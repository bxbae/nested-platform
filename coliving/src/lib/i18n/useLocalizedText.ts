"use client";

import { useEffect, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  translateText,
  type TranslationLanguage,
} from "@/lib/api/translations";

const translationCache = new Map<string, string>();

const pendingTranslations = new Map<string, Promise<string>>();

function detectLanguage(text: string): TranslationLanguage | null {
  // 한글이 포함돼 있으면 한국어 문장으로 판단합니다.
  if (/[가-힣]/.test(text)) {
    return "ko";
  }

  // 영문자가 포함돼 있으면 영어 문장으로 판단합니다.
  if (/[A-Za-z]/.test(text)) {
    return "en";
  }

  // 숫자와 특수문자만 있는 내용은 번역하지 않습니다.
  return null;
}

function createCacheKey(
  text: string,
  sourceLanguage: TranslationLanguage,
  targetLanguage: TranslationLanguage,
) {
  return `${sourceLanguage}:${targetLanguage}:${text}`;
}

async function requestTranslation(
  text: string,
  sourceLanguage: TranslationLanguage,
  targetLanguage: TranslationLanguage,
): Promise<string> {
  const cacheKey = createCacheKey(text, sourceLanguage, targetLanguage);

  const cachedTranslation = translationCache.get(cacheKey);

  if (cachedTranslation) {
    return cachedTranslation;
  }

  const pendingTranslation = pendingTranslations.get(cacheKey);

  if (pendingTranslation) {
    return pendingTranslation;
  }

  const translationPromise = translateText({
    text,
    sourceLanguage,
    targetLanguage,
  })
    .then((result) => {
      translationCache.set(cacheKey, result.translatedText);

      return result.translatedText;
    })
    .finally(() => {
      pendingTranslations.delete(cacheKey);
    });

  pendingTranslations.set(cacheKey, translationPromise);

  return translationPromise;
}

export function useLocalizedText(originalText: string, enabled = true) {
  const { locale } = useLanguage();

  const [displayText, setDisplayText] = useState(originalText);

  const [translating, setTranslating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const sourceLanguage = detectLanguage(originalText);

    const targetLanguage: TranslationLanguage = locale;

    setError(null);

    // 번역할 문자가 없거나 기능이 비활성화된 경우 원문 표시
    if (!enabled || !originalText.trim() || !sourceLanguage) {
      setDisplayText(originalText);
      setTranslating(false);

      return () => {
        cancelled = true;
      };
    }

    // 원문의 언어와 선택 언어가 같으면 원문 표시
    if (sourceLanguage === targetLanguage) {
      setDisplayText(originalText);
      setTranslating(false);

      return () => {
        cancelled = true;
      };
    }

    const cacheKey = createCacheKey(
      originalText,
      sourceLanguage,
      targetLanguage,
    );

    const cachedTranslation = translationCache.get(cacheKey);

    if (cachedTranslation) {
      setDisplayText(cachedTranslation);
      setTranslating(false);

      return () => {
        cancelled = true;
      };
    }

    setDisplayText(originalText);
    setTranslating(true);

    requestTranslation(originalText, sourceLanguage, targetLanguage)
      .then((translatedText) => {
        if (cancelled) return;

        setDisplayText(translatedText);
      })
      .catch((translationError: unknown) => {
        if (cancelled) return;

        setDisplayText(originalText);

        setError(
          translationError instanceof Error
            ? translationError.message
            : "번역에 실패했습니다.",
        );
      })
      .finally(() => {
        if (cancelled) return;

        setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, locale, originalText]);

  return {
    text: displayText,
    translating,
    error,
  };
}

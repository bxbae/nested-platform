"use client";

import { useState } from "react";
import { useLanguage, type Locale } from "@/contexts/LanguageContext";
import { useAuth } from "@/lib/api/useAuth";
import { updatePreferredLocale } from "@/lib/api/auth";

const LANGUAGES: {
  value: Locale;
  label: string;
}[] = [
  { value: "ko", label: "KO" },
  { value: "en", label: "EN" },
];

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  async function selectLanguage(nextLocale: Locale) {
    if (nextLocale === locale || saving) return;

    const previousLocale = locale;

    // 화면은 즉시 변경한다.
    setLocale(nextLocale);

    // 비로그인 사용자는 localStorage에만 저장한다.
    if (!user) return;

    setSaving(true);

    try {
      await updatePreferredLocale(nextLocale === "ko" ? "KO" : "EN");
    } catch (error) {
      // 서버 저장 실패 시 기존 언어로 되돌린다.
      setLocale(previousLocale);
      console.error("언어 설정 저장에 실패했습니다.", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="group"
      aria-label="언어 선택"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: 3,
        border: "1px solid var(--border)",
        borderRadius: 999,
        background: "var(--bg-2)",
      }}
    >
      {LANGUAGES.map((language) => {
        const active = locale === language.value;

        return (
          <button
            type="button"
            key={language.value}
            onClick={() => void selectLanguage(language.value)}
            disabled={saving}
            aria-pressed={active}
            style={{
              minWidth: 34,
              height: 28,
              padding: "0 8px",
              border: "none",
              borderRadius: 999,
              background: active ? "var(--surface, #fff)" : "transparent",
              color: active ? "var(--text)" : "var(--text-2)",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              fontSize: 11.5,
              fontWeight: active ? 700 : 500,
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}

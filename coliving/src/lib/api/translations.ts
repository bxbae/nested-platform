import { api } from "./client";

export type TranslationLanguage = "ko" | "en";

export interface TranslationRequest {
  text: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
}

export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
}

export async function translateText(
  request: TranslationRequest,
): Promise<TranslationResponse> {
  const text = request.text.trim();

  if (!text) {
    throw new Error("번역할 내용을 입력해주세요.");
  }

  return api.post<TranslationResponse>("/translations", {
    ...request,
    text,
  });
}

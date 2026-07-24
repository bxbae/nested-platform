import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

export type TranslationLanguage = "ko" | "en";

interface TranslatorResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
}

@Injectable()
export class TranslationsService {
  private readonly translatorUrl = (
    process.env.TRANSLATOR_URL ?? "http://localhost:8000"
  ).replace(/\/$/, "");

  async translate(
    text: string,
    sourceLanguage: TranslationLanguage,
    targetLanguage: TranslationLanguage,
  ): Promise<TranslatorResponse> {
    if (sourceLanguage === targetLanguage) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
      };
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 120_000);

    try {
      const response = await fetch(`${this.translatorUrl}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          text,
          sourceLanguage,
          targetLanguage,
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new BadGatewayException({
          code: "TRANSLATOR_REQUEST_FAILED",
          message: "번역 서버가 요청을 처리하지 못했습니다.",
          translatorStatus: response.status,
        });
      }

      let result: unknown;

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new BadGatewayException({
          code: "INVALID_TRANSLATOR_RESPONSE",
          message: "번역 서버가 올바르지 않은 응답을 반환했습니다.",
        });
      }

      if (
        !result ||
        typeof result !== "object" ||
        !("translatedText" in result) ||
        typeof result.translatedText !== "string" ||
        !result.translatedText.trim()
      ) {
        throw new BadGatewayException({
          code: "EMPTY_TRANSLATION_RESULT",
          message: "번역 결과가 비어 있습니다.",
        });
      }

      return {
        originalText: text,
        translatedText: result.translatedText.trim(),
        sourceLanguage,
        targetLanguage,
      };
    } catch (error: unknown) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceUnavailableException({
          code: "TRANSLATOR_TIMEOUT",
          message: "번역 서버의 응답 시간이 초과되었습니다.",
        });
      }

      throw new ServiceUnavailableException({
        code: "TRANSLATOR_UNAVAILABLE",
        message: "현재 번역 서비스를 사용할 수 없습니다.",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

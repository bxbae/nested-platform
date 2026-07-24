import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/auth.guards";
import {
  type TranslationLanguage,
  TranslationsService,
} from "./translations.service";

interface TranslationRequestBody {
  text?: unknown;
  sourceLanguage?: unknown;
  targetLanguage?: unknown;
}

@Controller("translations")
@UseGuards(JwtAuthGuard)
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Post()
  async translate(@Body() body: TranslationRequestBody) {
    if (typeof body.text !== "string" || !body.text.trim()) {
      throw new BadRequestException({
        code: "INVALID_TRANSLATION_TEXT",
        message: "번역할 내용을 입력해주세요.",
      });
    }

    const text = body.text.trim();

    if (text.length > 5000) {
      throw new BadRequestException({
        code: "TRANSLATION_TEXT_TOO_LONG",
        message: "번역할 내용은 5,000자 이하여야 합니다.",
      });
    }

    const sourceLanguage = this.parseLanguage(
      body.sourceLanguage,
      "sourceLanguage",
    );

    const targetLanguage = this.parseLanguage(
      body.targetLanguage,
      "targetLanguage",
    );

    return this.translationsService.translate(
      text,
      sourceLanguage,
      targetLanguage,
    );
  }

  private parseLanguage(
    value: unknown,
    fieldName: string,
  ): TranslationLanguage {
    if (value !== "ko" && value !== "en") {
      throw new BadRequestException({
        code: "INVALID_TRANSLATION_LANGUAGE",
        message: `${fieldName}는 ko 또는 en이어야 합니다.`,
      });
    }

    return value;
  }
}

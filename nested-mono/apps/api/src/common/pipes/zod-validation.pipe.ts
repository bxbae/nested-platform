import { PipeTransform, BadRequestException } from "@nestjs/common";
import { ZodSchema } from "zod";

// Validates request bodies against a Zod schema and returns a 400 with a
// structured error payload. Used per-route: @Body(new ZodValidationPipe(schema)).
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "요청 값이 올바르지 않습니다.",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}

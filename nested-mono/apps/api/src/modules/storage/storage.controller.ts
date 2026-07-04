import { Controller, Post, Body, Delete, Param, UseGuards, HttpCode } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { z } from "zod";
import { StorageService } from "./storage.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

const presignSchema = z.object({
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  prefix: z.enum(["rooms", "avatars", "chat"]).optional(),
});

@Controller("storage")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  // POST /storage/presign → { uploadUrl, key, cdnUrl }
  // Client then PUTs the file to uploadUrl and keeps `key`/`cdnUrl`.
  @Post("presign")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  presign(@Body(new ZodValidationPipe(presignSchema)) dto: z.infer<typeof presignSchema>) {
    return this.storage.createUploadUrl(dto);
  }

  @Delete(":key")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("key") key: string) {
    await this.storage.remove(decodeURIComponent(key));
    return { ok: true };
  }
}

@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

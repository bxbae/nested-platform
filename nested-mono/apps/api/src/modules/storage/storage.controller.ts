import { Controller, Post, Body, Delete, Param, UseGuards, HttpCode } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { z } from "zod";
import { StorageService } from "./storage.service";
import { CloudinaryService } from "./cloudinary.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

const presignSchema = z.object({
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  prefix: z.enum(["rooms", "avatars", "chat"]).optional(),
});

const cloudinarySchema = z.object({
  folder: z.enum(["rooms", "avatars", "chat", "banners"]).default("rooms"),
});

@Controller("storage")
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // POST /storage/presign → { uploadUrl, key, cdnUrl }
  // Client then PUTs the file to uploadUrl and keeps `key`/`cdnUrl`.
  @Post("presign")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  presign(@Body(new ZodValidationPipe(presignSchema)) dto: z.infer<typeof presignSchema>) {
    return this.storage.createUploadUrl(dto);
  }

  // POST /storage/cloudinary-signature → params the browser needs to upload
  // directly to Cloudinary. The API secret never leaves the server.
  @Post("cloudinary-signature")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  cloudinarySignature(
    @Body(new ZodValidationPipe(cloudinarySchema)) dto: z.infer<typeof cloudinarySchema>,
  ) {
    return this.cloudinary.sign({ folder: dto.folder });
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
  providers: [StorageService, CloudinaryService],
  exports: [StorageService, CloudinaryService],
})
export class StorageModule {}

import { Injectable, BadRequestException } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSignedUrl as getCfSignedUrl } from "@aws-sdk/cloudfront-signer";
import { randomUUID } from "crypto";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// Handles image storage on S3 and delivery via CloudFront.
//
// Upload flow (direct-to-S3, keeps large files off the API):
//   1. client asks POST /storage/presign  → we return a presigned PUT URL + key
//   2. client PUTs the file straight to S3 using that URL
//   3. client sends the returned key back with the listing/message create call
//   4. reads are served from the CloudFront CDN domain, not S3 directly
@Injectable()
export class StorageService {
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-northeast-2" });
  private readonly bucket = process.env.S3_BUCKET ?? "nested-uploads";
  private get cdnDomain(): string {
    return process.env.CLOUDFRONT_DOMAIN ?? "";
  }

  // ── 1. Presigned PUT URL for direct browser → S3 upload ──
  async createUploadUrl(params: {
    contentType: string;
    sizeBytes: number;
    prefix?: "rooms" | "avatars" | "chat";
  }): Promise<{ uploadUrl: string; key: string; cdnUrl: string }> {
    if (!ALLOWED.has(params.contentType)) {
      throw new BadRequestException("지원하지 않는 이미지 형식입니다.");
    }
    if (params.sizeBytes > MAX_BYTES) {
      throw new BadRequestException("이미지는 10MB 이하여야 합니다.");
    }

    const ext = params.contentType.split("/")[1];
    const key = `${params.prefix ?? "rooms"}/${new Date().getFullYear()}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.contentType,
      // never public-read: bucket is private, CloudFront (OAC) reads it
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 }); // 5 min

    return { uploadUrl, key, cdnUrl: this.cdnUrl(key) };
  }

  // ── 2. CloudFront URL for a stored key (public assets) ──
  cdnUrl(key: string): string {
    return `https://${this.cdnDomain}/${key}`;
  }

  // ── 3. Signed CloudFront URL for private/expiring content ──
  signedCdnUrl(key: string, ttlSeconds = 3600): string {
    const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
    const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY;
    if (!keyPairId || !privateKey) return this.cdnUrl(key); // fall back to public
    return getCfSignedUrl({
      url: this.cdnUrl(key),
      keyPairId,
      privateKey,
      dateLessThan: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    });
  }

  // ── delete (e.g. when a listing image is removed) ──
  async remove(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

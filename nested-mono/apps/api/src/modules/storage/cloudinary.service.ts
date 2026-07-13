import { Injectable, BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";

// Signed direct-to-Cloudinary uploads.
//
// Same shape as the S3 presign flow: the browser never sees the API secret, and
// the file never passes through our API.
//
//   1. client asks POST /storage/cloudinary-signature
//   2. we return a signature + the public params it must send
//   3. client POSTs the file straight to Cloudinary with those params
//   4. Cloudinary returns a secure_url, which the client stores on the listing
//
// Unsigned uploads would be simpler but let anyone with the preset name dump
// files into the account, so we sign.
@Injectable()
export class CloudinaryService {
  private get cloudName(): string {
    return process.env.CLOUDINARY_CLOUD_NAME ?? "";
  }
  private get apiKey(): string {
    return process.env.CLOUDINARY_API_KEY ?? "";
  }
  private get apiSecret(): string {
    return process.env.CLOUDINARY_API_SECRET ?? "";
  }

  get configured(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  // Cloudinary signs the SHA-1 of the alphabetically-sorted params plus the
  // API secret. Any param the client sends that isn't in this string will be
  // rejected, which is what stops it from overriding the folder.
  sign(params: { folder: string }): {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
    uploadUrl: string;
  } {
    if (!this.configured) {
      throw new BadRequestException({
        code: "STORAGE_NOT_CONFIGURED",
        message: "이미지 업로드가 아직 설정되지 않았어요. 이미지 URL을 붙여넣어 주세요.",
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=${params.folder}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = createHash("sha1").update(toSign).digest("hex");

    return {
      signature,
      timestamp,
      apiKey: this.apiKey,
      cloudName: this.cloudName,
      folder: params.folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
    };
  }
}

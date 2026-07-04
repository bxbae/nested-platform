import { StorageService } from "../storage.service";
import { BadRequestException } from "@nestjs/common";

// These test the pure validation + URL logic. The AWS SDK calls in
// createUploadUrl's presign step require credentials, so we test the guards
// and the CDN URL construction which run before any network call.
describe("StorageService", () => {
  const svc = new StorageService();

  beforeAll(() => {
    process.env.CLOUDFRONT_DOMAIN = "cdn.nested.kr";
    process.env.S3_BUCKET = "nested-uploads";
  });

  it("builds a CloudFront URL from a key", () => {
    expect(svc.cdnUrl("rooms/2026/abc.jpg")).toBe("https://cdn.nested.kr/rooms/2026/abc.jpg");
  });

  it("rejects unsupported content types", async () => {
    await expect(
      svc.createUploadUrl({ contentType: "application/pdf", sizeBytes: 1000 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects files over 10MB", async () => {
    await expect(
      svc.createUploadUrl({ contentType: "image/png", sizeBytes: 11 * 1024 * 1024 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("falls back to a public CDN URL when no signing key is configured", () => {
    delete process.env.CLOUDFRONT_KEY_PAIR_ID;
    delete process.env.CLOUDFRONT_PRIVATE_KEY;
    expect(svc.signedCdnUrl("chat/2026/x.webp")).toBe("https://cdn.nested.kr/chat/2026/x.webp");
  });
});

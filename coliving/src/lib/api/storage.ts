// ── Storage service ──────────────────────────────────────────────────
// Direct-to-S3 upload via a presigned URL: ask the API for a short-lived
// upload URL, PUT the file straight to S3, then keep the CDN URL. The file
// never passes through our API, which keeps large uploads off the server.
//
// Requires AWS to be configured on the API (bucket + credentials + CloudFront).
// Until then presign returns an error and the caller should fall back to
// pasting an image URL.

import { api } from "./client";

interface PresignResponse {
  uploadUrl: string; // short-lived S3 PUT URL
  key: string; // object key in the bucket
  cdnUrl: string; // public CloudFront URL to store on the room
}

const MAX_BYTES = 10 * 1024 * 1024; // API rejects anything larger
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function uploadImage(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("JPG, PNG, WebP, AVIF 형식만 올릴 수 있어요.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("이미지는 10MB 이하여야 해요.");
  }

  const { uploadUrl, cdnUrl } = await api.post<PresignResponse>("/storage/presign", {
    contentType: file.type,
    sizeBytes: file.size,
    prefix: "rooms",
  });

  // Straight to S3 — no auth header here; the signature is in the URL.
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) {
    throw new Error("이미지 업로드에 실패했어요.");
  }

  return cdnUrl;
}

// ── Storage service ──────────────────────────────────────────────────
// Signed direct-to-Cloudinary upload:
//   1. ask our API to sign the upload (the API secret stays server-side)
//   2. POST the file straight to Cloudinary with that signature
//   3. keep the returned secure_url and store it on the listing
//
// The file never passes through our API, which keeps large uploads off the
// server. If storage isn't configured yet the API says so and the caller falls
// back to pasting an image URL.

import { api } from "./client";

interface CloudinarySignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadUrl: string;
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function uploadImage(
  file: File,
  folder: "rooms" | "avatars" | "chat" = "rooms",
): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("JPG, PNG, WebP, AVIF 형식만 올릴 수 있어요.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("이미지는 10MB 이하여야 해요.");
  }

  const sig = await api.post<CloudinarySignature>("/storage/cloudinary-signature", {
    folder,
  });

  // Only the params that were signed may be sent — Cloudinary rejects the
  // upload otherwise.
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const res = await fetch(sig.uploadUrl, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error("이미지 업로드에 실패했어요.");
  }

  const data = (await res.json()) as CloudinaryUploadResponse;
  return data.secure_url;
}

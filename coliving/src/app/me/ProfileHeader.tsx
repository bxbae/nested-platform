"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { currentUser } from "@/lib/me";
import { useAuth } from "@/lib/api/useAuth";
import { updateProfile } from "@/lib/api/auth";
import { uploadImage } from "@/lib/api/storage";

export function ProfileHeader() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUrlInput, setNeedsUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  const name = user?.name || currentUser.name;
  const email = user?.email || currentUser.email;
  const role =
    user?.role === "HOST" ? "호스트" : user ? "게스트" : currentUser.role;
  const initial = name.trim()[0] ?? "N";
  const joinYear = user?.createdAt
    ? new Date(user.createdAt).getFullYear()
    : currentUser.joined;
  const bio: string | null = user?.bio ?? null;
  const avatarUrl = user?.avatarUrl;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    setNeedsUrlInput(false);
    try {
      const url = await uploadImage(file);
      await updateProfile({ avatarUrl: url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "사진을 올리지 못했어요.";
      setError(msg);
      // Storage isn't configured server-side yet — offer the URL fallback
      // instead of a dead end.
      if (msg.includes("URL")) setNeedsUrlInput(true);
    } finally {
      setUploading(false);
    }
  }

  async function saveManualUrl() {
    if (!manualUrl.trim() || !user) return;
    setUploading(true);
    setError(null);
    try {
      await updateProfile({ avatarUrl: manualUrl.trim() });
      setNeedsUrlInput(false);
      setManualUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 26, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`${name}의 프로필 사진`}
            style={{ width: 72, height: 72, borderRadius: 99, objectFit: "cover", display: "block" }}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: 72, height: 72, borderRadius: 99,
              background: currentUser.avatarColor,
              display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 28,
            }}
          >
            {initial}
          </span>
        )}

        {user && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="프로필 사진 변경"
              className="press"
              style={{
                position: "absolute", bottom: -2, right: -2,
                width: 26, height: 26, borderRadius: 99,
                background: "var(--surface)", border: "1px solid var(--border)",
                display: "grid", placeItems: "center", fontSize: 13, cursor: "pointer",
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "…" : "📷"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 20 }}>{name}</strong>
          <span className="chip" style={{ fontSize: 12 }}>{role}</span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4 }}>
          {joinYear}년 가입 · {email}
        </div>
        <p
          style={{
            fontSize: 14,
            color: user && !bio ? "var(--text-2)" : "var(--text)",
            marginTop: 10,
          }}
        >
          {user ? (bio ?? "아직 자기소개가 없어요. 프로필 수정에서 추가해보세요.") : currentUser.bio}
        </p>

        {error && <p style={{ fontSize: 12.5, color: "var(--primary)", marginTop: 6 }}>{error}</p>}

        {needsUrlInput && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, maxWidth: 420 }}>
            <input
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://... 이미지 주소"
              style={{
                flex: 1, padding: "8px 11px", fontSize: 13,
                border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
                background: "var(--surface)", color: "var(--text)",
              }}
            />
            <button
              type="button"
              className="btn btn-primary press"
              onClick={saveManualUrl}
              disabled={uploading || !manualUrl.trim()}
              style={{ fontSize: 13, padding: "8px 14px" }}
            >
              저장
            </button>
          </div>
        )}
      </div>
      <Link href="/me/settings" className="btn btn-ghost press">프로필 수정</Link>
    </div>
  );
}
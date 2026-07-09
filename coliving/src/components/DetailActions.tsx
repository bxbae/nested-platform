"use client";

import { useState, useEffect } from "react";
import { addFavorite, removeFavorite, listFavoriteIds } from "@/lib/api/favorites";
import { USE_REAL_API } from "@/lib/api/config";

// Share + wishlist actions shown in the detail header (matches mockup's
// 공유하기 / 찜하기). Share uses the Web Share API with a clipboard fallback.
// 찜하기 persists to the backend /favorites when logged in.
export function DetailActions({ title, roomId }: { title: string; roomId: string }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

  // Reflect the current saved state on mount (real API only).
  useEffect(() => {
    if (!USE_REAL_API) return;
    listFavoriteIds()
      .then((ids) => setSaved(ids.includes(roomId)))
      .catch(() => {});
  }, [roomId]);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        flash("링크가 복사되었습니다");
      }
    } catch {
      /* user cancelled share sheet */
    }
  };

  const toggleSave = async () => {
    if (busy) return;
    const next = !saved;
    setSaved(next); // optimistic
    setBusy(true);
    try {
      if (next) await addFavorite(roomId);
      else await removeFavorite(roomId);
      flash(next ? "찜 목록에 저장했습니다" : "찜을 해제했습니다");
    } catch (e) {
      setSaved(!next); // revert on failure
      const msg = (e as Error)?.message ?? "";
      flash(msg.includes("401") || msg.includes("인증") ? "로그인이 필요합니다" : "잠시 후 다시 시도해주세요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        onClick={share}
        className="press"
        style={actionStyle}
      >
        <span aria-hidden="true">↗</span> 공유하기
      </button>
      <button
        onClick={toggleSave}
        className="press"
        aria-pressed={saved}
        style={actionStyle}
      >
        <span aria-hidden="true" style={{ color: saved ? "var(--primary)" : "inherit" }}>
          {saved ? "♥" : "♡"}
        </span>{" "}
        찜하기
      </button>

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--text)",
            color: "var(--bg)",
            padding: "12px 20px",
            borderRadius: 999,
            fontSize: 14,
            zIndex: 300,
            boxShadow: "var(--shadow-lg)",
            animation: "fadeIn .2s ease",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

const actionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  color: "var(--text)",
  padding: "6px 8px",
};

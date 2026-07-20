"use client";

import { useState } from "react";
import { useFavorite } from "@/lib/api/useFavorites";

// Share + wishlist actions shown in the detail header (matches mockup's
// 공유하기 / 찜하기). Share uses the Web Share API with a clipboard fallback.
// 찜하기 persists to the backend /favorites when logged in.
export function DetailActions({ title, roomId }: { title: string; roomId: string }) {
  // 검색 카드와 같은 스토어를 쓴다 — 한쪽에서 찜하면 다른 쪽도 즉시 반영된다.
  const { saved, toggle } = useFavorite(roomId);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

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
    setBusy(true);
    const res = await toggle();
    setBusy(false);
    if (res.ok) {
      flash(res.saved ? "찜 목록에 저장했습니다" : "찜을 해제했습니다");
    } else {
      flash(res.reason === "auth" ? "로그인이 필요합니다" : "잠시 후 다시 시도해주세요");
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

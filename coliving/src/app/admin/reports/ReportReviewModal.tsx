"use client";

// 신고 관리 화면 전용 — 신고된 리뷰의 본문·평점·작성일·어느 숙소인지를
// 관리자가 한 번에 확인할 수 있는 모달. ReportChatModal.tsx와 같은
// 오버레이/패널 스타일을 쓴다. reportContext() 응답에 이미 다 들어있어서
// (MESSAGE의 "채팅 보기"처럼) 별도 fetch 없이 그대로 그려준다.

import { useEffect, type CSSProperties } from "react";
import type { ReportedReview } from "@/lib/api/admin";

interface ReportReviewModalProps {
  review: ReportedReview | null;
  onClose: () => void;
}

export default function ReportReviewModal({ review, onClose }: ReportReviewModalProps) {
  useEffect(() => {
    if (!review) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = original;
    };
  }, [review, onClose]);

  if (!review) return null;

  return (
    <div role="presentation" style={overlayStyle} onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="신고된 리뷰 보기"
        style={modalStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="닫기" onClick={onClose} style={closeButtonStyle}>
          ×
        </button>

        <h2 style={{ fontSize: 18, marginBottom: 4 }}>신고된 리뷰</h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
          {review.room.name}
        </p>

        <div className="card" style={{ padding: "14px 16px", borderColor: "var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-2)" }}>
              {new Date(review.createdAt).toLocaleString("ko-KR")}
            </span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>{review.body}</p>
        </div>

        <a
          href={`/homes/${review.room.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block", marginTop: 14, fontSize: 13, color: "var(--secondary)" }}
        >
          숙소 페이지에서 보기 →
        </a>
      </section>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  padding: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(20, 24, 32, 0.44)",
};

const modalStyle: CSSProperties = {
  position: "relative",
  width: "min(480px, 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  padding: 28,
  borderRadius: 22,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.18)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 14,
  right: 16,
  width: 38,
  height: 38,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 27,
  cursor: "pointer",
};

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useEffect } from "react";
import { reportReview } from "@/lib/api/reports";
import { useAuth } from "@/lib/api/useAuth";

// 리뷰 신고 버튼 + 팝업. me/messages/page.tsx의 메시지 신고 팝업(ReportMessageModal)과
// 완전히 같은 흐름이다 — 백엔드가 Report(targetType=REVIEW)로 저장하고,
// 관리자는 /admin/reports 화면에서 그대로 조회·처리한다.
//
// authorId가 없거나(demo fallback 리뷰) 로그인한 본인의 리뷰면 버튼 자체를
// 안 그린다 — 백엔드도 자기 리뷰 신고를 403으로 막지만(reports.module.ts
// reportedUserId), 여기서 먼저 숨기는 게 UX상 더 자연스럽다.
export function ReviewReportButton({
  reviewId,
  authorId,
}: {
  reviewId: string;
  authorId?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!authorId || user?.id === authorId) return null;

  function openModal() {
    setOpen(true);
    setReason("");
    setError(null);
    setDone(false);
  }

  function closeModal() {
    if (submitting) return;
    setOpen(false);
  }

  async function submit() {
    if (submitting) return;
    if (!reason.trim()) {
      setError("신고 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reportReview(reviewId, reason.trim());
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "신고 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="리뷰 신고"
        title="신고"
        onClick={openModal}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          color: "var(--text-2)",
          fontSize: 11.5,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        신고
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            onClick={closeModal}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 380,
                background: "var(--surface, #fff)",
                border: "1px solid var(--border, #ebebeb)",
                borderRadius: 20,
                padding: 24,
                boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              }}
            >
              {done ? (
                <>
                  <strong style={{ display: "block", fontSize: 16, marginBottom: 8 }}>
                    신고가 접수됐어요
                  </strong>
                  <p style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 20 }}>
                    운영팀이 확인 후 처리할게요. 신고해주셔서 감사합니다.
                  </p>
                  <button className="btn btn-primary press" onClick={closeModal} style={{ width: "100%" }}>
                    확인
                  </button>
                </>
              ) : (
                <>
                  <strong style={{ display: "block", fontSize: 16, marginBottom: 4 }}>리뷰 신고</strong>
                  <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14 }}>
                    신고 사유를 알려주시면 운영팀이 확인 후 조치할게요.
                  </p>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="예: 허위 리뷰, 욕설·비방, 광고 등"
                    rows={4}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 14,
                      fontFamily: "inherit",
                    }}
                  />
                  {error && (
                    <p style={{ fontSize: 12.5, color: "var(--primary)", marginTop: 8 }}>{error}</p>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button
                      type="button"
                      className="btn btn-ghost press"
                      onClick={closeModal}
                      disabled={submitting}
                      style={{ flex: 1 }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary press"
                      onClick={submit}
                      disabled={submitting || !reason.trim()}
                      style={{ flex: 1 }}
                    >
                      {submitting ? "접수 중…" : "신고하기"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/api/useAuth";
import { createReview } from "@/lib/api/reviews";

// Guest-facing review composer on the listing detail page. Without this there's
// no way to create a review from the UI, so every freshly seeded room would sit
// at ★0 forever. Posts to POST /reviews (JWT-guarded); the server derives the
// author from the token. After a successful post we refresh the route so the
// server component re-fetches and the new review + updated average appear.
export function ReviewForm({ roomId }: { roomId: string }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Not logged in: send them to the auth modal rather than showing a form that
  // would only 401 on submit.
  if (!isAuthenticated) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 12 }}>
          이 숙소에 후기를 남기려면 로그인이 필요해요.
        </p>
        <button
          className="btn btn-ghost press"
          onClick={() => router.push("/?auth=1")}
        >
          로그인하고 후기 쓰기
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <p style={{ fontSize: 14, color: "var(--text)" }}>
          후기를 남겨주셔서 감사해요! ★{rating} 평가가 반영됐습니다.
        </p>
      </div>
    );
  }

  async function submit() {
    if (busy) return;
    if (rating < 1) {
      setError("별점을 선택해주세요.");
      return;
    }
    if (body.trim().length === 0) {
      setError("후기 내용을 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createReview({ roomId, rating, body: body.trim() });
      setDone(true);
      // Re-fetch the server component so the new review and recalculated
      // average rating show up immediately.
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "후기를 등록하지 못했어요. 잠시 후 다시 시도해주세요."
      );
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <strong style={{ fontSize: 15 }}>후기 남기기</strong>

      {/* Star picker */}
      <div
        style={{ display: "flex", gap: 4, marginTop: 12, marginBottom: 12 }}
        role="radiogroup"
        aria-label="별점"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}점`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontSize: 26,
              lineHeight: 1,
              color: (hover || rating) >= n ? "#FF5A5F" : "var(--border)",
            }}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="이 숙소는 어땠나요? 방음, 위치, 청결 등 솔직한 후기를 남겨주세요."
        rows={4}
        style={{
          width: "100%",
          resize: "vertical",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          fontSize: 14,
          fontFamily: "inherit",
          lineHeight: 1.6,
        }}
      />

      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary press" onClick={submit} disabled={busy}>
          {busy ? "등록 중…" : "후기 등록"}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/api/useAuth";
import { listMyReviews, type MyReview } from "@/lib/api/reviews";

// 내가 작성한 리뷰 목록.
//
// 예전에는 lib/me 의 목업을 읽고 "수정" 버튼이 로컬 state 만 바꿨다 — 저장해도
// 서버에는 아무것도 가지 않아, 새로고침하면 되돌아갔다. 서버에 리뷰 수정
// API 가 없으므로 그 버튼은 뺐다. 있지도 않은 기능을 흉내 내기보다 실제
// 데이터를 정확히 보여주는 편이 낫다.
export default function MyReviews() {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let alive = true;
    listMyReviews()
      .then((rows) => {
        if (alive) setReviews(rows);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>내 리뷰</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        {loading ? "불러오는 중…" : `내가 작성한 후기 ${reviews.length}개`}
      </p>

      {!loading && !isAuthenticated && (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-2)", marginBottom: 16 }}>
            리뷰를 보려면 로그인이 필요해요.
          </p>
          <Link href="/?auth=1" className="btn btn-primary press">로그인</Link>
        </div>
      )}

      {!loading && isAuthenticated && reviews.length === 0 && (
        <div
          className="card"
          style={{
            padding: 40, textAlign: "center", color: "var(--text-2)",
            border: "1px dashed var(--border)", background: "transparent",
          }}
        >
          아직 작성한 리뷰가 없어요. 이용을 마친 숙소에 첫 후기를 남겨보세요.
        </div>
      )}

      {reviews.length > 0 && (
        <div style={{ display: "grid", gap: 14 }}>
          {reviews.map((r) => (
            <div key={r.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  {r.roomId ? (
                    <Link href={`/homes/${r.roomId}`}>
                      <strong style={{ fontSize: 15 }}>{r.roomName}</strong>
                    </Link>
                  ) : (
                    <strong style={{ fontSize: 15, color: "var(--text-2)" }}>{r.roomName}</strong>
                  )}
                  <div style={{ fontSize: 12.5, color: "var(--warning)", marginTop: 3 }}>
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                    <span style={{ color: "var(--text-2)", marginLeft: 6 }}>
                      {r.date}{r.region ? ` · ${r.region}` : ""}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 14, marginTop: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {r.body}
              </p>

              {r.hostReply && (
                <div
                  style={{
                    marginTop: 12, padding: 12, borderRadius: "var(--r-sm)",
                    background: "var(--bg-2)", fontSize: 13.5, lineHeight: 1.6,
                  }}
                >
                  <strong style={{ fontSize: 12.5, color: "var(--text-2)" }}>호스트 답글</strong>
                  <p style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{r.hostReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

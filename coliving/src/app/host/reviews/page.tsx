"use client";

import { useState } from "react";
import { hostReviews } from "@/lib/host";

export default function HostReviews() {
  const [reviews] = useState(() => hostReviews());
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [replied, setReplied] = useState<Record<number, string>>({});

  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>리뷰 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        받은 후기에 답글을 남기고 평판을 관리하세요.
      </p>

      <div className="card" style={{ padding: 18, marginBottom: 18, display: "flex", gap: 24, alignItems: "center" }}>
        <div>
          <div className="display" style={{ fontSize: 34, fontWeight: 700 }}>★ {avg}</div>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>후기 {reviews.length}개 평균</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {reviews.map((r, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span
                  aria-hidden="true"
                  style={{ width: 40, height: 40, borderRadius: 99, background: r.avatarColor, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 }}
                >
                  {r.author[0]}
                </span>
                <div>
                  <strong style={{ fontSize: 14.5 }}>{r.author}</strong>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                    {r.houseName} · {r.date}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--warning)" }}>
                {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
              </div>
            </div>

            <p style={{ fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>{r.body}</p>

            {replied[i] ? (
              <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg-2)", borderRadius: "var(--r-md)", borderLeft: "3px solid var(--secondary)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--secondary)", marginBottom: 4 }}>호스트 답글</div>
                <div style={{ fontSize: 13.5 }}>{replied[i]}</div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  value={replies[i] ?? ""}
                  onChange={(e) => setReplies((p) => ({ ...p, [i]: e.target.value }))}
                  placeholder="답글 남기기"
                  style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", fontSize: 13.5 }}
                />
                <button
                  className="btn btn-ghost press"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                  disabled={!replies[i]?.trim()}
                  onClick={() => setReplied((p) => ({ ...p, [i]: replies[i] }))}
                >
                  답글 등록
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { myReviews } from "@/lib/me";

export default function MyReviews() {
  const [reviews, setReviews] = useState(() => myReviews());
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>리뷰 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        내가 작성한 후기 {reviews.length}개
      </p>

      <div style={{ display: "grid", gap: 14 }}>
        {reviews.map((r, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <Link href={`/homes/${r.houseId}`}>
                  <strong style={{ fontSize: 15 }}>{r.houseName}</strong>
                </Link>
                <div style={{ fontSize: 12.5, color: "var(--warning)", marginTop: 3 }}>
                  {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  <span style={{ color: "var(--text-2)", marginLeft: 6 }}>{r.date}</span>
                </div>
              </div>
              {editing !== i && (
                <button
                  className="btn btn-ghost press"
                  style={{ fontSize: 13, padding: "6px 14px" }}
                  onClick={() => { setEditing(i); setDraft(r.body); }}
                >
                  수정
                </button>
              )}
            </div>

            {editing === i ? (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: 12, border: "1px solid var(--border)", borderRadius: "var(--r-sm)", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    className="btn btn-primary press"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                    onClick={() => {
                      setReviews((prev) => prev.map((x, j) => (j === i ? { ...x, body: draft } : x)));
                      setEditing(null);
                    }}
                  >
                    저장
                  </button>
                  <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => setEditing(null)}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>{r.body}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

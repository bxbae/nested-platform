"use client";

import { useEffect, useState } from "react";
import { listHostReviews, replyToReview, type HostReview } from "@/lib/api/reviews";

export default function HostReviews() {
  const [reviews, setReviews] = useState<HostReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setReviews(await listHostReviews());
      setLoading(false);
    })();
  }, []);

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  async function submitReply(id: string) {
    const text = drafts[id]?.trim();
    if (!text || busy) return;
    setBusy(id);
    setError(null);
    try {
      await replyToReview(id, text);
      // Reflect it locally rather than refetching the whole list.
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, hostReply: text } : r)));
      setDrafts((p) => ({ ...p, [id]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "답글을 등록하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>리뷰 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        받은 후기에 답글을 남기고 평판을 관리하세요.
      </p>

      <div className="card" style={{ padding: 18, marginBottom: 18, display: "flex", gap: 24, alignItems: "center" }}>
        <div>
          <div className="display" style={{ fontSize: 34, fontWeight: 700 }}>★ {avg}</div>
          <div style={{ fontSize: 13, color: "var(--text-2)" }}>
            {loading ? "불러오는 중…" : `후기 ${reviews.length}개 평균`}
          </div>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>
      )}

      {!loading && reviews.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          아직 받은 후기가 없어요.
          <div style={{ fontSize: 13.5, marginTop: 8 }}>
            게스트가 숙소에 후기를 남기면 여기에 표시됩니다.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {reviews.map((r) => (
            <div key={r.id} className="card" style={{ padding: 20 }}>
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

              {r.hostReply ? (
                <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg-2)", borderRadius: "var(--r-md)", borderLeft: "3px solid var(--secondary)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--secondary)", marginBottom: 4 }}>호스트 답글</div>
                  <div style={{ fontSize: 13.5 }}>{r.hostReply}</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input
                    value={drafts[r.id] ?? ""}
                    onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && submitReply(r.id)}
                    placeholder="답글 남기기"
                    style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", fontSize: 13.5 }}
                  />
                  <button
                    className="btn btn-ghost press"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                    disabled={!drafts[r.id]?.trim() || busy === r.id}
                    onClick={() => submitReply(r.id)}
                  >
                    {busy === r.id ? "등록 중…" : "답글 등록"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

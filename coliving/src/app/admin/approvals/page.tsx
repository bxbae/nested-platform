"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { getAccommodationLabel } from "@/lib/types";
import { Thumbnail } from "@/components/Thumbnail";
import {
  listPendingRooms,
  listPublishedRooms,
  publishRoom,
  rejectRoom,
  isLowRated,
  LOW_RATING_THRESHOLD,
  MIN_REVIEWS_FOR_WARNING,
  type PendingListing,
  type PublishedListing,
} from "@/lib/api/admin";

// 승인 대기 — the queue that gates a new listing into search. Rooms land here
// on creation (published=false) and only become visible to guests once approved.
export default function Approvals() {
  const [tab, setTab] = useState<"pending" | "live">("pending");
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [live, setLive] = useState<PublishedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [queue, published] = await Promise.all([
          listPendingRooms(),
          listPublishedRooms(),
        ]);
        setPending(queue);
        setLive(published);
      } catch (e) {
        setError(e instanceof Error ? e.message : "목록을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function approve(id: string) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await publishRoom(id, true);
      const target = pending.find((p) => p.id === id);
      setPending((prev) => prev.filter((p) => p.id !== id)); // drops out of the queue
      if (target) {
        setLive((prev) => [{ ...target, rating: 0, reviewCount: 0 }, ...prev]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "승인하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  // 게시 중단은 되돌릴 수 있지만 호스트 매출에 바로 영향을 주므로
  // 삭제와 마찬가지로 두 번 눌러야 실행됩니다.
  async function unpublish(id: string) {
    if (busy) return;
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusy(id);
    setError(null);
    try {
      await publishRoom(id, false);
      const target = live.find((r) => r.id === id);
      setLive((prev) => prev.filter((r) => r.id !== id));
      // 중단된 숙소는 승인 대기 목록으로 되돌아옵니다.
      if (target) setPending((prev) => [target, ...prev]);
      setConfirmId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "게시를 중단하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  // Rejecting deletes the listing for good, so make the admin confirm rather
  // than firing on a single stray click.
  async function reject(id: string) {
    if (busy) return;
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusy(id);
    setError(null);
    try {
      await rejectRoom(id);
      setPending((prev) => prev.filter((p) => p.id !== id));
      setConfirmId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>숙소 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 16 }}>
        등록된 매물을 검토하고 게시 여부를 관리하세요.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          ["pending", `승인 대기 ${pending.length}`],
          ["live", `게시중 ${live.length}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className="btn press"
            style={{
              fontSize: 13,
              padding: "8px 16px",
              background: tab === key ? "var(--text)" : "transparent",
              color: tab === key ? "var(--bg)" : "var(--text-2)",
              border: tab === key ? "none" : "1px solid var(--line)",
            }}
            onClick={() => {
              setTab(key);
              setConfirmId(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      ) : tab === "live" ? (
        live.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
            게시중인 숙소가 없어요.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {live.map((h) => {
              const flagged = isLowRated(h);
              return (
                <div
                  key={h.id}
                  className="card"
                  style={{
                    overflow: "hidden",
                    display: "flex",
                    flexWrap: "wrap",
                    borderColor: flagged ? "var(--warning)" : undefined,
                  }}
                >
                  <div style={{ width: 180, minWidth: 140, flex: "1 1 140px", maxWidth: 220 }}>
                    <Thumbnail src={h.photo} color={h.color} height="100%">
                      <div />
                    </Thumbnail>
                  </div>
                  <div style={{ flex: "3 1 320px", padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 16 }}>{h.name.trim()}</strong>
                        <span className="chip" style={{ fontSize: 11 }}>{getAccommodationLabel(h)}</span>
                        {flagged && (
                          <span
                            className="chip"
                            style={{ fontSize: 11, background: "var(--warning)", color: "#fff", border: "none" }}
                          >
                            별점 낮음
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 6 }}>
                        호스트 {h.hostName} · ★ {h.reviewCount ? h.rating.toFixed(1) : "—"} · 후기 {h.reviewCount}
                      </div>

                      {h.address && (
                        <div style={{ fontSize: 13, marginTop: 8, padding: "8px 12px", background: "var(--bg-2)", borderRadius: "var(--r-md)" }}>
                          <span style={{ color: "var(--text-2)" }}>주소 </span>
                          {h.address}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13, color: "var(--text-2)", flexWrap: "wrap" }}>
                        <span>월세 {won(h.monthlyRent)}</span>
                        <span>보증금 {won(h.deposit)}</span>
                      </div>

                      {flagged && (
                        <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10 }}>
                          후기 {MIN_REVIEWS_FOR_WARNING}건 이상이면서 평균 {LOW_RATING_THRESHOLD.toFixed(1)}점 미만입니다. 후기를 확인한 뒤 판단하세요.
                        </p>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                      <Link href={`/homes/${h.id}`} className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 14px", justifyContent: "center" }}>
                        미리보기
                      </Link>
                      <button
                        className="btn btn-ghost press"
                        style={{
                          fontSize: 13,
                          padding: "8px 14px",
                          justifyContent: "center",
                          color: confirmId === h.id ? "#fff" : "var(--primary)",
                          background: confirmId === h.id ? "var(--primary)" : undefined,
                          borderColor: "var(--primary)",
                        }}
                        onClick={() => unpublish(h.id)}
                        disabled={busy === h.id}
                      >
                        {busy === h.id ? "처리 중…" : confirmId === h.id ? "정말 중단할까요?" : "승인 취소"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : pending.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          승인 대기 중인 매물이 없어요.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {pending.map((h) => (
            <div key={h.id} className="card" style={{ overflow: "hidden", display: "flex", flexWrap: "wrap" }}>
              <div style={{ width: 180, minWidth: 140, flex: "1 1 140px", maxWidth: 220 }}>
                <Thumbnail src={h.photo} color={h.color} height="100%">
                  <div />
                </Thumbnail>
              </div>
              <div style={{ flex: "3 1 320px", padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16 }}>{h.name.trim()}</strong>
                    <span className="chip" style={{ fontSize: 11 }}>{getAccommodationLabel(h)}</span>
                    {h.verifiedByHost && (
                      <span
                        className="chip"
                        style={{ fontSize: 11, background: "var(--secondary)", color: "#fff", border: "none" }}
                      >
                        실매물 확인됨
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 6 }}>
                    호스트 {h.hostName} · 사진 {h.gallery?.length ?? 0}장
                  </div>

                  {/* The street address is the whole point of review — an admin
                      checks it against the listing before letting it go live. */}
                  {h.address && (
                    <div style={{ fontSize: 13, marginTop: 8, padding: "8px 12px", background: "var(--bg-2)", borderRadius: "var(--r-md)" }}>
                      <span style={{ color: "var(--text-2)" }}>주소 </span>
                      {h.address}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13, color: "var(--text-2)", flexWrap: "wrap" }}>
                    <span>월세 {won(h.monthlyRent)}</span>
                    <span>보증금 {won(h.deposit)}</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                  <Link href={`/homes/${h.id}`} className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 14px", justifyContent: "center" }}>
                    미리보기
                  </Link>
                  <button
                    className="btn btn-primary press"
                    style={{ fontSize: 13, padding: "8px 14px", justifyContent: "center" }}
                    onClick={() => approve(h.id)}
                    disabled={busy === h.id}
                  >
                    {busy === h.id ? "처리 중…" : "승인"}
                  </button>
                  <button
                    className="btn btn-ghost press"
                    style={{
                      fontSize: 13,
                      padding: "8px 14px",
                      justifyContent: "center",
                      color: confirmId === h.id ? "#fff" : "var(--primary)",
                      background: confirmId === h.id ? "var(--primary)" : undefined,
                      borderColor: "var(--primary)",
                    }}
                    onClick={() => reject(h.id)}
                    disabled={busy === h.id}
                  >
                    {confirmId === h.id ? "정말 삭제할까요?" : "거부"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { Thumbnail } from "@/components/Thumbnail";
import { listPendingRooms, publishRoom, rejectRoom, type PendingListing } from "@/lib/api/admin";

// 승인 대기 — the queue that gates a new listing into search. Rooms land here
// on creation (published=false) and only become visible to guests once approved.
export default function Approvals() {
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPending(await listPendingRooms());
      } catch (e) {
        setError(e instanceof Error ? e.message : "승인 대기 목록을 불러오지 못했어요.");
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
      setPending((prev) => prev.filter((p) => p.id !== id)); // drops out of the queue
    } catch (e) {
      setError(e instanceof Error ? e.message : "승인하지 못했어요.");
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
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>승인 대기</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        호스트가 등록한 매물을 검토하고 게시를 승인하세요.
      </p>

      {error && <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
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
                    <span className="chip" style={{ fontSize: 11 }}>{ROOM_TYPE_LABELS[h.roomType]}</span>
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
                  <Link href={`/homes/${h.id}`} className="btn btn-ghost press text-center" style={{ fontSize: 13, padding: "8px 14px" }}>
                    미리보기
                  </Link>
                  <button
                    className="btn btn-primary press text-center"
                    style={{ fontSize: 13, padding: "8px 14px" }}
                    onClick={() => approve(h.id)}
                    disabled={busy === h.id}
                  >
                    {busy === h.id ? "처리 중…" : "승인"}
                  </button>
                  <button
                    className="btn btn-ghost press text-center"
                    style={{
                      fontSize: 13,
                      padding: "8px 14px",
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

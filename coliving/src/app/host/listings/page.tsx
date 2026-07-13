"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { Thumbnail } from "@/components/Thumbnail";
import { listMyRooms, type HostListing } from "@/lib/api/rooms";

// 숙소 관리 — only *my* listings, and unlike search this includes rooms still
// waiting on admin approval. Previously this page showed every room in the DB
// and stamped "게시중" on all of them, so a host couldn't tell what was live.
export default function HostListings() {
  const [listings, setListings] = useState<HostListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setListings(await listMyRooms());
      } catch (e) {
        setError(e instanceof Error ? e.message : "숙소를 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>숙소 관리</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>등록한 숙소를 관리하고 수정하세요.</p>
        </div>
        <Link href="/host/listings/new" className="btn btn-primary press">+ 숙소 등록</Link>
      </div>

      {error && <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      ) : listings.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          아직 등록한 숙소가 없어요.
          <div style={{ fontSize: 13.5, marginTop: 8 }}>
            우측 상단의 “숙소 등록”으로 첫 매물을 올려보세요.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {listings.map((h) => (
            <div key={h.id} className="card" style={{ overflow: "hidden", display: "flex", flexWrap: "wrap" }}>
              <div style={{ width: 180, minWidth: 140, flex: "1 1 140px", maxWidth: 220 }}>
                <Thumbnail src={h.photo} color={h.color} height="100%">
                  <div />
                </Thumbnail>
              </div>
              <div style={{ flex: "3 1 300px", padding: 18, display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16 }}>{h.name.trim()}</strong>
                    <span className="chip" style={{ fontSize: 11 }}>{ROOM_TYPE_LABELS[h.roomType]}</span>
                    {h.published ? (
                      <span
                        className="chip"
                        style={{ fontSize: 11, background: "var(--secondary)", color: "#fff", border: "none" }}
                      >
                        게시중
                      </span>
                    ) : (
                      <span
                        className="chip"
                        style={{ fontSize: 11, background: "var(--warning)", color: "#fff", border: "none" }}
                      >
                        승인 대기
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4 }}>
                    {h.region} · ★ {h.rating} · 후기 {h.reviews}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "var(--text-2)", flexWrap: "wrap" }}>
                    <span>월세 {won(h.monthlyRent)}</span>
                    <span>보증금 {won(h.deposit)}</span>
                    <span>예약 {h.reservationCount}건</span>
                  </div>
                  {!h.published && (
                    <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10 }}>
                      관리자 승인 전까지는 검색 결과에 노출되지 않아요.
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                  <Link href={`/homes/${h.id}`} className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 14px" }}>
                    미리보기
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

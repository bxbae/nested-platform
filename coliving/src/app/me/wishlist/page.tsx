"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { wishlist } from "@/lib/me";
import { Thumbnail } from "@/components/Thumbnail";

export default function Wishlist() {
  const [items, setItems] = useState(() => wishlist());
  // Map each card's preview link to a real room id so clicks open a live
  // detail page instead of 404-ing on a demo id. Live rooms are round-robined.
  const [liveIds, setLiveIds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/houses")
      .then((r) => r.json())
      .then((d) => {
        const ids = (d.houses ?? []).map((h: { id: string }) => h.id);
        if (ids.length > 0) setLiveIds(ids);
      })
      .catch(() => {});
  }, []);

  const linkFor = (index: number, fallbackId: string) =>
    liveIds.length > 0 ? `/homes/${liveIds[index % liveIds.length]}` : `/homes/${fallbackId}`;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>찜 목록</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        저장한 숙소 {items.length}곳
      </p>

      {items.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          <p style={{ marginBottom: 16 }}>아직 찜한 숙소가 없어요.</p>
          <Link href="/search" className="btn btn-primary press">숙소 둘러보기</Link>
        </div>
      )}

      <div className="reco-grid">
        {items.map((h, i) => (
          <div key={h.id} className="card hover-card" style={{ overflow: "hidden", position: "relative" }}>
            {/* remove from wishlist */}
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== h.id))}
              aria-label="찜 해제"
              style={{
                position: "absolute", top: 10, right: 10, zIndex: 2,
                width: 32, height: 32, borderRadius: 99,
                background: "rgba(255,255,255,0.92)", color: "var(--primary)", fontSize: 16,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              ♥
            </button>
            <Link href={linkFor(i, h.id)}>
              <Thumbnail src={h.photo} color={h.color} height={160}>
                <div style={{ padding: 12, height: "100%", display: "flex", alignItems: "flex-start" }}>
                  <span className="chip glass" style={{ border: "none", color: "var(--text)", fontWeight: 600 }}>
                    {ROOM_TYPE_LABELS[h.roomType]}
                  </span>
                </div>
              </Thumbnail>
              <div style={{ padding: 15 }}>
                <strong style={{ fontSize: 15 }}>{h.name.trim()}</strong>
                <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
                  {h.region} · ★ {h.rating}
                </div>
                <div style={{ marginTop: 10, fontSize: 15 }}>
                  <strong>{won(h.monthlyRent)}</strong>
                  <span style={{ color: "var(--text-2)", fontSize: 13 }}> / 월</span>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

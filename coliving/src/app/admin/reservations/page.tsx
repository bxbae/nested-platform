"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import type { Booking } from "@/lib/types";

const STATUS = {
  hold: { label: "결제 대기", color: "var(--warning)" },
  paid: { label: "예약 확정", color: "var(--secondary)" },
  cancelled: { label: "취소됨", color: "var(--text-2)" },
} as const;

export default function AdminReservations() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "hold" | "paid" | "cancelled">("all");

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => {
        setBookings(d.bookings);
        setLoading(false);
      });
  }, []);

  const shown = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);
  const gmv = bookings.filter((b) => b.status === "paid").reduce((s, b) => s + b.totalDueNow, 0);

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>예약 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        전체 {bookings.length}건 · 확정 거래액 {won(gmv)}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {(["all", "hold", "paid", "cancelled"] as const).map((f) => (
          <button key={f} className="chip" data-active={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "전체" : STATUS[f].label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && shown.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          해당하는 예약이 없습니다.
        </div>
      )}

      {shown.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="admin-table-head" style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr" }}>
            <span>숙소</span><span>게스트</span><span>입주일</span><span>금액</span><span>상태</span>
          </div>
          {shown.map((b) => (
            <div key={b.id} className="admin-table-row" style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr" }}>
              <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.houseName.trim()}</span>
              <span style={{ fontSize: 13.5 }}>{b.guestName}</span>
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>{b.moveIn}</span>
              <span style={{ fontSize: 13.5 }}>{won(b.totalDueNow)}</span>
              <span>
                <span className="chip" style={{ fontSize: 11, background: STATUS[b.status].color, color: b.status === "cancelled" ? "var(--text-2)" : "#fff", border: "none" }}>
                  {STATUS[b.status].label}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

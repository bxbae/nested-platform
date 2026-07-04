"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { MY_HOUSE_IDS } from "@/lib/host";

const STATUS = {
  hold: { label: "결제 대기", color: "var(--warning)" },
  paid: { label: "예약 확정", color: "var(--secondary)" },
  cancelled: { label: "취소됨", color: "var(--text-2)" },
} as const;

export default function HostReservations() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "hold" | "paid" | "cancelled">("all");

  async function load() {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    // only reservations for my listings
    setBookings(data.bookings.filter((b: Booking) => MY_HOUSE_IDS.includes(b.houseId)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, status: "paid" | "cancelled") {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  const shown = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>예약 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>들어온 예약을 확인하고 승인하세요.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(["all", "hold", "paid", "cancelled"] as const).map((f) => (
          <button key={f} className="chip" data-active={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "전체" : STATUS[f].label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && shown.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          해당하는 예약이 없습니다. 게스트가 예약하면 여기에 표시됩니다.
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {shown.map((b) => {
          const st = STATUS[b.status];
          return (
            <div key={b.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontSize: 16 }}>{b.houseName.trim()}</strong>
                    <span className="chip" style={{ fontSize: 11, background: st.color, color: b.status === "cancelled" ? "var(--text-2)" : "#fff", border: "none" }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4 }}>
                    {b.guestName} · 입주 {b.moveIn} · {b.months}개월
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: 17 }}>{won(b.totalDueNow)}</strong>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>입주 시 결제</div>
                </div>
              </div>

              {b.status === "hold" && (
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn btn-primary press" style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => act(b.id, "paid")}>
                    예약 승인
                  </button>
                  <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => act(b.id, "cancelled")}>
                    거절
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

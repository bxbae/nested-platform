"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/types";
import { won } from "@/lib/format";

export function TripsList({ bare = false }: { bare?: boolean }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    setBookings(data.bookings);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(id: string) {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className={bare ? "" : "wrap"} style={bare ? {} : { paddingTop: 40, paddingBottom: 60, maxWidth: 780 }}>
      {!bare && (
        <>
          <span className="eyebrow">예약 내역</span>
          <h1 className="display" style={{ fontSize: 40, marginTop: 8, marginBottom: 24 }}>
            나의 예약
          </h1>
        </>
      )}
      {bare && (
        <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>예약 내역</h1>
      )}
      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && bookings.length === 0 && (
        <div
          className="card"
          style={{ padding: 40, textAlign: "center", border: "1px dashed var(--border)", background: "transparent" }}
        >
          <p style={{ color: "var(--text-2)", marginBottom: 16 }}>
            아직 예약이 없어요. 새로운 집을 찾아보세요.
          </p>
          <Link href="/browse" className="btn btn-primary">
            숙소 둘러보기
          </Link>
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {bookings.map((b) => {
          const dueNow = b.totalDueNow;
          const serviceFee = b.serviceFee;
          const cancelled = b.status === "cancelled";
          const held = b.status === "hold";
          const statusLabel = cancelled ? "취소됨" : held ? "결제 대기" : "예약 확정";
          const statusColor = cancelled
            ? "var(--border)"
            : held
            ? "var(--warning)"
            : "var(--secondary)";
          return (
            <div
              key={b.id}
              className="card"
              style={{ padding: 22, opacity: cancelled ? 0.55 : 1 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontSize: 18 }}>{b.houseName.trim()}</strong>
                    <span
                      className="chip"
                      style={{
                        background: statusColor,
                        color: cancelled ? "var(--text-2)" : "#fff",
                        border: "none",
                        fontSize: 11.5,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 4 }}>
                    입주 {b.moveIn} · {b.months}개월 · {b.guestName}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="display" style={{ fontSize: 22, fontWeight: 600 }}>
                    {won(dueNow)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>입주 시 결제</div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 20,
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border)",
                  fontSize: 13.5,
                  color: "var(--text-2)",
                  flexWrap: "wrap",
                }}
              >
                <span>월세 {won(b.monthlyRent)}</span>
                <span>보증금 {won(b.deposit)}</span>
                <span>청소비 {won(b.cleaningFee)}</span>
                <span>수수료 {won(serviceFee)}</span>
              </div>

              {!cancelled && (
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 14, fontSize: 13, padding: "8px 16px" }}
                  onClick={() => cancel(b.id)}
                >
                  예약 취소
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/types";
import { won } from "@/lib/format";
import { listMyBookings, cancelBooking, requestEarlyCheckout, requestExtension } from "@/lib/api/reservations";

export function TripsList({ bare = false }: { bare?: boolean }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await listMyBookings();
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function cancel(id: string) {
    // optimistic: mark cancelled locally, then persist
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
    try {
      await cancelBooking(id);
    } catch {
      /* revert by reloading the authoritative list */
    }
    load();
  }

  // Guest requests an early checkout on a confirmed reservation.
  async function requestEarly(id: string) {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, rawStatus: "EARLY_CHECKOUT_REQUESTED" } : b))
    );
    try {
      await requestEarlyCheckout(id);
    } catch {
      /* ignore; reload restores authoritative state */
    }
    load();
  }

  // Ask the host to extend the contract by N months.
  async function extend(id: string, months: number) {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, rawStatus: "EXTENSION_REQUESTED", extensionMonths: months } : b))
    );
    try {
      await requestExtension(id, months);
    } catch {
      /* ignore; reload restores authoritative state */
    }
    load();
  }

  // Days until the contract ends (null when unknown).
  function daysLeft(checkOut?: string): number | null {
    if (!checkOut) return null;
    const end = new Date(checkOut + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / 86400000);
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
                <>
                {/* Contract ending soon → prompt to extend (14 days out). */}
                {(() => {
                  const left = daysLeft(b.checkOut);
                  if (b.rawStatus !== "CONFIRMED" || left === null || left < 0 || left > 14) return null;
                  return (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "12px 14px",
                        borderRadius: "var(--r-sm)",
                        background: "var(--secondary-soft, #f2fbfa)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                        계약 종료까지 {left}일 남았습니다. 연장하시겠습니까?
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[1, 3, 6, 12].map((m) => (
                          <button
                            key={m}
                            className="btn btn-ghost"
                            style={{ fontSize: 12.5, padding: "6px 12px" }}
                            onClick={() => extend(b.id, m)}
                          >
                            {m}개월 연장
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                    onClick={() => cancel(b.id)}
                  >
                    예약 취소
                  </button>

                  {/* Early checkout: only on a confirmed (paid) stay. */}
                  {b.rawStatus === "CONFIRMED" && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 13, padding: "8px 16px" }}
                      onClick={() => requestEarly(b.id)}
                    >
                      조기 퇴실 요청
                    </button>
                  )}
                  {b.rawStatus === "EARLY_CHECKOUT_REQUESTED" && (
                    <span style={{ fontSize: 12.5, color: "var(--primary)" }}>
                      조기 퇴실 요청됨 · 호스트 승인 대기
                    </span>
                  )}
                  {b.rawStatus === "EARLY_CHECKOUT_APPROVED" && (
                    <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                      조기 퇴실 승인됨
                    </span>
                  )}
                  {b.rawStatus === "EXTENSION_REQUESTED" && (
                    <span style={{ fontSize: 12.5, color: "var(--primary)" }}>
                      {b.extensionMonths}개월 연장 요청됨 · 호스트 승인 대기
                    </span>
                  )}
                </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

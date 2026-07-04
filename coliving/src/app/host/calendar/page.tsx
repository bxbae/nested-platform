"use client";

import { useEffect, useState } from "react";
import type { Booking } from "@/lib/types";
import { MY_HOUSE_IDS } from "@/lib/host";
import { addMonths } from "@/lib/pricing";

export default function HostCalendar() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) =>
        setBookings(
          d.bookings.filter(
            (b: Booking) => MY_HOUSE_IDS.includes(b.houseId) && b.status !== "cancelled"
          )
        )
      );
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // for each day, which bookings are active
  function bookingsOn(day: number): Booking[] {
    const date = new Date(year, month, day);
    return bookings.filter((b) => {
      const inD = new Date(b.moveIn);
      const outD = addMonths(inD, b.months);
      return date >= new Date(inD.getFullYear(), inD.getMonth(), inD.getDate()) && date < outD;
    });
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = `${year}년 ${month + 1}월`;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>예약 캘린더</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>숙소별 예약 현황을 달력으로 확인하세요.</p>

      <div className="card" style={{ padding: 22 }}>
        {/* month nav */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <button className="btn btn-ghost press" style={{ padding: "8px 14px" }} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="이전 달">‹</button>
          <strong style={{ fontSize: 17 }}>{monthLabel}</strong>
          <button className="btn btn-ghost press" style={{ padding: "8px 14px" }} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="다음 달">›</button>
        </div>

        {/* weekday header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: i === 0 ? "var(--primary)" : "var(--text-2)" }}>
              {d}
            </div>
          ))}
        </div>

        {/* days */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const active = bookingsOn(day);
            const isToday =
              new Date().getFullYear() === year &&
              new Date().getMonth() === month &&
              new Date().getDate() === day;
            return (
              <div
                key={i}
                style={{
                  minHeight: 68,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  padding: 6,
                  background: active.length ? "var(--secondary-soft)" : "#fff",
                  outline: isToday ? "2px solid var(--primary)" : "none",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{day}</div>
                {active.slice(0, 2).map((b) => (
                  <div
                    key={b.id}
                    title={`${b.houseName.trim()} · ${b.guestName}`}
                    style={{
                      marginTop: 3,
                      fontSize: 10,
                      padding: "1px 4px",
                      borderRadius: 4,
                      background: b.status === "paid" ? "var(--secondary)" : "var(--warning)",
                      color: "#fff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.houseName.trim()}
                  </div>
                ))}
                {active.length > 2 && (
                  <div style={{ fontSize: 10, color: "var(--text-2)", marginTop: 2 }}>+{active.length - 2}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 12.5, color: "var(--text-2)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--secondary)", display: "inline-block" }} /> 예약 확정
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--warning)", display: "inline-block" }} /> 결제 대기
          </span>
        </div>
      </div>
    </div>
  );
}

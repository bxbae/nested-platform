"use client";

import { useEffect, useMemo, useState } from "react";
import { USE_REAL_API } from "@/lib/api/config";
import { listMyRooms, type HostListing } from "@/lib/api/rooms";
import {
  getHostCalendar,
  blockDate,
  unblockDate,
  type CalendarReservation,
} from "@/lib/api/host";

function isoOf(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export default function HostCalendar() {
  const [rooms, setRooms] = useState<HostListing[]>([]);
  const [roomId, setRoomId] = useState<string>("");
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  useEffect(() => {
    listMyRooms()
      .then((rs) => {
        setRooms(rs);
        if (rs.length) setRoomId(rs[0].id);
      })
      .catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    if (!roomId) return;
    getHostCalendar(roomId, year, month + 1)
      .then((m) => {
        setReservations(m.reservations);
        setBlocked(new Set(m.blockedDates));
      })
      .catch(() => {
        setReservations([]);
        setBlocked(new Set());
      });
  }, [roomId, year, month]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function reservationsOn(day: number): CalendarReservation[] {
    const date = new Date(year, month, day);
    return reservations.filter((r) => {
      const inD = new Date(r.checkIn);
      const outD = new Date(r.checkOut);
      return date >= new Date(inD.getFullYear(), inD.getMonth(), inD.getDate()) && date < outD;
    });
  }

  async function toggleBlock(day: number) {
    if (!roomId || !USE_REAL_API) return;
    const iso = isoOf(year, month, day);
    if (reservationsOn(day).length > 0) return;
    setBusyDate(iso);
    const next = new Set(blocked);
    try {
      if (blocked.has(iso)) {
        await unblockDate(roomId, iso);
        next.delete(iso);
      } else {
        await blockDate(roomId, iso);
        next.add(iso);
      }
      setBlocked(next);
    } finally {
      setBusyDate(null);
    }
  }

  const cells: (number | null)[] = useMemo(
    () => [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)],
    [firstDay, daysInMonth],
  );

  const monthLabel = `${year}년 ${month + 1}월`;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>예약 캘린더</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        숙소별 예약 현황을 확인하고, 날짜를 눌러 예약 불가일로 지정하세요.
      </p>

      <div style={{ marginBottom: 16 }}>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          aria-label="숙소 선택"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, minWidth: 220, background: "#fff" }}
        >
          {rooms.length === 0 && <option value="">숙소 없음</option>}
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name.trim()}</option>
          ))}
        </select>
        {!USE_REAL_API && (
          <span style={{ marginLeft: 12, fontSize: 12.5, color: "var(--text-2)" }}>
            데모 모드에서는 예약 불가일 지정이 비활성화됩니다.
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <button className="btn btn-ghost press" style={{ padding: "8px 14px" }} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="이전 달">‹</button>
          <strong style={{ fontSize: 17 }}>{monthLabel}</strong>
          <button className="btn btn-ghost press" style={{ padding: "8px 14px" }} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="다음 달">›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: i === 0 ? "var(--primary)" : "var(--text-2)" }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const active = reservationsOn(day);
            const iso = isoOf(year, month, day);
            const isBlocked = blocked.has(iso);
            const isToday =
              new Date().getFullYear() === year &&
              new Date().getMonth() === month &&
              new Date().getDate() === day;
            const clickable = USE_REAL_API && active.length === 0;
            return (
              <div
                key={i}
                onClick={() => clickable && toggleBlock(day)}
                style={{
                  minHeight: 68,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  padding: 6,
                  cursor: clickable ? "pointer" : "default",
                  opacity: busyDate === iso ? 0.5 : 1,
                  background: isBlocked
                    ? "repeating-linear-gradient(45deg, var(--border), var(--border) 4px, #fff 4px, #fff 8px)"
                    : active.length
                      ? "var(--secondary-soft)"
                      : "#fff",
                  outline: isToday ? "2px solid var(--primary)" : "none",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{day}</div>
                {isBlocked && (
                  <div style={{ fontSize: 10, color: "var(--text-2)", marginTop: 3 }}>예약 불가</div>
                )}
                {!isBlocked && active.slice(0, 2).map((r) => (
                  <div
                    key={r.id}
                    title={r.guestName}
                    style={{
                      marginTop: 3, fontSize: 10, padding: "1px 4px", borderRadius: 4,
                      background: r.status === "CONFIRMED" ? "var(--secondary)" : "var(--warning)",
                      color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {r.guestName}
                  </div>
                ))}
                {!isBlocked && active.length > 2 && (
                  <div style={{ fontSize: 10, color: "var(--text-2)", marginTop: 2 }}>+{active.length - 2}</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 12.5, color: "var(--text-2)", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--secondary)", display: "inline-block" }} /> 예약 확정
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--warning)", display: "inline-block" }} /> 결제 대기
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--border)", display: "inline-block" }} /> 예약 불가일
          </span>
        </div>
      </div>
    </div>
  );
}

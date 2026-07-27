"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { USE_REAL_API } from "@/lib/api/config";
import { listMyRooms, type HostListing } from "@/lib/api/rooms";
import {
  getHostCalendar,
  blockDate,
  unblockDate,
  blockDateRange,
  unblockDateRange,
  type CalendarDay,
  type CalendarMonth,
  type CalendarReservation,
} from "@/lib/api/host";

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "결제 대기",
  CONFIRMED: "예약 확정",
  EARLY_CHECKOUT_REQUESTED: "조기 퇴실 요청",
  EARLY_CHECKOUT_APPROVED: "조기 퇴실 승인",
  EXTENSION_REQUESTED: "연장 요청",
};

export default function HostCalendar() {
  const [rooms, setRooms] = useState<HostListing[]>([]);
  const [roomId, setRoomId] = useState("");
  const [calendar, setCalendar] = useState<CalendarMonth | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  useEffect(() => {
    listMyRooms()
      .then((result) => {
        setRooms(result);
        const requestedRoomId =
          typeof window === "undefined"
            ? null
            : new URLSearchParams(window.location.search).get("roomId");
        const selected = result.find((room) => room.id === requestedRoomId);
        setRoomId(selected?.id ?? result[0]?.id ?? "");
      })
      .catch(() => {
        setRooms([]);
        setRoomId("");
        setError(
          "숙소 목록을 불러오지 못했습니다. 백엔드 API 연결과 로그인을 확인해주세요.",
        );
      });
  }, []);

  const loadCalendar = useCallback(async () => {
    if (!roomId) return;
    try {
      setCalendar(await getHostCalendar(roomId, year, month + 1));
      setError("");
    } catch {
      setCalendar(null);
      setError("예약 캘린더를 불러오지 못했습니다.");
    }
  }, [roomId, year, month]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = useMemo(
    () => [
      ...Array<number | null>(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ],
    [firstDay, daysInMonth],
  );
  const dayMap = useMemo(
    () => new Map((calendar?.days ?? []).map((day) => [day.date, day])),
    [calendar],
  );
  const selectedDay = selectedDate ? dayMap.get(selectedDate) ?? null : null;
  const selectedReservations = selectedDay
    ? (calendar?.reservations ?? []).filter((reservation) =>
        selectedDay.reservationIds.includes(reservation.id),
      )
    : [];

  async function toggleSingleDate(day: CalendarDay) {
    if (!roomId || !USE_REAL_API || day.reservationIds.length > 0 || busy) return;
    setBusy(true);
    try {
      if (day.blocked) await unblockDate(roomId, day.date);
      else await blockDate(roomId, day.date, reason.trim() || undefined);
      await loadCalendar();
      setSelectedDate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "날짜 상태를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function applyRange(mode: "block" | "unblock") {
    if (!roomId || !rangeStart || !rangeEnd || busy) return;
    if (rangeEnd < rangeStart) {
      setError("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "block") {
        await blockDateRange(roomId, rangeStart, rangeEnd, reason.trim() || undefined);
      } else {
        await unblockDateRange(roomId, rangeStart, rangeEnd);
      }
      await loadCalendar();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "기간을 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>예약 캘린더</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        숙소별 예약자와 자리 현황을 확인하고 예약 불가 기간을 설정하세요.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          aria-label="숙소 선택"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            fontSize: 14,
            minWidth: 240,
            background: "#fff",
            color: "#52525b",
          }}
        >
          {rooms.length === 0 && (
            <option value="" style={{ color: "#52525b", background: "#fff" }}>
              {error ? "숙소 불러오기 실패" : "숙소 없음"}
            </option>
          )}
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name.trim()}</option>
          ))}
        </select>
        {calendar?.room.rentalUnit === "BED" && (
          <span className="chip" style={{ fontSize: 12 }}>
            공유형 다인실 · 총 {calendar.room.capacity ?? 1}자리
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <strong style={{ display: "block", fontSize: 14 }}>기간 예약 불가 설정</strong>
        <div style={{ display: "flex", gap: 8, alignItems: "end", marginTop: 10, flexWrap: "wrap" }}>
          <label className="field" style={{ minWidth: 155 }}>
            <span>시작일</span>
            <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
          </label>
          <label className="field" style={{ minWidth: 155 }}>
            <span>종료일</span>
            <input type="date" value={rangeEnd} min={rangeStart || undefined} onChange={(event) => setRangeEnd(event.target.value)} />
          </label>
          <label className="field" style={{ flex: "1 1 180px" }}>
            <span>사유 선택</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="공사, 호스트 사용 등" />
          </label>
          <button className="btn btn-primary press" disabled={busy || !rangeStart || !rangeEnd} onClick={() => applyRange("block")}>예약 불가 설정</button>
          <button className="btn btn-ghost press" disabled={busy || !rangeStart || !rangeEnd} onClick={() => applyRange("unblock")}>기간 해제</button>
        </div>
      </div>

      {error && <p style={{ color: "var(--primary)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <button className="btn btn-ghost press" style={{ padding: "8px 14px" }} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="이전 달">‹</button>
          <strong style={{ fontSize: 17 }}>{year}년 {month + 1}월</strong>
          <button className="btn btn-ghost press" style={{ padding: "8px 14px" }} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="다음 달">›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((label, index) => (
            <div key={label} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: index === 0 ? "var(--primary)" : "var(--text-2)" }}>{label}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
          {cells.map((day, index) => {
            if (day == null) return <div key={`empty-${index}`} />;
            const date = isoOf(year, month, day);
            const state = dayMap.get(date);
            const isToday = new Date().toISOString().slice(0, 10) === date;
            const guestSummary = state?.guestNames.length
              ? `${state.guestNames[0]}${state.guestNames.length > 1 ? ` 외 ${state.guestNames.length - 1}명` : ""}`
              : "";
            return (
              <button
                type="button"
                key={date}
                onClick={() => state && setSelectedDate(date)}
                style={{
                  minHeight: 86,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  padding: 7,
                  textAlign: "left",
                  cursor: state ? "pointer" : "default",
                  background: state?.blocked
                    ? "repeating-linear-gradient(45deg, #e5e7eb, #e5e7eb 4px, #fff 4px, #fff 8px)"
                    : state?.fullyBooked
                      ? "#e5e7eb"
                      : state?.reservedSpots
                        ? "#e5f6f4"
                        : "#fff",
                  color: "#52525b",
                  outline: isToday ? "2px solid var(--primary)" : "none",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#71717a",
                  }}
                >
                  {day}
                </span>
                {state?.blocked ? (
                  <span style={{ display: "block", marginTop: 5, fontSize: 10.5, fontWeight: 700 }}>호스트 예약 불가</span>
                ) : state ? (
                  <>
                    {calendar?.room.rentalUnit === "BED" ? (
                      <span style={{ display: "block", marginTop: 5, fontSize: 10.5, fontWeight: 700 }}>
                        {state.reservedSpots}/{calendar.room.capacity ?? 1}자리
                        {state.fullyBooked ? " · 마감" : ` · 잔여 ${state.remainingSpots}`}
                      </span>
                    ) : state.reservedSpots > 0 ? (
                      <span style={{ display: "block", marginTop: 5, fontSize: 10.5, fontWeight: 700 }}>예약 중 · 마감</span>
                    ) : (
                      <span
                        style={{
                          display: "block",
                          marginTop: 5,
                          fontSize: 10.5,
                          color: "#71717a",
                        }}
                      >
                        예약 가능
                      </span>
                    )}
                    {(state.pendingSpots > 0 || state.confirmedSpots > 0) && (
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          fontSize: 9.5,
                          color: "#71717a",
                        }}
                      >
                        확정 {state.confirmedSpots} · 대기 {state.pendingSpots}
                      </span>
                    )}
                    {guestSummary && (
                      <span
                        title={state.guestNames.join(", ")}
                        style={{
                          display: "block",
                          marginTop: 3,
                          fontSize: 9.5,
                          color: "#52525b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {guestSummary}
                      </span>
                    )}
                  </>
                ) : null}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 12.5, color: "var(--text-2)", flexWrap: "wrap" }}>
          <span>확정 자리 · 결제 대기 자리 분리 표시</span>
          <span>회색 · 예약 마감</span>
          <span>사선 · 호스트 예약 불가</span>
          {!USE_REAL_API && <span>데모 모드에서는 날짜 변경 비활성화</span>}
        </div>
      </div>

      {selectedDate && selectedDay && (
        <DayDetailModal
          date={selectedDate}
          day={selectedDay}
          reservations={selectedReservations}
          capacity={calendar?.room.capacity ?? null}
          rentalUnit={calendar?.room.rentalUnit ?? null}
          busy={busy}
          onClose={() => setSelectedDate(null)}
          onToggleBlock={() => toggleSingleDate(selectedDay)}
        />
      )}
    </div>
  );
}

function DayDetailModal({
  date,
  day,
  reservations,
  capacity,
  rentalUnit,
  busy,
  onClose,
  onToggleBlock,
}: {
  date: string;
  day: CalendarDay;
  reservations: CalendarReservation[];
  capacity: number | null;
  rentalUnit: string | null;
  busy: boolean;
  onClose: () => void;
  onToggleBlock: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${date} 예약 상세`}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.42)", display: "grid", placeItems: "center", padding: 20 }}
    >
      <div className="card" onClick={(event) => event.stopPropagation()} style={{ width: "min(560px, 100%)", maxHeight: "80vh", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 17 }}>{date} 예약 상세</strong>
          <button type="button" className="btn btn-ghost press" onClick={onClose}>닫기</button>
        </div>
        <div style={{ marginTop: 12, padding: 12, background: "var(--bg-2)", borderRadius: 10, fontSize: 13.5, lineHeight: 1.7 }}>
          {rentalUnit === "BED" ? (
            <>
              총 {capacity ?? 1}자리 · 예약 {day.reservedSpots}자리 · 잔여 {day.remainingSpots ?? 0}자리<br />
              확정 {day.confirmedSpots}자리 · 결제 대기 {day.pendingSpots}자리
            </>
          ) : day.reservedSpots > 0 ? "숙소 전체 예약 중" : "현재 예약 없음"}
          {day.blocked && <><br />호스트 지정 예약 불가{day.blockReason ? ` · ${day.blockReason}` : ""}</>}
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {reservations.map((reservation) => (
            <div key={reservation.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <strong style={{ display: "block", fontSize: 14 }}>{reservation.guestName}</strong>
              {reservation.companionNames.length > 0 && (
                <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: "var(--text-2)" }}>
                  동반 입주자 {reservation.companionNames.join(", ")}
                </span>
              )}
              <span style={{ display: "block", marginTop: 5, fontSize: 12.5, color: "var(--text-2)" }}>
                {reservation.checkIn.slice(0, 10)} ~ {reservation.checkOut.slice(0, 10)} · {reservation.reservedSpots}자리 · {STATUS_LABEL[reservation.status] ?? reservation.status}
              </span>
              {reservation.changeType && reservation.changeStatus && (
                <span style={{ display: "block", marginTop: 5, fontSize: 12.5, color: "var(--primary)" }}>
                  {reservation.changeType === "EARLY_CHECKOUT" ? "조기 퇴실" : "계약 연장"} · {reservation.changeStatus}
                  {reservation.requestedCheckOut ? ` · 요청일 ${reservation.requestedCheckOut.slice(0, 10)}` : ""}
                </span>
              )}
              <Link href={`/host/reservations?reservationId=${encodeURIComponent(reservation.id)}`} style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, color: "var(--secondary)", fontWeight: 700 }}>
                예약 관리에서 보기 →
              </Link>
            </div>
          ))}
          {reservations.length === 0 && (
            <p style={{ color: "var(--text-2)", fontSize: 13 }}>이 날짜에 예약자가 없습니다.</p>
          )}
        </div>

        {reservations.length === 0 && USE_REAL_API && (
          <button type="button" className={day.blocked ? "btn btn-ghost press" : "btn btn-primary press"} disabled={busy} onClick={onToggleBlock} style={{ width: "100%", justifyContent: "center", marginTop: 16 }}>
            {day.blocked ? "예약 불가 해제" : "이 날짜 예약 불가 설정"}
          </button>
        )}
      </div>
    </div>
  );
}

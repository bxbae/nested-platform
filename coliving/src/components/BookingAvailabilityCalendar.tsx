"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getRoomAvailabilityMonth,
  type RoomAvailabilityDay,
} from "@/lib/api/rooms";
import {
  minimumCheckOutISO,
  parseISODate,
} from "@/lib/stay-dates";

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type SelectionTarget = "checkIn" | "checkOut";

export function BookingAvailabilityCalendar({
  roomId,
  checkIn,
  checkOut,
  minStayMonths,
  requestedSpots,
  onChange,
}: {
  roomId: string;
  checkIn: string;
  checkOut: string;
  minStayMonths: number;
  requestedSpots: number;
  onChange: (range: { checkIn: string; checkOut: string }) => void;
}) {
  const initial = parseISODate(checkIn);
  const [cursor, setCursor] = useState(
    () => new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const [selectionTarget, setSelectionTarget] =
    useState<SelectionTarget>("checkIn");
  const [days, setDays] = useState<RoomAvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const minimumCheckOut = minimumCheckOutISO(checkIn, minStayMonths);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getRoomAvailabilityMonth(roomId, year, month + 1, requestedSpots)
      .then((result) => {
        if (alive) setDays(result.days);
      })
      .catch(() => {
        if (alive) {
          setDays([]);
          setError("예약 가능 날짜를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [roomId, year, month, requestedSpots]);

  useEffect(() => {
    if (selectionTarget !== "checkIn") return;

    const selected = parseISODate(checkIn);
    if (selected.getFullYear() !== year || selected.getMonth() !== month) {
      setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    // cursor is deliberately omitted: manual month navigation must remain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, selectionTarget]);

  const byDate = useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days],
  );
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = useMemo(
    () => [
      ...Array<number | null>(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ],
    [firstDay, daysInMonth],
  );

  function selectDate(date: string, state?: RoomAvailabilityDay) {
    if (selectionTarget === "checkIn") {
      if (!state?.available) return;
      const nextMinimum = minimumCheckOutISO(date, minStayMonths);
      onChange({
        checkIn: date,
        checkOut: checkOut >= nextMinimum ? checkOut : nextMinimum,
      });
      const minimumDate = parseISODate(nextMinimum);
      setCursor(
        new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1),
      );
      setSelectionTarget("checkOut");
      return;
    }

    if (date < minimumCheckOut) return;
    onChange({ checkIn, checkOut: date });
  }

  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        padding: 12,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          className="chip press"
          data-active={selectionTarget === "checkIn"}
          onClick={() => {
            const selected = parseISODate(checkIn);
            setCursor(
              new Date(selected.getFullYear(), selected.getMonth(), 1),
            );
            setSelectionTarget("checkIn");
          }}
        >
          입주일 {checkIn}
        </button>
        <button
          type="button"
          className="chip press"
          data-active={selectionTarget === "checkOut"}
          onClick={() => {
            const minimumDate = parseISODate(minimumCheckOut);
            setCursor(
              new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1),
            );
            setSelectionTarget("checkOut");
          }}
        >
          퇴실일 {checkOut}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost press"
          style={{ padding: "5px 10px" }}
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          aria-label="이전 달"
        >
          ‹
        </button>
        <strong style={{ fontSize: 14 }}>{year}년 {month + 1}월</strong>
        <button
          type="button"
          className="btn btn-ghost press"
          style={{ padding: "5px 10px" }}
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}
      >
        {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
          <div
            key={label}
            style={{
              textAlign: "center",
              color: "var(--text-2)",
              fontSize: 10.5,
              paddingBottom: 3,
            }}
          >
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day == null) return <div key={`empty-${index}`} />;
          const date = isoOf(year, month, day);
          const state = byDate.get(date);
          const selectingCheckIn = selectionTarget === "checkIn";
          const disabled = selectingCheckIn
            ? !state?.available
            : date < minimumCheckOut;
          const unavailableDay = Boolean(state && !state.available);
          const hideAvailabilityForMinimumStay =
            !selectingCheckIn && date < minimumCheckOut;
          const selectedCheckIn = date === checkIn;
          const selectedCheckOut = date === checkOut;
          const inRange = date > checkIn && date < checkOut;
          const dayStatus = availabilityLabel(state);
          const status = selectingCheckIn
            ? dayStatus
            : date < minimumCheckOut
              ? `최소 퇴실일 ${minimumCheckOut}`
              : `${dayStatus} · 퇴실일 후보`;

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => selectDate(date, state)}
              title={status}
              aria-label={`${date} ${status}`}
              style={{
                minHeight: 45,
                borderRadius: 8,
                border:
                  selectedCheckIn || selectedCheckOut
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border)",
                background:
                  selectedCheckIn || selectedCheckOut
                    ? "var(--primary-soft)"
                    : inRange
                      ? "var(--secondary-soft)"
                      : disabled || unavailableDay
                        ? "var(--bg-2)"
                        : "#fff",
                color:
                  selectedCheckIn || selectedCheckOut || inRange
                    ? "#ffffff"
                    : disabled || unavailableDay
                      ? "#9ca3af"
                      : "#18181b",
                opacity: 1,
                cursor: disabled ? "not-allowed" : "pointer",
                padding: "4px 2px",
                textAlign: "center",
              }}
            >
              <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
                {day}
              </span>
              {!hideAvailabilityForMinimumStay &&
                state?.remainingSpots != null && (
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 8.5,
                    lineHeight: 1.2,
                  }}
                >
                  {state.remainingSpots > 0
                    ? `잔여 ${state.remainingSpots}`
                    : "마감"}
                </span>
              )}
              {!hideAvailabilityForMinimumStay &&
                state?.remainingSpots == null &&
                state?.fullyBooked && (
                <span style={{ display: "block", marginTop: 2, fontSize: 8.5 }}>
                  마감
                </span>
              )}
              {!hideAvailabilityForMinimumStay && state?.blocked && (
                <span style={{ display: "block", marginTop: 2, fontSize: 8.5 }}>
                  차단
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 9,
          fontSize: 11.5,
          color: "var(--text-2)",
          lineHeight: 1.5,
        }}
      >
        {loading
          ? "예약 가능 날짜 확인 중…"
          : error ||
            (selectionTarget === "checkIn"
              ? "회색 날짜는 예약 마감·호스트 차단·입주 가능 시작일 이전 날짜입니다."
              : `이 숙소는 최소 ${minStayMonths}개월 계약입니다. 퇴실일은 ${minimumCheckOut}부터 선택할 수 있습니다.`)}
      </div>
    </div>
  );
}

function availabilityLabel(state?: RoomAvailabilityDay): string {
  if (!state) return "확인 중";
  if (state.past) return "지난 날짜";
  if (state.beforeAvailableFrom) return "입주 가능 시작일 이전";
  if (state.blocked) return state.blockReason || "호스트 예약 불가";
  if (state.fullyBooked) return "예약 마감";
  if (state.remainingSpots != null) return `잔여 ${state.remainingSpots}자리`;
  return "예약 가능";
}

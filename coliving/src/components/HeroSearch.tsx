"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RentalUnit } from "@/lib/types";
import { WORKPLACE_PRESETS } from "@/lib/seoul";
import {
  addCalendarMonths,
  formatStayDuration,
  minimumCheckOutISO,
  PLATFORM_MIN_STAY_MONTHS,
  toLocalISODate,
} from "@/lib/stay-dates";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const QUICK_STAY_MONTHS = [1, 3, 6, 12];
const HOUSING_OPTIONS: { label: string; value: "" | RentalUnit }[] = [
  { label: "모든 숙소", value: "" },
  { label: "단독형 숙소", value: "whole" },
  { label: "공유형 · 개인실", value: "private_room" },
  { label: "공유형 · 다인실", value: "bed" },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}
function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()}`;
}
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  const days = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= days; day++) cells.push(new Date(year, month, day));
  return cells;
}

type OpenPanel = "location" | "date" | null;

export function HeroSearch() {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [q, setQ] = useState("");
  const [rentalUnit, setRentalUnit] = useState<"" | RentalUnit>("");
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPanel) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openPanel]);

  const minimumCheckOut = checkIn
    ? addCalendarMonths(checkIn, PLATFORM_MIN_STAY_MONTHS)
    : null;
  const durationLabel =
    checkIn && checkOut
      ? formatStayDuration(toLocalISODate(checkIn), toLocalISODate(checkOut))
      : "";
  const hasPartialRange = Boolean(checkIn) !== Boolean(checkOut);

  function pickDate(d: Date) {
    if (d < today) return;

    if (!checkIn || checkOut || d <= checkIn) {
      setCheckIn(d);
      setCheckOut(null);
      return;
    }

    const earliestCheckOut = addCalendarMonths(checkIn, PLATFORM_MIN_STAY_MONTHS);
    if (d < earliestCheckOut) return;
    setCheckOut(d);
  }

  function applyQuickStay(months: number) {
    const start = checkIn ?? today;
    setCheckIn(start);
    setCheckOut(addCalendarMonths(start, months));
    setViewMonth(new Date(start.getFullYear(), start.getMonth(), 1));
  }

  function go() {
    if (hasPartialRange) {
      setOpenPanel("date");
      return;
    }

    const params = new URLSearchParams();
    const query = q.trim();
    const workplace = WORKPLACE_PRESETS.find((item) => item.query === query);

    if (query) params.set("q", query);
    if (workplace) {
      params.set("district", workplace.district);
      params.set("region", workplace.region);
    }
    if (rentalUnit) params.set("rentalUnits", rentalUnit);
    if (checkIn && checkOut) {
      params.set("checkIn", toLocalISODate(checkIn));
      params.set("checkOut", toLocalISODate(checkOut));
    }
    router.push(params.toString() ? `/search?${params.toString()}` : "/search");
  }

  const months = [
    viewMonth,
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
  ];
  const rangeLabel =
    checkIn && checkOut
      ? `${fmtShort(checkIn)} ~ ${fmtShort(checkOut)} · ${durationLabel}`
      : checkIn
        ? `${fmtShort(checkIn)} ~ 최소 ${minimumCheckOut ? fmtShort(minimumCheckOut) : ""}`
        : "입주일 ~ 퇴실일 선택";

  return (
    <div ref={boxRef} className="hero-search-root">
      <div
        className="card hero-search-bar"
        style={{
          display: "grid",
          gridTemplateColumns: "1.35fr 1fr .9fr auto",
          alignItems: "stretch",
          padding: 8,
          borderRadius: 22,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 16px",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 20 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>직장 또는 목적지</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setOpenPanel("location")}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="회사명, 역, 업무지구를 검색하세요"
              aria-label="직장 또는 목적지"
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 14,
                padding: "4px 0 0",
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpenPanel(openPanel === "date" ? null : "date")}
          style={{
            border: 0,
            borderLeft: "1px solid var(--border)",
            background: "transparent",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 19 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
              입주 기간
            </span>
            <span
              style={{
                display: "block",
                fontSize: 14,
                color: checkIn ? "var(--text)" : "var(--text-2)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {rangeLabel}
            </span>
          </span>
        </button>

        <label
          style={{
            borderLeft: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 19 }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
              숙소 유형
            </span>
            <select
              value={rentalUnit}
              onChange={(e) => setRentalUnit(e.target.value as "" | RentalUnit)}
              aria-label="숙소 유형"
              style={{
                width: "100%",
                border: 0,
                outline: 0,
                background: "transparent",
                padding: "4px 0 0",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {HOUSING_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <button
          onClick={go}
          className="btn btn-primary press"
          style={{
            padding: "0 28px",
            borderRadius: 18,
            whiteSpace: "nowrap",
            justifyContent: "center",
          }}
        >
          숙소 찾기
        </button>
      </div>

      {openPanel === "location" && (
        <div
          className="card hero-floating-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            left: 0,
            width: "min(470px, 92vw)",
            padding: 18,
            borderRadius: 18,
            boxShadow: "var(--shadow-lg)",
            zIndex: 300,
          }}
        >
          <strong style={{ fontSize: 14 }}>서울·근교 주요 업무지구</strong>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
            서울·경기·인천의 주요 출근 목적지를 빠르게 선택하세요.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {WORKPLACE_PRESETS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="chip press"
                onClick={() => {
                  setQ(item.query);
                  setOpenPanel(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>
              직장 기준 통근시간으로 보고 싶다면
            </span>
            <button
              type="button"
              onClick={() => router.push("/browse")}
              style={{ color: "var(--secondary)", fontWeight: 700, fontSize: 13 }}
            >
              직장 근처 숙소 →
            </button>
          </div>
        </div>
      )}

      {openPanel === "date" && (
        <div
          className="card hero-floating-panel hero-date-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            padding: 20,
            width: "min(620px, 94vw)",
            borderRadius: 18,
            boxShadow: "var(--shadow-lg)",
            zIndex: 300,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                )
              }
              aria-label="이전 달"
              style={{ fontSize: 22 }}
            >
              ‹
            </button>
            <strong style={{ fontSize: 14 }}>입주일과 퇴실일을 선택하세요</strong>
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                )
              }
              aria-label="다음 달"
              style={{ fontSize: 22 }}
            >
              ›
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {QUICK_STAY_MONTHS.map((monthCount) => (
              <button
                key={monthCount}
                type="button"
                className="chip press"
                onClick={() => applyQuickStay(monthCount)}
              >
                {monthCount}개월
              </button>
            ))}
          </div>

          <div
            className="hero-date-months"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
          >
            {months.map((m) => (
              <div key={m.getTime()}>
                <div
                  style={{
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                >
                  {m.getFullYear()}년 {m.getMonth() + 1}월
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 3,
                  }}
                >
                  {WEEKDAYS.map((w) => (
                    <span
                      key={w}
                      style={{
                        textAlign: "center",
                        fontSize: 11,
                        color: "var(--text-2)",
                        paddingBottom: 4,
                      }}
                    >
                      {w}
                    </span>
                  ))}
                  {monthCells(m.getFullYear(), m.getMonth()).map((d, i) => {
                    if (!d) return <span key={`blank-${i}`} />;
                    const past = d < today;
                    const tooShortCheckout = Boolean(
                      checkIn &&
                        !checkOut &&
                        d > checkIn &&
                        minimumCheckOut &&
                        d < minimumCheckOut,
                    );
                    const disabled = past || tooShortCheckout;
                    const selected = Boolean(
                      (checkIn && sameDay(d, checkIn)) ||
                        (checkOut && sameDay(d, checkOut)),
                    );
                    const inRange = Boolean(
                      checkIn && checkOut && d > checkIn && d < checkOut,
                    );
                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        disabled={disabled}
                        onClick={() => pickDate(d)}
                        title={
                          tooShortCheckout && minimumCheckOut
                            ? `퇴실일은 ${minimumCheckOutISO(
                                toLocalISODate(checkIn!),
                              )}부터 선택할 수 있습니다.`
                            : undefined
                        }
                        style={{
                          aspectRatio: "1",
                          border: tooShortCheckout
                            ? "1px dashed var(--calendar-min-stay-border)"
                            : 0,
                          borderRadius: selected ? 999 : 8,
                          background: selected
                            ? "var(--primary)"
                            : tooShortCheckout
                              ? "var(--calendar-min-stay-bg)"
                              : inRange
                                ? "var(--calendar-range-bg)"
                                : "transparent",
                          color: past
                            ? "#d4d4d8"
                            : tooShortCheckout
                              ? "var(--calendar-min-stay-text)"
                              : selected
                                ? "#fff"
                                : "var(--text)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          fontSize: 12,
                          fontWeight: tooShortCheckout ? 600 : 400,
                        }}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              marginTop: 14,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: hasPartialRange ? "var(--primary)" : "var(--text-2)",
            }}
          >
            {checkIn && !checkOut && minimumCheckOut
              ? `최소 거주 기간은 1개월입니다. 연분홍 날짜는 선택할 수 없으며, 퇴실일을 ${fmtShort(minimumCheckOut)} 이후로 선택해주세요.`
              : checkIn && checkOut
                ? `선택한 거주 기간 · ${durationLabel}`
                : "최소 1개월부터 선택할 수 있으며, 1개월 16일처럼 날짜 단위로 조정할 수 있습니다."}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setCheckIn(null);
                setCheckOut(null);
              }}
              style={{ fontSize: 13, color: "var(--text-2)" }}
            >
              날짜 초기화
            </button>
            <button
              type="button"
              className="btn btn-primary press"
              onClick={() => setOpenPanel(null)}
              disabled={hasPartialRange}
            >
              날짜 적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

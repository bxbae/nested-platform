"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchRooms } from "@/lib/api/rooms";

// The hero search entry point: 지역 + 숙박 기간.
// Picking a range filters out rooms that are already booked for those dates
// (the API applies the same overlap rule the reservation flow uses), and the
// live count under the calendar tells you how many rooms match before you
// commit to the search.

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PRESETS = [
  { label: "1주 (7일)", days: 7 },
  { label: "2주 (14일)", days: 14 },
  { label: "1개월 (30일)", days: 30 },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}
function isoDate(d: Date): string {
  // Local YYYY-MM-DD (avoids the UTC shift toISOString() would introduce).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

// Calendar cells for one month, padded so the 1st lands on its weekday.
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  return cells;
}

export function HeroSearch() {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date()), []);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the calendar when clicking outside it.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Live match count, debounced so typing/date-picking doesn't spam the API.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCounting(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchRooms({
          q: q.trim() || undefined,
          checkIn: checkIn ? isoDate(checkIn) : undefined,
          checkOut: checkOut ? isoDate(checkOut) : undefined,
          limit: 1,
        });
        if (alive) setCount(res.total);
      } catch {
        if (alive) setCount(null);
      } finally {
        if (alive) setCounting(false);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, checkIn, checkOut, open]);

  function pickDate(d: Date) {
    if (d < today) return;
    // First click (or restarting a range) sets check-in; second sets check-out.
    if (!checkIn || (checkIn && checkOut) || d <= checkIn) {
      setCheckIn(d);
      setCheckOut(null);
    } else {
      setCheckOut(d);
    }
  }

  function applyPreset(days: number) {
    const from = checkIn ?? today;
    setCheckIn(from);
    setCheckOut(addDays(from, days));
  }

  function go() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (checkIn) params.set("checkIn", isoDate(checkIn));
    if (checkOut) params.set("checkOut", isoDate(checkOut));
    router.push(params.toString() ? `/search?${params}` : "/search");
  }

  const months = [viewMonth, new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)];
  const rangeLabel =
    checkIn && checkOut
      ? `${fmtShort(checkIn)} ~ ${fmtShort(checkOut)}`
      : checkIn
        ? `${fmtShort(checkIn)} ~ 퇴실일 선택`
        : "입주일 ~ 퇴실일";

  return (
    <div ref={boxRef} style={{ position: "relative", maxWidth: 620, zIndex: 100 }}>
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          padding: 8,
          borderRadius: "var(--r-pill)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Where */}
        <div style={{ flex: 1.2, display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 4px 14px", minWidth: 0 }}>
          <span aria-hidden="true" style={{ fontSize: 16, opacity: 0.7 }}>📍</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>Where</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="지역, 동네, 숙소 이름으로 검색"
              aria-label="숙소 검색"
              style={{
                width: "100%", border: "none", outline: "none", background: "transparent",
                fontSize: 14, padding: "2px 0", color: "var(--text)",
              }}
            />
          </div>
        </div>

        <div aria-hidden="true" style={{ width: 1, height: 34, background: "var(--border)" }} />

        {/* When */}
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            padding: "4px 8px 4px 14px", background: "transparent", border: "none",
            cursor: "pointer", textAlign: "left", minWidth: 0,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 15, opacity: 0.7 }}>🗓️</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>When</span>
            <span style={{ display: "block", fontSize: 14, color: checkIn ? "var(--text)" : "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {rangeLabel}
            </span>
          </span>
        </button>

        <button onClick={go} className="btn btn-primary press" style={{ padding: "12px 26px", whiteSpace: "nowrap", flexShrink: 0 }}>
          Search
        </button>
      </div>

      {/* Calendar popover */}
      {open && (
        <div
          className="card"
          style={{
            position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 200,
            padding: 20, boxShadow: "var(--shadow-lg, 0 12px 40px rgba(0,0,0,0.16))",
            borderRadius: "var(--r-md, 16px)", width: "min(560px, 92vw)",
          }}
        >
          {/* month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              aria-label="이전 달"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "2px 8px", color: "var(--text-2)" }}
            >
              ‹
            </button>
            <div style={{ display: "flex", gap: 60, fontSize: 14, fontWeight: 700 }}>
              {months.map((m) => (
                <span key={m.getTime()}>{m.getFullYear()}년 {m.getMonth() + 1}월</span>
              ))}
            </div>
            <button
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              aria-label="다음 달"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "2px 8px", color: "var(--text-2)" }}
            >
              ›
            </button>
          </div>

          {/* two months */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {months.map((m) => (
              <div key={m.getTime()}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
                  {WEEKDAYS.map((w) => (
                    <span key={w} style={{ textAlign: "center", fontSize: 11, color: "var(--text-2)" }}>{w}</span>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                  {monthCells(m.getFullYear(), m.getMonth()).map((d, i) => {
                    if (!d) return <span key={i} />;
                    const past = d < today;
                    const isIn = checkIn && sameDay(d, checkIn);
                    const isOut = checkOut && sameDay(d, checkOut);
                    const inRange = checkIn && checkOut && d > checkIn && d < checkOut;
                    const selected = isIn || isOut;
                    return (
                      <button
                        key={i}
                        onClick={() => pickDate(d)}
                        disabled={past}
                        style={{
                          aspectRatio: "1", border: "none", borderRadius: selected ? "50%" : 6,
                          cursor: past ? "default" : "pointer", fontSize: 12.5,
                          background: selected ? "var(--primary)" : inRange ? "var(--bg-2)" : "transparent",
                          color: past ? "var(--border)" : selected ? "#fff" : "var(--text)",
                          fontWeight: selected ? 700 : 400,
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

          {/* presets */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
            {PRESETS.map((p) => {
              const active = checkIn && checkOut && Math.round((+checkOut - +checkIn) / 86400000) === p.days;
              return (
                <button
                  key={p.days}
                  onClick={() => applyPreset(p.days)}
                  className="chip"
                  style={{
                    fontSize: 12.5, padding: "8px 18px",
                    background: active ? "var(--primary)" : "transparent",
                    color: active ? "#fff" : "var(--text)",
                    border: active ? "none" : "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* live count */}
          <div style={{ textAlign: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-2)" }}>
            {counting ? (
              "조건에 맞는 숙소를 세는 중…"
            ) : count == null ? (
              "조건을 선택해 보세요"
            ) : (
              <>
                선택 조건에 맞는 숙소{" "}
                <strong style={{ color: "var(--primary)", fontSize: 14.5 }}>{count}곳</strong>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

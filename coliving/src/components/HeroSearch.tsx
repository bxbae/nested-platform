"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RentalUnit } from "@/lib/types";
import { WORKPLACE_PRESETS } from "@/lib/seoul";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const HOUSING_OPTIONS: { label: string; value: "" | RentalUnit }[] = [
  { label: "전체", value: "" },
  { label: "전체 숙소", value: "whole" },
  { label: "개인실", value: "private_room" },
  { label: "다인실·침대", value: "bed" },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date): boolean { return a.toDateString() === b.toDateString(); }
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtShort(d: Date): string { return `${d.getMonth() + 1}.${d.getDate()}`; }
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
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPanel) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenPanel(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openPanel]);

  function pickDate(d: Date) {
    if (d < today) return;
    if (!checkIn || checkOut || d <= checkIn) {
      setCheckIn(d);
      setCheckOut(null);
    } else {
      setCheckOut(d);
    }
  }

  function go() {
    const params = new URLSearchParams();
    const query = q.trim();
    const workplace = WORKPLACE_PRESETS.find(
      (item) => item.query === query,
    );

    if (query) params.set("q", query);

    if (workplace) {
      params.set("district", workplace.district);
      params.set("region", workplace.region);
    }

    if (rentalUnit) params.set("rentalUnits", rentalUnit);
    if (checkIn) params.set("checkIn", isoDate(checkIn));
    if (checkOut) params.set("checkOut", isoDate(checkOut));
    router.push(params.toString() ? `/search?${params.toString()}` : "/search");
  }

  const months = [viewMonth, new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)];
  const rangeLabel = checkIn && checkOut
    ? `${fmtShort(checkIn)} ~ ${fmtShort(checkOut)}`
    : checkIn ? `${fmtShort(checkIn)} ~ 퇴실일 선택` : "입주일 ~ 퇴실일 선택";

  return (
    <div ref={boxRef} className="hero-search-root">
      <div className="card hero-search-bar" style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr .9fr auto", alignItems: "stretch", padding: 8, borderRadius: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "8px 16px" }}>
          <span aria-hidden="true" style={{ fontSize: 20 }}></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>직장 또는 목적지</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setOpenPanel("location")}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="회사명, 지하철역, 지역을 검색하세요"
              aria-label="직장 또는 목적지"
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 14, padding: "4px 0 0" }}
            />
          </div>
        </div>

        <button type="button" onClick={() => setOpenPanel(openPanel === "date" ? null : "date")} style={{ border: 0, borderLeft: "1px solid var(--border)", background: "transparent", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", cursor: "pointer" }}>
          <span aria-hidden="true" style={{ fontSize: 19 }}></span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>입주 기간</span>
            <span style={{ display: "block", fontSize: 14, color: checkIn ? "var(--text)" : "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rangeLabel}</span>
          </span>
        </button>

        <label style={{ borderLeft: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, padding: "8px 16px" }}>
          <span aria-hidden="true" style={{ fontSize: 19 }}></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>예약 공간</span>
            <select value={rentalUnit} onChange={(e) => setRentalUnit(e.target.value as "" | RentalUnit)} aria-label="예약 공간" style={{ width: "100%", border: 0, outline: 0, background: "transparent", padding: "4px 0 0", fontSize: 14, cursor: "pointer" }}>
              {HOUSING_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
            </select>
          </span>
        </label>

        <button onClick={go} className="btn btn-primary press" style={{ padding: "0 28px", borderRadius: 18, whiteSpace: "nowrap", justifyContent: "center" }}>숙소 찾기</button>
      </div>

      {openPanel === "location" && (
        <div className="card" style={{ position: "absolute", top: "calc(100% + 10px)", left: 0, width: "min(470px, 92vw)", padding: 18, borderRadius: 18, boxShadow: "var(--shadow-lg)", zIndex: 300 }}>
          <strong style={{ fontSize: 14 }}>주요 업무 지역</strong>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>자주 찾는 출근 목적지를 빠르게 선택하세요.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {WORKPLACE_PRESETS.map((item) => (
              <button key={item.label} type="button" className="chip press" onClick={() => { setQ(item.query); setOpenPanel(null); }}>{item.label}</button>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>직장 기준 통근시간으로 보고 싶다면</span>
            <button type="button" onClick={() => router.push("/browse")} style={{ color: "var(--secondary)", fontWeight: 700, fontSize: 13 }}>직장 근처 숙소 →</button>
          </div>
        </div>
      )}

      {openPanel === "date" && (
        <div className="card" style={{ position: "absolute", top: "calc(100% + 10px)", left: 0, padding: 20, width: "min(620px, 94vw)", borderRadius: 18, boxShadow: "var(--shadow-lg)", zIndex: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="이전 달" style={{ fontSize: 22 }}>‹</button>
            <strong style={{ fontSize: 14 }}>입주일과 퇴실일을 선택하세요</strong>
            <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="다음 달" style={{ fontSize: 22 }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {months.map((m) => (
              <div key={m.getTime()}>
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{m.getFullYear()}년 {m.getMonth() + 1}월</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                  {WEEKDAYS.map((w) => <span key={w} style={{ textAlign: "center", fontSize: 11, color: "var(--text-2)", paddingBottom: 4 }}>{w}</span>)}
                  {monthCells(m.getFullYear(), m.getMonth()).map((d, i) => {
                    if (!d) return <span key={`blank-${i}`} />;
                    const past = d < today;
                    const selected = !!((checkIn && sameDay(d, checkIn)) || (checkOut && sameDay(d, checkOut)));
                    const inRange = !!(checkIn && checkOut && d > checkIn && d < checkOut);
                    return <button key={d.toISOString()} type="button" disabled={past} onClick={() => pickDate(d)} style={{ aspectRatio: "1", border: 0, borderRadius: selected ? 999 : 8, background: selected ? "var(--primary)" : inRange ? "var(--bg-2)" : "transparent", color: past ? "var(--border)" : selected ? "#fff" : "var(--text)", cursor: past ? "default" : "pointer", fontSize: 12 }}>{d.getDate()}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={() => { setCheckIn(null); setCheckOut(null); }} style={{ fontSize: 13, color: "var(--text-2)" }}>날짜 초기화</button>
            <button type="button" className="btn btn-primary press" onClick={() => setOpenPanel(null)} disabled={!checkIn || !checkOut}>날짜 적용</button>
          </div>
        </div>
      )}
    </div>
  );
}

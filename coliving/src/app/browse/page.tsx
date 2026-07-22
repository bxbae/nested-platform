"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { House } from "@/lib/types";
import { won } from "@/lib/format";
import { jobHubs, commuteBand } from "@/lib/commute";
import { Thumbnail } from "@/components/Thumbnail";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { regionLabel } from "@/lib/seoul";

// Leaflet touches window, so load the map only on the client.
const BrowseMap = dynamic(() => import("@/components/BrowseMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: 380, background: "var(--secondary-soft)" }} />
  ),
});

const vibes = ["any", "quiet", "social", "creative", "calm", "wellness", "international"];
const VIBE_LABELS: Record<string, string> = { any: "전체", quiet: "조용한 생활", social: "교류가 활발한 곳", creative: "창작자 중심", calm: "차분한 환경", wellness: "건강한 생활", international: "국제적인 환경" };
const roomTypes = ["any", "one_room", "share_room", "whole_house", "apartment"];

export default function Browse() {
  const [hub, setHub] = useState<string>("gangnam");
  const [q, setQ] = useState("");
  const [roomType, setRoomType] = useState("any");
  const [vibe, setVibe] = useState("any");
  const [maxRent, setMaxRent] = useState(1000000);
  const [maxCommute, setMaxCommute] = useState(60);
  const [sort, setSort] = useState("commute");
  const [results, setResults] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      q,
      roomType,
      vibe,
      maxRent: String(maxRent),
      maxCommute: String(maxCommute),
      hub,
      sort,
    });
    const res = await fetch(`/api/houses?${params}`);
    const data = await res.json();
    setResults(data.houses);
    setLoading(false);
  }, [q, roomType, vibe, maxRent, maxCommute, hub, sort]);

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [load]);

  const activeHub = jobHubs.find((h) => h.id === hub);

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <span className="eyebrow">직장 위치를 먼저</span>
      <h1 className="display" style={{ fontSize: 40, marginTop: 8, marginBottom: 6 }}>
        직장과 가까운 숙소 찾기
      </h1>
      <p style={{ color: "var(--text-2)", maxWidth: 560 }}>
출근 목적지를 기준으로 실제 이동 시간이 짧은 숙소부터 보여드립니다.
      </p>

      {/* Office picker — the commute-first entry point */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>
          어디로 출근하시나요?
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {jobHubs.map((h) => {
            const on = hub === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setHub(h.id)}
                className="card"
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  cursor: "pointer",
                  border: on ? "1.5px solid var(--text)" : "1px solid var(--border)",
                  background: on ? "var(--text)" : "#fff",
                  // Inactive buttons are always white, so force dark text
                  // (var(--text) is light in dark mode and would vanish).
                  color: on ? "var(--bg)" : "#222222",
                  transition: "all .15s ease",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600 }}>{h.name}</div>
                <div style={{ fontSize: 11.5, opacity: on ? 0.75 : 0.6, marginTop: 2 }}>
                  {h.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="card filter-bar"
        style={{
          padding: 18,
          alignItems: "end",
          margin: "22px 0",
        }}
      >
        <div className="field">
          <label>숙소 검색</label>
          <input
            placeholder="지역, 숙소명, 분위기 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="field">
          <label>주거 형태</label>
          <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
            {roomTypes.map((r) => (
              <option key={r} value={r}>
                {r === "any" ? "전체 유형" : ROOM_TYPE_LABELS[r as keyof typeof ROOM_TYPE_LABELS]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>최대 통근 시간 · {maxCommute}분</label>
          <input
            type="range"
            min={15}
            max={60}
            step={5}
            value={maxCommute}
            onChange={(e) => setMaxCommute(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>정렬</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="commute">통근 시간 짧은 순</option>
            <option value="recommended">추천순</option>
            <option value="price-asc">가격 낮은 순</option>
            <option value="price-desc">가격 높은 순</option>
            <option value="rating">평점 높은 순</option>
          </select>
        </div>
      </div>

      {/* Vibe chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {vibes.map((v) => (
          <button
            key={v}
            className="chip"
            data-active={vibe === v}
            onClick={() => setVibe(v)}
          >
            {VIBE_LABELS[v] ?? v}
          </button>
        ))}
      </div>

      <div className="browse-layout">
        {/* Results list */}
        <div>
          <div style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 14 }}>
            {loading
              ? "검색 중…"
              : `${activeHub?.name ?? "목적지"}까지 ${maxCommute}분 이내 숙소 ${results.length}곳`}
          </div>
          <div className="results-grid">
            {results.map((h) => {
              const band = h.commute ? commuteBand(h.commute.minutes) : null;
              return (
                <Link
                  key={h.id}
                  href={`/homes/${h.id}?hub=${hub}`}
                  className="card hover-card"
                  onMouseEnter={() => setHover(h.id)}
                  onMouseLeave={() => setHover(null)}
                  style={{ overflow: "hidden" }}
                >
                  <Thumbnail src={h.photo} color={h.color} height={168}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        padding: 12,
                        height: "100%",
                      }}
                    >
                      {h.commute && band && (
                        <span
                          className="chip glass"
                          style={{
                            background: band.color,
                            color: "#fff",
                            border: "none",
                            fontSize: 12,
                            fontWeight: 600,
                            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
                          }}
                        >
                          {h.commute.mode === "walk" ? "🚶" : "🚇"} {h.commute.minutes}분
                        </span>
                      )}
                      <span
                        className="chip glass"
                        style={{ fontSize: 11, border: "none", color: "var(--text)" }}
                      >
                        {h.residents}/{h.capacity}
                      </span>
                    </div>
                  </Thumbnail>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: 15 }}>{h.name.trim()}</strong>
                      <span style={{ fontSize: 13 }}>★ {h.rating}</span>
                    </div>
                    <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
                      {regionLabel(h.neighborhood)}
                      {h.commute && (
                        <span style={{ color: band?.color, fontWeight: 600 }}>
                          {" · "}{band?.label.toLowerCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {h.vibe.map((v) => (
                        <span key={v} className="chip" style={{ fontSize: 11, padding: "3px 8px" }}>
                          {v}
                        </span>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 14 }}>
                      <strong>{won(h.monthlyRent)}</strong>
                      <span style={{ color: "var(--text-2)", fontSize: 13 }}> / 월</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {!loading && results.length === 0 && (
            <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-2)" }}>
조건에 맞는 숙소가 없습니다. 통근 시간이나 예산 범위를 넓혀보세요.
            </div>
          )}
        </div>

        {/* Real map (Leaflet + OSM) with hub */}
        <div className="map-sticky">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 14 }}>{jobHubs.find((h) => h.id === hub)?.name ?? ""}까지 통근 거리</strong>
              <span className="mono" style={{ fontSize: 12, color: "var(--primary)" }}>◆ 직장</span>
            </div>
            <BrowseMap
              houses={results}
              hover={hover}
              onHover={setHover}
              hub={jobHubs.find((h) => h.id === hub)!}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

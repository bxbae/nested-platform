"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { House } from "@/lib/types";
import { won } from "@/lib/format";
import { jobHubs, commuteBand } from "@/lib/commute";
import { Thumbnail } from "@/components/Thumbnail";

const vibes = ["any", "quiet", "social", "creative", "calm", "wellness", "international"];
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
      <span className="eyebrow">Find a home · commute first</span>
      <h1 className="display" style={{ fontSize: 40, marginTop: 8, marginBottom: 6 }}>
        Live close to work
      </h1>
      <p style={{ color: "var(--text-2)", maxWidth: 560 }}>
        Pick where you work. Every home shows a realistic door-to-door commute,
        ranked shortest first.
      </p>

      {/* Office picker — the commute-first entry point */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 10 }}>
          Where do you work?
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
                  color: on ? "var(--bg)" : "var(--text)",
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
          <label>Search</label>
          <input
            placeholder="Neighborhood, name, or vibe"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Room type</label>
          <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
            {roomTypes.map((r) => (
              <option key={r} value={r}>
                {r === "any" ? "Any type" : r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Max commute · {maxCommute} min</label>
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
          <label>Sort</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="commute">Shortest commute</option>
            <option value="recommended">Recommended</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
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
            {v === "any" ? "All vibes" : v}
          </button>
        ))}
      </div>

      <div className="browse-layout">
        {/* Results list */}
        <div>
          <div style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 14 }}>
            {loading
              ? "Searching…"
              : `${results.length} homes within ${maxCommute} min of ${activeHub?.name}`}
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
                          {h.commute.mode === "walk" ? "🚶" : "🚇"} {h.commute.minutes} min
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
                      {h.neighborhood}
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
                      <span style={{ color: "var(--text-2)", fontSize: 13 }}> /mo</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {!loading && results.length === 0 && (
            <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-2)" }}>
              No homes within {maxCommute} min of {activeHub?.name}. Try a longer
              commute or a different budget.
            </div>
          )}
        </div>

        {/* Mini map with hub */}
        <div className="map-sticky">
          <MiniMap houses={results} hover={hover} onHover={setHover} hubId={hub} />
        </div>
      </div>
    </div>
  );
}

function MiniMap({
  houses,
  hover,
  onHover,
  hubId,
}: {
  houses: House[];
  hover: string | null;
  onHover: (id: string | null) => void;
  hubId: string;
}) {
  const hub = jobHubs.find((h) => h.id === hubId)!;
  const latMin = 37.38, latMax = 37.59, lngMin = 126.88, lngMax = 127.13;
  const px = (lng: number) => ((lng - lngMin) / (lngMax - lngMin)) * 360 + 20;
  const py = (lat: number) => (1 - (lat - latMin) / (latMax - latMin)) * 340 + 20;
  const hx = px(hub.lng), hy = py(hub.lat);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
        <strong style={{ fontSize: 14 }}>Distance to {hub.name}</strong>
        <span className="mono" style={{ fontSize: 12, color: "var(--primary)" }}>◆ office</span>
      </div>
      <svg viewBox="0 0 400 380" style={{ width: "100%", display: "block", background: "var(--secondary-soft)" }}>
        <path
          d="M0 250 Q100 230 200 255 T400 250 L400 300 Q250 290 120 300 T0 300 Z"
          fill="#c7d7e0"
          opacity="0.7"
        />
        {/* commute lines from hub to hovered house */}
        {houses.map((h) => {
          if (hover !== h.id) return null;
          return (
            <line
              key={`l-${h.id}`}
              x1={hx}
              y1={hy}
              x2={px(h.lng)}
              y2={py(h.lat)}
              stroke="var(--text)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          );
        })}
        {/* houses */}
        {houses.map((h) => {
          const active = hover === h.id;
          return (
            <g
              key={h.id}
              transform={`translate(${px(h.lng)}, ${py(h.lat)})`}
              onMouseEnter={() => onHover(h.id)}
              onMouseLeave={() => onHover(null)}
              style={{ cursor: "pointer" }}
            >
              <circle r={active ? 13 : 9} fill={h.color} opacity={active ? 1 : 0.85} />
              <circle r={active ? 13 : 9} fill="none" stroke="#fff" strokeWidth="2" />
              {active && h.commute && (
                <text y="-18" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">
                  {h.name.trim()} · {h.commute.minutes}min
                </text>
              )}
            </g>
          );
        })}
        {/* office marker on top */}
        <g transform={`translate(${hx}, ${hy})`}>
          <rect x="-8" y="-8" width="16" height="16" fill="var(--primary)" transform="rotate(45)" stroke="#fff" strokeWidth="2" />
          <text y="-16" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--primary)">
            {hub.name}
          </text>
        </g>
      </svg>
    </div>
  );
}

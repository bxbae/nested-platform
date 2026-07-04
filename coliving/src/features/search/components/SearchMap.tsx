"use client";

import type { House } from "@/lib/types";
import { wonShort } from "@/lib/format";

// A lightweight SVG map standing in for the Kakao Map adapter described in
// ARCHITECTURE.md (lib/maps). Markers are price pills synced with list hover.
export function SearchMap({
  houses,
  hover,
  onHover,
}: {
  houses: House[];
  hover: string | null;
  onHover: (id: string | null) => void;
}) {
  // Seoul bounding box
  const latMin = 37.38, latMax = 37.59, lngMin = 126.86, lngMax = 127.14;
  const W = 400, H = 520;
  const px = (lng: number) => ((lng - lngMin) / (lngMax - lngMin)) * (W - 60) + 30;
  const py = (lat: number) => (1 - (lat - latMin) / (latMax - latMin)) * (H - 80) + 40;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", height: "100%" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 13,
          color: "var(--text-2)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <strong style={{ color: "var(--text)", fontSize: 14 }}>지도</strong>
        <span>{houses.length}곳 표시</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block", background: "var(--secondary-soft)" }}
        role="img"
        aria-label="검색 결과 지도"
      >
        {/* stylised river */}
        <path
          d={`M0 ${H * 0.62} Q${W * 0.25} ${H * 0.58} ${W * 0.5} ${H * 0.63} T${W} ${H * 0.61} L${W} ${H * 0.72} Q${W * 0.6} ${H * 0.68} ${W * 0.3} ${H * 0.73} T0 ${H * 0.72} Z`}
          fill="#c7d7e0"
          opacity="0.7"
        />
        {houses.map((h) => {
          const active = hover === h.id;
          const x = px(h.lng), y = py(h.lat);
          const label = wonShort(h.monthlyRent);
          const w = label.length * 7 + 18;
          return (
            <g
              key={h.id}
              transform={`translate(${x}, ${y})`}
              onMouseEnter={() => onHover(h.id)}
              onMouseLeave={() => onHover(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={-w / 2}
                y={-13}
                width={w}
                height={26}
                rx={13}
                fill={active ? "var(--text)" : "#fff"}
                stroke={active ? "var(--text)" : "var(--border)"}
                strokeWidth={1}
                style={{
                  filter: active ? "drop-shadow(0 4px 10px rgba(0,0,0,.25))" : "none",
                  transition: "all .15s ease",
                }}
              />
              <text
                textAnchor="middle"
                dy="4"
                fontSize="12"
                fontWeight="600"
                fill={active ? "#fff" : "var(--text)"}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

"use client";

// Wrapper that loads the real Leaflet search map only on the client
// (Leaflet needs `window`). Flex column so the map fills the height left by
// the header — Leaflet needs a resolved pixel height to render tiles.
import dynamic from "next/dynamic";
import type { House } from "@/lib/types";

const SearchMapInner = dynamic(() => import("./SearchMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, minHeight: 300, background: "var(--secondary-soft)" }} />
  ),
});

export function SearchMap({
  houses,
  hover,
  onHover,
}: {
  houses: House[];
  hover: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <div
      className="card"
      style={{ padding: 0, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 13,
          color: "var(--text-2)",
          display: "flex",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <strong style={{ color: "var(--text)", fontSize: 14 }}>지도</strong>
        <span>{houses.length}곳 표시</span>
      </div>
      <div style={{ flex: 1, minHeight: 300, zIndex: 10 }}>
        <SearchMapInner houses={houses} hover={hover} onHover={onHover} />
      </div>
    </div>
  );
}

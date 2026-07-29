"use client";

import dynamic from "next/dynamic";

import type { House } from "@/lib/types";

const SearchMapInner = dynamic(() => import("./SearchMapInner"), {
  ssr: false,
  loading: () => <div className="search-map-loading" />,
});

export function SearchMap({
  houses,
  hover,
  onHover,
  onSelect,
}: {
  houses: House[];
  hover: string | null;
  onHover: (id: string | null) => void;
  onSelect?: (house: House) => void;
}) {
  return (
    <div className="card search-map-card">
      <div className="search-map-header">
        <strong>지도</strong>
        <span>{houses.length}곳 표시</span>
      </div>
      <div className="search-map-canvas">
        <SearchMapInner
          houses={houses}
          hover={hover}
          onHover={onHover}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

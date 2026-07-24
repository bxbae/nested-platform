"use client";

// Real search map (Leaflet + OSM). Price-pill markers stay synced with list
// hover. Loaded client-only via next/dynamic from SearchMap.

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { House } from "@/lib/types";
import { wonShort } from "@/lib/format";

function pill(house: House, active: boolean) {
  const bg = active ? "#111" : "#fff";
  const fg = active ? "#fff" : "#111";
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${bg};color:${fg};font-weight:700;font-size:12px;
      padding:4px 9px;border-radius:999px;white-space:nowrap;
      border:1.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);
      transform:translate(-50%,-50%)">${wonShort(house.monthlyRent)}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  // 배열 참조가 아니라 "실제 좌표 값"이 바뀌었을 때만 다시 맞추도록,
  // 좌표들을 문자열로 직렬화해서 의존성으로 사용한다. 이러면 상위에서
  // 배열이 새로 만들어져도(참조만 다르고 값은 같으면) 재실행되지 않는다.
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function SearchMapInner({
  houses,
  hover,
  onHover,
}: {
  houses: House[];
  hover: string | null;
  onHover: (id: string | null) => void;
}) {
  const points = useMemo<[number, number][]>(
    () => houses.map((h) => [h.lat, h.lng] as [number, number]),
    [houses],
  );
  const center: [number, number] = points[0] ?? [37.5665, 126.978];

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      style={{ width: "100%", height: "100%", minHeight: 300 }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      <FitBounds points={points} />
      {houses.map((h) => (
        <Marker
          key={h.id}
          position={[h.lat, h.lng]}
          icon={pill(h, hover === h.id)}
          eventHandlers={{
            mouseover: () => onHover(h.id),
            mouseout: () => onHover(null),
          }}
        />
      ))}
    </MapContainer>
  );
}

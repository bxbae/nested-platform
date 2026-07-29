"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { wonShort } from "@/lib/format";
import type { House } from "@/lib/types";

function pricePill(house: House, active: boolean) {
  const background = active ? "#ff5a5f" : "#ffffff";
  const foreground = active ? "#ffffff" : "#222222";
  const scale = active ? 1.12 : 1;

  return L.divIcon({
    className: "price-pill-icon",
    html: `<div style="
      background:${background};color:${foreground};font-weight:800;font-size:12px;
      padding:5px 10px;border-radius:999px;white-space:nowrap;
      border:1.5px solid rgba(255,255,255,.96);
      box-shadow:${active ? "0 8px 22px rgba(255,90,95,.34)" : "0 3px 10px rgba(0,0,0,.2)"};
      transform:translate(-50%,-50%) scale(${scale});
      transition:transform .16s ease, background .16s ease, box-shadow .16s ease;
    ">${wonShort(house.monthlyRent)}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((point) => point.join(",")).join("|");

  useEffect(() => {
    if (points.length === 0) return;

    map.fitBounds(L.latLngBounds(points), {
      padding: [34, 34],
      maxZoom: 14,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

export default function SearchMapInner({
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
  const points = useMemo<[number, number][]>(
    () => houses.map((house) => [house.lat, house.lng]),
    [houses],
  );
  const center: [number, number] = points[0] ?? [37.5665, 126.978];

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      style={{ width: "100%", height: "100%", minHeight: 320 }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      <FitBounds points={points} />

      {houses.map((house) => {
        const active = hover === house.id;

        return (
          <Marker
            key={house.id}
            position={[house.lat, house.lng]}
            icon={pricePill(house, active)}
            zIndexOffset={active ? 1000 : 0}
            eventHandlers={{
              mouseover: () => onHover(house.id),
              mouseout: () => onHover(null),
              click: () => onSelect?.(house),
            }}
          />
        );
      })}
    </MapContainer>
  );
}

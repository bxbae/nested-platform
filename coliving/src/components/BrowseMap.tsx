"use client";

// Real map (Leaflet + OpenStreetMap tiles) for the browse page. Kept as a
// standalone client component so the parent can load it via next/dynamic with
// ssr:false — Leaflet touches `window` and must not run on the server.

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { House } from "@/lib/types";

interface Hub {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  houses: House[];
  hover: string | null;
  onHover: (id: string | null) => void;
  hub: Hub;
}

// Office marker: a small diamond built as a divIcon so it matches the old look.
const officeIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;background:#FF5A5F;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Refit the map whenever the set of points changes so all markers stay visible.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export default function BrowseMap({ houses, hover, onHover, hub }: Props) {
  const points = useMemo<[number, number][]>(
    () => [[hub.lat, hub.lng], ...houses.map((h) => [h.lat, h.lng] as [number, number])],
    [hub, houses],
  );

  const hovered = houses.find((h) => h.id === hover);

  return (
    <MapContainer
      center={[hub.lat, hub.lng]}
      zoom={12}
      scrollWheelZoom={false}
      style={{ width: "100%", height: 380 }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      <FitBounds points={points} />

      {/* dashed commute line from hub to the hovered house */}
      {hovered && (
        <Polyline
          positions={[
            [hub.lat, hub.lng],
            [hovered.lat, hovered.lng],
          ]}
          pathOptions={{ color: "#111", weight: 1.5, dashArray: "5 5" }}
        />
      )}

      {/* house markers */}
      {houses.map((h) => {
        const active = hover === h.id;
        return (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lng]}
            radius={active ? 11 : 7}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: h.color || "#FF5A5F",
              fillOpacity: active ? 1 : 0.85,
            }}
            eventHandlers={{
              mouseover: () => onHover(h.id),
              mouseout: () => onHover(null),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <strong>{h.name.trim()}</strong>
              {h.commute ? ` · ${h.commute.minutes}min` : ""}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* office marker on top */}
      <Marker position={[hub.lat, hub.lng]} icon={officeIcon}>
        <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
          {hub.name}
        </Tooltip>
      </Marker>
    </MapContainer>
  );
}

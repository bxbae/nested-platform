"use client";

// Real location map (Leaflet + OSM) for the detail page. A soft privacy circle
// sits over the approximate point instead of an exact pin — the precise address
// is only shared after booking. Loaded via next/dynamic (ssr:false) by the
// LocationMap wrapper, since Leaflet needs `window`.

import { MapContainer, TileLayer, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function LocationMapInner({
  lat,
  lng,
  color,
}: {
  lat: number;
  lng: number;
  color: string;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ width: "100%", height: 300 }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      {/* privacy radius ~250m instead of an exact pin */}
      <Circle
        center={[lat, lng]}
        radius={250}
        pathOptions={{ color: color || "#FF5A5F", fillColor: color || "#FF5A5F", fillOpacity: 0.15, weight: 2 }}
      />
    </MapContainer>
  );
}

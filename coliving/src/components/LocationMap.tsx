"use client";

// Wrapper that loads the real Leaflet location map only on the client
// (Leaflet needs `window`). Keeps the same props and privacy note as before.
import dynamic from "next/dynamic";

const LocationMapInner = dynamic(() => import("@/components/LocationMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: 300, background: "var(--secondary-soft)" }} />
  ),
});

export function LocationMap({
  lat,
  lng,
  region,
  color,
}: {
  lat: number;
  lng: number;
  region: string;
  color: string;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <LocationMapInner lat={lat} lng={lng} color={color} />
      <div style={{ padding: "14px 16px", fontSize: 14, color: "var(--text-2)" }}>
        정확한 위치는 예약 확정 후 안내됩니다. · {region}
      </div>
    </div>
  );
}

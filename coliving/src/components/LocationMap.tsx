"use client";

// A stylised location map (stand-in for the Kakao Map adapter) showing the
// home's approximate position. A soft privacy radius sits over the exact point.
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
      <svg
        viewBox="0 0 800 360"
        style={{ width: "100%", display: "block", background: "var(--secondary-soft)" }}
        role="img"
        aria-label={`${region} 위치 지도`}
      >
        {/* abstract streets */}
        <g stroke="#ffffff" strokeWidth="6" opacity="0.7">
          <line x1="0" y1="130" x2="800" y2="150" />
          <line x1="0" y1="250" x2="800" y2="240" />
          <line x1="220" y1="0" x2="240" y2="360" />
          <line x1="520" y1="0" x2="540" y2="360" />
        </g>
        <path
          d="M0 300 Q200 285 400 305 T800 300 L800 360 L0 360 Z"
          fill="#c7d7e0"
          opacity="0.6"
        />
        {/* privacy radius + pin */}
        <circle cx="400" cy="185" r="70" fill={color} opacity="0.14" />
        <circle cx="400" cy="185" r="70" fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
        <g transform="translate(400, 185)">
          <circle r="13" fill={color} />
          <circle r="13" fill="none" stroke="#fff" strokeWidth="3" />
        </g>
      </svg>
      <div style={{ padding: "14px 16px", fontSize: 14, color: "var(--text-2)" }}>
        정확한 위치는 예약 확정 후 안내됩니다. · {region}
      </div>
    </div>
  );
}

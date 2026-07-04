// ── Commute model ───────────────────────────────────────────────────
// Job hubs where 20–40 직장인 actually commute to. Each carries coordinates
// so we can estimate a realistic door-to-door time from any house.

export interface JobHub {
  id: string;
  name: string; // display, e.g. "Gangnam"
  label: string; // subtitle, e.g. "테헤란로 · IT/대기업"
  lat: number;
  lng: number;
}

export const jobHubs: JobHub[] = [
  { id: "gangnam", name: "Gangnam", label: "테헤란로 · IT·대기업", lat: 37.4979, lng: 127.0276 },
  { id: "yeouido", name: "Yeouido", label: "금융·방송", lat: 37.5219, lng: 126.9245 },
  { id: "pangyo", name: "Pangyo", label: "판교테크노밸리 · 테크", lat: 37.3948, lng: 127.1112 },
  { id: "jongno", name: "Jongno / CBD", label: "광화문·시청 · 대기업 본사", lat: 37.5729, lng: 126.9794 },
  { id: "guro", name: "Guro / G-Valley", label: "구로·가산 디지털단지", lat: 37.4827, lng: 126.8967 },
  { id: "seongsu", name: "Seongsu", label: "성수 · 스타트업·크리에이티브", lat: 37.5446, lng: 127.0559 },
];

// Haversine distance in km.
function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export interface CommuteEstimate {
  minutes: number;
  km: number;
  mode: "subway" | "bus" | "walk";
}

// Estimate a public-transit commute. This is a transparent heuristic:
// a short access/egress overhead plus distance at an effective transit speed.
// Real deployments swap this for a routing API (Kakao/Naver/ODsay) behind the
// same signature.
export function estimateCommute(
  houseLat: number,
  houseLng: number,
  hubLat: number,
  hubLng: number
): CommuteEstimate {
  const km = haversine(houseLat, houseLng, hubLat, hubLng);

  if (km < 1.1) {
    return { minutes: Math.max(4, Math.round(km * 13)), km: round1(km), mode: "walk" };
  }

  // Effective door-to-door subway speed in Seoul ≈ 22 km/h including
  // walking to/from stations and transfers; fixed overhead ~10 min.
  const overhead = 10;
  const minutes = Math.round(overhead + (km / 22) * 60);
  return { minutes, km: round1(km), mode: "subway" };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function commuteBand(minutes: number): {
  label: string;
  color: string;
} {
  if (minutes <= 20) return { label: "Quick commute", color: "#00A699" };
  if (minutes <= 40) return { label: "Easy commute", color: "#FFB400" };
  return { label: "Longer commute", color: "#717171" };
}

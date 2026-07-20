import type {
  RoomType,
  GenderPolicy,
  SortKey,
  SearchParams,
} from "@/lib/types";

// Default filter state. Mirrors ARCHITECTURE.md: URL is the source of truth,
// this is the shape we serialize to/from the query string.
export const DEFAULT_FILTERS: SearchParams = {
  q: "",
  region: "",
  roomTypes: [],
  minRent: 500000,
  maxRent: 1100000,
  availableFrom: "",
  gender: "any",
  pets: false,
  smoking: false,
  parking: false,
  sort: "recommended",
};

export const RENT_MIN = 500000;
export const RENT_MAX = 1100000;

// Serialize filters → URLSearchParams (skips defaults/empties for clean URLs)
export function filtersToParams(f: SearchParams): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.region) p.set("region", f.region);
  if (f.roomTypes && f.roomTypes.length) p.set("roomTypes", f.roomTypes.join(","));
  if (f.minRent != null && f.minRent > RENT_MIN) p.set("minRent", String(f.minRent));
  if (f.maxRent != null && f.maxRent < RENT_MAX) p.set("maxRent", String(f.maxRent));
  if (f.availableFrom) p.set("availableFrom", f.availableFrom);
  if (f.checkIn) p.set("checkIn", f.checkIn);
  if (f.checkOut) p.set("checkOut", f.checkOut);
  if (f.gender && f.gender !== "any") p.set("gender", f.gender);
  if (f.pets) p.set("pets", "true");
  if (f.smoking) p.set("smoking", "true");
  if (f.parking) p.set("parking", "true");
  if (f.sort && f.sort !== "recommended") p.set("sort", f.sort);
  return p;
}

// Parse URLSearchParams → filters
export function paramsToFilters(sp: URLSearchParams): SearchParams {
  return {
    q: sp.get("q") ?? "",
    region: sp.get("region") ?? "",
    roomTypes: (sp.get("roomTypes")?.split(",").filter(Boolean) ?? []) as RoomType[],
    minRent: sp.get("minRent") ? Number(sp.get("minRent")) : RENT_MIN,
    maxRent: sp.get("maxRent") ? Number(sp.get("maxRent")) : RENT_MAX,
    availableFrom: sp.get("availableFrom") ?? "",
    // Stay window from the hero search (홈 검색바에서 고른 기간)
    checkIn: sp.get("checkIn") ?? "",
    checkOut: sp.get("checkOut") ?? "",
    gender: (sp.get("gender") as GenderPolicy) ?? "any",
    pets: sp.get("pets") === "true",
    smoking: sp.get("smoking") === "true",
    parking: sp.get("parking") === "true",
    sort: (sp.get("sort") as SortKey) ?? "recommended",
  };
}

// Count of active (non-default) filters, for the filter button badge
export function activeFilterCount(f: SearchParams): number {
  let n = 0;
  if (f.region) n++;
  if (f.roomTypes && f.roomTypes.length) n++;
  if ((f.minRent ?? RENT_MIN) > RENT_MIN || (f.maxRent ?? RENT_MAX) < RENT_MAX) n++;
  if (f.availableFrom) n++;
  if (f.checkIn && f.checkOut) n++; // 기간 선택은 하나의 필터로 센다
  if (f.gender && f.gender !== "any") n++;
  if (f.pets) n++;
  if (f.smoking) n++;
  if (f.parking) n++;
  return n;
}

// ── Adapters ────────────────────────────────────────────────────────
// The frontend and backend evolved with slightly different contracts:
//   • enums: frontend uses snake_case lowercase ("one_room", "any"),
//     Prisma uses SCREAMING_SNAKE ("ONE_ROOM", "ANY")
//   • room shape: Prisma returns nested relations (images[], amenities[]),
//     the UI expects a flat `House`
//   • search params: UI has roomTypes[]/gender/smoking/parking/sort,
//     the API takes query-string equivalents
//
// These pure functions are the single translation boundary, so the 33 UI
// screens keep using `House`/`SearchParams` untouched.

import type {
  House,
  RoomType,
  GenderPolicy,
  SearchParams,
  PaginatedRooms,
} from "@/lib/types";

// ── enum maps ──
const ROOM_TYPE_TO_API: Record<RoomType, string> = {
  one_room: "ONE_ROOM",
  share_room: "SHARE_ROOM",
  whole_house: "WHOLE_HOUSE",
  apartment: "APARTMENT",
};
const ROOM_TYPE_FROM_API: Record<string, RoomType> = {
  ONE_ROOM: "one_room",
  SHARE_ROOM: "share_room",
  WHOLE_HOUSE: "whole_house",
  APARTMENT: "apartment",
};
const GENDER_TO_API: Record<GenderPolicy, string> = {
  any: "ANY",
  male_only: "MALE_ONLY",
  female_only: "FEMALE_ONLY",
};
const GENDER_FROM_API: Record<string, GenderPolicy> = {
  ANY: "any",
  MALE_ONLY: "male_only",
  FEMALE_ONLY: "female_only",
};

export const toApiRoomType = (t: RoomType): string => ROOM_TYPE_TO_API[t] ?? "ONE_ROOM";
export const fromApiRoomType = (t: string): RoomType => ROOM_TYPE_FROM_API[t] ?? "one_room";

// ── search filters → API query string ──
export function filtersToApiQuery(f: SearchParams): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.region) p.set("region", f.region);
  if (f.roomTypes?.length) p.set("roomTypes", f.roomTypes.map(toApiRoomType).join(","));
  if (f.minRent != null) p.set("minRent", String(f.minRent));
  if (f.maxRent != null) p.set("maxRent", String(f.maxRent));
  if (f.availableFrom) p.set("availableFrom", f.availableFrom);
  // Date-range availability — the API excludes rooms booked in this window.
  if (f.checkIn) p.set("checkIn", f.checkIn);
  if (f.checkOut) p.set("checkOut", f.checkOut);
  if (f.gender && f.gender !== "any") p.set("gender", GENDER_TO_API[f.gender]);
  if (f.pets) p.set("petsAllowed", "true");
  if (f.smoking) p.set("smokingAllowed", "true");
  if (f.parking) p.set("parking", "true");
  if (f.sort && f.sort !== "recommended") p.set("sort", f.sort);
  if (f.limit) p.set("take", String(f.limit));
  return p;
}

// ── Prisma Room (as returned by the API) ──
interface ApiImage {
  url: string;
  order?: number;
}
interface ApiHostProfile {
  id?: string;
  name?: string;
  superhost?: boolean;
  responseRate?: number;
  avatarColor?: string;
  createdAt?: string;
}
export interface ApiRoom {
  id: string;
  hostId?: string; // scalar FK — present even when `host` isn't included
  name: string;
  region: string;
  city?: string;
  neighborhood?: string;
  lat: number;
  lng: number;
  roomType: string;
  genderPolicy?: string;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  minStayMonths: number;
  availableFrom: string;
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  parking?: boolean;
  images?: ApiImage[];
  amenities?: { amenity?: { label?: string; name?: string } }[];
  host?: ApiHostProfile;
  rating?: number;
  reviews?: number;
  reviewCount?: number;
  reviewList?: {
    rating: number;
    body: string;
    createdAt?: string;
    author?: { name?: string; avatarColor?: string };
  }[];
  description?: string;
  blurb?: string;
  color?: string;
}

// ── Prisma Room → House (flatten + enum decode) ──
export function apiRoomToHouse(r: ApiRoom): House {
  const gallery = (r.images ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((i) => i.url);

  return {
    id: r.id,
    name: r.name,
    // 오늘 기준 입주 중인지 — 서버가 계산해 내려준다.
    occupied: (r as { occupied?: boolean }).occupied ?? false,
    availableAgainFrom:
      (r as { availableAgainFrom?: string | null }).availableAgainFrom ?? null,
    city: r.city ?? "",
    neighborhood: r.neighborhood ?? r.region,
    region: r.region,
    lat: r.lat,
    lng: r.lng,
    monthlyRent: r.monthlyRent,
    deposit: r.deposit,
    cleaningFee: r.cleaningFee,
    maintenanceFee: r.maintenanceFee,
    roomType: fromApiRoomType(r.roomType),
    bedrooms: 1,
    residents: 0,
    capacity: 1,
    amenities: (r.amenities ?? []).map((a) => a.amenity?.label ?? a.amenity?.name ?? "").filter(Boolean),
    vibe: [],
    rating: r.rating ?? 0,
    reviews: r.reviewCount ?? (Array.isArray(r.reviewList) ? r.reviewList.length : r.reviews ?? 0),
    houseReviews: (r.reviewList ?? []).map((rv) => ({
      author: rv.author?.name ?? "게스트",
      rating: rv.rating,
      date: rv.createdAt
        ? `${new Date(rv.createdAt).getFullYear()}.${String(new Date(rv.createdAt).getMonth() + 1).padStart(2, "0")}`
        : "",
      body: rv.body,
      avatarColor: rv.author?.avatarColor ?? "#FF5A5F",
    })),
    color: r.color ?? "#FF5A5F",
    photo: gallery[0],
    gallery,
    blurb: r.blurb ?? "",
    description: r.description,
    // Keep a host object whenever we know *who* the host is, even if the
    // endpoint didn't include the full profile — the contact button only needs
    // the id, and losing the whole block would hide the host section entirely.
    host:
      r.host || r.hostId
        ? {
            id: r.host?.id ?? r.hostId,
            name: r.host?.name ?? "호스트",
            since: r.host?.createdAt ? new Date(r.host.createdAt).getFullYear().toString() : "",
            superhost: r.host?.superhost ?? false,
            responseRate: r.host?.responseRate ?? 100,
            avatarColor: r.host?.avatarColor ?? "#FF5A5F",
          }
        : undefined,
    availableFrom:
      typeof r.availableFrom === "string"
        ? r.availableFrom.slice(0, 10)
        : new Date(r.availableFrom).toISOString().slice(0, 10),
    minStayMonths: r.minStayMonths,
    genderPolicy: GENDER_FROM_API[r.genderPolicy ?? "ANY"] ?? "any",
    petsAllowed: r.petsAllowed ?? false,
    smokingAllowed: r.smokingAllowed ?? false,
    parking: r.parking ?? false,
  };
}

// ── paginated search response → PaginatedRooms ──
export interface ApiSearchResponse {
  items: ApiRoom[];
  nextCursor: string | null;
  total?: number;
}

export function apiSearchToPaginated(res: ApiSearchResponse): PaginatedRooms {
  return {
    items: res.items.map(apiRoomToHouse),
    nextCursor: res.nextCursor,
    total: res.total ?? res.items.length,
  };
}

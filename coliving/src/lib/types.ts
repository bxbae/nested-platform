// ── Domain model for the Nested co-living platform ──────────────────

// Aligns with ARCHITECTURE.md RoomType enum
export type RoomType = "one_room" | "share_room" | "whole_house" | "apartment";
export type GenderPolicy = "any" | "male_only" | "female_only";

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  one_room: "원룸",
  share_room: "쉐어룸",
  whole_house: "독채",
  apartment: "아파트",
};

export const GENDER_LABELS: Record<GenderPolicy, string> = {
  any: "성별 무관",
  male_only: "남성 전용",
  female_only: "여성 전용",
};

export interface House {
  id: string;
  name: string;
  city: string;
  neighborhood: string;
  region: string; // facet key, e.g. "Seongsu-dong"
  lat: number;
  lng: number;
  monthlyRent: number; // KRW
  deposit: number;
  cleaningFee: number; // 청소비 (one-time, due at move-in)
  maintenanceFee: number; // 관리비 (monthly)
  roomType: RoomType;
  bedrooms: number;
  residents: number;
  capacity: number;
  amenities: string[];
  vibe: string[]; // e.g. "quiet", "social", "creative"
  rating: number;
  reviews: number;
  color: string; // accent used in the card ring
  photo?: string; // primary thumbnail image url
  gallery?: string[]; // additional gallery images
  blurb: string;
  description?: string; // long-form 숙소 소개
  host?: {
    id?: string; // needed to open a chat thread with them
    name: string;
    since: string; // e.g. "2023"
    superhost: boolean;
    responseRate: number; // percent
    avatarColor: string;
  };
  houseReviews?: {
    author: string;
    rating: number;
    date: string; // "2026.05"
    body: string;
    avatarColor: string;
  }[];
  availableFrom: string; // ISO date
  minStayMonths: number;
  // filter dimensions
  genderPolicy: GenderPolicy;
  petsAllowed: boolean;
  smokingAllowed: boolean;
  parking: boolean;
  commute?: {
    minutes: number;
    km: number;
    mode: string;
    hubId: string;
  };
}

export interface Resident {
  id: string;
  name: string;
  age: number;
  occupation: string;
  bio: string;
  sleepSchedule: "early" | "flexible" | "night";
  cleanliness: 1 | 2 | 3 | 4 | 5;
  social: 1 | 2 | 3 | 4 | 5;
  interests: string[];
  smoker: boolean;
  pets: boolean;
}

export interface MatchResult {
  resident: Resident;
  score: number; // 0..100
  reasons: string[];
}

export interface Post {
  id: string;
  houseId: string;
  author: string;
  authorId?: string;
  category: "notice" | "event" | "chore" | "market" | "chat" | "seeking";
  title: string;
  body: string;
  createdAt: string;
  replies: number;
  pinned: boolean;
}

export interface Booking {
  id: string;
  houseId: string;
  houseName: string;
  guestName: string;
  moveIn: string;
  months: number;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  totalDueNow: number;
  serviceFeeRate: number; // e.g. 0.05
  status: "hold" | "paid" | "cancelled";
  rawStatus?: string; // original server status, for states the 3-way map collapses
  createdAt: string;
}

export interface MatchPreferences {
  sleepSchedule: "early" | "flexible" | "night";
  cleanliness: number;
  social: number;
  interests: string[];
  smoker: boolean;
  pets: boolean;
}

// ── Search ──────────────────────────────────────────────────────────
export type SortKey = "recommended" | "price_asc" | "price_desc" | "rating" | "newest";

export interface SearchParams {
  q?: string;
  region?: string;
  roomTypes?: RoomType[];
  minRent?: number;
  maxRent?: number;
  availableFrom?: string; // ISO date; house must be available on/before this
  // Stay window (숙박 기간). Both set → only rooms with no overlapping
  // reservation for that window are returned.
  checkIn?: string; // ISO date
  checkOut?: string; // ISO date
  gender?: GenderPolicy;
  pets?: boolean; // if true, only pet-friendly
  smoking?: boolean; // if true, only smoking-allowed
  parking?: boolean; // if true, only parking
  sort?: SortKey;
  cursor?: string | null;
  limit?: number;
}

export interface PaginatedRooms {
  items: House[];
  nextCursor: string | null;
  total: number;
}

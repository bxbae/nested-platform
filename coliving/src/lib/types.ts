// ── Domain model for the Nested co-living platform ──────────────────

// Aligns with ARCHITECTURE.md RoomType enum
export type RoomType = "one_room" | "share_room" | "whole_house" | "apartment";
export type RentalUnit = "whole" | "private_room" | "bed";
export type BuildingType = "studio" | "apartment" | "house";
export type SharedFacility =
  | "bathroom"
  | "kitchen"
  | "living_room"
  | "laundry_room"
  | "entrance";
export type BookingMode = "unit" | "bed" | "whole_room";
export type GenderPolicy = "any" | "male_only" | "female_only";

// 기존 RoomType 라벨은 분류 확인이 끝나지 않은 운영 데이터 표시용으로 유지한다.
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  one_room: "기존 개인실·원룸",
  share_room: "기존 쉐어룸",
  whole_house: "독채",
  apartment: "기존 아파트",
};

export const RENTAL_UNIT_LABELS: Record<RentalUnit, string> = {
  whole: "전체 숙소",
  private_room: "개인실",
  bed: "다인실·침대",
};

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  studio: "원룸",
  apartment: "아파트",
  house: "주택",
};

export const SHARED_FACILITY_LABELS: Record<SharedFacility, string> = {
  bathroom: "욕실·샤워실",
  kitchen: "주방",
  living_room: "거실",
  laundry_room: "세탁실",
  entrance: "출입구",
};

export function getAccommodationLabel(house: Pick<House, "rentalUnit" | "buildingType" | "roomType">): string {
  if (house.rentalUnit && house.buildingType) {
    return `${BUILDING_TYPE_LABELS[house.buildingType]} · ${RENTAL_UNIT_LABELS[house.rentalUnit]}`;
  }
  if (house.rentalUnit) return RENTAL_UNIT_LABELS[house.rentalUnit];
  if (house.buildingType) return `${BUILDING_TYPE_LABELS[house.buildingType]} · 분류 확인 필요`;
  return ROOM_TYPE_LABELS[house.roomType];
}

export function getPriceUnitLabel(rentalUnit?: RentalUnit | null): string {
  if (rentalUnit === "whole") return "숙소 전체";
  if (rentalUnit === "private_room") return "개인실";
  if (rentalUnit === "bed") return "1자리";
  return "숙소";
}

export const GENDER_LABELS: Record<GenderPolicy, string> = {
  any: "성별 무관",
  male_only: "남성 전용",
  female_only: "여성 전용",
};
export const VIBE_LABELS: Record<string, string> = {
  quiet: "조용함",
  social: "사교적",
  creative: "창의적",
  calm: "차분함",
  focused: "집중형",
  independent: "독립적",
  international: "국제적",
  wellness: "건강 중심",
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
  /** 신규 3축 숙소 분류. 기존 데이터는 null일 수 있다. */
  rentalUnit?: RentalUnit | null;
  buildingType?: BuildingType | null;
  sharedFacilities?: SharedFacility[];
  classificationReviewRequired?: boolean;
  /** 침실 개수. 미입력이면 null. */
  bedrooms: number | null;
  residents: number;
  /** 함께 지낼 수 있는 최대 인원. 기존 데이터는 null일 수 있다. */
  capacity: number | null;
  amenities: string[];
  vibe: string[]; // e.g. "quiet", "social", "creative"
  rating: number;
  reviews: number;
  /** 오늘 기준 누군가 살고 있어 지금은 입주할 수 없는 방 */
  occupied?: boolean;
  /** 현재 예약이 끝나 다시 들어갈 수 있는 날 (occupied 일 때만) */
  availableAgainFrom?: string | null;
  /** 로그인한 사용자 본인이 등록한 숙소인지 (비로그인/타인 숙소면 false) */
  isMine?: boolean;
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
    avatarUrl?: string | null;
  };
  houseReviews?: {
    // 실제 API에서 온 리뷰만 값이 있다 — enrichHouse()의 데모 폴백 리뷰는
    // DB에 없는 가짜 데이터라 신고할 대상 자체가 없으므로 id가 없다.
    id?: string;
    authorId?: string;
    author: string;
    rating: number;
    date: string; // "2026.05"
    body: string;
    avatarColor: string;
    avatarUrl?: string | null;
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
  authorAvatarColor?: string | null;
  authorAvatarUrl?: string | null;
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
  bookingMode?: BookingMode;
  reservedSpots?: number;
  rawStatus?: string; // original server status, for states the 3-way map collapses
  checkOut?: string;  // YYYY-MM-DD — used for the contract D-day countdown
  extensionMonths?: number | null; // pending extension request, if any
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
  district?: string;
  legalDongCode?: string;
  verified?: boolean;
  /** @deprecated 기존 URL 호환용. 신규 검색 UI는 아래 3축을 사용한다. */
  roomTypes?: RoomType[];
  rentalUnits?: RentalUnit[];
  buildingTypes?: BuildingType[];
  sharedFacilities?: SharedFacility[];
  minRent?: number;
  maxRent?: number;
  availableFrom?: string; // ISO date; house must be available on/before this
  // Stay window (숙박 기간). Both set → only rooms with no overlapping
  // reservation for that window are returned.
  checkIn?: string; // ISO date
  checkOut?: string; // ISO date
  /** 최소 수용 인원 — "N명 이상" */
  minCapacity?: number;
  /** 최소 침실 개수 — "방 N개 이상" */
  minBedrooms?: number;
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

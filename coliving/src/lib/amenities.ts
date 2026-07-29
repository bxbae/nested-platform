import type { AmenityKey } from "@/lib/types";

/**
 * 숙소 등록·수정·검색 필터가 함께 사용하는 편의시설 목록입니다.
 *
 * 값은 DB Amenity.key와 동일하게 유지합니다. 기존 운영 데이터에서 이미
 * 사용 중인 wifi/laundry/aircon/desk/rooftop 키는 이름을 바꾸지 않습니다.
 */
export const AMENITY_OPTIONS = [
  { key: "wifi", label: "초고속 와이파이" },
  { key: "laundry", label: "세탁시설" },
  { key: "aircon", label: "냉난방" },
  { key: "desk", label: "코워킹 공간" },
  { key: "weekly_cleaning", label: "주 1회 청소" },
  { key: "gym", label: "헬스장" },
  { key: "rooftop", label: "루프탑" },
  { key: "garden", label: "정원·테라스" },
  { key: "parcel_locker", label: "무인 택배함" },
  { key: "elevator", label: "엘리베이터" },
  { key: "step_free_access", label: "무단차 출입 가능" },
] as const satisfies readonly { key: AmenityKey; label: string }[];

export const AMENITY_KEYS = AMENITY_OPTIONS.map(
  (option) => option.key,
) as AmenityKey[];

// 기존 RoomAmenity 관계에서만 사용되던 키도 읽을 수 있게 유지합니다.
export const LEGACY_AMENITY_KEYS = ["kitchen", "parking"] as const satisfies readonly AmenityKey[];

export const ALL_AMENITY_KEYS = [
  ...AMENITY_KEYS,
  ...LEGACY_AMENITY_KEYS,
] as AmenityKey[];

const AMENITY_KEY_SET = new Set<string>(ALL_AMENITY_KEYS);

export function isAmenityKey(value: unknown): value is AmenityKey {
  return typeof value === "string" && AMENITY_KEY_SET.has(value);
}

export const AMENITY_KEY_LABELS = Object.fromEntries(
  AMENITY_OPTIONS.map((option) => [option.key, option.label]),
) as Record<AmenityKey, string>;

// 기존 화면·시드 데이터가 영문 라벨을 넘겨도 표시가 깨지지 않도록 유지합니다.
const LEGACY_AMENITY_LABELS: Record<string, string> = {
  Rooftop: "루프탑",
  "Coworking room": "코워킹 공간",
  Laundry: "세탁시설",
  "Fiber wifi": "초고속 와이파이",
  "Weekly cleaning": "주 1회 청소",
  Gym: "헬스장",
  Garden: "정원·테라스",
  "Bike storage": "자전거 보관소",
  "Parcel locker": "무인 택배함",
  Ensuite: "개별 욕실",
  "Reading nook": "독서 공간",
  "Yoga room": "요가실",
  Workshop: "작업실",
  "3D printers": "3D 프린터",
  Terrace: "정원·테라스",
  "River view": "한강 전망",
  "Communal dinners": "공동 식사",
};

export function getAmenityLabel(amenity: string): string {
  return (
    AMENITY_KEY_LABELS[amenity as AmenityKey] ??
    LEGACY_AMENITY_LABELS[amenity] ??
    amenity
  );
}

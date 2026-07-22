export const AMENITY_LABELS: Record<string, string> = {
  Rooftop: "루프탑",
  "Coworking room": "코워킹 공간",
  Laundry: "세탁실",
  "Fiber wifi": "초고속 와이파이",
  "Weekly cleaning": "주 1회 청소",
  Gym: "헬스장",
  Garden: "정원",
  "Bike storage": "자전거 보관소",
  "Parcel locker": "무인 택배함",
  Ensuite: "개별 욕실",
  "Reading nook": "독서 공간",
  "Yoga room": "요가실",
  Workshop: "작업실",
  "3D printers": "3D 프린터",
  Terrace: "테라스",
  "River view": "한강 전망",
  "Communal dinners": "공동 식사",
};

export function getAmenityLabel(amenity: string): string {
  return AMENITY_LABELS[amenity] ?? amenity;
}

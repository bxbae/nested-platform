import { houses } from "./data";
import { ROOM_TYPE_LABELS, type RoomType } from "./types";
import { districtForRegion } from "./seoul";

const DISTRICT_COPY: Record<string, string> = {
  강남구: "역삼·논현·삼성 업무 생활권",
  서초구: "교통과 생활 인프라가 안정적인 지역",
  마포구: "망원·합정·연남 커뮤니티 생활권",
  성동구: "성수·서울숲의 활기찬 생활권",
  용산구: "용산·이태원의 국제적인 생활 환경",
  영등포구: "여의도와 가까운 직장인 생활권",
  종로구: "도심 업무지구와 문화생활을 함께",
  관악구: "합리적인 월세와 대학가 생활권",
  구로구: "구로·가산 업무지구 접근이 편리",
  분당구: "판교 업무지구와 가까운 주거 환경",
};

export function popularRegions(limit = 6) {
  const grouped = new Map<string, { count: number; photo?: string }>();
  for (const h of houses) {
    const district = districtForRegion(h.region);
    const current = grouped.get(district) ?? { count: 0, photo: undefined };
    grouped.set(district, { count: current.count + 1, photo: current.photo ?? h.photo });
  }
  return Array.from(grouped.entries())
    .map(([district, value]) => ({ district, count: value.count, photo: value.photo, description: DISTRICT_COPY[district] ?? "서울의 편리한 공유주거 생활권" }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function recommendedHomes(limit = 4) {
  return [...houses].sort((a, b) => b.rating * b.reviews - a.rating * a.reviews).slice(0, limit);
}

const CATEGORY_META: Record<RoomType, { blurb: string; emoji: string }> = {
  one_room: { blurb: "개인 공간을 확보하며 함께 살기", emoji: "🛏️" },
  share_room: { blurb: "합리적인 비용으로 함께", emoji: "🛋️" },
  whole_house: { blurb: "집 전체를 오롯이", emoji: "🏡" },
  apartment: { blurb: "설비 갖춘 독립 생활", emoji: "🏢" },
};

export function categories() {
  const order: RoomType[] = ["one_room", "share_room", "whole_house", "apartment"];
  return order.map((rt) => ({ roomType: rt, label: ROOM_TYPE_LABELS[rt], blurb: CATEGORY_META[rt].blurb, emoji: CATEGORY_META[rt].emoji, count: houses.filter((h) => h.roomType === rt).length }));
}

export const totalListings = houses.length;

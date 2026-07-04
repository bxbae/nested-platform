import { houses } from "./data";
import { ROOM_TYPE_LABELS, type RoomType } from "./types";

// ── Popular regions ── ranked by number of active listings.
export function popularRegions(limit = 6) {
  const counts = new Map<string, number>();
  for (const h of houses) {
    counts.set(h.region, (counts.get(h.region) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── Recommended homes ── highest rating × review volume.
export function recommendedHomes(limit = 4) {
  return [...houses]
    .sort((a, b) => b.rating * b.reviews - a.rating * a.reviews)
    .slice(0, limit);
}

// ── Categories ── the four room types with counts + copy.
const CATEGORY_META: Record<RoomType, { blurb: string; emoji: string }> = {
  one_room: { blurb: "혼자만의 공간이 필요할 때", emoji: "🛏️" },
  share_room: { blurb: "합리적인 비용으로 함께", emoji: "🛋️" },
  whole_house: { blurb: "집 전체를 오롯이", emoji: "🏡" },
  apartment: { blurb: "설비 갖춘 독립 생활", emoji: "🏢" },
};

export function categories() {
  const order: RoomType[] = ["one_room", "share_room", "whole_house", "apartment"];
  return order.map((rt) => ({
    roomType: rt,
    label: ROOM_TYPE_LABELS[rt],
    blurb: CATEGORY_META[rt].blurb,
    emoji: CATEGORY_META[rt].emoji,
    count: houses.filter((h) => h.roomType === rt).length,
  }));
}

export const totalListings = houses.length;

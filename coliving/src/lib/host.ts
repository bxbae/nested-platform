import { houses } from "./data";
import { enrichHouse } from "./detail";
import type { House } from "./types";

// The signed-in host owns a fixed subset of listings (demo).
export const MY_HOUSE_IDS = ["h1", "h5", "h6", "h7"];

export function myListings(): House[] {
  return houses.filter((h) => MY_HOUSE_IDS.includes(h.id));
}

// ── Revenue dashboard figures (deterministic from listing data) ──
export function revenueSummary() {
  const listings = myListings();
  const monthly = listings.reduce((sum, h) => sum + h.monthlyRent * h.residents, 0);
  const occupancy = Math.round(
    (listings.reduce((s, h) => s + h.residents, 0) /
      listings.reduce((s, h) => s + (h.capacity ?? 0), 0)) *
      100
  );
  const upcoming = 3; // demo
  return {
    thisMonth: monthly,
    lastMonth: Math.round(monthly * 0.92),
    occupancy,
    listingCount: listings.length,
    reservationCount: listings.length * 3 + 2,
    upcoming,
  };
}

// 6-month revenue trend for the dashboard chart
export function revenueTrend() {
  const base = revenueSummary().thisMonth;
  const months = ["1월", "2월", "3월", "4월", "5월", "6월"];
  const factors = [0.72, 0.78, 0.85, 0.88, 0.94, 1];
  return months.map((m, i) => ({ month: m, value: Math.round(base * factors[i]) }));
}

// ── Inquiries (문의 관리) ──
export interface Inquiry {
  id: string;
  guest: string;
  avatarColor: string;
  houseId: string;
  houseName: string;
  message: string;
  date: string;
  unread: boolean;
}

const AVA = ["#FF7A5C", "#00A699", "#3E9BC4", "#7C6FE0", "#FFB400"];
const INQUIRY_MSGS = [
  "9월 초 입주 가능한가요? 3개월 정도 생각하고 있어요.",
  "반려묘와 함께 입주할 수 있을까요?",
  "주차 공간이 따로 있는지 궁금합니다.",
  "방 사진을 몇 장 더 볼 수 있을까요?",
  "장기 계약 시 할인이 있는지 문의드려요.",
];
const GUESTS = ["김민수", "이지현", "박서준", "최유나", "정하늘"];

export function inquiries(): Inquiry[] {
  const listings = myListings();
  return GUESTS.map((g, i) => ({
    id: `inq${i}`,
    guest: g,
    avatarColor: AVA[i % AVA.length],
    houseId: listings[i % listings.length].id,
    houseName: listings[i % listings.length].name.trim(),
    message: INQUIRY_MSGS[i % INQUIRY_MSGS.length],
    date: `2026.07.0${(i % 5) + 1}`,
    unread: i < 2,
  }));
}

// ── Reviews across my listings (리뷰 관리) ──
export function hostReviews() {
  return myListings().flatMap((h) => {
    const enriched = enrichHouse(h);
    return enriched.houseReviews.slice(0, 2).map((r) => ({
      ...r,
      houseId: h.id,
      houseName: h.name.trim(),
    }));
  });
}

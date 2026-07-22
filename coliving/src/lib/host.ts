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
  const occ = revenueSummary().occupancy;
  const months = ["1월", "2월", "3월", "4월", "5월", "6월"];
  const factors = [0.72, 0.78, 0.85, 0.88, 0.94, 1];
  return months.map((m, i) => ({ 
    month: m, 
    // value: Math.round(base * factors[i])
    revenue: Math.round(base * factors[i]),
    occupancy: Math.round(occ * factors[i]),
  }));
}
// ── Per-room revenue table (demo) ──
export function roomRevenue() {
  return myListings().map((h) => ({
    roomId: h.id,
    roomName: h.name.trim(),
    reservationCount: Math.max(1, Math.round(h.residents * 1.5)),
    occupancyPct: h.capacity ? Math.round((h.residents / h.capacity) * 100) : 100,
    revenue: h.monthlyRent * h.residents,
    netRevenue: Math.round(h.monthlyRent * h.residents * 0.95),
  }));
}

// ── Settlement breakdown (demo) — a fixed, deterministic split of net
// revenue across the three states so the dashboard has something to show
// without a backend. Real numbers come from GET /host/dashboard.
export function settlementBreakdown() {
  const totalNet = roomRevenue().reduce((s, r) => s + r.netRevenue, 0);
  const now = new Date();
  const nextMonth5th = new Date(now.getFullYear(), now.getMonth() + 1, 5)
    .toISOString()
    .slice(0, 10);
  const thisMonth5th = new Date(now.getFullYear(), now.getMonth(), 5)
    .toISOString()
    .slice(0, 10);
  return {
    paid: { amount: Math.round(totalNet * 0.6), count: 3, lastPaidDate: thisMonth5th },
    scheduled: { amount: Math.round(totalNet * 0.3), count: 2, nextDate: nextMonth5th },
    unsettled: { amount: Math.round(totalNet * 0.1), count: 1 },
  };
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

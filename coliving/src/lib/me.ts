import { houses } from "./data";
import { enrichHouse } from "./detail";
import type { House } from "./types";

// The signed-in guest (demo profile, matches mockup: 김하늘 · 게스트).
export const currentUser = {
  name: "김하늘",
  role: "게스트",
  email: "haneul@nested.kr",
  phone: "010-1234-5678",
  joined: "2024",
  avatarColor: "#FF7A5C",
  bio: "성수동에서 조용히 지낼 집을 찾고 있어요. 커피와 러닝을 좋아합니다.",
};

// ── Wishlist (찜 목록) ── a fixed set of saved listings (demo).
export const WISHLIST_IDS = ["h2", "h3", "h6", "h8", "h11"];
export function wishlist(): House[] {
  return houses.filter((h) => WISHLIST_IDS.includes(h.id));
}

// ── Payments (결제 내역) ──
export interface PaymentRecord {
  id: string;
  houseName: string;
  amount: number;
  method: string;
  date: string;
  status: "완료" | "환불";
}
export function payments(): PaymentRecord[] {
  const picks = houses.slice(0, 3);
  return [
    {
      id: "pay1",
      houseName: picks[0].name.trim(),
      amount: picks[0].deposit + picks[0].monthlyRent + picks[0].cleaningFee,
      method: "신한카드 ****1234",
      date: "2026.06.15",
      status: "완료",
    },
    {
      id: "pay2",
      houseName: picks[1].name.trim(),
      amount: picks[1].monthlyRent,
      method: "카카오페이",
      date: "2026.05.02",
      status: "완료",
    },
    {
      id: "pay3",
      houseName: picks[2].name.trim(),
      amount: picks[2].monthlyRent,
      method: "토스페이먼츠",
      date: "2026.04.11",
      status: "환불",
    },
  ];
}

// ── Messages (메시지) ── threads with hosts.
export interface Thread {
  id: string;
  host: string;
  avatarColor: string;
  houseName: string;
  last: string;
  time: string;
  unread: boolean;
  messages: { mine: boolean; body: string; time: string }[];
}
const AVA = ["#00A699", "#3E9BC4", "#7C6FE0", "#FFB400"];
export function threads(): Thread[] {
  const picks = houses.slice(0, 4);
  const hosts = ["이서준", "박지우", "최민서", "정예은"];
  const lasts = [
    "네, 다음 주 금요일 방문 가능합니다!",
    "반려동물 동반 가능하세요. 편하게 오세요.",
    "주차는 건물 지하에 있습니다.",
    "입주 서류는 방문 시 안내드릴게요.",
  ];
  return picks.map((h, i) => ({
    id: `th${i}`,
    host: hosts[i],
    avatarColor: AVA[i % AVA.length],
    houseName: h.name.trim(),
    last: lasts[i],
    time: `오후 ${2 + i}:1${i}`,
    unread: i === 0,
    messages: [
      { mine: true, body: `${h.name.trim()} 입주 문의드려요. 다음 주 방문 가능할까요?`, time: `오후 ${1 + i}:05` },
      { mine: false, body: lasts[i], time: `오후 ${2 + i}:1${i}` },
    ],
  }));
}

// ── Notifications (알림) ──
export interface Notification {
  id: string;
  type: "예약" | "결제" | "메시지" | "리뷰" | "시스템";
  title: string;
  body: string;
  time: string;
  unread: boolean;
}
export function notifications(): Notification[] {
  return [
    { id: "n1", type: "예약", title: "예약이 확정되었습니다", body: "Seongsu Loom · 9월 1일 입주", time: "2시간 전", unread: true },
    { id: "n2", type: "메시지", title: "이서준 호스트의 답변", body: "다음 주 금요일 방문 가능합니다!", time: "5시간 전", unread: true },
    { id: "n3", type: "결제", title: "결제가 완료되었습니다", body: "₩3,880,000 · 신한카드", time: "1일 전", unread: false },
    { id: "n4", type: "리뷰", title: "후기를 남겨주세요", body: "Yeonnam Quiet House 거주는 어떠셨나요?", time: "3일 전", unread: false },
    { id: "n5", type: "시스템", title: "새로운 쿠폰이 도착했어요", body: "첫 달 5% 할인 쿠폰", time: "5일 전", unread: false },
  ];
}

// ── My reviews (리뷰 관리) ── reviews I've written.
export function myReviews() {
  const picks = houses.slice(2, 5);
  const bodies = [
    "위치가 좋고 하우스메이트들이 친절했어요. 다음에도 살고 싶어요.",
    "방음이 잘 되고 공용 공간이 깔끔했습니다.",
    "호스트님이 친절하게 안내해주셨어요. 추천합니다.",
  ];
  return picks.map((h, i) => ({
    houseId: h.id,
    houseName: h.name.trim(),
    rating: 5 - (i % 2),
    date: `2026.0${5 - i}`,
    body: bodies[i],
  }));
}

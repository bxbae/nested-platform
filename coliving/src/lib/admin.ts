import { houses } from "./data";
import { won } from "./format";

// ── Admin domain data (demo). In production these come from admin APIs
// (ARCHITECTURE.md §7.8). ──

// Members (회원 관리)
export interface Member {
  id: string;
  name: string;
  email: string;
  role: "게스트" | "호스트";
  status: "정상" | "정지";
  joined: string;
  bookings: number;
  avatarColor: string;
}
const AVA = ["#FF7A5C", "#00A699", "#3E9BC4", "#7C6FE0", "#FFB400", "#4A8FD6"];
const NAMES = ["김하늘", "이서준", "박지우", "최민서", "정예은", "강도윤", "윤하은", "임시우", "한지민", "오세훈"];
export function members(): Member[] {
  return NAMES.map((name, i) => ({
    id: `u${i + 1}`,
    name,
    email: `${["haneul","seojun","jiwoo","minseo","yeeun","doyoon","haeun","siwoo","jimin","sehun"][i]}@nested.kr`,
    role: i % 3 === 0 ? "호스트" : "게스트",
    status: i === 7 ? "정지" : "정상",
    joined: `2024.0${(i % 9) + 1}`,
    bookings: (i * 3) % 11,
    avatarColor: AVA[i % AVA.length],
  }));
}

// Pending listing approvals (숙소 승인)
export interface PendingListing {
  id: string;
  name: string;
  host: string;
  region: string;
  monthlyRent: number;
  submitted: string;
  color: string;
}
export function pendingListings(): PendingListing[] {
  return houses.slice(8, 13).map((h, i) => ({
    id: h.id,
    name: h.name.trim(),
    host: NAMES[(i + 1) % NAMES.length],
    region: h.region,
    monthlyRent: h.monthlyRent,
    submitted: `2026.07.0${i + 1}`,
    color: h.color,
  }));
}

// Reports (신고 관리)
export interface Report {
  id: string;
  targetType: "숙소" | "리뷰" | "회원" | "메시지";
  target: string;
  reporter: string;
  reason: string;
  status: "접수" | "검토중" | "처리완료";
  date: string;
}
export function reports(): Report[] {
  return [
    { id: "r1", targetType: "숙소", target: "Hongdae Maker House", reporter: "김하늘", reason: "허위 매물 의심", status: "접수", date: "2026.07.02" },
    { id: "r2", targetType: "리뷰", target: "부적절한 후기", reporter: "이서준", reason: "욕설/비방", status: "검토중", date: "2026.07.01" },
    { id: "r3", targetType: "회원", target: "정예은", reporter: "박지우", reason: "노쇼 반복", status: "접수", date: "2026.06.30" },
    { id: "r4", targetType: "메시지", target: "스팸 링크", reporter: "최민서", reason: "광고성 메시지", status: "처리완료", date: "2026.06.28" },
  ];
}

// Statistics (통계)
export function stats() {
  return {
    dau: 1240,
    mau: 18500,
    newSignups: 86,
    conversion: 4.2,
    trend: [
      { label: "월", value: 62 }, { label: "화", value: 71 }, { label: "수", value: 68 },
      { label: "목", value: 84 }, { label: "금", value: 96 }, { label: "토", value: 110 }, { label: "일", value: 88 },
    ],
    regionShare: [
      { region: "Seongsu-dong", pct: 24 },
      { region: "Yeonnam-dong", pct: 18 },
      { region: "Mangwon-dong", pct: 15 },
      { region: "Gangnam-gu", pct: 13 },
      { region: "기타", pct: 30 },
    ],
  };
}

// Revenue (매출 관리)
export function revenue() {
  const gmv = houses.reduce((s, h) => s + h.monthlyRent * h.residents, 0);
  const commission = Math.round(gmv * 0.05);
  return {
    gmv,
    commission,
    payouts: gmv - commission,
    refunds: Math.round(gmv * 0.008),
    trend: [
      { month: "1월", value: Math.round(gmv * 0.7) },
      { month: "2월", value: Math.round(gmv * 0.76) },
      { month: "3월", value: Math.round(gmv * 0.83) },
      { month: "4월", value: Math.round(gmv * 0.88) },
      { month: "5월", value: Math.round(gmv * 0.94) },
      { month: "6월", value: gmv },
    ],
  };
}

// Notices (공지사항)
export interface Notice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  date: string;
}
export function notices(): Notice[] {
  return [
    { id: "no1", title: "7월 정기 점검 안내", body: "7월 15일 새벽 2~4시 서비스 점검이 진행됩니다.", pinned: true, date: "2026.07.01" },
    { id: "no2", title: "여름 이벤트 쿠폰 배포", body: "첫 달 5% 할인 쿠폰을 전 회원에게 배포합니다.", pinned: false, date: "2026.06.25" },
    { id: "no3", title: "이용약관 개정 안내", body: "환불 정책 관련 약관이 일부 개정되었습니다.", pinned: false, date: "2026.06.10" },
  ];
}

// Coupons (쿠폰 관리)
export interface Coupon {
  id: string;
  code: string;
  type: "정액" | "정률";
  value: number;
  used: number;
  limit: number;
  validTo: string;
  active: boolean;
}
export function coupons(): Coupon[] {
  return [
    { id: "c1", code: "WELCOME5", type: "정률", value: 5, used: 342, limit: 1000, validTo: "2026.08.31", active: true },
    { id: "c2", code: "SUMMER50K", type: "정액", value: 50000, used: 88, limit: 200, validTo: "2026.07.31", active: true },
    { id: "c3", code: "SPRING10", type: "정률", value: 10, used: 500, limit: 500, validTo: "2026.05.31", active: false },
  ];
}

// Banners (배너 관리)
export interface Banner {
  id: string;
  title: string;
  position: "메인 상단" | "검색 결과" | "앱 홈";
  active: boolean;
  color: string;
}
export function banners(): Banner[] {
  return [
    { id: "b1", title: "여름 이사 시즌 특가", position: "메인 상단", active: true, color: "#FF5A5F" },
    { id: "b2", title: "신규 입주자 5% 할인", position: "검색 결과", active: true, color: "#00A699" },
    { id: "b3", title: "룸메이트 매칭 오픈", position: "앱 홈", active: false, color: "#7C6FE0" },
  ];
}

export { won };

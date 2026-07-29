// ── Admin service ────────────────────────────────────────────────────
// Approval queue for new listings. A room is created with published=false and
// stays out of search until an admin approves it here.

import { api } from "./client";
import { apiRoomToHouse, type ApiRoom } from "./adapters";
import type { House } from "@/lib/types";

export interface PendingListing extends House {
  address: string | null;
  verifiedByHost: boolean;
  hostName: string;
  submittedAt: string;
}

// GET /admin/rooms/pending
export async function listPendingRooms(): Promise<PendingListing[]> {
  const rows = await api.get<
    (ApiRoom & {
      address?: string | null;
      verifiedByHost?: boolean;
      createdAt: string;
      host?: { name?: string };
    })[]
  >("/admin/rooms/pending");

  return rows.map((r) => ({
    ...apiRoomToHouse(r),
    address: r.address ?? null,
    verifiedByHost: r.verifiedByHost ?? false,
    hostName: r.host?.name ?? "호스트",
    submittedAt: r.createdAt,
  }));
}

export interface PublishedListing extends PendingListing {
  rating: number;
  reviewCount: number;
}

// 필터/검색/페이징 쿼리 파라미터
export interface PublishedRoomsQuery {
  buildingType?: string;
  rentalUnit?: string;
  nickname?: string;
  page?: number;
  pageSize?: number;
}

// 페이징 응답 형태 (백엔드 admin.module.ts의 반환 형태와 동일)
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// GET /admin/rooms/published — 게시중 숙소, 별점 낮은 순
export async function listPublishedRooms(
  query: PublishedRoomsQuery = {},
): Promise<PaginatedResult<PublishedListing>> {
  const params = new URLSearchParams();
  if (query.buildingType) params.set("buildingType", query.buildingType);
  if (query.rentalUnit) params.set("rentalUnit", query.rentalUnit);
  if (query.nickname) params.set("nickname", query.nickname);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();

  const res = await api.get<{
    items: (ApiRoom & {
      address?: string | null;
      verifiedByHost?: boolean;
      createdAt: string;
      host?: { name?: string };
      rating: number;
      reviewCount: number;
    })[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/admin/rooms/published${qs ? `?${qs}` : ""}`);

  return {
    items: res.items.map((r) => ({
      ...apiRoomToHouse(r),
      address: r.address ?? null,
      verifiedByHost: r.verifiedByHost ?? false,
      hostName: r.host?.name ?? "호스트",
      submittedAt: r.createdAt,
      rating: r.rating,
      reviewCount: r.reviewCount,
    })),
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
  };
}

// 후기가 3건 이상 쌓였고 평균이 3.0 미만이면 검토 대상으로 봅니다.
// 후기 1~2건은 한 건만으로 평균이 크게 흔들려 오탐이 많습니다.
export const LOW_RATING_THRESHOLD = 3.0;
export const MIN_REVIEWS_FOR_WARNING = 3;

export function isLowRated(room: PublishedListing): boolean {
  return room.reviewCount >= MIN_REVIEWS_FOR_WARNING && room.rating < LOW_RATING_THRESHOLD;
}

// PATCH /admin/rooms/:id/publish — makes the listing searchable
// ── Members (reference pattern for the admin section) ──
// A page becomes "real" by: (1) a typed shape for the API response, (2) a
// function per endpoint that calls `api`, (3) the page calling these in an
// effect. Copy this shape for reports, stats, etc.

// ── Dashboard stats ──
export interface AdminStats {
  users: number;
  rooms: number;
  reservations: number;
  gmv: number;        // gross merchandise value, in KRW
  commission: number; // platform cut (5% of gmv)
}

// GET /admin/stats — platform totals (not a time series).
export async function getStats(): Promise<AdminStats> {
  return api.get<AdminStats>("/admin/stats");
}

// GET /admin/dashboard/summary — 대시보드 전용 집계(오늘/이번달/예약현황).
export interface MetricPoint {
  value: number;
  delta: number | null; // 전일 대비 %, 어제가 0이면 null
}

export interface DashboardSummary {
  today: {
    reservations: MetricPoint;
    newUsers: MetricPoint;
    newHosts: MetricPoint;
    inquiries: MetricPoint;
    reports: MetricPoint;
    cancels: MetricPoint;
  };
  month: {
    revenue: number;
    netProfit: number;
  };
  totals: {
    hosts: number;
    avgRating: number | null;
  };
  reservationStatus: {
    pendingPayment: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>("/admin/dashboard/summary");
}

// ── Trash (휴지통 · 소프트 삭제 복구) ──
// 삭제는 deletedAt 을 찍기만 하므로, 여기서 목록을 보고 되돌릴 수 있다.
export interface TrashedPost {
  id: string;
  title: string;
  body: string;
  authorName: string;
  deletedAt: string;
  createdAt: string;
}

export interface TrashedComment {
  id: string;
  body: string;
  authorName: string;
  postId: string | null;
  postTitle: string;
  deletedAt: string;
  createdAt: string;
}

// GET /admin/trash
export async function listTrash(): Promise<{
  posts: TrashedPost[];
  comments: TrashedComment[];
}> {
  return api.get<{ posts: TrashedPost[]; comments: TrashedComment[] }>(
    "/admin/trash",
  );
}

// PATCH /admin/trash/posts/:id/restore
export async function restorePost(id: string): Promise<void> {
  await api.patch(`/admin/trash/posts/${id}/restore`);
}

// PATCH /admin/trash/comments/:id/restore
// 원글이 삭제된 상태였다면 서버가 원글도 함께 되살린다.
export async function restoreComment(id: string): Promise<void> {
  await api.patch(`/admin/trash/comments/${id}/restore`);
}

// ── Reports (신고 관리) ──

export type ReportStatus = "RECEIVED" | "IN_REVIEW" | "RESOLVED";
export type ReportTargetType = "ROOM" | "REVIEW" | "USER" | "MESSAGE" | "COMMUNITY_POST" | "COMMUNITY_COMMENT";

export interface AdminReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  // 신고 대상을 나타내는 사람의 닉네임 (ROOM은 그 방 호스트, REVIEW/
  // COMMUNITY_POST/COMMUNITY_COMMENT는 작성자, MESSAGE는 보낸 사람,
  // USER는 그 사용자 본인). 대상이 삭제됐거나 못 찾으면 null — 그때는
  // 프론트가 targetId를 대신 보여준다.
  targetName: string | null;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reporterId: string;
  reporterName: string;
}

export interface AdminReportPage {
  rows: AdminReport[];
  total: number;
  take: number;
  skip: number;
}

// GET /admin/reports?status=&take=&skip= — status 생략하면 전체.
export async function listReports(
  status?: ReportStatus,
  take = 20,
  skip = 0,
): Promise<AdminReportPage> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("take", String(take));
  params.set("skip", String(skip));
  return api.get<AdminReportPage>(`/admin/reports?${params.toString()}`);
}

// PATCH /admin/reports/:id — move a report through RECEIVED → IN_REVIEW → RESOLVED.
export async function setReportStatus(id: string, status: ReportStatus): Promise<void> {
  await api.patch(`/admin/reports/${id}`, { status });
}

// ── Report context / chat view / notify (신고 상세 · 채팅 보기 · 알림) ──

export interface ReportAccountRef {
  id: string;
  name: string;
  email: string;
}

export interface ReportChatRef {
  kind: "ROOM" | "DIRECT";
  id: string;
}

export interface ReportedReview {
  id: string;
  body: string;
  rating: number;
  createdAt: string;
  room: { id: string; name: string };
}

export interface ReportContext {
  reporter: ReportAccountRef;
  reported: ReportAccountRef | null;
  chat: ReportChatRef | null;
  review: ReportedReview | null;
}

// GET /admin/reports/:id/context
export async function getReportContext(reportId: string): Promise<ReportContext> {
  return api.get<ReportContext>(`/admin/reports/${reportId}/context`);
}

export interface AdminChatMessage {
  id: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface AdminRoomChat {
  guest: ReportAccountRef;
  host: ReportAccountRef;
  messages: AdminChatMessage[];
}

export interface AdminDirectChat {
  participantA: ReportAccountRef;
  participantB: ReportAccountRef;
  messages: AdminChatMessage[];
}

// GET /admin/chat/rooms/:id — 신고된 메시지가 속한 채팅방 전체 보기
export async function getRoomChat(chatRoomId: string): Promise<AdminRoomChat> {
  return api.get<AdminRoomChat>(`/admin/chat/rooms/${chatRoomId}`);
}

// GET /admin/chat/direct/:id — 신고된 메시지가 속한 1:1 다이렉트 대화 전체 보기
export async function getDirectChat(conversationId: string): Promise<AdminDirectChat> {
  return api.get<AdminDirectChat>(`/admin/chat/direct/${conversationId}`);
}

// POST /admin/reports/:id/notify — 신고자/피신고자에게 처리 알림 전송
export async function notifyReportParty(
  reportId: string,
  target: "REPORTER" | "REPORTED",
  message?: string,
): Promise<void> {
  await api.post(`/admin/reports/${reportId}/notify`, { target, message });
}

export type ActivityTier = "SEED" | "SPROUT" | "REGULAR" | "TRUSTED" | "ELITE";

export interface AdminMember {
  id: string;
  name: string;
  email: string;
  role: string;
  suspended: boolean;
  createdAt: string;
  verified: boolean;
  verifiedAt: string | null;
  tier: ActivityTier;
  tierLabel: string;
  completedStays: number;
  reviewsWritten: number;
  /** 입주자로 받은 평가 평균 별점. 받은 평가가 없으면 null. */
  avgRating: number | null;
  /** 입주자로 받은 평가 개수. */
  reviewCount: number;
  /** 이 회원이 신고당한 횟수 (targetType=USER 기준). */
  reportCount: number;
}

export type MemberRole = "GUEST" | "HOST" | "ADMIN";

// PATCH /admin/members/:id/role — promote/demote a member (grants or revokes
// admin rights). The API blocks changing your own role, and bumping someone
// to/from ADMIN drops their existing sessions so the new role takes effect
// on next login.
export async function setMemberRole(id: string, role: MemberRole): Promise<void> {
  await api.patch(`/admin/members/${id}/role`, { role });
}

// PATCH /admin/members/:id/verify — mark identity as checked (or revoke).
export async function verifyMember(id: string, verified: boolean): Promise<void> {
  await api.patch(`/admin/members/${id}/verify`, { verified });
}

// GET /admin/members?q= — search by name/email (omit q for all).
export interface ListMembersQuery {
  q?: string;
  role?: MemberRole;
  tier?: "SEED" | "SPROUT" | "REGULAR" | "TRUSTED" | "ELITE";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function listMembers(
  query: ListMembersQuery = {},
): Promise<PaginatedResult<AdminMember>> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.role) params.set("role", query.role);
  if (query.tier) params.set("tier", query.tier);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return api.get<PaginatedResult<AdminMember>>(`/admin/members${qs ? `?${qs}` : ""}`);
}
// 페이징 응답 형태
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// PATCH /admin/members/:id/suspend — toggle a member's suspension.
// The API rejects suspending your own account.
export async function suspendMember(id: string, suspended: boolean): Promise<void> {
  await api.patch(`/admin/members/${id}/suspend`, { suspended });
}

export async function publishRoom(id: string, published = true): Promise<void> {
  await api.patch(`/admin/rooms/${id}/publish`, { published });
}

// DELETE /admin/rooms/:id — reject the submission outright
export async function rejectRoom(id: string): Promise<void> {
  await api.delete(`/admin/rooms/${id}`);
}

// ── All reservations (관리자용 예약 조회) ─────────────────────────────
// Backend reservation status enum, mapped to Korean labels in the UI.
export type AdminReservationStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED_BY_GUEST"
  | "CANCELLED_BY_HOST"
  | "COMPLETED"
  | "NO_SHOW"
  | "EARLY_CHECKOUT_REQUESTED"
  | "EARLY_CHECKOUT_APPROVED";

export interface AdminReservation {
  id: string;
  status: AdminReservationStatus;
  checkIn: string;
  checkOut: string;
  months: number;
  totalDueNow: number;
  createdAt: string;
  room: { id: string; name: string };
  guest: { id: string; name: string; email: string };
}

export interface AdminReservationPage {
  rows: AdminReservation[];
  total: number;
  take: number;
  skip: number;
}

// GET /admin/reservations?status=&take=&skip=
export async function listReservations(
  status?: AdminReservationStatus,
  take = 50,
  skip = 0,
): Promise<AdminReservationPage> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("take", String(take));
  params.set("skip", String(skip));
  return api.get<AdminReservationPage>(`/admin/reservations?${params.toString()}`);
}

// ── Monthly revenue + reservation trend (통계/매출 월별 추이) ──────────
export interface MonthlyTrendPoint {
  month: string;      // "6월"
  revenue: number;    // PAID payment sum
  refunds: number;    // REFUNDED sum
  reservations: number;
}

export interface RevenueTrend {
  gmv: number;
  commission: number;
  payouts: number;
  refunds: number;
  // 사이트가 부담하는 쿠폰 할인 총액 — 매출이 아니라 비용이라 별도 표시.
  couponDiscount: number;
  trend: MonthlyTrendPoint[];
}

// GET /admin/revenue/monthly?months=6
export async function getRevenueTrend(months = 6): Promise<RevenueTrend> {
  return api.get<RevenueTrend>(`/admin/revenue/monthly?months=${months}`);
}

export interface RevenueTrendV2Point {
  label: string;
  day: number;
  revenue: number;
  reservations: number;
}

// GET /admin/revenue-trend-v2?granularity=day|week|month — 매출 관리
// 페이지 차트 전용(일/주/월 토글).
export async function getRevenueTrendV2(
  granularity: "day" | "week" | "month",
): Promise<RevenueTrendV2Point[]> {
  return api.get<RevenueTrendV2Point[]>(`/admin/revenue-trend-v2?granularity=${granularity}`);
}

// ── Notices (공지 관리 + 공개 조회) ───────────────────────────────────
export interface AdminNotice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// GET /admin/notices (admin) — full list, pinned first
export async function listNotices(): Promise<AdminNotice[]> {
  return api.get<AdminNotice[]>("/admin/notices");
}

// GET /notices (public) — for the home / notices page, no auth
export async function listPublicNotices(): Promise<AdminNotice[]> {
  return api.get<AdminNotice[]>("/notices", { auth: false });
}

// POST /admin/notices
export async function createNotice(input: {
  title: string;
  body: string;
  pinned?: boolean;
}): Promise<AdminNotice> {
  return api.post<AdminNotice>("/admin/notices", input);
}

// PATCH /admin/notices/:id
export async function updateNotice(
  id: string,
  input: { title?: string; body?: string; pinned?: boolean },
): Promise<AdminNotice> {
  return api.patch<AdminNotice>(`/admin/notices/${id}`, input);
}

// DELETE /admin/notices/:id
export async function deleteNotice(id: string): Promise<void> {
  await api.delete(`/admin/notices/${id}`);
}

// ── Banners (배너 관리 + 공개 조회) ───────────────────────────────────
export interface AdminBanner {
  id: string;
  title: string;
  color: string;
  position: string;
  linkUrl: string | null;
  imageUrl: string | null;
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// GET /admin/banners (admin) — full list
export async function listBanners(): Promise<AdminBanner[]> {
  return api.get<AdminBanner[]>("/admin/banners");
}

// GET /banners (public) — active only, for the home screen
export async function listActiveBanners(): Promise<AdminBanner[]> {
  return api.get<AdminBanner[]>("/banners", { auth: false });
}

// POST /admin/banners
export async function createBanner(input: {
  title: string;
  color: string;
  position: string;
  linkUrl?: string | null;
  imageUrl?: string | null;
  active?: boolean;
  order?: number;
}): Promise<AdminBanner> {
  return api.post<AdminBanner>("/admin/banners", input);
}

// PATCH /admin/banners/:id
export async function updateBanner(
  id: string,
  input: Partial<{
    title: string;
    color: string;
    position: string;
    linkUrl: string | null;
    imageUrl: string | null;
    active: boolean;
    order: number;
  }>,
): Promise<AdminBanner> {
  return api.patch<AdminBanner>(`/admin/banners/${id}`, input);
}

// DELETE /admin/banners/:id
export async function deleteBanner(id: string): Promise<void> {
  await api.delete(`/admin/banners/${id}`);
}

// ── Coupons (쿠폰 관리) ───────────────────────────────────────────────
export interface AdminCoupon {
  id: string;
  code: string;
  type: "FIXED" | "PERCENT";
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  validFrom: string;
  validTo: string;
  usageLimit: number | null;
  usedCount: number;
  active: boolean; // derived server-side from window + usage
}

// GET /admin/coupons
export async function listCoupons(): Promise<AdminCoupon[]> {
  return api.get<AdminCoupon[]>("/admin/coupons");
}

// POST /admin/coupons
export async function createCoupon(input: {
  code: string;
  type: "FIXED" | "PERCENT";
  value: number;
  maxDiscount?: number | null;
  minSpend?: number;
  validFrom: string;
  validTo: string;
  usageLimit?: number | null;
}): Promise<AdminCoupon> {
  return api.post<AdminCoupon>("/admin/coupons", input);
}

// PATCH /admin/coupons/:id — 코드(code)는 수정 불가 (발급 후 코드가 바뀌면
// 이미 공유된 쿠폰이 깨진다). 코드 자체를 바꿔야 하면 삭제 후 재생성.
export async function updateCoupon(
  id: string,
  input: Partial<{
    type: "FIXED" | "PERCENT";
    value: number;
    maxDiscount: number | null;
    minSpend: number;
    validFrom: string;
    validTo: string;
    usageLimit: number | null;
  }>,
): Promise<AdminCoupon> {
  return api.patch<AdminCoupon>(`/admin/coupons/${id}`, input);
}

// DELETE /admin/coupons/:id
export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/admin/coupons/${id}`);
}

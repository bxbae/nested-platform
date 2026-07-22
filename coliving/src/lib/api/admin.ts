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

// ── Reports (신고 관리) ──

export type ReportStatus = "RECEIVED" | "IN_REVIEW" | "RESOLVED";
export type ReportTargetType = "ROOM" | "REVIEW" | "USER" | "MESSAGE" | "COMMUNITY_POST" | "COMMUNITY_COMMENT";

export interface AdminReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reporterId: string;
  reporterName: string;
}

// GET /admin/reports?status= — omit status for all.
export async function listReports(status?: ReportStatus): Promise<AdminReport[]> {
  const query = status ? `?status=${status}` : "";
  return api.get<AdminReport[]>(`/admin/reports${query}`);
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

export interface ReportContext {
  reporter: ReportAccountRef;
  reported: ReportAccountRef | null;
  chat: ReportChatRef | null;
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

export type ActivityTier = "SEED" | "REGULAR" | "TRUSTED";

export interface AdminMember {
  id: string;
  name: string;
  email: string;
  role: string;
  suspended: boolean;
  createdAt: string;
  /** Identity checked by an admin. */
  verified: boolean;
  verifiedAt: string | null;
  /** Derived from completed stays + reviews written (server-computed). */
  tier: ActivityTier;
  tierLabel: string;
  completedStays: number;
  reviewsWritten: number;
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
export async function listMembers(q?: string): Promise<AdminMember[]> {
  const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return api.get<AdminMember[]>(`/admin/members${query}`);
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
  trend: MonthlyTrendPoint[];
}

// GET /admin/revenue/monthly?months=6
export async function getRevenueTrend(months = 6): Promise<RevenueTrend> {
  return api.get<RevenueTrend>(`/admin/revenue/monthly?months=${months}`);
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

// DELETE /admin/coupons/:id
export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/admin/coupons/${id}`);
}

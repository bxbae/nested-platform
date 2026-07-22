// ── Host dashboard service ──────────────────────────────────────────
// Aggregated snapshot for /host: revenue, reservations, inquiries, trend.
// Real path hits GET /host/dashboard; demo path derives numbers from the
// in-repo mock helpers so the presentation runs with no backend.

import { USE_REAL_API } from "./config";
import { api } from "./client";
import { API_BASE_URL } from "./config";
import { authStore } from "./auth-store";
import { listHostReservations } from "./reservations";
import {
  revenueSummary,
  revenueTrend,
  roomRevenue as demoRoomRevenue,
  settlementBreakdown as demoSettlementBreakdown,
  inquiries,
} from "@/lib/host";

// Mirrors nested-mono/apps/api/src/modules/host/host-analytics.util.ts —
// same field names on both the real API response and the demo fallback so
// the dashboard page never has to branch on USE_REAL_API itself.
export interface RoomRevenueRow {
  roomId: string;
  roomName: string;
  reservationCount: number;
  occupancyPct: number;
  revenue: number;
  netRevenue: number;
}

export interface SettlementBreakdown {
  paid: { amount: number; count: number; lastPaidDate: string | null };
  scheduled: { amount: number; count: number; nextDate: string | null };
  unsettled: { amount: number; count: number };
}

export interface RecentInquiry {
  chatRoomId: string;
  roomName: string;
  guestName: string;
  lastMessage: string;
  isImage: boolean;
  createdAt: string;
}

export interface HostDashboard {
  thisMonth: number;
  lastMonth: number;
  changePct: number | null;
  listingCount: number;
  reservationCount: number;
  occupancy: number; // 0–100, trailing 30 days
  newInquiries: number;
  newReservationCount: number; // pending, needs host action
  cancelledCount: number; // cancelled in the last 30 days
  trend: { month: string; revenue: number; occupancy: number }[]; // last 6 months
  roomRevenue: RoomRevenueRow[];
  settlement: SettlementBreakdown;
  recentInquiries: RecentInquiry[];
}

export async function getHostDashboard(): Promise<HostDashboard> {
  if (!USE_REAL_API) {
    // Demo: reuse the existing mock helpers, no backend involved.
    const s = revenueSummary();
    const trend = revenueTrend();
    const allInquiries = inquiries();
    const unread = allInquiries.filter((i) => i.unread);
    // Pending/cancelled counts come from the same demo reservation list the
    // 예약 관리 page reads, so the dashboard card and that page always agree.
    const hostReservations = await listHostReservations();
    return {
      thisMonth: s.thisMonth,
      lastMonth: s.lastMonth,
      changePct:
        s.lastMonth > 0 ? Math.round(((s.thisMonth - s.lastMonth) / s.lastMonth) * 100) : null,
      listingCount: s.listingCount,
      reservationCount: s.reservationCount,
      occupancy: s.occupancy,
      newInquiries: unread.length,
      newReservationCount: hostReservations.filter((r) => r.status === "PENDING_PAYMENT").length,
      cancelledCount: hostReservations.filter(
        (r) => r.status === "CANCELLED_BY_GUEST" || r.status === "CANCELLED_BY_HOST",
      ).length,
      trend,
      roomRevenue: demoRoomRevenue(),
      settlement: demoSettlementBreakdown(),
      recentInquiries: unread.slice(0, 5).map((i) => ({
        chatRoomId: i.id,
        roomName: i.houseName,
        guestName: i.guest,
        lastMessage: i.message,
        isImage: false,
        createdAt: i.date,
      })),
    };
  }
  return api.get<HostDashboard>("/host/dashboard");
}

// ── Host calendar: reservations + blocked (unavailable) dates ──
export interface CalendarReservation {
  id: string;
  roomId: string;
  guestName: string;
  checkIn: string; // ISO
  checkOut: string; // ISO
  status: string;
}
export interface CalendarMonth {
  reservations: CalendarReservation[];
  blockedDates: string[]; // YYYY-MM-DD
}

// GET /host/calendar — one room's reservations + blocked days for a month.
export async function getHostCalendar(
  roomId: string,
  year: number,
  month: number,
): Promise<CalendarMonth> {
  if (!USE_REAL_API) {
    return { reservations: [], blockedDates: [] };
  }
  const p = new URLSearchParams({ roomId, year: String(year), month: String(month) });
  return api.get<CalendarMonth>(`/host/calendar?${p.toString()}`);
}

// POST /host/calendar/block — mark a date unavailable (YYYY-MM-DD).
export async function blockDate(roomId: string, date: string, reason?: string): Promise<void> {
  if (!USE_REAL_API) return;
  await api.post("/host/calendar/block", { roomId, date, reason });
}

// DELETE /host/calendar/block — make a blocked date available again.
export async function unblockDate(roomId: string, date: string): Promise<void> {
  if (!USE_REAL_API) return;
  await api.delete("/host/calendar/block", { body: { roomId, date } });
}

// ── CSV export ──
// Download an authenticated CSV. We can't use the JSON `api` helper here, so we
// fetch with the Bearer token and trigger a browser download from the blob.
async function downloadCsv(path: string, fallbackName: string): Promise<void> {
  const token = authStore.getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("다운로드에 실패했어요.");
  const blob = await res.blob();

  // Prefer the server-provided filename, else fall back.
  const disp = res.headers.get("Content-Disposition") ?? "";
  const match = disp.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadRevenueCsv() {
  return downloadCsv("/host/export/revenue.csv", "revenue.csv");
}
export function downloadTenantsCsv() {
  return downloadCsv("/host/export/tenants.csv", "tenants.csv");
}

// ── Host settlements (정산 내역) ──
// Computed on the server from settleable reservations; no Settlement rows need
// to pre-exist. Demo mode returns an empty breakdown.
export interface SettlementRow {
  reservationId: string;
  roomName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  months: number;
  occupants: number;
  monthlyRent: number;
  deposit: number;
  gross: number;
  commission: number;
  net: number;
  status: "SCHEDULED" | "PAID";
}
export interface SettlementSummary {
  rows: SettlementRow[];
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  scheduledNet: number;
  paidNet: number;
  totalDeposit: number;
  totalOccupants: number;
}

export async function getHostSettlements(): Promise<SettlementSummary> {
  if (!USE_REAL_API) {
    return {
      rows: [],
      totalGross: 0,
      totalCommission: 0,
      totalNet: 0,
      scheduledNet: 0,
      paidNet: 0,
      totalDeposit: 0,
      totalOccupants: 0,
    };
  }
  return api.get<SettlementSummary>("/host/settlements");
}

// ── Host dashboard service ──────────────────────────────────────────
// Aggregated snapshot for /host: revenue, reservations, inquiries, trend.
// Real path hits GET /host/dashboard; demo path derives numbers from the
// in-repo mock helpers so the presentation runs with no backend.

import { USE_REAL_API } from "./config";
import { api } from "./client";
import { API_BASE_URL } from "./config";
import { authStore } from "./auth-store";
import { revenueSummary, revenueTrend, inquiries } from "@/lib/host";

export interface HostDashboard {
  thisMonth: number;
  lastMonth: number;
  changePct: number | null;
  listingCount: number;
  reservationCount: number;
  occupancy: number;
  newInquiries: number;
  trend: { month: string; value: number }[];
}

export async function getHostDashboard(): Promise<HostDashboard> {
  if (!USE_REAL_API) {
    // Demo: reuse the existing mock helpers.
    const s = revenueSummary();
    const trend = revenueTrend();
    const newInquiries = inquiries().filter((i) => i.unread).length;
    return {
      thisMonth: s.thisMonth,
      lastMonth: s.lastMonth,
      changePct:
        s.lastMonth > 0 ? Math.round(((s.thisMonth - s.lastMonth) / s.lastMonth) * 100) : null,
      listingCount: s.listingCount,
      reservationCount: s.reservationCount,
      occupancy: s.occupancy,
      newInquiries,
      trend,
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
  months: number;
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
}

export async function getHostSettlements(): Promise<SettlementSummary> {
  if (!USE_REAL_API) {
    return { rows: [], totalGross: 0, totalCommission: 0, totalNet: 0, scheduledNet: 0, paidNet: 0 };
  }
  return api.get<SettlementSummary>("/host/settlements");
}

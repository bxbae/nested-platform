// ── Host dashboard service ──────────────────────────────────────────
// Aggregated snapshot for /host: revenue, reservations, inquiries, trend.
// Real path hits GET /host/dashboard; demo path derives numbers from the
// in-repo mock helpers so the presentation runs with no backend.

import { USE_REAL_API } from "./config";
import { api } from "./client";
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

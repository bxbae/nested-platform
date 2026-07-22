// ── Shared host-analytics helpers ───────────────────────────────────
// Plain functions (no DI) so both HostService (dashboard) and
// HostExportService (CSV, if it ever adopts these) can compute the same
// numbers from the same raw reservation rows without duplicating the
// business rules.
//
// All money figures use the platform's 5% commission (mirrors
// SERVICE_FEE_RATE on the booking flow and host-settlement.module.ts).
import { ReservationStatus } from "@prisma/client";

export const COMMISSION_RATE = 0.05;

// Reservations that represent real, owed income. Mirrors SETTLEABLE in
// host-settlement.module.ts — EARLY_CHECKOUT_REQUESTED/EXTENSION_REQUESTED
// are deliberately excluded, since a request the host hasn't approved yet
// isn't earned income.
export const EARNING_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
];

// The subset of those that occupy a room's calendar (used for occupancy).
// EARLY_CHECKOUT_REQUESTED / EXTENSION_REQUESTED still occupy the room until
// decided, so they count here even though they aren't earning yet above.
const OCCUPYING_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
  ReservationStatus.EARLY_CHECKOUT_REQUESTED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
  ReservationStatus.EXTENSION_REQUESTED,
];

export interface RawReservation {
  id: string;
  roomId: string;
  status: ReservationStatus;
  monthlyRent: number;
  months: number;
  checkIn: Date;
  checkOut: Date;
  createdAt: Date;
}

export interface RoomLite {
  id: string;
  name: string;
}

function gross(r: RawReservation): number {
  return r.monthlyRent * r.months;
}
function net(r: RawReservation): number {
  return Math.round(gross(r) * (1 - COMMISSION_RATE));
}

// ── Occupancy ──
// Day-by-day over the trailing `days` window: for each day, a room counts as
// occupied if an occupying reservation spans it. occupancy% = occupied
// room-days / (room count × days).
export function computeOccupancyPct(
  reservations: RawReservation[],
  roomIds: string[],
  windowStart: Date,
  windowEnd: Date,
): number {
  if (roomIds.length === 0) return 0;
  const roomSet = new Set(roomIds);
  const relevant = reservations.filter(
    (r) => roomSet.has(r.roomId) && OCCUPYING_STATUSES.includes(r.status),
  );

  const totalDays = Math.max(1, Math.round((+windowEnd - +windowStart) / 86_400_000));
  let occupiedRoomDays = 0;
  for (const roomId of roomIds) {
    const roomRes = relevant.filter((r) => r.roomId === roomId);
    for (let i = 0; i < totalDays; i++) {
      const day = new Date(windowStart.getTime() + i * 86_400_000);
      const occupied = roomRes.some((r) => r.checkIn <= day && r.checkOut > day);
      if (occupied) occupiedRoomDays++;
    }
  }
  return Math.round((occupiedRoomDays / (roomIds.length * totalDays)) * 100);
}

// ── Per-room revenue table ──
export interface RoomRevenueRow {
  roomId: string;
  roomName: string;
  reservationCount: number;
  occupancyPct: number; // this room's own occupancy, last 30 days
  revenue: number; // gross
  netRevenue: number; // after commission
}

export function computeRoomRevenue(
  reservations: RawReservation[],
  rooms: RoomLite[],
  windowStart: Date,
  windowEnd: Date,
): RoomRevenueRow[] {
  return rooms.map((room) => {
    const mine = reservations.filter(
      (r) => r.roomId === room.id && EARNING_STATUSES.includes(r.status),
    );
    return {
      roomId: room.id,
      roomName: room.name.trim(),
      reservationCount: mine.length,
      occupancyPct: computeOccupancyPct(reservations, [room.id], windowStart, windowEnd),
      revenue: mine.reduce((s, r) => s + gross(r), 0),
      netRevenue: mine.reduce((s, r) => s + net(r), 0),
    };
  });
}

// ── Settlement breakdown (정산 완료 / 정산 예정 / 미정산) ──
// Computed on demand from reservation status + checkout date, same approach
// as host-settlement.module.ts — no dependency on the Settlement table being
// pre-populated.
export interface SettlementBreakdown {
  paid: { amount: number; count: number; lastPaidDate: string | null };
  scheduled: { amount: number; count: number; nextDate: string | null };
  unsettled: { amount: number; count: number };
}

// 5th of the month following `d`.
export function nextPayoutDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 5);
}

export function computeSettlementBreakdown(
  reservations: RawReservation[],
  now: Date,
): SettlementBreakdown {
  const paidRows = reservations.filter(
    (r) =>
      r.status === ReservationStatus.COMPLETED ||
      r.status === ReservationStatus.EARLY_CHECKOUT_APPROVED,
  );
  const confirmed = reservations.filter((r) => r.status === ReservationStatus.CONFIRMED);
  const scheduledRows = confirmed.filter((r) => r.checkOut >= now);
  const unsettledRows = confirmed.filter((r) => r.checkOut < now);

  const paidDates = paidRows.map((r) => nextPayoutDate(r.checkOut));
  const scheduledDates = scheduledRows.map((r) => nextPayoutDate(r.checkOut));

  return {
    paid: {
      amount: paidRows.reduce((s, r) => s + net(r), 0),
      count: paidRows.length,
      lastPaidDate:
        paidDates.length > 0
          ? new Date(Math.max(...paidDates.map((d) => +d))).toISOString().slice(0, 10)
          : null,
    },
    scheduled: {
      amount: scheduledRows.reduce((s, r) => s + net(r), 0),
      count: scheduledRows.length,
      nextDate:
        scheduledDates.length > 0
          ? new Date(Math.min(...scheduledDates.map((d) => +d))).toISOString().slice(0, 10)
          : null,
    },
    unsettled: {
      amount: unsettledRows.reduce((s, r) => s + net(r), 0),
      count: unsettledRows.length,
    },
  };
}

// ── 6-month revenue + occupancy trend ──
export interface TrendPoint {
  month: string; // "7월"
  revenue: number;
  occupancy: number; // 0–100, that calendar month's occupancy
}

export function computeTrend(
  reservations: RawReservation[],
  roomIds: string[],
  now: Date,
  months = 6,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEndFull = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const mEnd = mEndFull < now ? mEndFull : now;

    const revenue = reservations
      .filter(
        (r) =>
          EARNING_STATUSES.includes(r.status) && r.createdAt >= mStart && r.createdAt < mEndFull,
      )
      .reduce((s, r) => s + gross(r), 0);

    const occupancy =
      mEnd > mStart ? computeOccupancyPct(reservations, roomIds, mStart, mEnd) : 0;

    points.push({ month: `${mStart.getMonth() + 1}월`, revenue, occupancy });
  }
  return points;
}

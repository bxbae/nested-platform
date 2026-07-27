// ── Shared host-analytics helpers ───────────────────────────────────
// Plain functions (no DI) so the dashboard and exports calculate revenue,
// occupancy and current inventory with identical rules.
import {
  BookingMode,
  RentalUnit,
  ReservationStatus,
} from "@prisma/client";
import { INVENTORY_HOLDING_STATUSES } from "../reservations/reservation-inventory.util";
import { proratedMonthlyAmount } from "../reservations/pricing";

export const COMMISSION_RATE = 0.05;

// Reservations that represent earned or contractually owed income.
export const EARNING_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
  ReservationStatus.EARLY_CHECKOUT_REQUESTED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
  ReservationStatus.EXTENSION_REQUESTED,
];

// Historical occupancy includes completed stays because those room/spot days
// were genuinely occupied. Cancelled and no-show rows never count.
const ANALYTICS_OCCUPYING_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING_PAYMENT,
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
  ReservationStatus.EARLY_CHECKOUT_REQUESTED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
  ReservationStatus.EXTENSION_REQUESTED,
];

// 실제 입주 인원·진행 중 계약은 결제 대기를 제외한다.
export const ACTIVE_CONTRACT_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.EARLY_CHECKOUT_REQUESTED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
  ReservationStatus.EXTENSION_REQUESTED,
];

export interface RawReservation {
  id: string;
  roomId: string;
  status: ReservationStatus;
  bookingMode: BookingMode;
  reservedSpots: number;
  monthlyRent: number;
  months: number;
  checkIn: Date;
  checkOut: Date;
  createdAt: Date;
  /** 대표 예약자 외 수락 완료된 동반 입주자 수. */
  acceptedCompanionCount?: number;
}

export interface RoomLite {
  id: string;
  name: string;
  rentalUnit: RentalUnit | null;
  capacity: number | null;
}

export function reservationGross(r: RawReservation): number {
  return proratedMonthlyAmount(r.monthlyRent, r.checkIn, r.checkOut);
}

function gross(r: RawReservation): number {
  return reservationGross(r);
}
function commission(r: RawReservation): number {
  return Math.round(gross(r) * COMMISSION_RATE);
}
function net(r: RawReservation): number {
  return gross(r) - commission(r);
}

function dayStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function roomCapacity(room: RoomLite): number {
  return room.rentalUnit === RentalUnit.BED ? Math.max(1, room.capacity ?? 1) : 1;
}

function reservationUnits(reservation: RawReservation, room: RoomLite): number {
  const capacity = roomCapacity(room);
  if (room.rentalUnit !== RentalUnit.BED) return 1;
  if (reservation.bookingMode !== BookingMode.BED) return capacity;
  return Math.max(1, reservation.reservedSpots);
}

function reservationOccupants(reservation: RawReservation, room: RoomLite): number {
  if (room.rentalUnit === RentalUnit.BED) {
    return reservationUnits(reservation, room);
  }
  return 1 + Math.max(0, reservation.acceptedCompanionCount ?? 0);
}

function activeOnDay(reservation: RawReservation, day: Date): boolean {
  return reservation.checkIn < new Date(day.getTime() + 86_400_000) && reservation.checkOut > day;
}

// ── Occupancy ──
// 단독형·개인실은 방 일수, 다인실은 자리 일수로 계산한다.
// occupancy% = occupied unit-days / available unit-days.
export function computeOccupancyPct(
  reservations: RawReservation[],
  rooms: RoomLite[],
  windowStart: Date,
  windowEnd: Date,
): number {
  if (rooms.length === 0) return 0;
  const start = dayStart(windowStart);
  const end = dayStart(windowEnd);
  const totalDays = Math.max(1, Math.ceil((+end - +start) / 86_400_000));
  const relevant = reservations.filter((r) => ANALYTICS_OCCUPYING_STATUSES.includes(r.status));

  let occupiedUnitDays = 0;
  let availableUnitDays = 0;

  for (const room of rooms) {
    const capacity = roomCapacity(room);
    const roomReservations = relevant.filter((r) => r.roomId === room.id);
    availableUnitDays += capacity * totalDays;

    for (let index = 0; index < totalDays; index++) {
      const day = new Date(start.getTime() + index * 86_400_000);
      const occupied = Math.min(
        capacity,
        roomReservations
          .filter((reservation) => activeOnDay(reservation, day))
          .reduce((sum, reservation) => sum + reservationUnits(reservation, room), 0),
      );
      occupiedUnitDays += occupied;
    }
  }

  return availableUnitDays > 0
    ? Math.round((occupiedUnitDays / availableUnitDays) * 100)
    : 0;
}

export function currentInventoryForRoom(
  reservations: RawReservation[],
  room: RoomLite,
  now: Date,
): { reservedSpots: number; remainingSpots: number | null } {
  const active = reservations.filter(
    (r) =>
      r.roomId === room.id &&
      INVENTORY_HOLDING_STATUSES.includes(r.status) &&
      r.checkIn <= now &&
      r.checkOut > now,
  );
  if (room.rentalUnit !== RentalUnit.BED) {
    return { reservedSpots: active.length > 0 ? 1 : 0, remainingSpots: null };
  }
  const capacity = roomCapacity(room);
  const reservedSpots = Math.min(
    capacity,
    active.reduce((sum, reservation) => sum + reservationUnits(reservation, room), 0),
  );
  return { reservedSpots, remainingSpots: Math.max(0, capacity - reservedSpots) };
}

export interface RoomRevenueRow {
  roomId: string;
  roomName: string;
  rentalUnit: RentalUnit | null;
  capacity: number | null;
  reservationCount: number;
  currentReservedSpots: number;
  currentRemainingSpots: number | null;
  occupancyPct: number;
  revenue: number;
  platformFee: number;
  netRevenue: number;
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
    const inventory = currentInventoryForRoom(reservations, room, windowEnd);
    return {
      roomId: room.id,
      roomName: room.name.trim(),
      rentalUnit: room.rentalUnit,
      capacity: room.capacity,
      reservationCount: mine.length,
      currentReservedSpots: inventory.reservedSpots,
      currentRemainingSpots: inventory.remainingSpots,
      occupancyPct: computeOccupancyPct(reservations, [room], windowStart, windowEnd),
      revenue: mine.reduce((sum, reservation) => sum + gross(reservation), 0),
      platformFee: mine.reduce((sum, reservation) => sum + commission(reservation), 0),
      netRevenue: mine.reduce((sum, reservation) => sum + net(reservation), 0),
    };
  });
}

export function computeCurrentOperations(
  reservations: RawReservation[],
  rooms: RoomLite[],
  now: Date,
): { currentOccupants: number; activeContractCount: number } {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const active = reservations.filter(
    (reservation) =>
      ACTIVE_CONTRACT_STATUSES.includes(reservation.status) &&
      reservation.checkIn <= now &&
      reservation.checkOut > now,
  );
  return {
    activeContractCount: active.length,
    currentOccupants: active.reduce((sum, reservation) => {
      const room = roomMap.get(reservation.roomId);
      return sum + (
        room
          ? reservationOccupants(reservation, room)
          : Math.max(1, reservation.reservedSpots)
      );
    }, 0),
  };
}

// ── Settlement breakdown ──
export interface SettlementBreakdown {
  paid: { amount: number; count: number; lastPaidDate: string | null };
  scheduled: { amount: number; count: number; nextDate: string | null };
  unsettled: { amount: number; count: number };
}

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
  const activeRevenueStatuses: ReservationStatus[] = [
    ReservationStatus.CONFIRMED,
    ReservationStatus.EARLY_CHECKOUT_REQUESTED,
    ReservationStatus.EXTENSION_REQUESTED,
  ];
  const activeRevenueRows = reservations.filter((reservation) =>
    activeRevenueStatuses.includes(reservation.status),
  );
  const scheduledRows = activeRevenueRows.filter((r) => r.checkOut >= now);
  const unsettledRows = activeRevenueRows.filter((r) => r.checkOut < now);

  const paidDates = paidRows.map((r) => nextPayoutDate(r.checkOut));
  const scheduledDates = scheduledRows.map((r) => nextPayoutDate(r.checkOut));

  return {
    paid: {
      amount: paidRows.reduce((sum, reservation) => sum + net(reservation), 0),
      count: paidRows.length,
      lastPaidDate:
        paidDates.length > 0
          ? new Date(Math.max(...paidDates.map((date) => +date))).toISOString().slice(0, 10)
          : null,
    },
    scheduled: {
      amount: scheduledRows.reduce((sum, reservation) => sum + net(reservation), 0),
      count: scheduledRows.length,
      nextDate:
        scheduledDates.length > 0
          ? new Date(Math.min(...scheduledDates.map((date) => +date))).toISOString().slice(0, 10)
          : null,
    },
    unsettled: {
      amount: unsettledRows.reduce((sum, reservation) => sum + net(reservation), 0),
      count: unsettledRows.length,
    },
  };
}

export interface TrendPoint {
  month: string;
  revenue: number;
  occupancy: number;
}

export function computeTrend(
  reservations: RawReservation[],
  rooms: RoomLite[],
  now: Date,
  months = 6,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let index = months - 1; index >= 0; index--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const monthEndFull = new Date(now.getFullYear(), now.getMonth() - index + 1, 1);
    const monthEnd = monthEndFull < now ? monthEndFull : now;
    const revenue = reservations
      .filter(
        (reservation) =>
          EARNING_STATUSES.includes(reservation.status) &&
          reservation.createdAt >= monthStart &&
          reservation.createdAt < monthEndFull,
      )
      .reduce((sum, reservation) => sum + gross(reservation), 0);
    const occupancy =
      monthEnd > monthStart
        ? computeOccupancyPct(reservations, rooms, monthStart, monthEnd)
        : 0;
    points.push({ month: `${monthStart.getMonth() + 1}월`, revenue, occupancy });
  }
  return points;
}

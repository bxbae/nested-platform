import {
  BookingMode,
  RentalUnit,
  ReservationStatus,
} from "@prisma/client";

/** 정상적으로 예약 재고를 계속 점유하는 상태. */
export const INVENTORY_HOLDING_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING_PAYMENT,
  ReservationStatus.CONFIRMED,
  ReservationStatus.EARLY_CHECKOUT_REQUESTED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
  ReservationStatus.EXTENSION_REQUESTED,
];

/**
 * 조회 시에는 과거 버그로 퇴실일 전에 COMPLETED 처리된 예약도 함께 읽는다.
 * 정상 완료 예약은 checkOut이 이미 지나 범위 조건에서 자동 제외된다.
 */
export const INVENTORY_QUERY_STATUSES: ReservationStatus[] = [
  ...INVENTORY_HOLDING_STATUSES,
  ReservationStatus.COMPLETED,
];

export interface InventoryReservationLike {
  bookingMode: BookingMode | string;
  reservedSpots: number;
  status?: ReservationStatus | string;
  checkIn?: Date;
  checkOut?: Date;
}

export interface InventorySnapshot {
  reservedSpots: number;
  remainingSpots: number | null;
  fullyBooked: boolean;
  blocked: boolean;
}

function reservedUnits(
  capacity: number,
  reservation: InventoryReservationLike,
): number {
  if (
    reservation.bookingMode !== BookingMode.BED &&
    reservation.bookingMode !== "BED"
  ) {
    return capacity;
  }
  return Math.max(1, reservation.reservedSpots);
}

export function calculateInventory(
  rentalUnit: RentalUnit | string | null | undefined,
  capacityValue: number | null | undefined,
  reservations: InventoryReservationLike[],
  blocked = false,
): InventorySnapshot {
  if (rentalUnit !== RentalUnit.BED && rentalUnit !== "BED") {
    const reservedSpots = reservations.length > 0 ? 1 : 0;
    return {
      reservedSpots,
      remainingSpots: null,
      fullyBooked: blocked || reservedSpots > 0,
      blocked,
    };
  }

  const capacity = Math.max(1, capacityValue ?? 1);
  const reservedSpots = Math.min(
    capacity,
    reservations.reduce(
      (sum, reservation) => sum + reservedUnits(capacity, reservation),
      0,
    ),
  );
  const remainingSpots = blocked ? 0 : Math.max(0, capacity - reservedSpots);

  return {
    reservedSpots,
    remainingSpots,
    fullyBooked: blocked || remainingSpots === 0,
    blocked,
  };
}

/**
 * 선택 기간 전체에서 동시에 가장 많이 점유되는 시점의 재고를 계산한다.
 * 서로 겹치지 않는 순차 예약을 단순 합산하지 않아 다인실 잔여 자리를 정확히 유지한다.
 */
export function calculateRangeInventory(
  rentalUnit: RentalUnit | string | null | undefined,
  capacityValue: number | null | undefined,
  reservations: InventoryReservationLike[],
  rangeStart: Date,
  rangeEnd: Date,
  blocked = false,
): InventorySnapshot {
  const hasMissingDates = reservations.some(
    (reservation) => !reservation.checkIn || !reservation.checkOut,
  );
  const relevant = reservations.filter(
    (reservation) =>
      reservation.checkIn &&
      reservation.checkOut &&
      overlaps(
        reservation.checkIn,
        reservation.checkOut,
        rangeStart,
        rangeEnd,
      ),
  );

  if (rentalUnit !== RentalUnit.BED && rentalUnit !== "BED") {
    return calculateInventory(rentalUnit, capacityValue, relevant, blocked);
  }

  // 날짜가 빠진 테스트·레거시 레코드는 보수적으로 기존 합산 방식으로 처리한다.
  if (hasMissingDates) {
    return calculateInventory(rentalUnit, capacityValue, reservations, blocked);
  }

  const capacity = Math.max(1, capacityValue ?? 1);
  const events: Array<{ at: number; delta: number }> = [];

  for (const reservation of relevant) {
    const checkIn = reservation.checkIn!;
    const checkOut = reservation.checkOut!;
    const start = Math.max(checkIn.getTime(), rangeStart.getTime());
    const end = Math.min(checkOut.getTime(), rangeEnd.getTime());
    if (start >= end) continue;

    const spots = reservedUnits(capacity, reservation);
    events.push({ at: start, delta: spots });
    events.push({ at: end, delta: -spots });
  }

  // 같은 날 퇴실과 입주가 겹치면 퇴실(-)을 먼저 처리한다.
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);

  let current = 0;
  let peak = 0;
  for (const event of events) {
    current = Math.max(0, current + event.delta);
    peak = Math.max(peak, current);
  }

  const reservedSpots = Math.min(capacity, peak);
  const remainingSpots = blocked ? 0 : Math.max(0, capacity - reservedSpots);

  return {
    reservedSpots,
    remainingSpots,
    fullyBooked: blocked || remainingSpots === 0,
    blocked,
  };
}

export function atUtcDayStart(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function addUtcDays(value: Date, days: number): Date {
  const out = atUtcDayStart(value);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function isoDate(value: Date): string {
  return atUtcDayStart(value).toISOString().slice(0, 10);
}

export function overlaps(
  checkIn: Date,
  checkOut: Date,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  return checkIn < rangeEnd && checkOut > rangeStart;
}

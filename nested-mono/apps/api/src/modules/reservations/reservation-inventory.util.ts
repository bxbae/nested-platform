import {
  BookingMode,
  RentalUnit,
  ReservationStatus,
} from "@prisma/client";

/** 예약 재고를 계속 점유하는 상태. 검색·견적·생성·캘린더에서 공통 사용한다. */
export const INVENTORY_HOLDING_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING_PAYMENT,
  ReservationStatus.CONFIRMED,
  ReservationStatus.EARLY_CHECKOUT_REQUESTED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
  ReservationStatus.EXTENSION_REQUESTED,
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
    reservations.reduce((sum, reservation) => {
      // UNIT/WHOLE_ROOM은 방 전체를 잡는 기존 또는 전체 예약이다.
      if (
        reservation.bookingMode !== BookingMode.BED &&
        reservation.bookingMode !== "BED"
      ) {
        return capacity;
      }
      return sum + Math.max(1, reservation.reservedSpots);
    }, 0),
  );
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

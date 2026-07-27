import { BookingMode, RentalUnit, ReservationStatus } from "@prisma/client";
import {
  computeCurrentOperations,
  computeOccupancyPct,
  computeRoomRevenue,
  type RawReservation,
  type RoomLite,
} from "../host-analytics.util";

const start = new Date("2026-08-01T00:00:00.000Z");
const end = new Date("2026-08-11T00:00:00.000Z");

function reservation(overrides: Partial<RawReservation> = {}): RawReservation {
  return {
    id: "reservation-1",
    roomId: "room-bed",
    status: ReservationStatus.CONFIRMED,
    bookingMode: BookingMode.BED,
    reservedSpots: 2,
    monthlyRent: 700_000,
    months: 1,
    checkIn: start,
    checkOut: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: start,
    ...overrides,
  };
}

const bedRoom: RoomLite = {
  id: "room-bed",
  name: "성수 공유 하우스",
  rentalUnit: RentalUnit.BED,
  capacity: 3,
};

describe("host analytics — 자리 일수 기준", () => {
  it("3인 다인실에서 2자리가 전 기간 예약되면 점유율은 67%다", () => {
    expect(computeOccupancyPct([reservation()], [bedRoom], start, end)).toBe(67);
  });

  it("다인실 현재 예약 현황과 수수료를 객실별 수익에 반영한다", () => {
    const rows = computeRoomRevenue(
      [reservation()],
      [bedRoom],
      start,
      new Date("2026-08-05T00:00:00.000Z"),
    );
    expect(rows[0]).toMatchObject({
      currentReservedSpots: 2,
      currentRemainingSpots: 1,
      occupancyPct: 67,
      revenue: 700_000,
      platformFee: 35_000,
      netRevenue: 665_000,
    });
  });

  it("현재 입주 인원은 다인실 예약 자리 수로 계산한다", () => {
    expect(computeCurrentOperations([reservation()], [bedRoom], new Date("2026-08-05T00:00:00.000Z"))).toEqual({
      currentOccupants: 2,
      activeContractCount: 1,
    });
  });
});

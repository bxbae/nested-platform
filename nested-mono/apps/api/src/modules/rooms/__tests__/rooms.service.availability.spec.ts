import { BadRequestException } from "@nestjs/common";
import { RoomsService } from "../rooms.service";

describe("RoomsService — 날짜 기반 가용성 검색", () => {
  function makeService(
    roomRows: any[] = [],
    reservationRows: any[] = [],
    blockRows: any[] = [],
  ) {
    const calls: any[] = [];
    const prisma: any = {
      room: {
        findMany: jest.fn(async (args: any) => {
          calls.push(args);
          return roomRows;
        }),
        count: jest.fn(async () => roomRows.length),
      },
      reservation: { findMany: jest.fn(async () => reservationRows) },
      reservationCompanionMember: {
        findMany: jest.fn(async () => []),
      },
      calendarBlock: { findMany: jest.fn(async () => blockRows) },
    };
    const redis: any = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      del: jest.fn(async () => undefined),
      cacheGet: jest.fn(async () => null),
      cacheSet: jest.fn(async () => undefined),
    };
    const geocoding: any = { geocode: jest.fn(async () => null) };
    return { svc: new RoomsService(prisma, redis, geocoding), calls, prisma };
  }

  const baseRoom = {
    hostId: "host-1",
    capacity: null,
    avgRating: 0,
    images: [],
  };

  it("선택 기간이 마감된 숙소도 상태와 함께 반환한다", async () => {
    const rooms = [
      { ...baseRoom, id: "open-room", rentalUnit: "WHOLE" },
      { ...baseRoom, id: "closed-room", rentalUnit: "PRIVATE_ROOM" },
    ];
    const reservations = [
      {
        roomId: "closed-room",
        checkIn: new Date("2026-08-04T00:00:00.000Z"),
        checkOut: new Date("2026-10-01T00:00:00.000Z"),
        bookingMode: "UNIT",
        reservedSpots: 1,
        companionId: null,
        companionStatus: null,
      },
    ];

    const { svc, calls } = makeService(rooms, reservations);
    const result = await svc.search({
      checkIn: "2026-08-04",
      checkOut: "2026-09-20",
    });

    expect(result.items.map((room: any) => room.id)).toEqual([
      "open-room",
      "closed-room",
    ]);
    expect(result.items[1]?.inventory.fullyBooked).toBe(true);
    expect(result.total).toBe(2);
    expect(calls[0]?.where.availableFrom.lte).toEqual(
      new Date("2026-08-04"),
    );
    expect(calls[0]?.where.minStayMonths.lte).toBe(1);
  });

  it("다인실은 선택 기간에 잔여 자리가 있으면 유지한다", async () => {
    const rooms = [
      {
        ...baseRoom,
        id: "bed-room",
        rentalUnit: "BED",
        capacity: 3,
      },
    ];
    const reservations = [
      {
        roomId: "bed-room",
        checkIn: new Date("2026-08-01T00:00:00.000Z"),
        checkOut: new Date("2026-10-01T00:00:00.000Z"),
        bookingMode: "BED",
        reservedSpots: 2,
        companionId: null,
        companionStatus: null,
      },
    ];

    const { svc } = makeService(rooms, reservations);
    const result = await svc.search({
      checkIn: "2026-08-04",
      checkOut: "2026-09-20",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.inventory.remainingSpots).toBe(1);
    expect(result.items[0]?.inventory.fullyBooked).toBe(false);
  });

  it("서로 겹치지 않는 다인실 예약은 합산하지 않고 최대 동시 점유만 계산한다", async () => {
    const rooms = [
      {
        ...baseRoom,
        id: "bed-room",
        rentalUnit: "BED",
        capacity: 6,
      },
    ];
    const reservations = [
      {
        roomId: "bed-room",
        checkIn: new Date("2026-08-01T00:00:00.000Z"),
        checkOut: new Date("2026-09-01T00:00:00.000Z"),
        bookingMode: "BED",
        reservedSpots: 3,
        companionId: null,
        companionStatus: null,
      },
      {
        roomId: "bed-room",
        checkIn: new Date("2026-09-01T00:00:00.000Z"),
        checkOut: new Date("2026-10-01T00:00:00.000Z"),
        bookingMode: "BED",
        reservedSpots: 3,
        companionId: null,
        companionStatus: null,
      },
    ];

    const { svc } = makeService(rooms, reservations);
    const result = await svc.search({
      checkIn: "2026-08-01",
      checkOut: "2026-10-01",
    });

    expect(result.items[0]?.inventory.reservedSpots).toBe(3);
    expect(result.items[0]?.inventory.remainingSpots).toBe(3);
    expect(result.items[0]?.inventory.fullyBooked).toBe(false);
  });

  it("호스트가 막은 날짜가 포함돼도 마감 상태로 반환한다", async () => {
    const rooms = [{ ...baseRoom, id: "blocked-room", rentalUnit: "WHOLE" }];
    const blocks = [
      { roomId: "blocked-room", date: new Date("2026-08-20T00:00:00.000Z") },
    ];
    const { svc } = makeService(rooms, [], blocks);

    const result = await svc.search({
      checkIn: "2026-08-04",
      checkOut: "2026-09-20",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.inventory.blocked).toBe(true);
    expect(result.items[0]?.inventory.fullyBooked).toBe(true);
    expect(result.total).toBe(1);
  });

  it("플랫폼 최소 1개월보다 짧은 검색은 거부한다", async () => {
    const { svc } = makeService();
    await expect(
      svc.search({ checkIn: "2026-08-05", checkOut: "2026-08-19" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("입주일 또는 퇴실일만 전달하면 거부한다", async () => {
    const { svc } = makeService();
    await expect(
      svc.search({ checkIn: "2026-08-05" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("날짜가 없으면 입주 가능 시작일과 최소 계약 기간을 제한하지 않는다", async () => {
    const { svc, calls } = makeService();
    await svc.search({});
    expect(calls[0]?.where.availableFrom).toBeUndefined();
    expect(calls[0]?.where.minStayMonths).toBeUndefined();
  });
});

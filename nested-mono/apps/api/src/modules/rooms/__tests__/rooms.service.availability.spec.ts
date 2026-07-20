// 배치 위치: src/modules/rooms/__tests__/rooms.service.availability.spec.ts
//
// 날짜 기반 검색(checkIn/checkOut) 검증.
// prisma / redis / geocoding 을 mock 으로 주입하고, 서비스가 Prisma 에 넘기는
// `where` 조건을 확인한다 — 실제 DB 없이 필터 조립 로직만 격리 테스트.

import { RoomsService } from "../rooms.service";

describe("RoomsService — 날짜 기반 가용성 필터", () => {
  function makeService() {
    // 서비스가 findMany 에 넘긴 인자를 캡처해 검증에 사용한다.
    const calls: any[] = [];
    const prisma: any = {
      room: {
        findMany: jest.fn(async (args: any) => {
          calls.push(args);
          return [];
        }),
        count: jest.fn(async () => 0),
      },
    };
    const redis: any = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      del: jest.fn(async () => undefined),
      cacheGet: jest.fn(async () => null),
      cacheSet: jest.fn(async () => undefined),
    };
    const geocoding: any = { geocode: jest.fn(async () => null) };
    return { svc: new RoomsService(prisma, redis, geocoding), calls };
  }

  it("checkIn/checkOut 이 있으면 겹치는 예약이 없는 방만 조회한다", async () => {
    const { svc, calls } = makeService();
    await svc.search({ checkIn: "2026-08-01", checkOut: "2026-11-01" });

    const where = calls[0]?.where;
    expect(where).toBeDefined();
    // 겹치는 예약이 "없는(none)" 방만
    expect(where.reservations).toBeDefined();
    expect(where.reservations.none.status.in).toEqual([
      "PENDING_PAYMENT",
      "CONFIRMED",
    ]);
    // overlap 규칙: existing.checkIn < 요청종료 AND existing.checkOut > 요청시작
    expect(where.reservations.none.checkIn.lt).toEqual(new Date("2026-11-01"));
    expect(where.reservations.none.checkOut.gt).toEqual(new Date("2026-08-01"));
    // 입주 가능일도 요청 시작일 이전이어야 한다
    expect(where.availableFrom.lte).toEqual(new Date("2026-08-01"));
  });

  it("날짜가 없으면 예약 겹침 필터를 걸지 않는다", async () => {
    const { svc, calls } = makeService();
    await svc.search({});
    expect(calls[0]?.where.reservations).toBeUndefined();
  });

  it("checkIn 만 있으면(종료일 없음) 겹침 필터를 걸지 않는다", async () => {
    const { svc, calls } = makeService();
    await svc.search({ checkIn: "2026-08-01" });
    expect(calls[0]?.where.reservations).toBeUndefined();
  });

  it("종료일이 시작일보다 빠르면 무시한다", async () => {
    const { svc, calls } = makeService();
    await svc.search({ checkIn: "2026-11-01", checkOut: "2026-08-01" });
    expect(calls[0]?.where.reservations).toBeUndefined();
  });

  it("잘못된 날짜 형식은 무시한다", async () => {
    const { svc, calls } = makeService();
    await svc.search({ checkIn: "not-a-date", checkOut: "2026-11-01" });
    expect(calls[0]?.where.reservations).toBeUndefined();
  });
});

// 배치 위치: src/modules/rooms/__tests__/rooms.service.rating.spec.ts
//
// "평점순(rating)" 정렬 검증.
// prisma / redis / geocoding을 mock으로 주입해
// searchByRating 경로만 격리 테스트한다.

import { RoomsService } from "../rooms.service";

describe("RoomsService — rating 정렬", () => {
  // 가중 평점 내림차순 결과.
  // 리뷰가 없는 D, E는 SQL의 HAVING 조건으로 결과에서 제외된다.
  const rankedOrder = ["C", "A", "B"];

  function makeService(opts?: { filteredIds?: string[] }) {
    const filteredIds = opts?.filteredIds ?? ["A", "B", "C", "D", "E"];

    const prisma: any = {
      room: {
        // 첫 번째 호출: 검색 조건을 통과한 후보 숙소 ID 조회
        // 이후 호출: 페이지에 표시할 숙소 상세 조회
        findMany: jest
          .fn()
          .mockImplementationOnce(async () => filteredIds.map((id) => ({ id })))
          .mockImplementation(async ({ where }: any) => {
            const ids: string[] = where.id.in;

            // DB가 순서를 보장하지 않는 상황을 재현하기 위해
            // 일부러 역순으로 반환한다.
            return [...ids]
              .reverse()
              .map((id) => ({ id, hostId: `host-${id}`, images: [] }));
          }),

        count: jest.fn(),
      },

      reservation: {
        findMany: jest.fn(async () => []),
      },

      calendarBlock: {
        findMany: jest.fn(async () => []),
      },

      // 실제 SQL 실행 결과를 흉내 낸다.
      // 리뷰가 없는 D, E는 반환하지 않는다.
      $queryRaw: jest.fn(async () =>
        rankedOrder
          .filter((id) => filteredIds.includes(id))
          .map((id) => ({ id })),
      ),
    };

    const redis: any = {
      cacheGet: jest.fn(),
      cacheSet: jest.fn(),
    };

    const geocoding: any = {};

    return new RoomsService(prisma, redis, geocoding);
  }

  it("리뷰 수를 포함한 가중 평점 SQL을 사용하고 무리뷰 숙소를 제외한다", async () => {
    const svc = makeService();
    const prisma: any = (svc as any).prisma;

    await svc.search({
      sort: "rating",
      take: 10,
    });

    const [sqlParts] = prisma.$queryRaw.mock.calls[0] ?? [];

    const sql = (
      Array.isArray(sqlParts) ? sqlParts.join(" ") : String(sqlParts ?? "")
    ).replace(/\s+/g, " ");

    expect(sql).toContain('COUNT(rv."id")');
    expect(sql).toContain('AVG(rv."rating")');
    expect(sql).toContain('COUNT(rv."id")::double precision + 5');
    expect(sql).toContain("* 4.0");
    expect(sql).toContain('HAVING COUNT(rv."id") > 0');
    expect(sql).toContain("DESC NULLS LAST");
  });

  it("가중 평점 내림차순으로 정렬하고 무리뷰 숙소는 제외한다", async () => {
    const svc = makeService();

    const res = await svc.search({
      sort: "rating",
      take: 10,
    });

    const ids = res.items.map((room: any) => room.id);

    expect(ids).toEqual(["C", "A", "B"]);
    expect(ids).not.toContain("D");
    expect(ids).not.toContain("E");
  });

  it("첫 페이지는 리뷰가 있는 숙소 수를 total로 반환한다", async () => {
    const svc = makeService();

    const res = await svc.search({
      sort: "rating",
      take: 2,
    });

    expect(res.items.map((room: any) => room.id)).toEqual(["C", "A"]);
    expect(res.nextCursor).toBe("2");
    expect(res.total).toBe(3);
  });

  it("커서로 다음 페이지를 이어받는다", async () => {
    const svc = makeService();

    const res = await svc.search({
      sort: "rating",
      take: 2,
      cursor: "2",
    });

    expect(res.items.map((room: any) => room.id)).toEqual(["B"]);
    expect(res.nextCursor).toBeNull();
    expect(res.total).toBeUndefined();
  });

  it("결과 범위를 넘은 커서는 빈 목록을 반환한다", async () => {
    const svc = makeService();

    const res = await svc.search({
      sort: "rating",
      take: 2,
      cursor: "4",
    });

    expect(res.items).toEqual([]);
    expect(res.nextCursor).toBeNull();
    expect(res.total).toBeUndefined();
  });

  it("findMany가 순서를 뒤섞어 반환해도 랭킹 순서를 복원한다", async () => {
    const svc = makeService();

    const res = await svc.search({
      sort: "rating",
      take: 2,
    });

    // 상세 조회에서는 A, C 순서로 반환되지만
    // 최종 결과는 SQL 랭킹인 C, A 순서여야 한다.
    expect(res.items.map((room: any) => room.id)).toEqual(["C", "A"]);
  });

  it("필터 결과가 비면 빈 배열과 total 0을 반환한다", async () => {
    const svc = makeService({
      filteredIds: [],
    });

    const res = await svc.search({
      sort: "rating",
      take: 10,
    });

    expect(res.items).toEqual([]);
    expect(res.nextCursor).toBeNull();
    expect(res.total).toBe(0);
  });

  it("rating이 아닌 정렬은 rating 경로를 사용하지 않는다", async () => {
    const svc = makeService();
    const prisma: any = (svc as any).prisma;

    await svc
      .search({
        sort: "price_asc",
        take: 10,
      })
      .catch(() => undefined);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

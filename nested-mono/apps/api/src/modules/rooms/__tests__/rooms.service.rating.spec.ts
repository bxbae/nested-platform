// 배치 위치: src/modules/rooms/__tests__/rooms.service.rating.spec.ts
//
// "평점순(rating)" 정렬 버그 수정 검증.
// prisma / redis / geocoding 을 mock 으로 주입해 searchByRating 경로만 격리 테스트한다.
// (기존 reservations.service.spec.ts 의 의존성 mock 패턴을 따름)

import { RoomsService } from "../rooms.service";

type Room = { id: string; createdAt: number };

describe("RoomsService — rating 정렬", () => {
  // 랭킹 픽스처: 평균 평점 desc, 동점은 createdAt desc, 무리뷰는 후순위.
  // $queryRaw 는 DB 가 이미 정렬해 돌려주므로, mock 은 "정렬된 id 배열"을 반환한다.
  const rankedOrder = ["C", "A", "B", "E", "D"]; // C/A=5.0(동점→최신 C), B=4.0, E/D=무리뷰(최신 E)

  function makeService(opts?: { filteredIds?: string[] }) {
    const filteredIds = opts?.filteredIds ?? ["A", "B", "C", "D", "E"];

    const prisma: any = {
      room: {
        // 1) 필터된 후보 id
        // 2) 페이지 상세 조회 — 일부러 순서를 뒤섞어 반환해 "순서 복원"을 검증
        findMany: jest
          .fn()
          // 첫 호출: select id
          .mockImplementationOnce(async () => filteredIds.map((id) => ({ id })))
          // 이후 호출: 상세 (순서 뒤섞어 반환)
          .mockImplementation(async ({ where }: any) => {
            const ids: string[] = where.id.in;
            return [...ids].reverse().map((id) => ({ id, images: [] }));
          }),
        count: jest.fn(),
      },
      // $queryRaw: 필터된 id 교집합을 rankedOrder 순서로 반환
      $queryRaw: jest.fn(async () =>
        rankedOrder.filter((id) => filteredIds.includes(id)).map((id) => ({ id }))
      ),
    };
    const redis: any = { cacheGet: jest.fn(), cacheSet: jest.fn() };
    const geocoding: any = {};

    return new RoomsService(prisma, redis, geocoding);
  }

  it("평균 평점 내림차순으로 정렬한다 (동점은 최신순, 무리뷰는 맨 뒤)", async () => {
    const svc = makeService();
    const res = await svc.search({ sort: "rating", take: 10 });
    expect(res.items.map((r: any) => r.id)).toEqual(["C", "A", "B", "E", "D"]);
  });

  it("첫 페이지는 total 을 포함하고 offset 커서를 발급한다", async () => {
    const svc = makeService();
    const res = await svc.search({ sort: "rating", take: 2 });
    expect(res.items.map((r: any) => r.id)).toEqual(["C", "A"]);
    expect(res.nextCursor).toBe("2");
    expect(res.total).toBe(5);
  });

  it("커서로 다음 페이지를 이어받는다 (total 미포함)", async () => {
    const svc = makeService();
    const res = await svc.search({ sort: "rating", take: 2, cursor: "2" });
    expect(res.items.map((r: any) => r.id)).toEqual(["B", "E"]);
    expect(res.nextCursor).toBe("4");
    expect(res.total).toBeUndefined();
  });

  it("마지막 페이지에서는 nextCursor 가 null 이다", async () => {
    const svc = makeService();
    const res = await svc.search({ sort: "rating", take: 2, cursor: "4" });
    expect(res.items.map((r: any) => r.id)).toEqual(["D"]);
    expect(res.nextCursor).toBeNull();
  });

  it("findMany 가 순서를 뒤섞어 반환해도 랭킹 순서를 복원한다", async () => {
    const svc = makeService();
    const res = await svc.search({ sort: "rating", take: 2 });
    // mock findMany 는 ["C","A"] 를 ["A","C"] 로 뒤집어 반환하지만 결과는 랭킹 순서
    expect(res.items.map((r: any) => r.id)).toEqual(["C", "A"]);
  });

  it("필터 결과가 비면 빈 배열과 total 0 을 반환한다", async () => {
    const svc = makeService({ filteredIds: [] });
    const res = await svc.search({ sort: "rating", take: 10 });
    expect(res.items).toEqual([]);
    expect(res.nextCursor).toBeNull();
    expect(res.total).toBe(0);
  });

  it("rating 이 아닌 정렬은 rating 경로($queryRaw)를 타지 않는다", async () => {
    const svc = makeService();
    const prisma: any = (svc as any).prisma;
    await svc.search({ sort: "price_asc", take: 10 }).catch(() => {});
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

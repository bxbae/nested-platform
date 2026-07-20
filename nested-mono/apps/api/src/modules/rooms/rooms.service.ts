import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.module";
import { GeocodingService } from "./geocoding.service";

export interface RoomSearchQuery {
  region?: string;
  q?: string;
  roomType?: string;
  roomTypes?: string[]; // multi-select (frontend sends CSV → array)
  minRent?: number;
  maxRent?: number;
  availableFrom?: string; // ISO date; room must be available on/before this
  gender?: string; // ANY | MALE_ONLY | FEMALE_ONLY
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  parking?: boolean;
  sort?: string; // recommended | price_asc | price_desc | rating | newest
  cursor?: string;
  take?: number;
  // Stay window (숙박 기간). When both are set, rooms already booked for any
  // part of the window are excluded.
  checkIn?: string;
  checkOut?: string;
}

// Listing CRUD + search. Reads are cached; writes are host-scoped.
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geocoding: GeocodingService
  ) {}

  // ── Search / list (검색 API) — cursor pagination + filters ──
  async search(query: RoomSearchQuery) {
    const take = Math.min(query.take ?? 20, 50);
    const where: any = { published: true };
    if (query.region) {
      // Partial, case-insensitive so "Seocho-gu" also matches "Seocho-dong",
      // and a bare neighborhood term still works.
      const term = query.region.split("-")[0] || query.region;
      where.region = { contains: term, mode: "insensitive" };
    }

    // roomType (single) or roomTypes (multi-select) → Prisma `in`
    const types = query.roomTypes?.length
      ? query.roomTypes
      : query.roomType
        ? [query.roomType]
        : [];
    if (types.length) where.roomType = { in: types };

    if (query.q) where.name = { contains: query.q, mode: "insensitive" };
    if (query.petsAllowed !== undefined) where.petsAllowed = query.petsAllowed;
    if (query.smokingAllowed !== undefined) where.smokingAllowed = query.smokingAllowed;
    if (query.parking !== undefined) where.parking = query.parking;
    if (query.availableFrom) where.availableFrom = { lte: new Date(query.availableFrom) };

    // Date-range availability (날짜 기반 검색). A room is bookable for the
    // requested window when it has NO reservation that overlaps it. Overlap is
    // the same rule the reservation service uses:
    //   existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
    // Only reservations that still hold inventory count (PENDING_PAYMENT /
    // CONFIRMED); cancelled or completed stays free the dates up again.
    if (query.checkIn && query.checkOut) {
      const from = new Date(query.checkIn);
      const to = new Date(query.checkOut);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) {
        // The room must also be move-in ready by the requested start date.
        where.availableFrom = { lte: from };
        where.reservations = {
          none: {
            status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
            checkIn: { lt: to },
            checkOut: { gt: from },
          },
        };
      }
    }
    // gender: an ANY room satisfies any request; otherwise must match
    if (query.gender && query.gender !== "ANY") {
      where.genderPolicy = { in: ["ANY", query.gender] };
    }
    if (query.minRent || query.maxRent) {
      where.monthlyRent = {};
      if (query.minRent) where.monthlyRent.gte = query.minRent;
      if (query.maxRent) where.monthlyRent.lte = query.maxRent;
    }

    // ── sort ──
    // "rating" is not a column: it's the average of a room's reviews. Prisma's
    // orderBy can't sort by a relation aggregate, so we handle it on a separate
    // path (see searchByRating) that reuses this same `where` filter. Every
    // other sort maps to a plain column and keeps id-based cursor pagination.
    if (query.sort === "rating") {
      return this.searchByRating(where, take, query.cursor);
    }

    // recommended is default (createdAt desc as proxy)
    const orderBy: any =
      query.sort === "price_asc"
        ? { monthlyRent: "asc" }
        : query.sort === "price_desc"
          ? { monthlyRent: "desc" }
          : query.sort === "newest"
            ? { availableFrom: "asc" }
            : { createdAt: "desc" };

    // total is computed once (page 1 has no cursor) so the UI can show a count
    const total = query.cursor ? undefined : await this.prisma.room.count({ where });

    const items = await this.prisma.room.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy,
      include: { images: { orderBy: { order: "asc" }, take: 1 } },
    });

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    return {
      items: page,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      ...(total !== undefined ? { total } : {}),
    };
  }

  // ── Sort by average review rating ──
  // Rating is a relation aggregate, so id-cursor pagination doesn't apply here.
  // The cursor is instead an offset ("cursor:<n>"), keeping the public response
  // shape identical to the column-sorted path. Rooms with no reviews sort last.
  private async searchByRating(where: any, take: number, cursor?: string) {
    // 1) Resolve the filtered set with the SAME Prisma `where` — no filter drift.
    const filtered = await this.prisma.room.findMany({ where, select: { id: true } });
    const ids = filtered.map((r) => r.id);
    const total = cursor ? undefined : ids.length;
    if (ids.length === 0) {
      return { items: [], nextCursor: null, ...(total !== undefined ? { total } : {}) };
    }

    // 2) Rank those ids by average rating (desc), then newest as a tiebreak.
    //    NULLS LAST puts review-less rooms at the bottom. Parameterised via
    //    Prisma.join to stay injection-safe.
    const ranked = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT r."id"
      FROM "Room" r
      LEFT JOIN "Review" rv ON rv."roomId" = r."id"
      WHERE r."id" IN (${Prisma.join(ids)})
      GROUP BY r."id", r."createdAt"
      ORDER BY AVG(rv."rating") DESC NULLS LAST, r."createdAt" DESC
    `;

    // 3) Offset slice (+1 to detect a next page), decoding the offset cursor.
    const offset = cursor ? Number(cursor) || 0 : 0;
    const window = ranked.slice(offset, offset + take + 1);
    const hasMore = window.length > take;
    const pageIds = (hasMore ? window.slice(0, take) : window).map((r) => r.id);

    // 4) Fetch the page rows, then restore the ranked order (findMany won't keep it).
    const rows = await this.prisma.room.findMany({
      where: { id: { in: pageIds } },
      include: { images: { orderBy: { order: "asc" }, take: 1 } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = pageIds.map((id) => byId.get(id)).filter(Boolean);

    return {
      items,
      nextCursor: hasMore ? String(offset + take) : null,
      ...(total !== undefined ? { total } : {}),
    };
  }

  // ── Read one ──
  async findOne(id: string) {
    const cacheKey = `room:${id}`;
    const cached = await this.redis.cacheGet(cacheKey);
    if (cached) return cached;

    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        images: true,
        amenities: { include: { amenity: true } },
        host: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { name: true, avatarColor: true } } },
        },
      },
    });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    // Flatten a rating summary the frontend adapter expects.
    const reviewCount = room.reviews.length;
    const rating =
      reviewCount > 0
        ? Math.round(
            (room.reviews.reduce((s: number, rv: { rating: number }) => s + rv.rating, 0) / reviewCount) * 10,
          ) / 10
        : 0;
    // `address` is the exact street address the host attested to. It must not
    // leave the server for a public listing view — guests only ever see the
    // approximate lat/lng (rendered as a privacy circle on the map).
    const { address: _address, ...publicRoom } = room;
    const result = { ...publicRoom, rating, reviewCount, reviewList: room.reviews };
    await this.redis.cacheSet(cacheKey, result, 60);
    return result;
  }

  // Every room I host, published or not, newest first. Powers 숙소 관리.
  async listForHost(hostId: string) {
    return this.prisma.room.findMany({
      where: { hostId },
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: { order: "asc" } },
        _count: { select: { reservations: true } },
      },
    });
  }

  // ── Create (host) ──
  // `images` is a relation, not a column — spreading it into `data` makes
  // Prisma throw, which is why listings were saving with no photos.
  //
  // The room is created unpublished (schema default) and stays invisible to
  // search until an admin approves it via PATCH /admin/rooms/:id/publish.
  async create(hostId: string, data: any) {
    const { images = [], address, ...rest } = data;

    // Coordinates come from geocoding the attested address, never from the
    // client.
    const { lat, lng } = await this.geocoding.geocode(address);

    return this.prisma.room.create({
      data: {
        ...rest,
        hostId,
        address,
        lat,
        lng,
        availableFrom: new Date(data.availableFrom),
        images: {
          create: (images as string[]).map((url, order) => ({ url, order })),
        },
      },
      include: { images: { orderBy: { order: "asc" } } },
    });
  }

  // ── Update (host-scoped) ──
  async update(hostId: string, id: string, data: any) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    if (room.hostId !== hostId) throw new ForbiddenException("본인 숙소만 수정할 수 있습니다.");
    await this.redis.cacheSet(`room:${id}`, null, 1); // invalidate

    const { images, ...rest } = data;
    return this.prisma.room.update({
      where: { id },
      data: {
        ...rest,
        ...(data.availableFrom ? { availableFrom: new Date(data.availableFrom) } : {}),
        // When a gallery is supplied, replace it wholesale.
        ...(images
          ? {
              images: {
                deleteMany: {},
                create: (images as string[]).map((url, order) => ({ url, order })),
              },
            }
          : {}),
      },
      include: { images: { orderBy: { order: "asc" } } },
    });
  }

  // ── Delete (host-scoped) ──
  async remove(hostId: string, id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    if (room.hostId !== hostId) throw new ForbiddenException("본인 숙소만 삭제할 수 있습니다.");
    await this.prisma.room.delete({ where: { id } });
    return { ok: true };
  }
  // ═══════════════════════════════════════════════════════════
  // 비슷한 숙소 추천 (유사 숙소 추천)
  // ═══════════════════════════════════════════════════════════
  // 숙소 상세 페이지에서 "이 숙소랑 비슷한 곳" 목록을 보여주기 위한 기능.
  // 별도 AI 모델 없이, 이미 있는 숙소 속성(지역/방종류/가격/편의시설)이
  // 얼마나 겹치는지를 점수로 환산해서 가장 비슷한 순서로 추천한다.
  //
  // 점수 배점 (총 100점 만점 기준으로 설계):
  //   - 같은 방 종류(roomType)        : +30점
  //   - 가격 차이가 적을수록          : 최대 +25점 (5만원 차이당 1점씩 감점)
  //   - 성별 정책(genderPolicy) 일치  : +15점
  //   - 겹치는 편의시설 1개당         : +10점 (최대 +30점)
    async findSimilar(roomId: string, limit = 4){
    // 1) 기준이 되는 숙소(target) 정보를 가져온다.
    // amenities(편의시설)까지 같이 가져와야 뒤에서 겹치는 개수를 셀 수 있음.
    const target = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { amenities: true },
    });
    // 존재하지 않는 숙소 id로 요청이 오면(잘못된 링크 등) 빈 배열로 안전하게 응답.
    if(!target) return[];

    // 2) 비교 대상 후보군을 DB에서 미리 좁혀서 가져온다.
    //    - 자기 자신은 제외 (id not equal)
    //    - 아직 승인 안 된(비공개) 숙소는 제외 (published: true)
    //    - 같은 지역(region)으로 먼저 필터링 → 전체 숙소를 다 훑지 않고
    //      DB 단계에서 미리 줄여야 숙소 수가 늘어나도 성능이 유지됨
    //    - take: 30 → 점수 계산은 이 30개 후보 안에서만 수행
    // 수정 — images도 같이 가져오도록 추가 (썸네일 표시에 필요)
    const candidates = await this.prisma.room.findMany({
      where: {
        id: { not: roomId },
        published: true,
        region: target.region,
      },
      include: { amenities: true, images: true },
      take: 30,
    });

    // 기준 숙소가 가진 편의시설 id들을 Set으로 만들어둠 (겹치는 개수를 빠르게 세기 위함)
    const targetAmenityIds = new Set(target.amenities.map((a) => a.amenityId));

    // 3) 후보 30개 각각에 대해 점수를 계산한다.
    // 겹치는 항목이 있을 때마다 reasons 배열에 이유도 같이 기록해서,
    // 프론트에서 "왜 추천됐는지" 문구로 보여줄 수 있게 한다.
    const scored = candidates.map((r) => {
      let score = 0;
      const reasons: string[] = [];

      // 방 종류가 같으면 30점 (원룸끼리, 쉐어룸끼리 비교하는 게 의미 있으므로 배점 높게)
      if (r.roomType === target.roomType) {
        score += 30;
        reasons.push("같은 방 종류");
      }

      // 가격 차이가 적을수록 높은 점수. 5만원 차이날 때마다 1점씩 깎이고,
      // 25만원 이상 차이나면 0점 (Math.max로 음수 방지)
      const priceDiff = Math.abs(r.monthlyRent - target.monthlyRent);
      score += Math.max(0, 25 - priceDiff / 50000);
      if (priceDiff <= 100000) {
        reasons.push("비슷한 가격대");
      }

      // 성별 정책(남성전용/여성전용/무관)이 같으면 15점
      if (r.genderPolicy === target.genderPolicy) {
        score += 15;
        reasons.push("같은 성별 정책");
      }

      // 편의시설이 겹치는 개수만큼 10점씩, 최대 30점까지만 인정
      const shared = r.amenities.filter((a) => targetAmenityIds.has(a.amenityId));
      score += Math.min(30, shared.length * 10);
      if (shared.length > 0) {
        reasons.push(`편의시설 ${shared.length}개 일치`);
      }

      return { room: r, score, reasons };
    });

    // 4) 점수 높은 순으로 정렬해서 상위 limit(기본 4)개만 반환.
    // room 객체에 reasons를 얹어서 함께 반환한다 (score는 내부 계산용이라 응답엔 안 넣음).
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => ({ ...s.room, reasons: s.reasons }));
  }

}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.module";
import { GeocodingService } from "./geocoding.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";

export interface RoomSearchQuery {
  region?: string;
  district?: string;
  legalDongCode?: string;
  verifiedByHost?: boolean;
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
  /** 최소 수용 인원. "N명 이상 지낼 수 있는 방"으로 좁힌다. */
  minCapacity?: number;
  /** 최소 침실 개수. "방 N개 이상". */
  minBedrooms?: number;
}

// Listing CRUD + search. Reads are cached; writes are host-scoped.
// ── 입주 가능 여부 (오늘 기준) ────────────────────────────────────────
// 오늘 날짜가 어떤 예약의 checkIn~checkOut 사이에 있으면 지금 누군가 살고 있는
// 방이다. 목록에서 "입주 중"으로 표시해 헛걸음을 줄인다. 방을 목록에서 빼지는
// 않는다 — 나중 날짜로는 들어갈 수 있기 때문이다.
const OCCUPYING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED"] as const;

/** 오늘 진행 중인 예약만 얇게 붙여 오는 include 절. */
function occupancyInclude() {
  const now = new Date();
  return {
    reservations: {
      where: {
        status: { in: [...OCCUPYING_STATUSES] },
        checkIn: { lte: now },
        checkOut: { gt: now },
      },
      // 거주 인원을 세려면 전부 필요하다 — 한 방에 여러 예약이 있을 수 있고,
      // 공동 예약은 동반자까지 포함해야 한다.
      select: { checkOut: true, companionId: true, companionStatus: true },
    },
  };
}

/** 조회 결과에 occupied / availableAgainFrom 을 얹고 원본 관계는 걷어낸다. */
type OccupancyReservation = {
  checkOut: Date;
  companionId: string | null;
  companionStatus: string | null;
};

/**
 * occupied / availableAgainFrom / residents 를 얹고 원본 관계는 걷어낸다.
 *
 * residents 는 지금 그 방에 실제로 살고 있는 사람 수다. 예약 1건당 예약자
 * 1명이고, 공동 예약에서 동반자가 수락(ACCEPTED)했으면 1명을 더 센다.
 * 초대 대기(PENDING)나 거절(DECLINED)은 아직 살고 있는 게 아니므로 빼야 한다.
 */
function withOccupancy<T extends { reservations?: OccupancyReservation[] }>(
  room: T,
) {
  const { reservations, ...rest } = room;
  const current = reservations ?? [];

  const residents = current.reduce((sum, r) => {
    return (
      sum + 1 + (r.companionId && r.companionStatus === "ACCEPTED" ? 1 : 0)
    );
  }, 0);

  // 가장 늦게 끝나는 예약이 곧 다시 입주 가능한 시점이다.
  // 초기값을 null 로 두면 빈 배열도 자연히 처리되고, 인덱스 접근이 없어
  // 컴파일러가 undefined 를 걱정할 일도 없다.
  const availableAgainFrom = current.reduce<Date | null>(
    (latest, r) =>
      latest === null || r.checkOut > latest ? r.checkOut : latest,
    null,
  );

  return {
    ...rest,
    occupied: current.length > 0,
    availableAgainFrom,
    residents,
    // 프론트 어댑터(apiRoomToHouse)는 `rating`을 찾는다 — DB 컬럼명은
    // avgRating(내부 캐시임을 분명히 하려고)이라 여기서 한 번만 맞춰준다.
    rating: (room as { avgRating?: number }).avgRating ?? 0,
  };
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geocoding: GeocodingService,
    @Optional()
    private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  // ── Search / list (검색 API) — cursor pagination + filters ──
  async search(query: RoomSearchQuery) {
    const take = Math.min(query.take ?? 20, 50);
    const where: any = { published: true };
    if (query.legalDongCode) {
      where.legalDongCode = query.legalDongCode;
    } else if (query.district && query.region) {
      where.district = query.district;
      where.region = query.region;
    } else if (query.district) {
      where.district = query.district;
    } else if (query.region) {
      where.region = query.region;
    }

    if (query.verifiedByHost) where.verifiedByHost = true;

    // roomType (single) or roomTypes (multi-select) → Prisma `in`
    const types = query.roomTypes?.length
      ? query.roomTypes
      : query.roomType
        ? [query.roomType]
        : [];
    if (types.length) where.roomType = { in: types };

    if (query.q) {
      const term = query.q.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { district: { contains: term, mode: "insensitive" } },
            { neighborhood: { contains: term, mode: "insensitive" } },
            { region: { contains: term, mode: "insensitive" } },
          ],
        },
      ];
    }
    if (query.petsAllowed !== undefined) where.petsAllowed = query.petsAllowed;
    if (query.smokingAllowed !== undefined)
      where.smokingAllowed = query.smokingAllowed;
    if (query.parking !== undefined) where.parking = query.parking;
    if (query.availableFrom)
      where.availableFrom = { lte: new Date(query.availableFrom) };

    // 인원수 필터. 독채는 capacity 가 null 이라 이 조건에서 자연히 빠진다 —
    // 정원 개념이 없는 매물을 "N명 가능"으로 셀 수는 없기 때문이다.
    const minCapacity = Number(query.minCapacity);
    if (Number.isFinite(minCapacity) && minCapacity > 0) {
      where.capacity = { gte: minCapacity };
    }

    // 침실 개수 필터. 미입력(null)인 매물은 조건을 만족한다고 볼 수 없어
    // 자연히 제외된다.
    const minBedrooms = Number(query.minBedrooms);
    if (Number.isFinite(minBedrooms) && minBedrooms > 0) {
      where.bedrooms = { gte: minBedrooms };
    }

    // Date-range availability (날짜 기반 검색). A room is bookable for the
    // requested window when it has NO reservation that overlaps it. Overlap is
    // the same rule the reservation service uses:
    //   existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
    // Only reservations that still hold inventory count (PENDING_PAYMENT /
    // CONFIRMED); cancelled or completed stays free the dates up again.
    if (query.checkIn && query.checkOut) {
      const from = new Date(query.checkIn);
      const to = new Date(query.checkOut);
      if (
        !Number.isNaN(from.getTime()) &&
        !Number.isNaN(to.getTime()) &&
        from < to
      ) {
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
    const total = query.cursor
      ? undefined
      : await this.prisma.room.count({ where });

    const rows = await this.prisma.room.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy,
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        ...occupancyInclude(),
      },
    });
    const items = rows.map(withOccupancy);

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
    const filtered = await this.prisma.room.findMany({
      where,
      select: { id: true },
    });
    const ids = filtered.map((r) => r.id);
    const total = cursor ? undefined : ids.length;
    if (ids.length === 0) {
      return {
        items: [],
        nextCursor: null,
        ...(total !== undefined ? { total } : {}),
      };
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
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        ...occupancyInclude(),
      },
    });
    const byId = new Map(rows.map((row) => [row.id, withOccupancy(row)]));
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
          include: {
            author: {
              select: {
                name: true,
                avatarColor: true,
                avatarUrl: true,
              },
            },
          },
        },
        ...occupancyInclude(),
      },
    });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    // // Flatten a rating summary the frontend adapter expects.
    // const reviewCount = room.reviews.length;
    // const rating =
    //   reviewCount > 0
    //     ? Math.round(
    //         (room.reviews.reduce(
    //           (s: number, rv: { rating: number }) => s + rv.rating,
    //           0,
    //         ) /
    //           reviewCount) *
    //           10,
    //       ) / 10
    //     : 0;
    // `address` is the exact street address the host attested to. It must not
    // leave the server for a public listing view — guests only ever see the
    // approximate lat/lng (rendered as a privacy circle on the map).
    const {
      address: _address,
      roadAddress: _roadAddress,
      jibunAddress: _jibunAddress,
      detailAddress: _detailAddress,
      zipCode: _zipCode,
      ...publicRoom
    } = room;
    // 현재 거주 인원 · 입주 가능 여부를 얹는다. 캐시가 60초라 예약 직후
    // 잠깐은 이전 값이 보일 수 있지만, 그 정도 지연은 감수할 만하다.
    // rating/reviewCount는 여기서 다시 계산 안 한다 — withOccupancy()가
    // Room.avgRating을 그대로 실어주고, reviewCount도 raw 컬럼이 이미
    // publicRoom 안에 있다. 검색 목록과 상세 페이지가 같은 캐시 값을
    // 보는 셈이라 둘이 서로 다른 숫자를 보여줄 일이 없다.
    const result = {
      ...withOccupancy(publicRoom),
      // rating,
      // reviewCount,
      reviewList: room.reviews,
    };
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
  // The room is created published (schema default) and is visible in search
  // immediately. An admin can still unpublish it via
  // PATCH /admin/rooms/:id/publish if a listing turns out to be problematic.
  async create(hostId: string, data: any) {
    const {
      images = [],
      roadAddress,
      jibunAddress = "",
      detailAddress = "",
      zipCode = "",
      city,
      district,
      neighborhood,
      legalDongCode,
      ...rest
    } = data;

    const fullAddress = [roadAddress, detailAddress]
      .filter(Boolean)
      .join(" ")
      .trim();

    const { lat, lng } = await this.geocoding.geocode(roadAddress);

    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          ...rest,
          hostId,
          published: true,
          region: neighborhood,
          city,
          district,
          neighborhood,
          legalDongCode,
          roadAddress,
          jibunAddress,
          detailAddress,
          zipCode,
          address: fullAddress,
          lat,
          lng,
          availableFrom: new Date(data.availableFrom),
          images: {
            create: (images as string[]).map((url, order) => ({
              url,
              order,
            })),
          },
        },
        include: {
          images: { orderBy: { order: "asc" } },
        },
      });

      const admins = await tx.user.findMany({
        where: {
          role: "ADMIN",
          suspended: false,
          deletedAt: null,
        },
        select: { id: true },
      });

      const notifications = await Promise.all(
        admins.map((admin) =>
          tx.notification.create({
            data: {
              userId: admin.id,
              type: "SYSTEM",
              title: "새 숙소가 등록되었어요",
              body: `"${room.name}" 숙소가 승인을 기다리고 있습니다.`,
              targetUrl: "/admin/approvals",
            },
          }),
        ),
      );

      return { room, notifications };
    });

    for (const notification of result.notifications) {
      this.notificationsGateway?.emitToUser(notification.userId, notification);
    }

    return result.room;
  }

  // ── Update (host-scoped) ──
  async update(hostId: string, id: string, data: any) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    if (room.hostId !== hostId)
      throw new ForbiddenException("본인 숙소만 수정할 수 있습니다.");
    await this.redis.cacheSet(`room:${id}`, null, 1); // invalidate

    const { images, ...rest } = data;
    return this.prisma.room.update({
      where: { id },
      data: {
        ...rest,
        ...(data.availableFrom
          ? { availableFrom: new Date(data.availableFrom) }
          : {}),
        // When a gallery is supplied, replace it wholesale.
        ...(images
          ? {
              images: {
                deleteMany: {},
                create: (images as string[]).map((url, order) => ({
                  url,
                  order,
                })),
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
    if (room.hostId !== hostId)
      throw new ForbiddenException("본인 숙소만 삭제할 수 있습니다.");

    // 살아 있는 예약이 걸린 방은 지울 수 없다. 지워 버리면 이미 결제한
    // 게스트가 갈 곳을 잃는다. 예약을 먼저 정리(취소·완료)해야 한다.
    const active = await this.prisma.reservation.count({
      where: {
        roomId: id,
        status: {
          in: [
            "PENDING_PAYMENT",
            "CONFIRMED",
            "EARLY_CHECKOUT_REQUESTED",
            "EARLY_CHECKOUT_APPROVED",
          ],
        },
      },
    });
    if (active > 0) {
      throw new BadRequestException({
        code: "ROOM_HAS_ACTIVE_RESERVATIONS",
        message: `진행 중인 예약이 ${active}건 있어 삭제할 수 없습니다. 예약을 먼저 정리해주세요.`,
      });
    }

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
  async findSimilar(roomId: string, limit = 4) {
    // 1) 기준이 되는 숙소(target) 정보를 가져온다.
    // amenities(편의시설)까지 같이 가져와야 뒤에서 겹치는 개수를 셀 수 있음.
    const target = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { amenities: true },
    });
    // 존재하지 않는 숙소 id로 요청이 오면(잘못된 링크 등) 빈 배열로 안전하게 응답.
    if (!target) return [];

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
      include: { amenities: true, images: true, ...occupancyInclude() },
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
      const shared = r.amenities.filter((a) =>
        targetAmenityIds.has(a.amenityId),
      );
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
      .map((s) => ({ ...withOccupancy(s.room), reasons: s.reasons }));
  }

  // ═══════════════════════════════════════════════════════════
  // 개인화 숙소 추천
  // ═══════════════════════════════════════════════════════════
  // 1) 찜 목록 기반으로 규칙 기반 점수를 매겨 후보 10개를 추린다.
  // 2) 그 후보들에 대해 AI가 자연어 추천 한줄평을 붙인다 (아래 explainPersonalized).
  // 홈 화면 카드가 한 줄(4칸)에 맞게 떨어지도록 기본값을 4로 둔다.
  async getPersonalizedRooms(userId: string, limit = 4) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: { room: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (favorites.length === 0)
      return { rooms: [], userName: user?.name ?? null };

    const preferredTypes = new Set(favorites.map((f) => f.room.roomType));
    const preferredRegions = new Set(favorites.map((f) => f.room.region));
    const favoriteIds = new Set(favorites.map((f) => f.roomId));
    const avgRent =
      favorites.reduce((sum, f) => sum + f.room.monthlyRent, 0) /
      favorites.length;

    const candidates = await this.prisma.room.findMany({
      where: { published: true, id: { notIn: [...favoriteIds] } },
      include: { images: true, ...occupancyInclude() },
      take: 50,
    });

    // 점수를 매기면서, "왜 이 점수를 줬는지"도 reasons 배열에 같이 기록한다.
    // (유사 숙소 추천 만들 때와 완전히 같은 패턴)
    const scored = candidates.map((room) => {
      let score = 0;
      const reasons: string[] = [];

      if (preferredTypes.has(room.roomType)) {
        score += 20;
        reasons.push("평소 관심 있으시던 방 종류");
      }
      if (preferredRegions.has(room.region)) {
        score += 15;
        reasons.push("자주 찾으신 지역");
      }
      const rentDiff = Math.abs(room.monthlyRent - avgRent);
      score += Math.max(0, 15 - rentDiff / 50000);
      if (rentDiff < 100000) {
        reasons.push("찜하신 곳들과 비슷한 가격대");
      }

      return { room, score, reasons };
    });

    const top = scored.sort((a, b) => b.score - a.score).slice(0, limit);

    // AI 호출 없이, 근거 배열을 그대로 문장으로 조합.
    // 겹치는 게 하나도 없는 예외적인 경우(순수 랜덤 노출)를 대비한 기본 문구도 준비.
    return {
      rooms: top.map(({ room, reasons }) => ({
        // 검색/유사숙소 추천이랑 같은 변환을 거쳐야 avgRating→rating 매핑,
        // occupied/residents 계산이 여기서도 똑같이 적용된다. 이걸 빼먹어서
        // 메인화면 추천 카드에만 별점이 안 뜨는 문제가 있었다.
        ...withOccupancy(room),
        personalizedReason:
          reasons.length > 0
            ? `${reasons.join(", ")}라 추천드려요!`
            : "새로운 스타일의 숙소를 추천드려요",
      })),
      userName: user?.name ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 연령대별 인기 숙소
  // ═══════════════════════════════════════════════════════════
  // 같은 연령대(20대/30대/…) 사용자들이 실제로 찜하거나 예약한 숙소를 집계한다.
  // 서비스 초기에는 표본이 적어 결과가 비거나 한두 건에 그치므로,
  // 모자란 자리는 전체 인기순(찜 수)으로 채워 카드가 항상 4칸을 채우게 한다.
  async getAgeGroupRooms(userId: string, limit = 4) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });

    if (!me?.birthDate) return { rooms: [], ageGroup: null };

    const age =
      new Date().getFullYear() - new Date(me.birthDate).getFullYear();
    // 10년 단위로 내림. 10대 미만/80대 이상은 의미가 없어 제외한다.
    const decade = Math.floor(age / 10) * 10;
    if (decade < 10 || decade > 70) return { rooms: [], ageGroup: null };

    // 같은 연령대의 생년 범위 (예: 30대 → 올해-39 ~ 올해-30년생)
    const thisYear = new Date().getFullYear();
    const from = new Date(`${thisYear - decade - 9}-01-01`);
    const to = new Date(`${thisYear - decade}-12-31`);

    const peers = await this.prisma.user.findMany({
      where: { id: { not: userId }, birthDate: { gte: from, lte: to } },
      select: { id: true },
    });
    const peerIds = peers.map((p) => p.id);

    // 같은 연령대의 찜을 방별로 집계
    const counts = new Map<string, number>();
    if (peerIds.length > 0) {
      const favs = await this.prisma.favorite.groupBy({
        by: ["roomId"],
        where: { userId: { in: peerIds } },
        _count: { roomId: true },
      });
      for (const f of favs) counts.set(f.roomId, f._count.roomId);
    }

    const rooms = await this.prisma.room.findMany({
      where: { published: true },
      include: { images: true, ...occupancyInclude(), _count: { select: { favorites: true } } },
    });

    const picked = rooms
      .map((room) => ({
        room,
        peerCount: counts.get(room.id) ?? 0,
        totalCount: room._count.favorites,
      }))
      .sort((a, b) => {
        // 또래가 고른 숙소가 우선, 그다음 전체 인기순, 마지막은 최신순.
        if (b.peerCount !== a.peerCount) return b.peerCount - a.peerCount;
        if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
        return b.room.createdAt.getTime() - a.room.createdAt.getTime();
      })
      .slice(0, limit);

    return {
      rooms: picked.map(({ room }) => withOccupancy(room)),
      ageGroup: decade,
    };
  }

  // 찜 목록(사용자가 좋아하는 것들)과 추천 후보들을 Claude API에 같이 보여주고,
  // 후보마다 "왜 이 사용자에게 맞는지" 한 문장씩 자연어로 받아온다.
  // 응답이 실패하거나 형식이 안 맞으면 조용히 빈 값 처리 (개인화는 "있으면 좋은" 기능이라
  // 이 부분이 실패해도 추천 목록 자체는 정상적으로 화면에 뜨게 함).
  private async explainPersonalized(
    favoriteRooms: { name: string; roomType: string; region: string }[],
    candidates: {
      id: string;
      name: string;
      roomType: string;
      region: string;
      monthlyRent: number;
    }[],
  ): Promise<Record<string, string>> {
    if (candidates.length === 0) return {};

    const prompt = `
사용자가 찜한 숙소들: ${favoriteRooms.map((r) => `${r.name}(${r.roomType}, ${r.region})`).join(", ")}

아래 추천 후보 숙소마다, 왜 이 사용자에게 어울리는지 한국어로 한 문장씩(15자 내외) 만들어줘.
반드시 JSON 객체만 출력해. 형식: {"숙소id": "이유 문장", ...}

후보:
${candidates.map((c) => `${c.id}: ${c.name}(${c.roomType}, ${c.region}, 월${c.monthlyRent}원)`).join("\n")}
`.trim();

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data: any = await res.json();
      const text = data.content?.[0]?.text ?? "{}";
      // 혹시 모델이 ```json 코드블록으로 감싸서 응답하면 벗겨내기
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return {}; // 실패해도 추천 목록 자체는 살아있어야 하므로 조용히 빈 값
    }
  }
}
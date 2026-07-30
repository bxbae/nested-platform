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
import {
  INVENTORY_QUERY_STATUSES,
  addUtcDays,
  atUtcDayStart,
  calculateInventory,
  calculateRangeInventory,
  isoDate,
  overlaps,
} from "../reservations/reservation-inventory.util";
import {
  addCalendarMonths,
  fullCalendarMonthsBetween,
} from "../reservations/pricing";

export interface RoomSearchQuery {
  region?: string;
  district?: string;
  legalDongCode?: string;
  currentUserId?: string;
  verifiedByHost?: boolean;
  q?: string;
  roomType?: string;
  roomTypes?: string[]; // legacy multi-select
  rentalUnits?: string[];
  buildingTypes?: string[];
  sharedFacilities?: string[];
  amenities?: string[];
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
const OCCUPYING_STATUSES = INVENTORY_QUERY_STATUSES;

const MANAGED_AMENITY_KEYS = new Set([
  "wifi",
  "laundry",
  "aircon",
  "desk",
  "weekly_cleaning",
  "gym",
  "rooftop",
  "garden",
  "parcel_locker",
  "elevator",
  "step_free_access",
  // 주차는 신규 UI에서 Boolean으로 관리하므로 사용자가 변경하면 기존 관계를 제거합니다.
  "parking",
]);

const AMENITY_CATALOG: Record<string, { label: string; icon: string }> = {
  wifi: { label: "초고속 와이파이", icon: "wifi" },
  laundry: { label: "세탁시설", icon: "washer" },
  aircon: { label: "냉난방", icon: "thermometer" },
  desk: { label: "코워킹 공간", icon: "desk" },
  weekly_cleaning: { label: "주 1회 청소", icon: "sparkles" },
  gym: { label: "헬스장", icon: "dumbbell" },
  rooftop: { label: "루프탑", icon: "sun" },
  garden: { label: "정원·테라스", icon: "leaf" },
  parcel_locker: { label: "무인 택배함", icon: "package" },
  elevator: { label: "엘리베이터", icon: "elevator" },
  step_free_access: { label: "무단차 출입 가능", icon: "accessibility" },
  // 기존 시드/운영 데이터 관계를 수정 시 그대로 보존하기 위한 호환 키입니다.
  kitchen: { label: "공용 주방", icon: "kitchen" },
  parking: { label: "주차 가능", icon: "car" },
};

function amenityCreates(
  keys: string[],
  existingCatalog: Record<string, { label: string; icon: string | null }> = {},
) {
  return [...new Set(keys)].map((key) => {
    const catalog = AMENITY_CATALOG[key] ?? existingCatalog[key];
    if (!catalog) {
      throw new BadRequestException(`지원하지 않는 편의시설입니다: ${key}`);
    }
    return {
      amenity: {
        connectOrCreate: {
          where: { key },
          create: { key, label: catalog.label, icon: catalog.icon },
        },
      },
    };
  });
}

function appendAnd(where: Record<string, any>, clause: Record<string, any>) {
  where.AND = [...(Array.isArray(where.AND) ? where.AND : []), clause];
}

function deriveLegacyRoomType(
  rentalUnit?: string | null,
  buildingType?: string | null,
): "ONE_ROOM" | "SHARE_ROOM" | "WHOLE_HOUSE" | "APARTMENT" | undefined {
  if (!rentalUnit || !buildingType) return undefined;
  if (rentalUnit !== "WHOLE") return "SHARE_ROOM";
  if (buildingType === "STUDIO") return "ONE_ROOM";
  if (buildingType === "APARTMENT" || buildingType === "OFFICETEL")
    return "APARTMENT";
  return "WHOLE_HOUSE";
}

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
      select: {
        checkOut: true,
        companionId: true,
        companionStatus: true,
        bookingMode: true,
        reservedSpots: true,
      },
    },
  };
}

/** 조회 결과에 occupied / availableAgainFrom 을 얹고 원본 관계는 걷어낸다. */
type OccupancyReservation = {
  checkOut: Date;
  companionId: string | null;
  companionStatus: string | null;
  bookingMode: string;
  reservedSpots: number;
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
    if (r.bookingMode === "BED" || r.bookingMode === "WHOLE_ROOM") {
      return sum + Math.max(1, r.reservedSpots);
    }
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
    const take = Math.min(Math.max(Math.trunc(query.take ?? 20), 1), 50);
    const requestedWindow = this.parseRequestedWindow(query);
    const where: any = { published: true };
    // NESTED_METRO_LOCATION_FILTER_V5
    const appendLocationClause = (condition: any) => {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), condition];
    };

    const locationFieldsFor = (term: string) => [
      { city: { contains: term, mode: "insensitive" } },
      { district: { contains: term, mode: "insensitive" } },
      { neighborhood: { contains: term, mode: "insensitive" } },
      { region: { contains: term, mode: "insensitive" } },
      { roadAddress: { contains: term, mode: "insensitive" } },
      { jibunAddress: { contains: term, mode: "insensitive" } },
      { address: { contains: term, mode: "insensitive" } },
    ];

    const metroAreaTerms: Record<string, string[]> = {
      // 경기
      분당구: ["성남시", "분당구", "판교", "분당"],
      영통구: ["수원시", "영통구", "광교", "수원"],
      수지구: ["용인시", "수지구", "수지", "용인"],
      일산동구: ["고양시", "일산동구", "일산서구", "일산", "고양"],
      광명시: ["광명시", "광명"],
      동안구: ["안양시", "동안구", "만안구", "안양"],
      하남시: ["하남시", "하남"],
      부천시: ["부천시", "부천", "원미구", "소사구", "오정구", "소사본동"],

      // 인천
      연수구: ["연수구", "송도", "연수"],
      부평구: ["부평구", "부평"],
      남동구: ["남동구", "구월동", "남동"],
      계양구: ["계양구", "계양"],
      미추홀구: ["미추홀구", "미추홀"],
      서구: ["인천 서구", "서구", "청라"],
    };

    const seoulDistrictAliases: Record<string, string[]> = {
      강남구: ["강남구", "Gangnam-gu", "Yeoksam-dong", "역삼동"],
      서초구: ["서초구", "Seocho-gu"],
      송파구: ["송파구", "Songpa-gu"],
      마포구: [
        "마포구",
        "Mapo-gu",
        "Mangwon-dong",
        "Seogyo-dong",
        "Yeonnam-dong",
        "Hongdae",
      ],
      성동구: ["성동구", "Seongdong-gu", "Seongsu-dong"],
      용산구: ["용산구", "Yongsan-gu", "Itaewon"],
      영등포구: ["영등포구", "Yeongdeungpo-gu", "Yeouido"],
      종로구: ["종로구", "Jongno-gu", "Hyehwa-dong"],
      관악구: ["관악구", "Gwanak-gu", "Sillim", "Bongcheon-dong"],
      구로구: ["구로구", "Guro-gu", "Gasan-dong"],
      강서구: ["강서구", "Gangseo-gu", "Magok-dong"],
    };

    if (query.legalDongCode) {
      where.legalDongCode = query.legalDongCode;
    } else if (query.district) {
      const metroTerms = metroAreaTerms[query.district];

      if (metroTerms) {
        const clauses = metroTerms.flatMap(locationFieldsFor);

        // 인천의 "서구"가 서울 서구와 혼동되는 상황을 막기 위해
        // 인천 생활권은 인천 주소 조건까지 함께 적용합니다.
        const isIncheonDistrict = [
          "연수구",
          "부평구",
          "남동구",
          "계양구",
          "미추홀구",
          "서구",
        ].includes(query.district);

        if (isIncheonDistrict) {
          appendLocationClause({
            AND: [
              {
                OR: [
                  ...locationFieldsFor("인천"),
                  ...locationFieldsFor("인천광역시"),
                ],
              },
              { OR: clauses },
            ],
          });
        } else {
          appendLocationClause({ OR: clauses });
        }
      } else {
        // 서울은 기존 구 필터와 영문 별칭을 함께 유지합니다.
        const aliases = seoulDistrictAliases[query.district] ?? [
          query.district,
        ];

        appendLocationClause({
          OR: aliases.flatMap(locationFieldsFor),
        });

        if (query.region) {
          const term = query.region.split("-")[0] || query.region;

          appendLocationClause({
            OR: locationFieldsFor(term),
          });
        }
      }
    } else if (query.region) {
      const term = query.region.split("-")[0] || query.region;

      appendLocationClause({
        OR: locationFieldsFor(term),
      });
    }
    if (query.verifiedByHost) where.verifiedByHost = true;

    // roomType (single) or roomTypes (multi-select) → Prisma `in`
    const types = query.roomTypes?.length
      ? query.roomTypes
      : query.roomType
        ? [query.roomType]
        : [];
    if (types.length) where.roomType = { in: types };

    if (query.rentalUnits?.length) {
      const fallbackRoomTypes = query.rentalUnits.includes("WHOLE")
        ? ["WHOLE_HOUSE"]
        : [];
      appendAnd(where, {
        OR: [
          { rentalUnit: { in: query.rentalUnits } },
          ...(fallbackRoomTypes.length
            ? [{ rentalUnit: null, roomType: { in: fallbackRoomTypes } }]
            : []),
        ],
      });
    }

    if (query.buildingTypes?.length) {
      const fallbackRoomTypes = [
        ...(query.buildingTypes.includes("STUDIO") ? ["ONE_ROOM"] : []),
        ...(query.buildingTypes.includes("APARTMENT") ? ["APARTMENT"] : []),
        ...(query.buildingTypes.includes("HOUSE") ? ["WHOLE_HOUSE"] : []),
      ];
      appendAnd(where, {
        OR: [
          { buildingType: { in: query.buildingTypes } },
          ...(fallbackRoomTypes.length
            ? [{ buildingType: null, roomType: { in: fallbackRoomTypes } }]
            : []),
        ],
      });
    }

    if (query.sharedFacilities?.length) {
      where.sharedFacilities = { hasEvery: query.sharedFacilities };
    }

    if (query.amenities?.length) {
      for (const key of query.amenities) {
        appendAnd(where, {
          amenities: { some: { amenity: { key } } },
        });
      }
    }

    if (query.q) {
      const term = query.q.trim();
      appendAnd(where, {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { city: { contains: term, mode: "insensitive" } },
          { district: { contains: term, mode: "insensitive" } },
          { neighborhood: { contains: term, mode: "insensitive" } },
          { region: { contains: term, mode: "insensitive" } },
        ],
      });
    }
    if (query.petsAllowed !== undefined) where.petsAllowed = query.petsAllowed;
    if (query.smokingAllowed !== undefined)
      where.smokingAllowed = query.smokingAllowed;
    if (query.parking !== undefined) {
      // 운영 초기 시드에는 parking이 Amenity 관계에만 저장된 숙소가 있어
      // 신규 Boolean 필드와 기존 관계를 모두 인정합니다.
      appendAnd(where, {
        OR: [
          { parking: query.parking },
          ...(query.parking
            ? [{ amenities: { some: { amenity: { key: "parking" } } } }]
            : []),
        ],
      });
    }
    if (query.availableFrom)
      where.availableFrom = { lte: new Date(query.availableFrom) };

    // 인원수 필터. 신규 숙소는 전체 숙소까지 capacity를 저장한다.
    // 기존 데이터 중 capacity가 null인 숙소는 조건에서 안전하게 제외된다.
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

    // 날짜 범위 검색은 실제로 전체 기간을 예약할 수 있는 숙소만 반환한다.
    // 플랫폼 최소 1개월과 숙소별 최소 계약 기간을 먼저 적용하고, 예약 중복·
    // 다인실 잔여 자리·호스트 차단일은 재고 계산 후 최종 제외한다.
    if (requestedWindow) {
      where.availableFrom = { lte: requestedWindow.checkIn };
      where.minStayMonths = { lte: requestedWindow.fullMonths };
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
      return this.searchByRating(
        where,
        take,
        query.cursor,
        query.currentUserId,
        query,
      );
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

    if (requestedWindow) {
      return this.searchAvailableByColumnSort(where, orderBy, take, query);
    }

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
      },
    });
    const items = await this.attachInventoryState(rows, query);

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    // 로그인한 사용자 기준으로 "내가 등록한 숙소"인지 표시
    const withOwnership = page.map((room) => ({
      ...room,
      isMine: query.currentUserId ? room.hostId === query.currentUserId : false,
    }));
    return {
      items: withOwnership,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      ...(total !== undefined ? { total } : {}),
    };
  }

  private parseRequestedWindow(query: RoomSearchQuery): {
    checkIn: Date;
    checkOut: Date;
    fullMonths: number;
  } | null {
    const hasCheckIn = Boolean(query.checkIn);
    const hasCheckOut = Boolean(query.checkOut);
    if (hasCheckIn !== hasCheckOut) {
      throw new BadRequestException("입주일과 퇴실일을 모두 선택해주세요.");
    }
    if (!query.checkIn || !query.checkOut) return null;

    const checkIn = new Date(query.checkIn);
    const checkOut = new Date(query.checkOut);
    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime()) ||
      checkOut <= checkIn
    ) {
      throw new BadRequestException("입주 기간이 올바르지 않습니다.");
    }

    const platformMinimum = addCalendarMonths(checkIn, 1);
    if (checkOut < platformMinimum) {
      throw new BadRequestException(
        `최소 거주 기간은 1개월입니다. 퇴실일을 ${isoDate(platformMinimum)} 이후로 선택해주세요.`,
      );
    }

    return {
      checkIn,
      checkOut,
      fullMonths: Math.max(1, fullCalendarMonthsBetween(checkIn, checkOut)),
    };
  }

  private async searchAvailableByColumnSort(
    where: any,
    orderBy: any,
    take: number,
    query: RoomSearchQuery,
  ) {
    // 다인실은 예약 자리 합산이 필요하므로 관계 필터만으로 정확히 거르기
    // 어렵다. 기본 필터 결과에 공통 재고 계산을 적용한 뒤 페이지를 나눈다.
    const rows = await this.prisma.room.findMany({
      where,
      orderBy,
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
      },
    });

    const visible = await this.attachInventoryState(rows, query);

    // 선택 기간이 마감된 숙소도 검색 결과에 남긴다.
    // 상세 달력에서 다른 입주 가능 날짜를 확인할 수 있어야 하기 때문이다.
    const cursorIndex = query.cursor
      ? visible.findIndex((room) => room.id === query.cursor)
      : -1;
    const offset = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const window = visible.slice(offset, offset + take + 1);
    const hasMore = window.length > take;
    const page = hasMore ? window.slice(0, take) : window;

    return {
      items: page.map((room) => ({
        ...room,
        isMine: query.currentUserId
          ? room.hostId === query.currentUserId
          : false,
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      ...(!query.cursor ? { total: visible.length } : {}),
    };
  }

  private async attachInventoryState(rows: any[], query: RoomSearchQuery) {
    if (rows.length === 0) return [];

    const today = atUtcDayStart(new Date());
    const tomorrow = addUtcDays(today, 1);
    const requestedFrom = query.checkIn ? new Date(query.checkIn) : null;
    const requestedTo = query.checkOut ? new Date(query.checkOut) : null;
    const hasRequestedWindow = Boolean(
      requestedFrom &&
      requestedTo &&
      !Number.isNaN(requestedFrom.getTime()) &&
      !Number.isNaN(requestedTo.getTime()) &&
      requestedFrom < requestedTo,
    );
    const inventoryFrom = hasRequestedWindow ? requestedFrom! : today;
    const inventoryTo = hasRequestedWindow ? requestedTo! : tomorrow;
    const queryFrom = inventoryFrom < today ? inventoryFrom : today;
    const queryTo = inventoryTo > tomorrow ? inventoryTo : tomorrow;
    const roomIds = rows.map((room) => room.id);

    const [reservations, blocks] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          roomId: { in: roomIds },
          status: { in: INVENTORY_QUERY_STATUSES },
          checkIn: { lt: queryTo },
          checkOut: { gt: queryFrom },
        },
        select: {
          roomId: true,
          checkIn: true,
          checkOut: true,
          bookingMode: true,
          reservedSpots: true,
          companionId: true,
          companionStatus: true,
        },
      }),
      this.prisma.calendarBlock.findMany({
        where: {
          roomId: { in: roomIds },
          blocked: true,
          date: {
            gte: atUtcDayStart(inventoryFrom),
            lt: atUtcDayStart(inventoryTo),
          },
        },
        select: { roomId: true, date: true },
      }),
    ]);

    return rows.map((room) => {
      const roomReservations = reservations.filter((r) => r.roomId === room.id);
      const current = roomReservations.filter((r) =>
        overlaps(r.checkIn, r.checkOut, today, tomorrow),
      );
      const selected = roomReservations.filter((r) =>
        overlaps(r.checkIn, r.checkOut, inventoryFrom, inventoryTo),
      );
      const blocked = blocks.some((block) => block.roomId === room.id);
      const inventory = calculateRangeInventory(
        room.rentalUnit,
        room.capacity,
        selected,
        inventoryFrom,
        inventoryTo,
        blocked,
      );
      const residents = current.reduce((sum, r) => {
        if (r.bookingMode === "BED" || r.bookingMode === "WHOLE_ROOM") {
          return sum + Math.max(1, r.reservedSpots);
        }
        return (
          sum + 1 + (r.companionId && r.companionStatus === "ACCEPTED" ? 1 : 0)
        );
      }, 0);
      const availableAgainFrom = current.reduce<Date | null>(
        (latest, r) =>
          latest === null || r.checkOut > latest ? r.checkOut : latest,
        null,
      );

      return {
        ...room,
        occupied: current.length > 0,
        residents,
        availableAgainFrom,
        rating: room.avgRating ?? 0,
        inventory: {
          ...inventory,
          scope: hasRequestedWindow ? "SELECTED_DATES" : "CURRENT",
          checkIn: hasRequestedWindow ? isoDate(inventoryFrom) : null,
          checkOut: hasRequestedWindow ? isoDate(inventoryTo) : null,
        },
      };
    });
  }

  async availabilityMonth(
    id: string,
    year: number,
    month: number,
    requestedSpots = 1,
  ) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        rentalUnit: true,
        capacity: true,
        availableFrom: true,
      },
    });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));
    const [reservations, blocks] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          roomId: id,
          status: { in: INVENTORY_QUERY_STATUSES },
          checkIn: { lt: monthEnd },
          checkOut: { gt: monthStart },
        },
        select: {
          checkIn: true,
          checkOut: true,
          bookingMode: true,
          reservedSpots: true,
        },
      }),
      this.prisma.calendarBlock.findMany({
        where: {
          roomId: id,
          blocked: true,
          date: { gte: monthStart, lt: monthEnd },
        },
        select: { date: true, reason: true },
      }),
    ]);
    const blockMap = new Map(
      blocks.map((block) => [isoDate(block.date), block.reason ?? null]),
    );
    const days = [];
    const today = atUtcDayStart(new Date());

    for (let day = monthStart; day < monthEnd; day = addUtcDays(day, 1)) {
      const nextDay = addUtcDays(day, 1);
      const date = isoDate(day);
      const active = reservations.filter((reservation) =>
        overlaps(reservation.checkIn, reservation.checkOut, day, nextDay),
      );
      const hostBlocked = blockMap.has(date);
      const beforeAvailableFrom = day < atUtcDayStart(room.availableFrom);
      const past = day < today;
      const inventory = calculateInventory(
        room.rentalUnit,
        room.capacity,
        active,
        hostBlocked || beforeAvailableFrom || past,
      );
      const enoughSpots =
        room.rentalUnit !== "BED" ||
        (inventory.remainingSpots ?? 0) >= Math.max(1, requestedSpots);
      days.push({
        date,
        blocked: hostBlocked,
        blockReason: blockMap.get(date) ?? null,
        beforeAvailableFrom,
        past,
        reservedSpots: inventory.reservedSpots,
        remainingSpots: inventory.remainingSpots,
        fullyBooked: inventory.fullyBooked,
        available: !inventory.fullyBooked && enoughSpots,
      });
    }

    return {
      roomId: room.id,
      rentalUnit: room.rentalUnit,
      capacity: room.capacity,
      availableFrom: isoDate(room.availableFrom),
      requestedSpots: Math.max(1, requestedSpots),
      days,
    };
  }

  // ── Sort by average review rating ──
  // Rating is a relation aggregate, so id-cursor pagination doesn't apply here.
  // The cursor is instead an offset ("cursor:<n>"), keeping the public response
  // shape identical to the column-sorted path. Rooms with no reviews sort last.
  private async searchByRating(
    where: any,
    take: number,
    cursor?: string,
    currentUserId?: string,
    query: RoomSearchQuery = {},
  ) {
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

    // 2) Rank rooms using a Bayesian weighted rating.
    //
    // A room with one 5-star review should not automatically outrank a room
    // with many consistently high reviews.
    //
    // weighted score =
    //   (reviewCount / (reviewCount + 5)) * averageRating
    //   + (5 / (reviewCount + 5)) * 4.0
    //
    // Rooms without reviews are excluded from the top-rated results.
    const ranked = await this.prisma.$queryRaw<{ id: string }[]>`
  SELECT r."id"
  FROM "Room" r
  LEFT JOIN "Review" rv ON rv."roomId" = r."id"
  WHERE r."id" IN (${Prisma.join(ids)})
  GROUP BY r."id", r."createdAt"
  HAVING COUNT(rv."id") > 0
  ORDER BY
    CASE
      WHEN COUNT(rv."id") = 0 THEN NULL
      ELSE (
        (
          COUNT(rv."id")::double precision
          / (COUNT(rv."id")::double precision + 5)
        )
        * AVG(rv."rating")::double precision
        +
        (
          5.0
          / (COUNT(rv."id")::double precision + 5)
        )
        * 4.0
      )
    END DESC NULLS LAST,
    COUNT(rv."id") DESC,
    AVG(rv."rating") DESC NULLS LAST,
    r."createdAt" DESC
`;

    const rankedIds = ranked.map((row) => row.id);
    // 평점순에서도 마감 숙소를 제거하지 않는다. 최종 조회 단계에서
    // inventory를 붙여 카드에 "선택 기간 예약 마감"으로 표시한다.
    const availableIds = rankedIds;

    // 3) Offset slice (+1 to detect a next page), decoding the offset cursor.
    const offset = cursor ? Number(cursor) || 0 : 0;
    const window = availableIds.slice(offset, offset + take + 1);
    const hasMore = window.length > take;
    const pageIds = hasMore ? window.slice(0, take) : window;

    // 4) Fetch the page rows, then restore the ranked order (findMany won't keep it).
    const rows = await this.prisma.room.findMany({
      where: { id: { in: pageIds } },
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
      },
    });
    const enriched = await this.attachInventoryState(rows, query);
    const byId = new Map(enriched.map((row) => [row.id, row]));
    const items = pageIds.map((id) => byId.get(id)).filter(Boolean);
    const withOwnership = items.map((room: any) => ({
      ...room,
      isMine: currentUserId ? room.hostId === currentUserId : false,
    }));

    return {
      items: withOwnership,
      nextCursor: hasMore ? String(offset + take) : null,
      ...(!cursor ? { total: availableIds.length } : {}),
    };
  }

  // ── Read one ──
  async findOne(id: string) {
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
                id: true,
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
    // 현재 거주 인원 · 입주 가능 여부는 예약 직후 즉시 보여야 하므로
    // 동적 상세 응답은 캐시하지 않는다.
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
    return result;
  }

  // Every room I host, published or not, newest first. Powers 숙소 관리.
  async listForHost(hostId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { hostId },
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: { order: "asc" } },
        amenities: { include: { amenity: true } },
        _count: { select: { reservations: true } },
      },
    });
    if (rooms.length === 0) return [];

    const today = atUtcDayStart(new Date());
    const tomorrow = addUtcDays(today, 1);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        roomId: { in: rooms.map((room) => room.id) },
        status: { in: INVENTORY_QUERY_STATUSES },
        checkOut: { gt: today },
      },
      select: {
        id: true,
        roomId: true,
        checkIn: true,
        checkOut: true,
        status: true,
        bookingMode: true,
        reservedSpots: true,
        guest: { select: { name: true } },
        companion: { select: { name: true } },
        companions: {
          where: {
            status: {
              in: ["PENDING", "ACCEPTED", "PAYMENT_PENDING", "PAID"],
            },
          },
          select: { user: { select: { name: true } } },
        },
      },
      orderBy: { checkIn: "asc" },
    });
    const blocks = await this.prisma.calendarBlock.findMany({
      where: {
        roomId: { in: rooms.map((room) => room.id) },
        blocked: true,
        date: { gte: today, lt: tomorrow },
      },
      select: { roomId: true },
    });
    const blockedRoomIds = new Set(blocks.map((block) => block.roomId));

    return rooms.map((room) => {
      const roomReservations = reservations.filter((r) => r.roomId === room.id);
      const current = roomReservations.filter((r) =>
        overlaps(r.checkIn, r.checkOut, today, tomorrow),
      );
      const future = roomReservations.filter((r) => r.checkIn >= tomorrow);
      const currentInventory = calculateInventory(
        room.rentalUnit,
        room.capacity,
        current,
        blockedRoomIds.has(room.id),
      );
      const guestNames = [
        ...new Set(
          current.flatMap((reservation) => [
            reservation.guest?.name ?? "게스트",
            ...reservation.companions.map((member) => member.user.name),
            ...(reservation.companions.length === 0 &&
            reservation.companion?.name
              ? [reservation.companion.name]
              : []),
          ]),
        ),
      ];
      const currentCheckOuts = current.map((r) => r.checkOut);
      const next = future[0];
      const nextWindowReservations = next
        ? roomReservations.filter((reservation) =>
            overlaps(
              reservation.checkIn,
              reservation.checkOut,
              next.checkIn,
              next.checkOut,
            ),
          )
        : [];
      const upcomingInventory = next
        ? calculateRangeInventory(
            room.rentalUnit,
            room.capacity,
            nextWindowReservations,
            next.checkIn,
            next.checkOut,
          )
        : null;

      return {
        ...room,
        currentInventory: {
          ...currentInventory,
          reservationCount: current.length,
          representativeGuestName: guestNames[0] ?? null,
          additionalGuestCount: Math.max(0, guestNames.length - 1),
          nextCheckIn: next?.checkIn ?? null,
          nextCheckOut:
            currentCheckOuts.length > 0
              ? new Date(Math.min(...currentCheckOuts.map((date) => +date)))
              : (next?.checkOut ?? null),
        },
        upcomingInventory:
          next && upcomingInventory
            ? {
                ...upcomingInventory,
                reservationCount: nextWindowReservations.length,
                checkIn: next.checkIn,
                checkOut: next.checkOut,
              }
            : null,
      };
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
      amenities = [],
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
    // 신규 3축이 들어오면 legacy roomType도 서버가 같은 의미로 강제 계산한다.
    // 클라이언트가 서로 모순되는 두 분류를 보내도 DB에는 일관된 값만 저장한다.
    const legacyRoomType =
      rest.rentalUnit || rest.buildingType
        ? deriveLegacyRoomType(rest.rentalUnit, rest.buildingType)
        : rest.roomType;
    if (!legacyRoomType) {
      throw new BadRequestException("숙소 분류를 확인해주세요.");
    }

    const normalizedCapacity =
      rest.rentalUnit == null
        ? rest.capacity
        : rest.rentalUnit === "BED"
          ? rest.capacity
          : rest.rentalUnit === "PRIVATE_ROOM"
            ? 1
            : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          ...rest,
          capacity: normalizedCapacity,
          roomType: legacyRoomType,
          classificationReviewRequired: false,
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
          amenities: {
            create: amenityCreates(amenities as string[]),
          },
        },
        include: {
          images: { orderBy: { order: "asc" } },
        },
      });

      return { room };
    }, { timeout: 15000 });

    const notifiedAdmins = await this.prisma.user.findMany({
      where: {
        role: "ADMIN",
        suspended: false,
        deletedAt: null,
      },
      select: { id: true },
    });

    const notifications = await this.prisma.notification.createManyAndReturn({
      data: notifiedAdmins.map((admin) => ({
        userId: admin.id,
        type: "SYSTEM",
        title: "새 숙소가 등록되었어요",
        body: `"${result.room.name}" 새로운 숙소가 등록 되었습니다.`,
        targetUrl: "/admin/approvals",
      })),
    });

    for (const notification of notifications) {
      this.notificationsGateway?.emitToUser(notification.userId, notification);
    }

    return result.room;
  }

  // ── Update (host-scoped) ──
  async update(hostId: string, id: string, data: any) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { amenities: { include: { amenity: true } } },
    });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    if (room.hostId !== hostId)
      throw new ForbiddenException("본인 숙소만 수정할 수 있습니다.");
    await this.redis.cacheSet(`room:${id}`, null, 1); // invalidate

    const { images, amenities, ...rest } = data;
    const existingAmenityCatalog = Object.fromEntries(
      room.amenities.map(({ amenity }) => [
        amenity.key,
        { label: amenity.label, icon: amenity.icon },
      ]),
    );
    // 편의시설을 수정해도 신규 UI에서 관리하지 않는 기존 관계는 보존합니다.
    // 예: 과거 시드의 kitchen 또는 향후 추가된 별도 편의시설.
    const preservedAmenityKeys = room.amenities
      .map(({ amenity }) => amenity.key)
      .filter((key) => !MANAGED_AMENITY_KEYS.has(key));
    const nextAmenityKeys = amenities
      ? [...preservedAmenityKeys, ...(amenities as string[])]
      : undefined;
    const nextRentalUnit = rest.rentalUnit ?? room.rentalUnit;
    const nextBuildingType = rest.buildingType ?? room.buildingType;
    const nextSharedFacilities = rest.sharedFacilities ?? room.sharedFacilities;
    const nextCapacity =
      rest.capacity !== undefined ? rest.capacity : room.capacity;

    if (nextRentalUnit || nextBuildingType) {
      if (!nextRentalUnit || !nextBuildingType) {
        throw new BadRequestException(
          "예약 공간과 건물 유형을 모두 선택해주세요.",
        );
      }
      if (
        nextRentalUnit === "BED" &&
        (nextCapacity == null || nextCapacity < 2)
      ) {
        throw new BadRequestException(
          "다인실 수용 인원은 2명 이상이어야 합니다.",
        );
      }
      if (nextRentalUnit === "WHOLE" && nextSharedFacilities.length > 0) {
        throw new BadRequestException(
          "전체 숙소는 공유 시설을 선택하지 않습니다.",
        );
      }
      if (nextRentalUnit !== "WHOLE" && nextSharedFacilities.length === 0) {
        throw new BadRequestException("공유 시설을 하나 이상 선택해주세요.");
      }
      rest.roomType = deriveLegacyRoomType(nextRentalUnit, nextBuildingType);
      if (nextRentalUnit === "PRIVATE_ROOM") {
        rest.capacity = 1;
      } else if (nextRentalUnit !== "BED") {
        rest.capacity = null;
      }
      // 분류 세 축이 유효하게 저장된 경우에만 검토 필요 상태를 해제한다.
      rest.classificationReviewRequired = false;
    } else if (rest.classificationReviewRequired === false) {
      throw new BadRequestException(
        "예약 공간과 건물 유형을 먼저 선택한 뒤 분류 확인을 완료해주세요.",
      );
    }

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
        ...(nextAmenityKeys
          ? {
              amenities: {
                deleteMany: {},
                create: amenityCreates(
                  nextAmenityKeys,
                  existingAmenityCatalog,
                ),
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
        status: { in: INVENTORY_QUERY_STATUSES },
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

    const age = new Date().getFullYear() - new Date(me.birthDate).getFullYear();
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
      include: {
        images: true,
        ...occupancyInclude(),
        _count: { select: { favorites: true } },
      },
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

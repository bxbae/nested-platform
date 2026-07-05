import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.module";

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
}

// Listing CRUD + search. Reads are cached; writes are host-scoped.
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  // ── Search / list (검색 API) — cursor pagination + filters ──
  async search(query: RoomSearchQuery) {
    const take = Math.min(query.take ?? 20, 50);
    const where: any = { published: true };
    if (query.region) where.region = query.region;

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
    // gender: an ANY room satisfies any request; otherwise must match
    if (query.gender && query.gender !== "ANY") {
      where.genderPolicy = { in: ["ANY", query.gender] };
    }
    if (query.minRent || query.maxRent) {
      where.monthlyRent = {};
      if (query.minRent) where.monthlyRent.gte = query.minRent;
      if (query.maxRent) where.monthlyRent.lte = query.maxRent;
    }

    // ── sort ── recommended is default (createdAt desc as proxy)
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

  // ── Read one ──
  async findOne(id: string) {
    const cacheKey = `room:${id}`;
    const cached = await this.redis.cacheGet(cacheKey);
    if (cached) return cached;

    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { images: true, amenities: { include: { amenity: true } }, host: true },
    });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    await this.redis.cacheSet(cacheKey, room, 60);
    return room;
  }

  // ── Create (host) ──
  async create(hostId: string, data: any) {
    return this.prisma.room.create({
      data: { ...data, hostId, availableFrom: new Date(data.availableFrom) },
    });
  }

  // ── Update (host-scoped) ──
  async update(hostId: string, id: string, data: any) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    if (room.hostId !== hostId) throw new ForbiddenException("본인 숙소만 수정할 수 있습니다.");
    await this.redis.cacheSet(`room:${id}`, null, 1); // invalidate
    return this.prisma.room.update({ where: { id }, data });
  }

  // ── Delete (host-scoped) ──
  async remove(hostId: string, id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    if (room.hostId !== hostId) throw new ForbiddenException("본인 숙소만 삭제할 수 있습니다.");
    await this.prisma.room.delete({ where: { id } });
    return { ok: true };
  }
}

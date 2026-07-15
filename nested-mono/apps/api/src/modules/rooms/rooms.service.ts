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
}

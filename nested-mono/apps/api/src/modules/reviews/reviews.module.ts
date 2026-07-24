import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req,
  Injectable, Module, NotFoundException, ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { toBadges } from "../../common/activity-tier";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.module";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // Reviews for a listing, with the author's trust badges so a reader can weigh
  // the review — a verified, frequent guest carries more signal than a new one.
  async listForRoom(roomId: string) {
    const rows = await this.prisma.review.findMany({
      where: { roomId },
      include: {
        author: {
          select: {
            name: true,
            avatarColor: true,
            verifiedAt: true,
            _count: { select: { reviews: true } },
            reservations: { where: { status: "COMPLETED" }, select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map(({ author, ...review }) => ({
      ...review,
      author: {
        name: author.name,
        avatarColor: author.avatarColor,
        ...toBadges(author.verifiedAt, author.reservations.length, author._count.reviews),
      },
    }));
  }

  // 리뷰 작성 — 트랜잭션으로 리뷰 생성 + 그 방의 평점 캐시(avgRating/
  // reviewCount) 재계산을 같이 처리한다. 둘이 따로 놀면(리뷰는 생겼는데
  // 캐시가 안 갱신되는 등) 검색 카드가 실제 리뷰 수와 어긋나게 된다.
  async create(authorId: string, data: { roomId: string; rating: number; body: string }) {
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({ data: { ...data, authorId } });

      const agg = await tx.review.aggregate({
        where: { roomId: data.roomId },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.room.update({
        where: { id: data.roomId },
        data: {
          avgRating: agg._avg.rating ?? 0,
          reviewCount: agg._count.rating,
        },
      });

      return created;
    });

    // rooms.service.ts findOne()의 60초 캐시를 즉시 무효화 — 안 그러면
    // 방금 단 리뷰가 최대 1분 동안 상세 페이지에 안 보인다.
    // (트랜잭션 밖에서: DB 커밋이 확정된 뒤에 캐시를 지워야, 캐시가
    // 무효화된 순간과 새 값을 읽을 수 있는 순간 사이에 텀이 안 생긴다.)
    await this.redis.cacheSet(`room:${data.roomId}`, null, 1);
      return review;
  }

  // Reviews I wrote — the guest-side "내 리뷰" list. Includes the room so the
  // list can link back to what was reviewed.
  listForGuest(authorId: string) {
    return this.prisma.review.findMany({
      where: { authorId },
      include: { room: { select: { id: true, name: true, region: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // Every review across the listings I host — the 리뷰 관리 inbox.
  listForHost(hostId: string) {
    return this.prisma.review.findMany({
      where: { room: { hostId } },
      include: {
        author: { select: { id: true, name: true, avatarColor: true } },
        room: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Host replies to a review. Only the host of that review's room may reply —
  // without this check any signed-in user could answer anyone's reviews.
  async reply(userId: string, id: string, hostReply: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: { room: { select: { hostId: true } } },
    });
    if (!review) {
      throw new NotFoundException({ code: "REVIEW_NOT_FOUND", message: "리뷰를 찾을 수 없습니다." });
    }
    if (review.room.hostId !== userId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소의 리뷰에만 답변할 수 있습니다.",
      });
    }
    return this.prisma.review.update({ where: { id }, data: { hostReply } });
  }
}

const createReviewSchema = z.object({
  roomId: z.string(),
  rating: z.number().int().min(1).max(5),
  body: z.string().min(1),
});
const replySchema = z.object({ hostReply: z.string().min(1) });

// 리뷰 API
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query("roomId") roomId: string) {
    return this.reviews.listForRoom(roomId);
  }

  // Declared before any ":id" route so "mine" isn't captured as an id.
  // GET /reviews/mine — 내가 작성한 리뷰 (게스트 관점)
  @Get("mine")
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: any) {
    return this.reviews.listForGuest(req.user.id);
  }

  // GET /reviews/received — 내 숙소에 달린 리뷰 (호스트 관점)
  // 예전에는 /mine 이 이 동작을 했다. 게스트가 /mine 을 부르면 자기 리뷰가
  // 아니라 빈 목록이 돌아오던 문제를 바로잡으면서 경로를 나눴다.
  @Get("received")
  @UseGuards(JwtAuthGuard)
  received(@Req() req: any) {
    return this.reviews.listForHost(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body(new ZodValidationPipe(createReviewSchema)) dto: any) {
    return this.reviews.create(req.user.id, dto);
  }

  @Patch(":id/reply")
  @UseGuards(JwtAuthGuard)
  reply(@Req() req: any, @Param("id") id: string, @Body(new ZodValidationPipe(replySchema)) dto: any) {
    return this.reviews.reply(req.user.id, id, dto.hostReply);
  }
}

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}

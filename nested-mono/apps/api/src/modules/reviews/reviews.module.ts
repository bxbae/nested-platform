import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, Injectable, Module } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  listForRoom(roomId: string) {
    return this.prisma.review.findMany({
      where: { roomId },
      include: { author: { select: { name: true, avatarColor: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  create(authorId: string, data: { roomId: string; rating: number; body: string }) {
    return this.prisma.review.create({ data: { ...data, authorId } });
  }

  // host replies to a review
  reply(id: string, hostReply: string) {
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

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body(new ZodValidationPipe(createReviewSchema)) dto: any) {
    return this.reviews.create(req.user.id, dto);
  }

  @Patch(":id/reply")
  @UseGuards(JwtAuthGuard)
  reply(@Param("id") id: string, @Body(new ZodValidationPipe(replySchema)) dto: any) {
    return this.reviews.reply(id, dto.hostReply);
  }
}

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}

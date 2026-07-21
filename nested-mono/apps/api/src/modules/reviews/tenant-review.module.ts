import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  Injectable,
  Module,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { ReservationStatus } from "@prisma/client";

// A stay must be over before the host can review the tenant.
const REVIEWABLE: ReservationStatus[] = [
  ReservationStatus.COMPLETED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
];

export interface Badge {
  key: string;
  label: string;
  icon: string;
  description: string;
}

export interface TenantBadges {
  userId: string;
  ratingAverage: number | null; // average of reviews received (null = none yet)
  ratingCount: number;
  reviewsWritten: number;
  badges: Badge[];
}

// Badge thresholds. Rating badges need a minimum count so a single 5★ doesn't
// mint a top badge; activity badges reward writing reviews.
function deriveBadges(avg: number | null, count: number, written: number): Badge[] {
  const badges: Badge[] = [];

  if (avg !== null && count >= 3 && avg >= 4.8) {
    badges.push({
      key: "TOP_TENANT",
      label: "최우수 입주자",
      icon: "🏆",
      description: "받은 평가 평균 4.8점 이상 (3건 이상)",
    });
  } else if (avg !== null && count >= 2 && avg >= 4.5) {
    badges.push({
      key: "GREAT_TENANT",
      label: "우수 입주자",
      icon: "⭐",
      description: "받은 평가 평균 4.5점 이상 (2건 이상)",
    });
  }

  if (written >= 10) {
    badges.push({
      key: "TOP_REVIEWER",
      label: "우수 리뷰어",
      icon: "✍️",
      description: "후기 10개 이상 작성",
    });
  } else if (written >= 3) {
    badges.push({
      key: "REVIEWER",
      label: "리뷰어",
      icon: "📝",
      description: "후기 3개 이상 작성",
    });
  }

  return badges;
}

@Injectable()
export class TenantReviewService {
  constructor(private readonly prisma: PrismaService) {}

  // Host reviews the tenant of a finished stay on their own listing.
  async create(hostId: string, reservationId: string, rating: number, body: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        guestId: true,
        status: true,
        room: { select: { hostId: true } },
        tenantReview: { select: { id: true } },
      },
    });
    if (!reservation) {
      throw new NotFoundException({ code: "RESERVATION_NOT_FOUND", message: "예약을 찾을 수 없습니다." });
    }
    if (reservation.room.hostId !== hostId) {
      throw new ForbiddenException({ code: "NOT_HOST", message: "본인 숙소의 입주자만 평가할 수 있습니다." });
    }
    if (!REVIEWABLE.includes(reservation.status)) {
      throw new BadRequestException({
        code: "NOT_FINISHED",
        message: "이용이 끝난 예약만 평가할 수 있습니다.",
      });
    }
    if (reservation.tenantReview) {
      throw new BadRequestException({ code: "ALREADY_REVIEWED", message: "이미 평가한 예약입니다." });
    }

    return this.prisma.tenantReview.create({
      data: { reservationId, authorId: hostId, tenantId: reservation.guestId, rating, body },
    });
  }

  // Badges for a user: rating badges from reviews received (as a tenant),
  // activity badges from reviews written (on rooms). Computed on demand —
  // no badge table to keep in sync.
  async badges(userId: string): Promise<TenantBadges> {
    const [received, written] = await Promise.all([
      this.prisma.tenantReview.findMany({ where: { tenantId: userId }, select: { rating: true } }),
      this.prisma.review.count({ where: { authorId: userId } }),
    ]);

    const ratingCount = received.length;
    const ratingAverage =
      ratingCount > 0
        ? Math.round((received.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10) / 10
        : null;

    return {
      userId,
      ratingAverage,
      ratingCount,
      reviewsWritten: written,
      badges: deriveBadges(ratingAverage, ratingCount, written),
    };
  }
}

const createSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(1000),
});

// 입주자 평가 + 배지
@Controller()
export class TenantReviewController {
  constructor(private readonly svc: TenantReviewService) {}

  // POST /tenant-reviews/:reservationId — host reviews the tenant.
  @Post("tenant-reviews/:reservationId")
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req: any,
    @Param("reservationId") reservationId: string,
    @Body(new ZodValidationPipe(createSchema)) dto: any,
  ) {
    return this.svc.create(req.user.id, reservationId, dto.rating, dto.body);
  }

  // GET /users/:id/badges — public badge summary for a user.
  @Get("users/:id/badges")
  badges(@Param("id") id: string) {
    return this.svc.badges(id);
  }

  // GET /me/badges — my own badges.
  @Get("me/badges")
  @UseGuards(JwtAuthGuard)
  myBadges(@Req() req: any) {
    return this.svc.badges(req.user.id);
  }
}

@Module({
  controllers: [TenantReviewController],
  providers: [TenantReviewService],
})
export class TenantReviewModule {}

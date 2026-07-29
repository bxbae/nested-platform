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
  earned: boolean;
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
function deriveBadges(
  avg: number | null,
  ratingCount: number,
  written: number,
  completedStays: number,
  verified: boolean,
): Badge[] {
  // 6종 성취 배지. 활동 등급(연속 레벨)과 달리 각각 독립적으로 획득한다.
  // 미획득 배지도 회색으로 보여줘야 하므로 항상 6개를 모두 반환하고,
  // earned 로 획득 여부만 구분한다.
  return [
    {
      key: "FIRST_STAY",
      label: "첫 발걸음",
      icon: "\uD83D\uDC63",
      description: "첫 숙박을 완료했어요",
      earned: completedStays >= 1,
    },
    {
      key: "REGULAR_GUEST",
      label: "단골 이웃",
      icon: "\uD83C\uDFE0",
      description: "숙박 5회를 완료했어요",
      earned: completedStays >= 5,
    },
    {
      key: "FIRST_REVIEW",
      label: "후기 작성자",
      icon: "\uD83D\uDCDD",
      description: "후기를 처음 남겼어요",
      earned: written >= 1,
    },
    {
      key: "PROLIFIC_REVIEWER",
      label: "성실한 후기러",
      icon: "\u270D\uFE0F",
      description: "후기를 5개 이상 작성했어요",
      earned: written >= 5,
    },
    {
      key: "WELL_RATED",
      label: "호평 받은 게스트",
      icon: "\u2B50",
      description: "받은 평가 평균 4.5점 이상 (3건 이상)",
      earned: avg !== null && ratingCount >= 3 && avg >= 4.5,
    },
    {
      key: "VERIFIED",
      label: "인증 완료",
      icon: "\u2705",
      description: "신원 인증을 마쳤어요",
      earned: verified,
    },
  ];
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
    const [received, written, completedStays, user] = await Promise.all([
      this.prisma.tenantReview.findMany({ where: { tenantId: userId }, select: { rating: true } }),
      this.prisma.review.count({ where: { authorId: userId } }),
      this.prisma.reservation.count({ where: { guestId: userId, status: { in: ["COMPLETED", "EARLY_CHECKOUT_APPROVED"] } } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { verifiedAt: true } }),
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
      badges: deriveBadges(ratingAverage, ratingCount, written, completedStays, user?.verifiedAt != null),
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

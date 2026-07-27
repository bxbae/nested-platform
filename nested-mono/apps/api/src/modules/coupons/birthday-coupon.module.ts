import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { isBirthday } from "../../common/age-group";
import { couponDiscount } from "../reservations/pricing";

const BIRTHDAY_DISCOUNT = 10000;
const VALID_DAYS = 7;

function birthdayCode(userId: string, year: number): string {
  return `BDAY-${userId.slice(0, 8).toUpperCase()}-${year}`;
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

@Injectable()
export class BirthdayCouponService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureBirthdayCoupon(userId: string, today = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });

    if (!user?.birthDate || !isBirthday(user.birthDate, today)) {
      return null;
    }

    const code = birthdayCode(userId, today.getFullYear());
    const validTo = new Date(today);
    validTo.setDate(validTo.getDate() + VALID_DAYS);

    return this.prisma.coupon.upsert({
      where: { code },
      update: {
        kind: "BIRTHDAY",
        ownerId: userId,
      },
      create: {
        code,
        type: "FIXED",
        value: BIRTHDAY_DISCOUNT,
        minSpend: 0,
        validFrom: today,
        validTo,
        usageLimit: 1,
        kind: "BIRTHDAY",
        ownerId: userId,
      },
    });
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });
    const today = new Date();
    const birthday = isBirthday(user?.birthDate, today);
    const coupon = birthday
      ? await this.ensureBirthdayCoupon(userId, today)
      : await this.prisma.coupon.findFirst({
          where: {
            ownerId: userId,
            kind: "BIRTHDAY",
            code: birthdayCode(userId, today.getFullYear()),
          },
        });

    return {
      hasBirthDate: !!user?.birthDate,
      isBirthday: birthday,
      claimed: !!coupon,
      code: coupon?.code ?? null,
      discount: BIRTHDAY_DISCOUNT,
      validTo: coupon?.validTo?.toISOString() ?? null,
    };
  }

  async claim(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });

    if (!user?.birthDate) {
      throw new BadRequestException({
        code: "BIRTHDATE_REQUIRED",
        message: "생년월일을 먼저 등록해주세요.",
      });
    }

    const today = new Date();
    if (!isBirthday(user.birthDate, today)) {
      throw new BadRequestException({
        code: "NOT_BIRTHDAY",
        message: "생일 당일에만 받을 수 있어요.",
      });
    }

    const coupon = await this.ensureBirthdayCoupon(userId, today);
    if (!coupon) {
      throw new BadRequestException({
        code: "BIRTHDAY_COUPON_FAILED",
        message: "생일 쿠폰을 발급하지 못했습니다.",
      });
    }

    return {
      code: coupon.code,
      discount: coupon.value,
      validTo: coupon.validTo.toISOString(),
    };
  }

  async listMyCoupons(userId: string, monthlyRent?: number) {
    const today = new Date();
    await this.ensureBirthdayCoupon(userId, today);

    const currentBirthdayCode = birthdayCode(userId, today.getFullYear());
    const [coupons, usedReservations] = await Promise.all([
      this.prisma.coupon.findMany({
        where: {
          OR: [
            { kind: "GENERAL", ownerId: null },
            { kind: "BIRTHDAY", ownerId: userId },
            // 이전 버전에서 발급된 생일 쿠폰 호환
            { code: currentBirthdayCode },
          ],
        },
        orderBy: [{ validTo: "asc" }, { code: "asc" }],
      }),
      this.prisma.reservation.findMany({
        where: {
          guestId: userId,
          couponId: { not: null },
          status: { not: "PENDING_PAYMENT" },
        },
        select: { couponId: true },
      }),
    ]);

    const usedIds = new Set(
      usedReservations
        .map((row) => row.couponId)
        .filter((id): id is string => Boolean(id)),
    );
    const rentBase =
      typeof monthlyRent === "number" && Number.isFinite(monthlyRent)
        ? Math.max(0, Math.round(monthlyRent))
        : null;

    return coupons.map((coupon) => {
      const used = usedIds.has(coupon.id);
      const exhausted =
        coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit;

      let status:
        | "AVAILABLE"
        | "USED"
        | "EXPIRED"
        | "NOT_STARTED"
        | "MIN_SPEND";

      if (used) status = "USED";
      else if (today < coupon.validFrom) status = "NOT_STARTED";
      else if (today > coupon.validTo || exhausted) status = "EXPIRED";
      else if (rentBase != null && rentBase < coupon.minSpend)
        status = "MIN_SPEND";
      else status = "AVAILABLE";

      const discountAmount =
        rentBase != null ? couponDiscount(coupon as any, rentBase) : null;
      const effectivePercent =
        rentBase && discountAmount != null
          ? roundPercent((discountAmount / rentBase) * 100)
          : null;

      return {
        id: coupon.id,
        code: coupon.code,
        kind: coupon.kind as "GENERAL" | "BIRTHDAY",
        type: coupon.type as "FIXED" | "PERCENT",
        value: coupon.value,
        maxDiscount: coupon.maxDiscount,
        minSpend: coupon.minSpend,
        validFrom: coupon.validFrom.toISOString(),
        validTo: coupon.validTo.toISOString(),
        status,
        discountAmount,
        effectivePercent,
        appliesTo: "FIRST_MONTH_RENT" as const,
      };
    });
  }
}

@UseGuards(JwtAuthGuard)
@Controller("me/birthday-coupon")
export class BirthdayCouponController {
  constructor(private readonly service: BirthdayCouponService) {}

  @Get()
  status(@Req() req: any) {
    return this.service.status(req.user.id);
  }

  @Post()
  claim(@Req() req: any) {
    return this.service.claim(req.user.id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller("me/coupons")
export class MyCouponsController {
  constructor(private readonly service: BirthdayCouponService) {}

  @Get()
  list(
    @Req() req: any,
    @Query("monthlyRent") monthlyRent?: string,
  ) {
    const parsed = monthlyRent ? Number(monthlyRent) : undefined;
    return this.service.listMyCoupons(
      req.user.id,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [BirthdayCouponController, MyCouponsController],
  providers: [BirthdayCouponService],
})
export class BirthdayCouponModule {}

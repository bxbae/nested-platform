import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { isBirthday } from "../../common/age-group";

// 생일 쿠폰 (Birthday coupon).
//
// The Coupon table is code-based and has no per-user ownership, so a birthday
// coupon is issued as a Coupon row with a code unique to that user and year
// (usageLimit 1). Claiming twice in the same year is rejected because the code
// already exists — the uniqueness constraint is the ownership check.
//
// Discount and validity are fixed here rather than admin-configurable; move
// them to a settings row if that ever needs to change without a deploy.
const BIRTHDAY_DISCOUNT = 10000; // 원
const VALID_DAYS = 7;

function birthdayCode(userId: string, year: number): string {
  return `BDAY-${userId.slice(0, 8).toUpperCase()}-${year}`;
}

@Injectable()
export class BirthdayCouponService {
  constructor(private readonly prisma: PrismaService) {}

  // 오늘이 생일인지 + 올해 이미 받았는지.
  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true },
    });
    const today = new Date();
    const birthday = isBirthday(user?.birthDate, today);
    const existing = await this.prisma.coupon.findUnique({
      where: { code: birthdayCode(userId, today.getFullYear()) },
    });
    return {
      // 생년월일 미입력이면 false — 설정에서 입력하라고 안내한다.
      hasBirthDate: !!user?.birthDate,
      isBirthday: birthday,
      claimed: !!existing,
      code: existing?.code ?? null,
      discount: BIRTHDAY_DISCOUNT,
      validTo: existing?.validTo?.toISOString() ?? null,
    };
  }

  // 생일 당일에만 발급. 같은 해에 두 번은 코드 중복으로 막힌다.
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

    const code = birthdayCode(userId, today.getFullYear());
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException({
        code: "ALREADY_CLAIMED",
        message: "올해 생일 쿠폰은 이미 받으셨어요.",
      });
    }

    const validTo = new Date(today);
    validTo.setDate(validTo.getDate() + VALID_DAYS);

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        type: "FIXED",
        value: BIRTHDAY_DISCOUNT,
        minSpend: 0,
        validFrom: today,
        validTo,
        usageLimit: 1,
      },
    });
    return {
      code: coupon.code,
      discount: coupon.value,
      validTo: coupon.validTo.toISOString(),
    };
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

@Module({
  imports: [PrismaModule],
  controllers: [BirthdayCouponController],
  providers: [BirthdayCouponService],
})
export class BirthdayCouponModule {}

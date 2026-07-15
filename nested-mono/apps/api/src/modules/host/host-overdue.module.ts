import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  Injectable,
  Module,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

@Injectable()
export class HostOverdueService {
  constructor(private readonly prisma: PrismaService) {}

  // Host sends an overdue-payment notice to a reservation's guest. This creates
  // an in-app notification (PAYMENT type) rather than a real SMS — a real text
  // needs a paid gateway + a pre-registered sender number (legally required in
  // KR), which is out of scope. The delivery path can be swapped for SMS later
  // without changing this interface.
  async sendNotice(hostId: string, reservationId: string, message?: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        guestId: true,
        room: { select: { name: true, hostId: true } },
      },
    });
    if (!reservation) {
      throw new NotFoundException({ code: "RESERVATION_NOT_FOUND", message: "예약을 찾을 수 없습니다." });
    }
    if (reservation.room.hostId !== hostId) {
      throw new ForbiddenException({ code: "NOT_HOST", message: "본인 숙소의 예약만 안내할 수 있습니다." });
    }

    const roomName = reservation.room.name.trim();
    const body =
      message?.trim() ||
      `[${roomName}] 월 이용료가 연체되었습니다. 빠른 시일 내에 납부 부탁드립니다.`;

    const notification = await this.prisma.notification.create({
      data: {
        userId: reservation.guestId,
        type: "PAYMENT",
        title: "연체 안내",
        body,
      },
    });
    return { ok: true, notificationId: notification.id };
  }
}

const noticeSchema = z.object({
  message: z.string().trim().max(500).optional(),
});

// 호스트 연체 안내 — 입주자에게 앱 내 알림 발송
@Controller("host/overdue")
@UseGuards(JwtAuthGuard)
export class HostOverdueController {
  constructor(private readonly svc: HostOverdueService) {}

  // POST /host/overdue/:reservationId  { message? }
  @Post(":reservationId")
  send(
    @Req() req: any,
    @Param("reservationId") reservationId: string,
    @Body(new ZodValidationPipe(noticeSchema)) dto: any,
  ) {
    return this.svc.sendNotice(req.user.id, reservationId, dto.message);
  }
}

@Module({
  controllers: [HostOverdueController],
  providers: [HostOverdueService],
})
export class HostOverdueModule {}

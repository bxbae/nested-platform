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
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationsGateway } from "../notifications/notifications.gateway";

@Injectable()
export class HostOverdueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

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
        status: true,
        room: {
          select: {
            name: true,
            hostId: true,
          },
        },
      },
    });
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    }
    if (reservation.room.hostId !== hostId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소의 예약만 안내할 수 있습니다.",
      });
    }
    if (reservation.status !== "CONFIRMED") {
      throw new BadRequestException({
        code: "INVALID_RESERVATION_STATUS",
        message: "예약이 확정된 상태일 때만 연체 안내를 보낼 수 있습니다.",
      });
    }

    const roomName = reservation.room.name.trim();

    const body =
      message?.trim() ||
      `[${roomName}] 월 이용료가 연체되었습니다. 빠른 시일 내에 납부 부탁드립니다.`;

    const targetUrl = `/me/payments?reservationId=${reservationId}`;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentNotification = await this.prisma.notification.findFirst({
      where: {
        userId: reservation.guestId,
        type: "PAYMENT",
        title: "연체 안내",
        targetUrl,
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentNotification) {
      return {
        ok: true,
        notificationId: recentNotification.id,
        duplicate: true,
      };
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: reservation.guestId,
        type: "PAYMENT",
        title: "연체 안내",
        body,
        targetUrl,
      },
    });

    this.notificationsGateway.emitToUser(reservation.guestId, notification);

    return {
      ok: true,
      notificationId: notification.id,
      duplicate: false,
    };
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
  imports: [NotificationsModule],
  controllers: [HostOverdueController],
  providers: [HostOverdueService],
})
export class HostOverdueModule {}

import { Controller, Get, Patch, Param, UseGuards, Req, Injectable, Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

@Injectable()
export class NotificationsApiService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  unreadMessageCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, type: "MESSAGE", read: false },
    });
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }
}

// 알림 API
@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsApiController {
  constructor(private readonly svc: NotificationsApiService) {}

  @Get()
  async list(@Req() req: any) {
    const [items, unread] = await Promise.all([
      this.svc.list(req.user.id),
      this.svc.unreadCount(req.user.id),
    ]);
    return { items, unread };
  }

  @Get("messages/unread-count")
  async messageUnreadCount(@Req() req: any) {
    return { unread: await this.svc.unreadMessageCount(req.user.id) };
  }

  @Patch(":id/read")
  read(@Req() req: any, @Param("id") id: string) {
    return this.svc.markRead(req.user.id, id);
  }

  @Patch("read-all")
  readAll(@Req() req: any) {
    return this.svc.markAllRead(req.user.id);
  }
}

@Module({
  controllers: [NotificationsApiController],
  providers: [NotificationsApiService],
})
export class NotificationsApiModule {}

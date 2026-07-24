import {
  Body,
  Controller,
  ForbiddenException,
  Injectable,
  Module,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationsGateway } from "../notifications/notifications.gateway";

const TYPES = [
  "ROOM",
  "REVIEW",
  "USER",
  "MESSAGE",
  "COMMUNITY_POST",
  "COMMUNITY_COMMENT",
] as const;
type TargetType = (typeof TYPES)[number];
const schema = z.object({
  targetType: z.enum(TYPES),
  targetId: z.string().min(1),
  reason: z.string().trim().min(1).max(500),
});

const TARGET_LABEL: Record<TargetType, string> = {
  ROOM: "숙소",
  REVIEW: "리뷰",
  USER: "사용자",
  MESSAGE: "메시지",
  COMMUNITY_POST: "커뮤니티 게시글",
  COMMUNITY_COMMENT: "커뮤니티 댓글",
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private async reportedUserId(
    reporterId: string,
    type: TargetType,
    id: string,
  ): Promise<string | null> {
    if (type === "USER") {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException("사용자를 찾을 수 없습니다.");
      }

      return user.id;
    }

    if (type === "ROOM") {
      const room = await this.prisma.room.findUnique({
        where: { id },
        select: { hostId: true },
      });

      if (!room) {
        throw new NotFoundException("숙소를 찾을 수 없습니다.");
      }

      return room.hostId;
    }

    if (type === "REVIEW") {
      const review = await this.prisma.review.findUnique({
        where: { id },
        select: { authorId: true },
      });

      if (!review) {
        throw new NotFoundException("리뷰를 찾을 수 없습니다.");
      }

      return review.authorId;
    }

    if (type === "COMMUNITY_POST") {
      const row = await this.prisma.post.findUnique({
        where: { id },
        select: { authorId: true },
      });
      if (!row) throw new NotFoundException("게시글을 찾을 수 없습니다.");
      return row.authorId;
    }
    if (type === "COMMUNITY_COMMENT") {
      const row = await this.prisma.comment.findUnique({
        where: { id },
        select: { authorId: true },
      });
      if (!row) throw new NotFoundException("댓글을 찾을 수 없습니다.");
      return row.authorId;
    }
    if (type === "MESSAGE") {
      const room = await this.prisma.message.findUnique({
        where: { id },
        select: {
          senderId: true,
          chatRoom: { select: { guestId: true, hostId: true } },
        },
      });
      if (room) {
        if (![room.chatRoom.guestId, room.chatRoom.hostId].includes(reporterId))
          throw new ForbiddenException("대화 참여자만 신고할 수 있습니다.");
        return room.senderId;
      }
      const direct = await this.prisma.directMessage.findUnique({
        where: { id },
        select: {
          senderId: true,
          conversation: {
            select: { participantAId: true, participantBId: true },
          },
        },
      });
      if (!direct) throw new NotFoundException("메시지를 찾을 수 없습니다.");
      if (
        ![
          direct.conversation.participantAId,
          direct.conversation.participantBId,
        ].includes(reporterId)
      )
        throw new ForbiddenException("대화 참여자만 신고할 수 있습니다.");
      return direct.senderId;
    }
    return null;
  }

  async create(
    reporterId: string,
    dto: { targetType: TargetType; targetId: string; reason: string },
  ) {
    const reportedId = await this.reportedUserId(
      reporterId,
      dto.targetType,
      dto.targetId,
    );
    if (reportedId === reporterId)
      throw new ForbiddenException({
        code: "CANNOT_REPORT_SELF",
        message: "본인이 작성한 콘텐츠는 신고할 수 없습니다.",
      });
    const duplicate = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: { in: ["RECEIVED", "IN_REVIEW"] },
      },
    });
    if (duplicate)
      throw new ForbiddenException({
        code: "DUPLICATE_REPORT",
        message: "이미 접수된 신고입니다.",
      });
    const admins = await this.prisma.user.findMany({
      where: {
        role: "ADMIN",
        suspended: false,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          reporterId,
          reportedUserId: reportedId,
          ...dto,
        },
      });

      const notifications = await Promise.all(
        admins.map((admin) =>
          tx.notification.create({
            data: {
              userId: admin.id,
              type: "REPORT",
              title: "새 신고가 접수되었습니다",
              body: `${TARGET_LABEL[dto.targetType]} 신고가 새로 접수되었습니다.`,
              targetUrl: "/admin/reports",
            },
          }),
        ),
      );

      return {
        report,
        notifications,
      };
    });

    for (const notification of result.notifications) {
      this.notificationsGateway.emitToUser(notification.userId, notification);
    }

    return result.report;
  }
}
@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Post() create(
    @Req() req: any,
    @Body(new ZodValidationPipe(schema)) dto: any,
  ) {
    return this.reports.create(req.user.id, dto);
  }
}
@Module({
  imports: [NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

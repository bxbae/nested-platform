import { Body, Controller, ForbiddenException, Injectable, Module, NotFoundException, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

const TYPES = ["ROOM", "REVIEW", "USER", "MESSAGE", "COMMUNITY_POST", "COMMUNITY_COMMENT"] as const;
type TargetType = (typeof TYPES)[number];
const schema = z.object({ targetType: z.enum(TYPES), targetId: z.string().min(1), reason: z.string().trim().min(1).max(500) });

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async reportedUserId(reporterId: string, type: TargetType, id: string): Promise<string | null> {
    if (type === "USER") return id;
    if (type === "REVIEW") {
      const row = await this.prisma.review.findUnique({ where: { id }, select: { authorId: true } });
      if (!row) throw new NotFoundException("리뷰를 찾을 수 없습니다.");
      return row.authorId;
    }
    if (type === "COMMUNITY_POST") {
      const row = await this.prisma.post.findUnique({ where: { id }, select: { authorId: true } });
      if (!row) throw new NotFoundException("게시글을 찾을 수 없습니다.");
      return row.authorId;
    }
    if (type === "COMMUNITY_COMMENT") {
      const row = await this.prisma.comment.findUnique({ where: { id }, select: { authorId: true } });
      if (!row) throw new NotFoundException("댓글을 찾을 수 없습니다.");
      return row.authorId;
    }
    if (type === "MESSAGE") {
      const room = await this.prisma.message.findUnique({ where: { id }, select: { senderId: true, chatRoom: { select: { guestId: true, hostId: true } } } });
      if (room) {
        if (![room.chatRoom.guestId, room.chatRoom.hostId].includes(reporterId)) throw new ForbiddenException("대화 참여자만 신고할 수 있습니다.");
        return room.senderId;
      }
      const direct = await this.prisma.directMessage.findUnique({ where: { id }, select: { senderId: true, conversation: { select: { participantAId: true, participantBId: true } } } });
      if (!direct) throw new NotFoundException("메시지를 찾을 수 없습니다.");
      if (![direct.conversation.participantAId, direct.conversation.participantBId].includes(reporterId)) throw new ForbiddenException("대화 참여자만 신고할 수 있습니다.");
      return direct.senderId;
    }
    return null;
  }

  async create(reporterId: string, dto: { targetType: TargetType; targetId: string; reason: string }) {
    const reportedId = await this.reportedUserId(reporterId, dto.targetType, dto.targetId);
    if (reportedId === reporterId) throw new ForbiddenException({ code: "CANNOT_REPORT_SELF", message: "본인이 작성한 콘텐츠는 신고할 수 없습니다." });
    const duplicate = await this.prisma.report.findFirst({ where: { reporterId, targetType: dto.targetType, targetId: dto.targetId, status: { in: ["RECEIVED", "IN_REVIEW"] } } });
    if (duplicate) throw new ForbiddenException({ code: "DUPLICATE_REPORT", message: "이미 접수된 신고입니다." });
    return this.prisma.report.create({ data: { reporterId, ...dto } });
  }
}
@Controller("reports") @UseGuards(JwtAuthGuard)
export class ReportsController { constructor(private readonly reports: ReportsService) {} @Post() create(@Req() req: any, @Body(new ZodValidationPipe(schema)) dto: any) { return this.reports.create(req.user.id, dto); } }
@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}

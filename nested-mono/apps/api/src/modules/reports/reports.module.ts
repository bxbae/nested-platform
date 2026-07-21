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

// ReportTargetType (schema.prisma) 과 동일한 값.
const REPORT_TARGET_TYPES = ["ROOM", "REVIEW", "USER", "MESSAGE"] as const;
type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1),
  reason: z.string().trim().min(1, "신고 사유를 입력해주세요.").max(500),
});

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // 메시지 신고: 채팅방/다이렉트 대화 양쪽 테이블에서 메시지를 찾아
  //  - 신고자가 그 대화의 참여자인지
  //  - 본인이 보낸 메시지를 스스로 신고하는 건 아닌지
  // 를 확인한다.
  private async assertCanReportMessage(reporterId: string, messageId: string) {
    const roomMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        senderId: true,
        chatRoom: { select: { guestId: true, hostId: true } },
      },
    });

    if (roomMessage) {
      const isParticipant =
        roomMessage.chatRoom.guestId === reporterId ||
        roomMessage.chatRoom.hostId === reporterId;

      if (!isParticipant) {
        throw new ForbiddenException({
          code: "NOT_CONVERSATION_MEMBER",
          message: "대화 참여자만 신고할 수 있습니다.",
        });
      }
      if (roomMessage.senderId === reporterId) {
        throw new ForbiddenException({
          code: "CANNOT_REPORT_SELF",
          message: "본인 메시지는 신고할 수 없습니다.",
        });
      }
      return;
    }

    const directMessage = await this.prisma.directMessage.findUnique({
      where: { id: messageId },
      select: {
        senderId: true,
        conversation: {
          select: { participantAId: true, participantBId: true },
        },
      },
    });

    if (!directMessage) {
      throw new NotFoundException({
        code: "MESSAGE_NOT_FOUND",
        message: "메시지를 찾을 수 없습니다.",
      });
    }

    const isParticipant =
      directMessage.conversation.participantAId === reporterId ||
      directMessage.conversation.participantBId === reporterId;

    if (!isParticipant) {
      throw new ForbiddenException({
        code: "NOT_CONVERSATION_MEMBER",
        message: "대화 참여자만 신고할 수 있습니다.",
      });
    }
    if (directMessage.senderId === reporterId) {
      throw new ForbiddenException({
        code: "CANNOT_REPORT_SELF",
        message: "본인 메시지는 신고할 수 없습니다.",
      });
    }
  }

  async create(
    reporterId: string,
    dto: { targetType: ReportTargetType; targetId: string; reason: string },
  ) {
    if (dto.targetType === "MESSAGE") {
      await this.assertCanReportMessage(reporterId, dto.targetId);
    }

    // status 는 admin 쪽 신고함(/admin/reports)에서 그대로 조회한다 —
    // 기본값 RECEIVED 로 생성되며 관리자가 IN_REVIEW → RESOLVED 로 처리.
    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });
  }
}

// 사용자용 신고 접수 API (관리자 화면은 modules/admin 의 GET/PATCH /admin/reports 에서 처리)
@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(
    @Req() req: any,
    @Body(new ZodValidationPipe(createReportSchema)) dto: any,
  ) {
    return this.reports.create(req.user.id, dto);
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

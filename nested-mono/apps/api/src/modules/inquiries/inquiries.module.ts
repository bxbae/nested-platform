// ── 고객센터 문의 ────────────────────────────────────────────────────
// 로그인한 사용자가 운영팀에 문의를 남기고, 운영팀이 답변하면 알림이 간다.
// 신고(Report)와 달리 대상이 없고 1:1 문의라 구조가 단순하다.
import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards/auth.guards";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { NotificationsGateway } from "../notifications/notifications.gateway";

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(5).max(4000),
});

const answerSchema = z.object({
  // 상태만 바꾸는 경우도 있어서 answer 는 선택값이다.
  answer: z.string().trim().max(4000).optional(),
  status: z.enum(["RECEIVED", "IN_PROGRESS", "RESOLVED"]).optional(),
});

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "대기 중",
  IN_PROGRESS: "처리 중",
  RESOLVED: "완료",
};

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(authorId: string, input: { title: string; body: string }) {
    return this.prisma.inquiry.create({
      data: { authorId, title: input.title, body: input.body },
    });
  }

  // 내 문의 목록 — 답변 여부를 바로 볼 수 있게 답변도 함께 내려준다.
  async listMine(authorId: string) {
    return this.prisma.inquiry.findMany({
      where: { authorId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  // 관리자용 전체 목록
  async listAll(status?: string) {
    const rows = await this.prisma.inquiry.findMany({
      where: status ? { status: status as any } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      status: r.status,
      answer: r.answer,
      answeredAt: r.answeredAt,
      createdAt: r.createdAt,
      authorId: r.author.id,
      authorName: r.author.name,
      authorEmail: r.author.email,
    }));
  }

  // 답변 저장 + 상태 변경. 답변 본문이 새로 들어온 경우에만 알림을 보낸다
  // (상태만 바꿀 때마다 알림이 가면 문의자에게 소음이 된다).
  async answer(
    adminId: string,
    id: string,
    input: { answer?: string; status?: string },
  ) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true, answer: true },
    });
    if (!inquiry)
      throw new NotFoundException({
        code: "INQUIRY_NOT_FOUND",
        message: "문의를 찾을 수 없습니다.",
      });

    const hasNewAnswer =
      typeof input.answer === "string" &&
      input.answer.length > 0 &&
      input.answer !== inquiry.answer;

    const updated = await this.prisma.inquiry.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status as any } : {}),
        ...(hasNewAnswer
          ? {
              answer: input.answer,
              answeredAt: new Date(),
              answeredBy: adminId,
              // 답변을 달면 자동으로 완료 처리 (관리자가 상태를 따로 지정하면 그 값이 우선).
              ...(input.status ? {} : { status: "RESOLVED" as any }),
            }
          : {}),
      },
    });

    if (hasNewAnswer) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: inquiry.authorId,
          type: "INQUIRY_ANSWERED",
          title: "문의에 답변이 등록되었어요",
          body: `"${inquiry.title}" 문의에 운영팀 답변이 도착했습니다.`,
          targetUrl: "/support",
        },
      });
      this.notificationsGateway.emitToUser(inquiry.authorId, notification);
    }

    return { ...updated, statusLabel: STATUS_LABEL[updated.status] };
  }
}

@Controller("inquiries")
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req: any,
    @Body(new ZodValidationPipe(createSchema)) dto: any,
  ) {
    return this.inquiries.create(req.user.id, dto);
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: any) {
    return this.inquiries.listMine(req.user.id);
  }
}

@Controller("admin/inquiries")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminInquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  list(@Req() req: any) {
    return this.inquiries.listAll(req.query?.status);
  }

  @Patch(":id")
  answer(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(answerSchema)) dto: any,
  ) {
    return this.inquiries.answer(req.user.id, id, dto);
  }
}

@Module({
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}

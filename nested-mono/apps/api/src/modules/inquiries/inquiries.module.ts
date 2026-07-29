// ── 고객센터 문의 ────────────────────────────────────────────────────
// 로그인한 사용자가 운영팀에 문의를 남기면 관리자에게 알림이 간다.
// 운영팀이 답변을 등록하거나 처리 상태를 변경하면 문의자에게 알림이 간다.
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
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards/auth.guards";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { NotificationsModule } from "../notifications/notifications.module";

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(5).max(4000),
});

const answerSchema = z.object({
  // 답변 없이 상태만 변경할 수도 있으므로 선택값이다.
  answer: z.string().trim().max(4000).optional(),
  status: z.enum(["RECEIVED", "IN_PROGRESS", "RESOLVED"]).optional(),
});

type InquiryStatusValue = "RECEIVED" | "IN_PROGRESS" | "RESOLVED";

const STATUS_LABEL: Record<InquiryStatusValue, string> = {
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

  /**
   * 문의 등록
   * 문의와 관리자 알림을 하나의 트랜잭션에서 저장한다.
   */
  async create(
    authorId: string,
    input: {
      title: string;
      body: string;
    },
  ) {
    const author = await this.prisma.user.findUnique({
      where: {
        id: authorId,
      },
      select: {
        name: true,
      },
    });

    if (!author) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.create({
        data: {
          authorId,
          title: input.title,
          body: input.body,
        },
      });

      const admins = await tx.user.findMany({
        where: {
          role: "ADMIN",
          suspended: false,
          deletedAt: null,

          // 관리자가 직접 문의한 경우
          // 자기 자신에게 알림을 보내지 않는다.
          id: {
            not: authorId,
          },
        },
        select: {
          id: true,
        },
      });

      const notifications = await Promise.all(
        admins.map((admin) =>
          tx.notification.create({
            data: {
              userId: admin.id,
              type: "INQUIRY_CREATED",
              title: "새 문의가 접수되었어요",
              body:
                `${author.name}님이 ` + `"${input.title}" 문의를 등록했습니다.`,
              targetUrl: "/admin/inquiries",
            },
          }),
        ),
      );

      return {
        inquiry,
        notifications,
      };
    });

    // 트랜잭션이 성공한 이후에만 실시간 알림 전송
    for (const notification of result.notifications) {
      this.notificationsGateway.emitToUser(notification.userId, notification);
    }

    return result.inquiry;
  }

  /**
   * 로그인한 사용자의 문의 목록
   */
  async listMine(authorId: string, take = 10, skip = 0) {
    const where = {
      authorId,
    };

    const [rows, total] = await Promise.all([
      this.prisma.inquiry.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take,
        skip,
      }),

      this.prisma.inquiry.count({
        where,
      }),
    ]);

    return {
      rows,
      total,
      take,
      skip,
    };
  }

  /**
   * 관리자용 전체 문의 목록
   */
  async listAll(status?: string) {
    const rows = await this.prisma.inquiry.findMany({
      where: status
        ? {
            status: status as InquiryStatusValue,
          }
        : {},
      orderBy: [
        {
          status: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 200,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      status: row.status,
      answer: row.answer,
      answeredAt: row.answeredAt,
      createdAt: row.createdAt,
      authorId: row.author.id,
      authorName: row.author.name,
      authorEmail: row.author.email,
    }));
  }

  /**
   * 관리자 답변 및 문의 상태 변경
   */
  async answer(
    adminId: string,
    id: string,
    input: {
      answer?: string;
      status?: InquiryStatusValue;
    },
  ) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        authorId: true,
        title: true,
        answer: true,
        status: true,
      },
    });

    if (!inquiry) {
      throw new NotFoundException({
        code: "INQUIRY_NOT_FOUND",
        message: "문의를 찾을 수 없습니다.",
      });
    }

    const hasNewAnswer =
      typeof input.answer === "string" &&
      input.answer.length > 0 &&
      input.answer !== inquiry.answer;

    // 답변을 등록하면서 상태를 지정하지 않으면
    // 기존 정책대로 자동 완료 처리한다.
    const nextStatus: InquiryStatusValue =
      input.status ?? (hasNewAnswer ? "RESOLVED" : inquiry.status);

    const statusChanged = nextStatus !== inquiry.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.inquiry.update({
        where: {
          id,
        },
        data: {
          status: nextStatus,

          ...(hasNewAnswer
            ? {
                answer: input.answer,
                answeredAt: new Date(),
                answeredBy: adminId,
              }
            : {}),
        },
      });

      const notificationTitle =
        hasNewAnswer && statusChanged
          ? "문의 답변과 처리 상태가 업데이트됐어요"
          : hasNewAnswer
            ? "문의에 답변이 등록되었어요"
            : "문의 처리 상태가 변경되었어요";

      const notificationBody =
        hasNewAnswer && statusChanged
          ? `"${inquiry.title}" 문의에 운영팀 답변이 등록되었고 상태가 ${STATUS_LABEL[nextStatus]}으로 변경되었습니다.`
          : hasNewAnswer
            ? `"${inquiry.title}" 문의에 운영팀 답변이 도착했습니다.`
            : `"${inquiry.title}" 문의 상태가 ${STATUS_LABEL[nextStatus]}으로 변경되었습니다.`;

      // 답변 또는 상태가 실제로 변경된 경우에만 생성
      const notification =
        hasNewAnswer || statusChanged
          ? await tx.notification.create({
              data: {
                userId: inquiry.authorId,
                type: hasNewAnswer
                  ? "INQUIRY_ANSWERED"
                  : "INQUIRY_STATUS_CHANGED",
                title: notificationTitle,
                body: notificationBody,
                targetUrl: `/support?inquiryId=${inquiry.id}`,
              },
            })
          : null;

      return {
        updated,
        notification,
      };
    });

    if (result.notification) {
      this.notificationsGateway.emitToUser(
        inquiry.authorId,
        result.notification,
      );
    }

    return {
      ...result.updated,
      statusLabel: STATUS_LABEL[result.updated.status],
    };
  }
}

@Controller("inquiries")
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req: any,
    @Body(new ZodValidationPipe(createSchema))
    dto: z.infer<typeof createSchema>,
  ) {
    return this.inquiries.create(req.user.id, dto);
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  mine(
    @Req() req: any,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.inquiries.listMine(
      req.user.id,
      take ? Number(take) : undefined,
      skip ? Number(skip) : undefined,
    );
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
    @Body(new ZodValidationPipe(answerSchema))
    dto: z.infer<typeof answerSchema>,
  ) {
    return this.inquiries.answer(req.user.id, id, dto);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}

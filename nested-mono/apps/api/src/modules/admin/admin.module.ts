import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  Injectable,
  Module,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards/auth.guards";
import { activityTier, TIER_LABEL } from "../../common/activity-tier";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationsGateway } from "../notifications/notifications.gateway";

const noticeCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(200),
  body: z.string().min(1, "내용을 입력해주세요.").max(5000),
  pinned: z.boolean().optional(),
});
const noticeUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  pinned: z.boolean().optional(),
});
const MAX_HOME_BANNERS = 5;

const bannerCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상 형식이 올바르지 않아요."),
  position: z.string().min(1).max(50),
  linkUrl: z.string().url().max(500).nullable().optional(),
  imageUrl: z.string().url().max(1000).nullable().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
});
const bannerUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  position: z.string().min(1).max(50).optional(),
  linkUrl: z.string().url().max(500).nullable().optional(),
  imageUrl: z.string().url().max(1000).nullable().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
});
const couponCreateSchema = z.object({
  code: z.string().min(1, "코드를 입력해주세요.").max(50),
  type: z.enum(["FIXED", "PERCENT"]),
  value: z.number().int().positive("할인값은 0보다 커야 해요."),
  maxDiscount: z.number().int().positive().nullable().optional(),
  minSpend: z.number().int().min(0).optional(),
  validFrom: z.string().min(1),
  validTo: z.string().min(1),
  usageLimit: z.number().int().positive().nullable().optional(),
});

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async members(q?: string) {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        suspended: true,
        createdAt: true,
        verifiedAt: true,
        _count: { select: { reviews: true } },
        reservations: { where: { status: "COMPLETED" }, select: { id: true } },
        // 입주자로서 받은 평가(TenantReview)들의 별점만 뽑아온다.
        // 여기서는 목록만 가져오고, 평균 계산은 아래에서 JS로 처리한다
        // (Prisma가 관계 필드의 평균을 select 안에서 바로 못 구해줌).
        tenantReviewsReceived: { select: { rating: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // 신고 건수는 관계(relation)로 못 가져오므로 별도 집계.
    // targetType이 "USER"인 신고만 모아서, targetId(=회원 id)별로 개수를 센다.
    // 회원 100명 전체를 한 번의 쿼리로 처리해서, N+1 문제를 피한다.
    const userIds = rows.map((u) => u.id);
    const reportGroups = await this.prisma.report.groupBy({
      by: ["targetId"],
      where: { targetType: "USER", targetId: { in: userIds } },
      _count: { targetId: true },
    });
    const reportCountMap = new Map(
      reportGroups.map((g) => [g.targetId, g._count.targetId]),
    );

    return rows.map(({ _count, reservations, tenantReviewsReceived, ...u }) => {
      const completedStays = reservations.length;
      const reviewsWritten = _count.reviews;
      const tier = activityTier(completedStays, reviewsWritten);

      // 받은 평가 별점 평균 계산 (소수점 첫째 자리까지)
      const reviewCount = tenantReviewsReceived.length;
      const avgRating =
        reviewCount > 0
          ? Math.round(
              (tenantReviewsReceived.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10,
            ) / 10
          : null;

      return {
        ...u,
        verified: u.verifiedAt != null,
        tier,
        tierLabel: TIER_LABEL[tier],
        completedStays,
        reviewsWritten,
        avgRating,                                    // 신규 — null이면 "받은 평가 없음"
        reviewCount,                                   // 신규 — 몇 건 받았는지
        reportCount: reportCountMap.get(u.id) ?? 0,     // 신규
      };
    });
  }

  // Admin marks identity as checked (or revokes it). Separate from
  // emailVerified: that only proves the address works, this is a human check.
  async setVerified(userId: string, verified: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "사용자를 찾을 수 없어요.",
      });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { verifiedAt: verified ? new Date() : null },
      select: { id: true, verifiedAt: true },
    });
  }

  setSuspended(adminId: string, userId: string, suspended: boolean) {
    // An admin locking themselves out would be an easy footgun — block it.
    if (adminId === userId) {
      throw new BadRequestException({
        code: "CANNOT_SUSPEND_SELF",
        message: "본인 계정은 정지할 수 없어요.",
      });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { suspended },
    });
  }

  // Change a member's role. Guests can promote themselves via
  // POST /auth/become-host; this is the operational path — granting ADMIN, or
  // demoting someone who shouldn't be hosting.
  async setRole(
    adminId: string,
    userId: string,
    role: "GUEST" | "HOST" | "ADMIN",
  ) {
    // Removing your own admin rights would lock you out of this very screen.
    if (adminId === userId) {
      throw new BadRequestException({
        code: "CANNOT_CHANGE_OWN_ROLE",
        message: "본인 계정의 역할은 변경할 수 없어요.",
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "사용자를 찾을 수 없어요.",
      });
    }
    // The target keeps their old role until their token refreshes — guards read
    // it from the JWT. Existing sessions are dropped so they re-authenticate.
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { role },
        select: { id: true, role: true },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    return updated;
  }

  // listing approvals (숙소 승인)
  pendingRooms() {
    return this.prisma.room.findMany({
      where: { published: false },
      orderBy: { createdAt: "desc" },
      // Images matter here: an admin approving a listing needs to see the
      // photos, not just its name.
      include: {
        host: { select: { name: true } },
        images: { orderBy: { order: "asc" } },
      },
    });
  }
  // 게시중인 숙소 — 별점이 낮은 순으로 정렬해 관리자가 문제 매물을 먼저 보게 합니다.
  // 후기가 적으면 평균이 흔들리므로 reviewCount를 함께 내려 UI에서 판단하게 합니다.
  async publishedRooms() {
    const rooms = await this.prisma.room.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      include: {
        host: { select: { name: true } },
        images: { orderBy: { order: "asc" } },
        reviews: { select: { rating: true } },
      },
    });

    return rooms
      .map((room) => {
        const ratings = room.reviews.map((r) => r.rating);
        const reviewCount = ratings.length;
        const rating = reviewCount
          ? ratings.reduce((sum, n) => sum + n, 0) / reviewCount
          : 0;
        const { reviews, ...rest } = room;
        return { ...rest, rating: Number(rating.toFixed(2)), reviewCount };
      })
      .sort((a, b) => {
        // 후기 없는 숙소는 평가할 근거가 없으므로 뒤로 보냅니다.
        if (!a.reviewCount && !b.reviewCount) return 0;
        if (!a.reviewCount) return 1;
        if (!b.reviewCount) return -1;
        return a.rating - b.rating;
      });
  }

  async setPublished(id: string, published: boolean) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        hostId: true,
        published: true,
      },
    });

    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });
    }

    // 이미 같은 상태라면 중복 알림 없이 그대로 처리
    if (room.published === published) {
      return this.prisma.room.update({
        where: { id },
        data: { published },
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRoom = await tx.room.update({
        where: { id },
        data: { published },
      });

      // 공개 전환과 게시 중단 모두 호스트에게 알립니다. 중단은 호스트가
      // 이유를 모르면 문의로 이어지므로 알림을 생략하지 않습니다.
      const notification = await tx.notification.create({
        data: {
          userId: room.hostId,
          type: published ? "ROOM_APPROVED" : "ROOM_UNPUBLISHED",
          title: published
            ? "숙소 등록이 승인되었어요"
            : "숙소 게시가 중단되었어요",
          body: published
            ? `"${room.name}" 숙소가 승인되어 서비스에 공개되었습니다.`
            : `"${room.name}" 숙소가 관리자에 의해 비공개 처리되었습니다. 자세한 내용은 고객센터로 문의해 주세요.`,
          targetUrl: "/host/listings",
        },
      });

      return {
        updatedRoom,
        notification,
      };
    });

    if (result.notification) {
      this.notificationsGateway.emitToUser(room.hostId, result.notification);
    }

    return result.updatedRoom;
  }

  // Reject a submission outright. Unlike RoomsService.remove this isn't scoped
  // to the owner — an admin is by definition acting on someone else's listing.
  // Only unpublished rooms may be rejected, so this can't be used to nuke a
  // live listing out from under a host.
  async rejectRoom(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { _count: { select: { reservations: true } } },
    });
    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });
    }
    if (room.published) {
      throw new BadRequestException({
        code: "ALREADY_PUBLISHED",
        message:
          "이미 게시된 숙소는 거부할 수 없습니다. 먼저 게시를 취소해주세요.",
      });
    }
    // Reservations have an FK RESTRICT, so the delete would fail at the DB
    // level with an opaque error. Say so plainly instead.
    if (room._count.reservations > 0) {
      throw new BadRequestException({
        code: "HAS_RESERVATIONS",
        message: "예약이 있는 숙소는 삭제할 수 없습니다.",
      });
    }
    const notification = await this.prisma.$transaction(async (tx) => {
      await tx.room.delete({
        where: { id },
      });

      return tx.notification.create({
        data: {
          userId: room.hostId,
          type: "ROOM_REJECTED",
          title: "숙소 등록이 반려되었어요",
          body: `"${room.name}" 숙소 등록이 반려되었습니다. 내용을 확인한 뒤 다시 등록해주세요.`,
          targetUrl: "/host/listings",
        },
      });
    });

    this.notificationsGateway.emitToUser(room.hostId, notification);

    return { ok: true };
  }

  // reports (신고 관리)
  async reports(status?: string) {
    const rows = await this.prisma.report.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: "desc" },
      include: { reporter: { select: { name: true } } },
      take: 200,
    });
    // Flatten the reporter relation so the client gets a plain name string.
    return rows.map((r: (typeof rows)[number]) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      reporterId: r.reporterId,
      reporterName: r.reporter?.name ?? "알 수 없음",
    }));
  }
  // ── 휴지통 (소프트 삭제된 커뮤니티 콘텐츠) ──
  // 삭제는 deletedAt 을 찍어두기만 하므로, 여기서 목록을 보여주고 되돌린다.
  async trash() {
    const [posts, comments] = await Promise.all([
      this.prisma.post.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
        take: 200,
        include: { author: { select: { name: true } } },
      }),
      this.prisma.comment.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
        take: 200,
        include: {
          author: { select: { name: true } },
          post: { select: { id: true, title: true } },
        },
      }),
    ]);

    return {
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        authorName: p.author?.name ?? "알 수 없음",
        deletedAt: p.deletedAt,
        createdAt: p.createdAt,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        authorName: c.author?.name ?? "알 수 없음",
        postId: c.post?.id ?? null,
        postTitle: c.post?.title ?? "(삭제된 게시글)",
        deletedAt: c.deletedAt,
        createdAt: c.createdAt,
      })),
    };
  }

  async restorePost(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!post)
      throw new NotFoundException({
        code: "POST_NOT_FOUND",
        message: "게시글을 찾을 수 없습니다.",
      });
    if (!post.deletedAt) return { ok: true };

    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: null },
    });
    return { ok: true };
  }

  async restoreComment(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, postId: true },
    });
    if (!comment)
      throw new NotFoundException({
        code: "COMMENT_NOT_FOUND",
        message: "댓글을 찾을 수 없습니다.",
      });
    if (!comment.deletedAt) return { ok: true };

    // 원글이 삭제된 상태면 댓글만 살려도 화면에 나오지 않는다.
    const post = await this.prisma.post.findUnique({
      where: { id: comment.postId },
      select: { deletedAt: true },
    });

    await this.prisma.$transaction([
      this.prisma.comment.update({
        where: { id },
        data: { deletedAt: null },
      }),
      ...(post?.deletedAt
        ? [
            this.prisma.post.update({
              where: { id: comment.postId },
              data: { deletedAt: null },
            }),
          ]
        : []),
    ]);
    return { ok: true, restoredPost: !!post?.deletedAt };
  }

  async setReportStatus(id: string, status: string) {
    // 검토 중으로 변경할 때는 상태만 변경
    if (status !== "RESOLVED") {
      return this.prisma.report.update({
        where: { id },
        data: { status: status as any },
      });
    }

    // 처리 완료 알림을 받을 신고자·피신고자 확인
    const context = await this.reportContext(id);

    const recipientIds = Array.from(
      new Set(
        [context.reporter.id, context.reported?.id].filter(
          (userId): userId is string => Boolean(userId),
        ),
      ),
    );

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // 동일 신고의 처리 완료 알림 중복 전송 방지
      const updated = await tx.report.updateMany({
        where: {
          id,
          resolvedNotifiedAt: null,
        },
        data: {
          status: "RESOLVED",
          resolvedAt: now,
          resolvedNotifiedAt: now,
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException({
          code: "REPORT_ALREADY_RESOLVED",
          message: "이미 처리 완료된 신고입니다.",
        });
      }

      const notifications = await Promise.all(
        recipientIds.map((userId) =>
          tx.notification.create({
            data: {
              userId,
              type: "REPORT",
              title: "신고 처리가 완료되었습니다",
              body: "관련 신고에 대한 관리자 검토 및 처리가 완료되었습니다.",
              targetUrl: "/me/notifications",
            },
          }),
        ),
      );

      const report = await tx.report.findUnique({
        where: { id },
      });

      return {
        report,
        notifications,
      };
    });

    // 접속 중인 사용자에게 실시간 전송
    for (const notification of result.notifications) {
      this.notificationsGateway.emitToUser(notification.userId, notification);
    }

    return result.report;
  }

  // 신고 상세 컨텍스트 — 신고자/피신고자 계정과, MESSAGE 신고라면 연결된
  // 채팅(채팅방 or 1:1 다이렉트)의 위치를 함께 내려준다. 신고 관리 화면의
  // "계정 조회" / "채팅 보기" 버튼이 이 응답을 사용한다.
  async reportContext(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { reporter: { select: { id: true, name: true, email: true } } },
    });
    if (!report) {
      throw new NotFoundException({
        code: "REPORT_NOT_FOUND",
        message: "신고를 찾을 수 없어요.",
      });
    }

    let reported: { id: string; name: string; email: string } | null = null;
    let chat: { kind: "ROOM" | "DIRECT"; id: string } | null = null;

    if (report.targetType === "USER") {
      reported = await this.prisma.user.findUnique({
        where: { id: report.targetId },
        select: { id: true, name: true, email: true },
      });
    } else if (report.targetType === "ROOM") {
      const room = await this.prisma.room.findUnique({
        where: { id: report.targetId },
        select: { host: { select: { id: true, name: true, email: true } } },
      });
      reported = room?.host ?? null;
    } else if (report.targetType === "REVIEW") {
      const review = await this.prisma.review.findUnique({
        where: { id: report.targetId },
        select: { author: { select: { id: true, name: true, email: true } } },
      });
      reported = review?.author ?? null;
    } else if (report.targetType === "COMMUNITY_POST") {
      const post = await this.prisma.post.findUnique({
        where: { id: report.targetId },
        select: { author: { select: { id: true, name: true, email: true } } },
      });
      reported = post?.author ?? null;
    } else if (report.targetType === "COMMUNITY_COMMENT") {
      const comment = await this.prisma.comment.findUnique({
        where: { id: report.targetId },
        select: { author: { select: { id: true, name: true, email: true } } },
      });
      reported = comment?.author ?? null;
    } else if (report.targetType === "MESSAGE") {
      const roomMessage = await this.prisma.message.findUnique({
        where: { id: report.targetId },
        select: {
          chatRoomId: true,
          sender: { select: { id: true, name: true, email: true } },
        },
      });
      if (roomMessage) {
        reported = roomMessage.sender;
        chat = { kind: "ROOM", id: roomMessage.chatRoomId };
      } else {
        const directMessage = await this.prisma.directMessage.findUnique({
          where: { id: report.targetId },
          select: {
            conversationId: true,
            sender: { select: { id: true, name: true, email: true } },
          },
        });
        if (directMessage) {
          reported = directMessage.sender;
          chat = { kind: "DIRECT", id: directMessage.conversationId };
        }
      }
    }

    return { reporter: report.reporter, reported, chat };
  }

  // 채팅방(숙소 문의) 대화 조회 — 관리자는 대화 참여자가 아니어도
  // 신고된 메시지가 오간 대화 전체를 볼 수 있어야 한다.
  async roomChat(chatRoomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      include: {
        guest: { select: { id: true, name: true, email: true } },
        host: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderId: true,
            body: true,
            imageUrl: true,
            createdAt: true,
          },
        },
      },
    });
    if (!room) {
      throw new NotFoundException({
        code: "CHAT_ROOM_NOT_FOUND",
        message: "대화방을 찾을 수 없어요.",
      });
    }
    return { guest: room.guest, host: room.host, messages: room.messages };
  }

  // 1:1 다이렉트 대화 조회 (관리자용)
  async directChat(conversationId: string) {
    const conversation = await this.prisma.directConversation.findUnique({
      where: { id: conversationId },
      include: {
        participantA: { select: { id: true, name: true, email: true } },
        participantB: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderId: true,
            body: true,
            imageUrl: true,
            createdAt: true,
          },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: "CONVERSATION_NOT_FOUND",
        message: "대화를 찾을 수 없어요.",
      });
    }
    return {
      participantA: conversation.participantA,
      participantB: conversation.participantB,
      messages: conversation.messages,
    };
  }

  // 신고 처리 알림 — 신고자/피신고자에게 처리 결과를 알림으로 보낸다.
  // 알림 타입은 스키마상 별도 REPORT 타입이 없어 SYSTEM 을 사용한다.
  async notifyReportParties(
    reportId: string,
    target: "REPORTER" | "REPORTED",
    message?: string,
  ) {
    const context = await this.reportContext(reportId);

    const recipient =
      target === "REPORTER" ? context.reporter : context.reported;

    if (!recipient) {
      throw new NotFoundException({
        code: "RECIPIENT_NOT_FOUND",
        message:
          target === "REPORTER"
            ? "신고자 계정을 찾을 수 없습니다."
            : "피신고자 계정을 찾을 수 없습니다.",
      });
    }

    const title =
      target === "REPORTER" ? "신고 처리 안내" : "신고 접수 및 처리 안내";

    const defaultBody =
      target === "REPORTER"
        ? "접수하신 신고를 관리자가 확인하여 처리 중입니다."
        : "회원님과 관련된 신고가 접수되어 관리자가 검토 중입니다.";

    const notification = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const updated =
        target === "REPORTER"
          ? await tx.report.updateMany({
              where: {
                id: reportId,
                reporterNotifiedAt: null,
              },
              data: {
                reporterNotifiedAt: now,
              },
            })
          : await tx.report.updateMany({
              where: {
                id: reportId,
                reportedNotifiedAt: null,
              },
              data: {
                reportedNotifiedAt: now,
              },
            });

      if (updated.count === 0) {
        throw new BadRequestException({
          code: "REPORT_NOTIFICATION_ALREADY_SENT",
          message: "이미 해당 계정에 처리 알림을 전송했습니다.",
        });
      }

      return tx.notification.create({
        data: {
          userId: recipient.id,
          type: "REPORT",
          title,
          body: message?.trim()
            ? `${defaultBody}\n${message.trim()}`
            : defaultBody,
          targetUrl: "/me/notifications",
        },
      });
    });

    this.notificationsGateway.emitToUser(recipient.id, notification);

    return notification;
  }

  // stats / revenue (통계 · 매출)
  async stats() {
    const [users, rooms, reservations, paidAgg] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.room.count(),
      this.prisma.reservation.count(),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "PAID" },
      }),
    ]);
    const gmv = paidAgg._sum.amount ?? 0;
    return {
      users,
      rooms,
      reservations,
      gmv,
      commission: Math.round(gmv * 0.05),
    };
  }

  // all reservations (관리자용 예약 조회)
  // Optional status filter; newest first; simple offset pagination. Joins the
  // room name and guest so the admin table can show who booked what without
  // extra lookups.
  async reservations(status?: string, take = 50, skip = 0) {
    const where = status ? { status: status as any } : {};
    const [rows, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          status: true,
          checkIn: true,
          checkOut: true,
          months: true,
          totalDueNow: true,
          createdAt: true,
          room: { select: { id: true, name: true } },
          guest: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return { rows, total, take, skip };
  }

  // monthly revenue + reservation counts (통계/매출 월별 추이)
  // Aggregates the last `months` calendar months (default 6) in the DB with
  // date_trunc, so the admin charts show real data instead of the lib/admin
  // mock. Returns one row per month, oldest→newest, with zero-filled gaps.
  async monthlyTrend(months = 6) {
    // Start of the window: first day of the month, (months-1) months ago.
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    // Revenue = sum of PAID payments per month. Refunds tracked separately.
    const revenueRows = await this.prisma.$queryRaw<
      { month: Date; paid: bigint; refunded: bigint }[]
    >`
      SELECT date_trunc('month', "createdAt") AS month,
             COALESCE(SUM(CASE WHEN "status" = 'PAID' THEN "amount" ELSE 0 END), 0) AS paid,
             COALESCE(SUM(CASE WHEN "status" = 'REFUNDED' THEN "amount" ELSE 0 END), 0) AS refunded
      FROM "Payment"
      WHERE "createdAt" >= ${start}
      GROUP BY 1
      ORDER BY 1
    `;

    // Reservation counts per month.
    const reservationRows = await this.prisma.$queryRaw<
      { month: Date; count: bigint }[]
    >`
      SELECT date_trunc('month', "createdAt") AS month, COUNT(*) AS count
      FROM "Reservation"
      WHERE "createdAt" >= ${start}
      GROUP BY 1
      ORDER BY 1
    `;

    // Index DB results by "YYYY-M" so we can zero-fill missing months.
    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const revByMonth = new Map(
      revenueRows.map((r) => [key(new Date(r.month)), r]),
    );
    const resByMonth = new Map(
      reservationRows.map((r) => [key(new Date(r.month)), r]),
    );

    const trend: {
      month: string;
      revenue: number;
      refunds: number;
      reservations: number;
    }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const rev = revByMonth.get(key(d));
      const res = resByMonth.get(key(d));
      trend.push({
        month: `${d.getMonth() + 1}월`,
        revenue: rev ? Number(rev.paid) : 0,
        refunds: rev ? Number(rev.refunded) : 0,
        reservations: res ? Number(res.count) : 0,
      });
    }

    // Totals across the window for the summary cards.
    const gmv = trend.reduce((s, t) => s + t.revenue, 0);
    const refunds = trend.reduce((s, t) => s + t.refunds, 0);
    const commission = Math.round(gmv * 0.05);
    return {
      gmv,
      commission,
      payouts: gmv - commission,
      refunds,
      trend,
    };
  }

  // ── Notices (공지 CRUD) ──
  listNotices() {
    // Pinned first, then newest. Admin list shows everything.
    return this.prisma.notice.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });
  }

  createNotice(data: { title: string; body: string; pinned?: boolean }) {
    return this.prisma.notice.create({
      data: {
        title: data.title,
        body: data.body,
        pinned: data.pinned ?? false,
      },
    });
  }

  async updateNotice(
    id: string,
    data: { title?: string; body?: string; pinned?: boolean },
  ) {
    await this.ensureNotice(id);
    return this.prisma.notice.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
      },
    });
  }

  async deleteNotice(id: string) {
    await this.ensureNotice(id);
    await this.prisma.notice.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureNotice(id: string) {
    const found = await this.prisma.notice.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException({
        code: "NOTICE_NOT_FOUND",
        message: "공지를 찾을 수 없어요.",
      });
    }
  }

  // ── Banners (배너 CRUD) ──
  // Admin list shows everything; the public home shows only active ones.
  listBanners() {
    return this.prisma.banner.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  listActiveBanners() {
    return this.prisma.banner.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  async createBanner(data: {
    title: string;
    color: string;
    position: string;
    linkUrl?: string | null;
    imageUrl?: string | null;
    active?: boolean;
    order?: number;
  }) {
    const bannerCount = await this.prisma.banner.count({
      where: { position: "메인 상단" },
    });

    if (bannerCount >= MAX_HOME_BANNERS) {
      throw new BadRequestException(
        "메인 배너는 최대 5장까지 등록할 수 있습니다.",
      );
    }

    return this.prisma.banner.create({
      data: {
        title: data.title,
        color: data.color,
        position: data.position,
        linkUrl: data.linkUrl ?? null,
        imageUrl: data.imageUrl ?? null,
        active: data.active ?? true,
        order: data.order ?? 0,
      },
    });
  }

  async updateBanner(
    id: string,
    data: {
      title?: string;
      color?: string;
      position?: string;
      linkUrl?: string | null;
      imageUrl?: string | null;
      active?: boolean;
      order?: number;
    },
  ) {
    await this.ensureBanner(id);
    return this.prisma.banner.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
        ...(data.linkUrl !== undefined ? { linkUrl: data.linkUrl } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
      },
    });
  }

  async deleteBanner(id: string) {
    await this.ensureBanner(id);
    await this.prisma.banner.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureBanner(id: string) {
    const found = await this.prisma.banner.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException({
        code: "BANNER_NOT_FOUND",
        message: "배너를 찾을 수 없어요.",
      });
    }
  }

  // ── Coupons (쿠폰 관리) ──
  // The discount math + validation already live in reservations (couponDiscount
  // / assertCouponUsable). Admins were missing a way to CREATE and LIST coupons,
  // which is what these add. "Active" is derived from the validity window and
  // remaining usage rather than a stored flag.
  async listCoupons() {
    const rows = await this.prisma.coupon.findMany({
      orderBy: { validTo: "desc" },
    });
    const now = new Date();
    return rows.map((c) => ({
      ...c,
      // Derived status: within the window and not exhausted.
      active:
        now >= c.validFrom &&
        now <= c.validTo &&
        (c.usageLimit == null || c.usedCount < c.usageLimit),
    }));
  }

  createCoupon(data: {
    code: string;
    type: "FIXED" | "PERCENT";
    value: number;
    maxDiscount?: number | null;
    minSpend?: number;
    validFrom: string;
    validTo: string;
    usageLimit?: number | null;
  }) {
    return this.prisma.coupon.create({
      data: {
        code: data.code,
        type: data.type,
        value: data.value,
        maxDiscount: data.maxDiscount ?? null,
        minSpend: data.minSpend ?? 0,
        validFrom: new Date(data.validFrom),
        validTo: new Date(data.validTo),
        usageLimit: data.usageLimit ?? null,
      },
    });
  }

  async deleteCoupon(id: string) {
    const found = await this.prisma.coupon.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException({
        code: "COUPON_NOT_FOUND",
        message: "쿠폰을 찾을 수 없어요.",
      });
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { ok: true };
  }
}

const suspendSchema = z.object({ suspended: z.boolean() });
const verifySchema = z.object({ verified: z.boolean() });
const roleSchema = z.object({ role: z.enum(["GUEST", "HOST", "ADMIN"]) });
const publishSchema = z.object({ published: z.boolean() });
const reportStatusSchema = z.object({
  status: z.enum(["RECEIVED", "IN_REVIEW", "RESOLVED"]),
});
const reportNotifySchema = z.object({
  target: z.enum(["REPORTER", "REPORTED"]),
  message: z.string().trim().max(500).optional(),
});

// 관리자 API — all routes require ADMIN role.
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("stats")
  stats() {
    return this.admin.stats();
  }

  @Get("members")
  members(@Query("q") q?: string) {
    return this.admin.members(q);
  }

  // PATCH /admin/members/:id/verify — 신원 확인 표시 토글
  @Patch("members/:id/verify")
  setVerified(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(verifySchema))
    dto: z.infer<typeof verifySchema>,
  ) {
    return this.admin.setVerified(id, dto.verified);
  }

  // PATCH /admin/members/:id/role — 역할 변경 (게스트 ↔ 호스트 ↔ 관리자)
  @Patch("members/:id/role")
  setRole(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roleSchema)) dto: z.infer<typeof roleSchema>,
  ) {
    return this.admin.setRole(req.user.id, id, dto.role);
  }

  @Patch("members/:id/suspend")
  suspend(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(suspendSchema)) dto: any,
  ) {
    return this.admin.setSuspended(req.user.id, id, dto.suspended);
  }

  @Get("rooms/pending")
  pending() {
    return this.admin.pendingRooms();
  }

  // GET /admin/rooms/published — 게시중 숙소 (별점 낮은 순)
  @Get("rooms/published")
  publishedList() {
    return this.admin.publishedRooms();
  }

  @Patch("rooms/:id/publish")
  publish(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(publishSchema)) dto: any,
  ) {
    return this.admin.setPublished(id, dto.published);
  }

  // DELETE /admin/rooms/:id — reject a pending submission
  @Delete("rooms/:id")
  reject(@Param("id") id: string) {
    return this.admin.rejectRoom(id);
  }

  // GET /admin/trash — 소프트 삭제된 게시글/댓글
  @Get("trash")
  trash() {
    return this.admin.trash();
  }

  @Patch("trash/posts/:id/restore")
  restorePost(@Param("id") id: string) {
    return this.admin.restorePost(id);
  }

  @Patch("trash/comments/:id/restore")
  restoreComment(@Param("id") id: string) {
    return this.admin.restoreComment(id);
  }

  @Get("reports")
  reports(@Query("status") status?: string) {
    return this.admin.reports(status);
  }

  @Patch("reports/:id")
  reportStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reportStatusSchema)) dto: any,
  ) {
    return this.admin.setReportStatus(id, dto.status);
  }

  // GET /admin/reports/:id/context — 신고자/피신고자 계정 + 연결된 채팅 위치
  @Get("reports/:id/context")
  reportContext(@Param("id") id: string) {
    return this.admin.reportContext(id);
  }

  // POST /admin/reports/:id/notify — 신고자/피신고자에게 처리 알림 전송
  @Post("reports/:id/notify")
  notifyReport(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reportNotifySchema))
    dto: z.infer<typeof reportNotifySchema>,
  ) {
    return this.admin.notifyReportParties(id, dto.target, dto.message);
  }

  // GET /admin/chat/rooms/:id — 신고된 메시지가 속한 채팅방 전체 보기
  @Get("chat/rooms/:id")
  roomChat(@Param("id") id: string) {
    return this.admin.roomChat(id);
  }

  // GET /admin/chat/direct/:id — 신고된 메시지가 속한 1:1 다이렉트 대화 전체 보기
  @Get("chat/direct/:id")
  directChat(@Param("id") id: string) {
    return this.admin.directChat(id);
  }

  // GET /admin/reservations?status=&take=&skip=
  @Get("reservations")
  reservations(
    @Query("status") status?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.admin.reservations(
      status,
      take ? Number(take) : undefined,
      skip ? Number(skip) : undefined,
    );
  }

  // GET /admin/revenue/monthly?months=6
  @Get("revenue/monthly")
  monthlyTrend(@Query("months") months?: string) {
    return this.admin.monthlyTrend(months ? Number(months) : undefined);
  }

  // ── Notices (공지 관리) ──
  @Get("notices")
  listNotices() {
    return this.admin.listNotices();
  }

  @Post("notices")
  createNotice(
    @Body(new ZodValidationPipe(noticeCreateSchema))
    dto: z.infer<typeof noticeCreateSchema>,
  ) {
    return this.admin.createNotice(dto);
  }

  @Patch("notices/:id")
  updateNotice(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(noticeUpdateSchema))
    dto: z.infer<typeof noticeUpdateSchema>,
  ) {
    return this.admin.updateNotice(id, dto);
  }

  @Delete("notices/:id")
  deleteNotice(@Param("id") id: string) {
    return this.admin.deleteNotice(id);
  }

  // ── Banners (배너 관리) ──
  @Get("banners")
  listBanners() {
    return this.admin.listBanners();
  }

  @Post("banners")
  createBanner(
    @Body(new ZodValidationPipe(bannerCreateSchema))
    dto: z.infer<typeof bannerCreateSchema>,
  ) {
    return this.admin.createBanner(dto);
  }

  @Patch("banners/:id")
  updateBanner(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(bannerUpdateSchema))
    dto: z.infer<typeof bannerUpdateSchema>,
  ) {
    return this.admin.updateBanner(id, dto);
  }

  @Delete("banners/:id")
  deleteBanner(@Param("id") id: string) {
    return this.admin.deleteBanner(id);
  }

  // ── Coupons (쿠폰 관리) ──
  @Get("coupons")
  listCoupons() {
    return this.admin.listCoupons();
  }

  @Post("coupons")
  createCoupon(
    @Body(new ZodValidationPipe(couponCreateSchema))
    dto: z.infer<typeof couponCreateSchema>,
  ) {
    return this.admin.createCoupon(dto);
  }

  @Delete("coupons/:id")
  deleteCoupon(@Param("id") id: string) {
    return this.admin.deleteCoupon(id);
  }
}

// Public (no auth): notices for the notices page / home.
@Controller("notices")
export class PublicNoticeController {
  constructor(private readonly admin: AdminService) {}

  // GET /notices — anyone can read notices.
  @Get()
  list() {
    return this.admin.listNotices();
  }
}

// Public (no auth): active banners for the home screen.
@Controller("banners")
export class PublicBannerController {
  constructor(private readonly admin: AdminService) {}

  // GET /banners — active banners only, ordered.
  @Get()
  list() {
    return this.admin.listActiveBanners();
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [
    AdminController,
    PublicNoticeController,
    PublicBannerController,
  ],
  providers: [AdminService],
})
export class AdminModule {}

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationsGateway } from "../notifications/notifications.gateway";

const CATEGORIES = [
  "NOTICE",
  "EVENT",
  "CHORE",
  "MARKET",
  "CHAT",
  "SEEKING",
] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CLOSED"] as const;
const LIFESTYLE_FIELDS = [
  "noise",
  "cleanliness",
  "smoking",
  "pets",
  "visitors",
  "sleep",
  "sociability",
  "sharedSpace",
  "drinking",
  "keywords",
] as const;
type Category = (typeof CATEGORIES)[number];
type Status = (typeof STATUSES)[number];

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
  ) {}

  async list(category?: string, q?: string, status?: string) {
    const categoryWhere =
      category &&
      category !== "all" &&
      CATEGORIES.includes(category.toUpperCase() as Category)
        ? { category: category.toUpperCase() as Category }
        : {};
    const statusWhere =
      status &&
      status !== "all" &&
      STATUSES.includes(status.toUpperCase() as Status)
        ? { status: status.toUpperCase() as Status }
        : {};
    const keyword = q?.trim();
    const keywordWhere = keyword
      ? {
          OR: [
            { title: { contains: keyword, mode: "insensitive" as const } },
            { body: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {};
    return this.prisma.post.findMany({
      where: { ...categoryWhere, ...statusWhere, ...keywordWhere },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: {
          select: { id: true, name: true, avatarColor: true, avatarUrl: true },
        },
        _count: { select: { comments: true } },
      },
    });
  }

  async getById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, avatarColor: true, avatarUrl: true },
        },
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatarColor: true,
                avatarUrl: true,
              },
            },
            replies: {
              orderBy: { createdAt: "asc" },
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    avatarColor: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { comments: true } },
      },
    });
    if (!post)
      throw new NotFoundException({
        code: "POST_NOT_FOUND",
        message: "게시글을 찾을 수 없습니다.",
      });
    return post;
  }

  async create(
    authorId: string,
    authorRole: string,
    dto: {
      roomId: string;
      category: Category;
      title: string;
      body: string;
      status?: Status;
      sharedLifestyleFields?: string[];
    },
  ) {
    // "공지" is admin-only — enforced here, not just hidden in the compose
    // UI, since the UI check alone doesn't stop a direct API call.
    if (dto.category === "NOTICE" && authorRole !== "ADMIN") {
      throw new ForbiddenException({
        code: "NOTICE_ADMIN_ONLY",
        message: "공지 카테고리는 관리자만 작성할 수 있습니다.",
      });
    }
    const safeFields = (dto.sharedLifestyleFields ?? []).filter((v) =>
      (LIFESTYLE_FIELDS as readonly string[]).includes(v),
    );
    let lifestyleSnapshot: Prisma.InputJsonObject | undefined;
    if (dto.category === "SEEKING" && safeFields.length) {
      const pref = await this.prisma.roommatePreference.findUnique({
        where: { userId: authorId },
      });
      if (pref?.isCompleted) {
        lifestyleSnapshot = Object.fromEntries(
          safeFields.map((key) => [key, (pref as any)[key]]),
        );
      }
    }
    return this.prisma.post.create({
      data: {
        authorId,
        roomId: dto.roomId,
        category: dto.category,
        title: dto.title,
        body: dto.body,
        status: dto.status ?? "OPEN",
        sharedLifestyleFields: safeFields,
        lifestyleSnapshot,
      },
      include: {
        author: {
          select: { id: true, name: true, avatarColor: true, avatarUrl: true },
        },
        _count: { select: { comments: true } },
      },
    });
  }

  private async assertPostAuthor(userId: string, id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!post)
      throw new NotFoundException({
        code: "POST_NOT_FOUND",
        message: "게시글을 찾을 수 없습니다.",
      });
    if (post.authorId !== userId)
      throw new ForbiddenException({
        code: "NOT_AUTHOR",
        message: "본인이 쓴 글만 변경할 수 있습니다.",
      });
  }

  async update(
    userId: string,
    id: string,
    dto: {
      category?: Category;
      title?: string;
      body?: string;
      status?: Status;
    },
  ) {
    await this.assertPostAuthor(userId, id);
    return this.prisma.post.update({
      where: { id },
      data: dto,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
            avatarUrl: true,
          },
        },
        _count: { select: { comments: true } },
      },
    });
  }

  async remove(userId: string, id: string, role?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!post)
      throw new NotFoundException({
        code: "POST_NOT_FOUND",
        message: "게시글을 찾을 수 없습니다.",
      });
    if (post.authorId !== userId && role !== "ADMIN")
      throw new ForbiddenException({
        code: "NOT_AUTHOR",
        message: "본인이 쓴 글만 삭제할 수 있습니다.",
      });
    await this.prisma.post.delete({ where: { id } });
    return { ok: true };
  }

  async addComment(
    authorId: string,
    postId: string,
    body: string,
    parentId?: string,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, title: true, authorId: true },
    });
    if (!post)
      throw new NotFoundException({
        code: "POST_NOT_FOUND",
        message: "게시글을 찾을 수 없습니다.",
      });
    let parent: {
      id: string;
      authorId: string;
      parentId: string | null;
    } | null = null;
    if (parentId) {
      parent = (await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          authorId: true,
          parentId: true,
          postId: true,
        } as any,
      })) as any;
      if (!parent || (parent as any).postId !== postId)
        throw new NotFoundException({
          code: "COMMENT_NOT_FOUND",
          message: "답글 대상 댓글을 찾을 수 없습니다.",
        });
      const rootParentId = parent.parentId ?? parent.id;
      const replyCount = await this.prisma.comment.count({
        where: { parentId: rootParentId },
      });
      if (replyCount >= 50)
        throw new ForbiddenException({
          code: "REPLY_LIMIT_REACHED",
          message: "이 댓글에는 답글을 최대 50개까지 작성할 수 있습니다.",
        });
      parentId = rootParentId; // 답글 깊이는 1단계로 고정
    }
    const notifyUserId =
      parentId && parent?.authorId !== authorId
        ? parent?.authorId
        : post.authorId !== authorId
          ? post.authorId
          : null;
    const result = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { authorId, postId, body, parentId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarColor: true,
              avatarUrl: true,
            },
          },
          replies: true,
        },
      });
      const notification = notifyUserId
        ? await tx.notification.create({
            data: {
              userId: notifyUserId,
              type: "COMMENT",
              title: parentId
                ? "내 댓글에 답글이 달렸어요"
                : "내 게시글에 새 댓글이 달렸어요",
              body: parentId
                ? `“${post.title}” 게시글의 내 댓글에 답글이 등록되었습니다.`
                : `“${post.title}” 게시글에 새로운 댓글이 등록되었습니다.`,
              targetUrl: `/community/${post.id}`,
            },
          })
        : null;
      return { comment, notification };
    });
    if (result.notification && notifyUserId)
      this.notifications.emitToUser(notifyUserId, result.notification);
    return result.comment;
  }

  async updateComment(userId: string, commentId: string, body: string) {
    const c = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });
    if (!c)
      throw new NotFoundException({
        code: "COMMENT_NOT_FOUND",
        message: "댓글을 찾을 수 없습니다.",
      });
    if (c.authorId !== userId)
      throw new ForbiddenException({
        code: "NOT_AUTHOR",
        message: "본인이 쓴 댓글만 수정할 수 있습니다.",
      });
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body },
      include: {
        author: {
          select: { id: true, name: true, avatarColor: true, avatarUrl: true },
        },
        replies: true,
      },
    });
  }

  async removeComment(userId: string, commentId: string, role?: string) {
    const c = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });
    if (!c)
      throw new NotFoundException({
        code: "COMMENT_NOT_FOUND",
        message: "댓글을 찾을 수 없습니다.",
      });
    if (c.authorId !== userId && role !== "ADMIN")
      throw new ForbiddenException({
        code: "NOT_AUTHOR",
        message: "본인이 쓴 댓글만 삭제할 수 있습니다.",
      });
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { ok: true };
  }
}

const createPostSchema = z.object({
  roomId: z.string().min(1),
  category: z.enum(CATEGORIES).default("CHAT"),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  status: z.enum(STATUSES).optional(),
  sharedLifestyleFields: z
    .array(z.enum(LIFESTYLE_FIELDS))
    .max(LIFESTYLE_FIELDS.length)
    .optional(),
});
const updatePostSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  status: z.enum(STATUSES).optional(),
});
const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  parentId: z.string().optional(),
});

@Controller("posts")
export class CommunityController {
  constructor(private readonly community: CommunityService) {}
  @Get() list(
    @Query("category") category?: string,
    @Query("q") q?: string,
    @Query("status") status?: string,
  ) {
    return this.community.list(category, q, status);
  }
  @Get(":id") get(@Param("id") id: string) {
    return this.community.getById(id);
  }
  @HttpPost() @UseGuards(JwtAuthGuard) create(
    @Req() req: any,
    @Body(new ZodValidationPipe(createPostSchema)) dto: any,
  ) {
    return this.community.create(req.user.id, req.user.role, dto);
  }
  @Patch("comments/:commentId") @UseGuards(JwtAuthGuard) updateComment(
    @Req() req: any,
    @Param("commentId") id: string,
    @Body(new ZodValidationPipe(commentSchema.pick({ body: true }))) dto: any,
  ) {
    return this.community.updateComment(req.user.id, id, dto.body);
  }
  @Delete("comments/:commentId") @UseGuards(JwtAuthGuard) removeComment(
    @Req() req: any,
    @Param("commentId") id: string,
  ) {
    return this.community.removeComment(req.user.id, id, req.user.role);
  }
  @Patch(":id") @UseGuards(JwtAuthGuard) update(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePostSchema)) dto: any,
  ) {
    return this.community.update(req.user.id, id, dto);
  }
  @Delete(":id") @UseGuards(JwtAuthGuard) remove(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    return this.community.remove(req.user.id, id, req.user.role);
  }
  @HttpPost(":id/comments") @UseGuards(JwtAuthGuard) addComment(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(commentSchema)) dto: any,
  ) {
    return this.community.addComment(req.user.id, id, dto.body, dto.parentId);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}

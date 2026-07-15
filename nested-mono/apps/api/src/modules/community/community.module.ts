import {
  Controller,
  Get,
  Post as HttpPost,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Injectable,
  Module,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

const CATEGORIES = ["NOTICE", "EVENT", "CHORE", "MARKET", "CHAT", "SEEKING"] as const;
type Category = (typeof CATEGORIES)[number];

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // Board listing. Pinned posts float to the top, then newest first.
  // `_count.comments` is what the UI shows as "💬 N replies".
  // `q` does a case-insensitive keyword match on title/body — used by hosts to
  // search "방 구함"(SEEKING) posts for suitable tenants.
  async list(category?: string, q?: string) {
    const categoryWhere =
      category && category !== "all" && CATEGORIES.includes(category.toUpperCase() as Category)
        ? { category: category.toUpperCase() as Category }
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
      where: { ...categoryWhere, ...keywordWhere },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  async getById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });
    if (!post) throw new NotFoundException({ code: "POST_NOT_FOUND", message: "게시글을 찾을 수 없습니다." });
    return post;
  }

  async create(authorId: string, dto: { roomId: string; category: Category; title: string; body: string }) {
    return this.prisma.post.create({
      data: {
        authorId,
        roomId: dto.roomId,
        category: dto.category,
        title: dto.title,
        body: dto.body,
      },
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  // Only the author can delete their own post.
  async remove(userId: string, id: string) {
    const post = await this.prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) throw new NotFoundException({ code: "POST_NOT_FOUND", message: "게시글을 찾을 수 없습니다." });
    if (post.authorId !== userId) {
      throw new ForbiddenException({ code: "NOT_AUTHOR", message: "본인이 쓴 글만 삭제할 수 있습니다." });
    }
    await this.prisma.post.delete({ where: { id } });
    return { ok: true };
  }

  async addComment(authorId: string, postId: string, body: string) {
    const exists = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: "POST_NOT_FOUND", message: "게시글을 찾을 수 없습니다." });

    return this.prisma.comment.create({
      data: { authorId, postId, body },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async removeComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });
    if (!comment) throw new NotFoundException({ code: "COMMENT_NOT_FOUND", message: "댓글을 찾을 수 없습니다." });
    if (comment.authorId !== userId) {
      throw new ForbiddenException({ code: "NOT_AUTHOR", message: "본인이 쓴 댓글만 삭제할 수 있습니다." });
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { ok: true };
  }
}

const createPostSchema = z.object({
  roomId: z.string().min(1),
  category: z.enum(CATEGORIES).default("CHAT"),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
});

const commentSchema = z.object({
  body: z.string().min(1).max(2000),
});

// 커뮤니티 API — reads are public so the board is browsable while logged out;
// writes require a session.
@Controller("posts")
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get()
  list(@Query("category") category?: string, @Query("q") q?: string) {
    return this.community.list(category, q);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.community.getById(id);
  }

  @HttpPost()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body(new ZodValidationPipe(createPostSchema)) dto: any) {
    return this.community.create(req.user.id, dto);
  }

  // Declared before DELETE /:id so "comments" isn't captured as a post id.
  @Delete("comments/:commentId")
  @UseGuards(JwtAuthGuard)
  removeComment(@Req() req: any, @Param("commentId") commentId: string) {
    return this.community.removeComment(req.user.id, commentId);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param("id") id: string) {
    return this.community.remove(req.user.id, id);
  }

  @HttpPost(":id/comments")
  @UseGuards(JwtAuthGuard)
  addComment(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(commentSchema)) dto: any,
  ) {
    return this.community.addComment(req.user.id, id, dto.body);
  }
}

@Module({
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}

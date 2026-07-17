import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, UseGuards, Injectable, Module,
  NotFoundException, BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards/auth.guards";

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
const bannerCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상 형식이 올바르지 않아요."),
  position: z.string().min(1).max(50),
  linkUrl: z.string().url().max(500).nullable().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
});
const bannerUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.string().min(1).max(50).optional(),
  linkUrl: z.string().url().max(500).nullable().optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
});

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // members (검색 + 정지 토글)
  members(q?: string) {
    return this.prisma.user.findMany({
      where: {
        // Hide accounts that have deleted themselves — they're anonymised and
        // shouldn't clutter the admin list.
        deletedAt: null,
        ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
      },
      select: { id: true, name: true, email: true, role: true, suspended: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
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
    return this.prisma.user.update({ where: { id: userId }, data: { suspended } });
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
  setPublished(id: string, published: boolean) {
    return this.prisma.room.update({ where: { id }, data: { published } });
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
      throw new NotFoundException({ code: "ROOM_NOT_FOUND", message: "숙소를 찾을 수 없습니다." });
    }
    if (room.published) {
      throw new BadRequestException({
        code: "ALREADY_PUBLISHED",
        message: "이미 게시된 숙소는 거부할 수 없습니다. 먼저 게시를 취소해주세요.",
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
    await this.prisma.room.delete({ where: { id } });
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
      reporterName: r.reporter?.name ?? "알 수 없음",
    }));
  }
  setReportStatus(id: string, status: string) {
    return this.prisma.report.update({ where: { id }, data: { status: status as any } });
  }

  // stats / revenue (통계 · 매출)
  async stats() {
    const [users, rooms, reservations, paidAgg] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.room.count(),
      this.prisma.reservation.count(),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    ]);
    const gmv = paidAgg._sum.amount ?? 0;
    return { users, rooms, reservations, gmv, commission: Math.round(gmv * 0.05) };
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
    const revByMonth = new Map(revenueRows.map((r) => [key(new Date(r.month)), r]));
    const resByMonth = new Map(reservationRows.map((r) => [key(new Date(r.month)), r]));

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
      data: { title: data.title, body: data.body, pinned: data.pinned ?? false },
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
    const found = await this.prisma.notice.findUnique({ where: { id }, select: { id: true } });
    if (!found) {
      throw new NotFoundException({ code: "NOTICE_NOT_FOUND", message: "공지를 찾을 수 없어요." });
    }
  }

  // ── Banners (배너 CRUD) ──
  // Admin list shows everything; the public home shows only active ones.
  listBanners() {
    return this.prisma.banner.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] });
  }

  listActiveBanners() {
    return this.prisma.banner.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  }

  createBanner(data: {
    title: string;
    color: string;
    position: string;
    linkUrl?: string | null;
    active?: boolean;
    order?: number;
  }) {
    return this.prisma.banner.create({
      data: {
        title: data.title,
        color: data.color,
        position: data.position,
        linkUrl: data.linkUrl ?? null,
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
    const found = await this.prisma.banner.findUnique({ where: { id }, select: { id: true } });
    if (!found) {
      throw new NotFoundException({ code: "BANNER_NOT_FOUND", message: "배너를 찾을 수 없어요." });
    }
  }
}

const suspendSchema = z.object({ suspended: z.boolean() });
const publishSchema = z.object({ published: z.boolean() });
const reportStatusSchema = z.object({ status: z.enum(["RECEIVED", "IN_REVIEW", "RESOLVED"]) });

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

  @Patch("rooms/:id/publish")
  publish(@Param("id") id: string, @Body(new ZodValidationPipe(publishSchema)) dto: any) {
    return this.admin.setPublished(id, dto.published);
  }

  // DELETE /admin/rooms/:id — reject a pending submission
  @Delete("rooms/:id")
  reject(@Param("id") id: string) {
    return this.admin.rejectRoom(id);
  }

  @Get("reports")
  reports(@Query("status") status?: string) {
    return this.admin.reports(status);
  }

  @Patch("reports/:id")
  reportStatus(@Param("id") id: string, @Body(new ZodValidationPipe(reportStatusSchema)) dto: any) {
    return this.admin.setReportStatus(id, dto.status);
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
  createNotice(@Body(new ZodValidationPipe(noticeCreateSchema)) dto: z.infer<typeof noticeCreateSchema>) {
    return this.admin.createNotice(dto);
  }

  @Patch("notices/:id")
  updateNotice(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(noticeUpdateSchema)) dto: z.infer<typeof noticeUpdateSchema>,
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
  createBanner(@Body(new ZodValidationPipe(bannerCreateSchema)) dto: z.infer<typeof bannerCreateSchema>) {
    return this.admin.createBanner(dto);
  }

  @Patch("banners/:id")
  updateBanner(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(bannerUpdateSchema)) dto: z.infer<typeof bannerUpdateSchema>,
  ) {
    return this.admin.updateBanner(id, dto);
  }

  @Delete("banners/:id")
  deleteBanner(@Param("id") id: string) {
    return this.admin.deleteBanner(id);
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
  controllers: [AdminController, PublicNoticeController, PublicBannerController],
  providers: [AdminService],
})
export class AdminModule {}

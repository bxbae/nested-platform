import { Controller, Get, Patch, Param, Query, Body, UseGuards, Injectable, Module } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards/auth.guards";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // members (검색 + 정지 토글)
  members(q?: string) {
    return this.prisma.user.findMany({
      where: q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {},
      select: { id: true, name: true, email: true, role: true, suspended: true, createdAt: true },
      take: 100,
    });
  }

  setSuspended(userId: string, suspended: boolean) {
    return this.prisma.user.update({ where: { id: userId }, data: { suspended } });
  }

  // listing approvals (숙소 승인)
  pendingRooms() {
    return this.prisma.room.findMany({ where: { published: false }, include: { host: { select: { name: true } } } });
  }
  setPublished(id: string, published: boolean) {
    return this.prisma.room.update({ where: { id }, data: { published } });
  }

  // reports (신고 관리)
  reports(status?: string) {
    return this.prisma.report.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: "desc" },
    });
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
  suspend(@Param("id") id: string, @Body(new ZodValidationPipe(suspendSchema)) dto: any) {
    return this.admin.setSuspended(id, dto.suspended);
  }

  @Get("rooms/pending")
  pending() {
    return this.admin.pendingRooms();
  }

  @Patch("rooms/:id/publish")
  publish(@Param("id") id: string, @Body(new ZodValidationPipe(publishSchema)) dto: any) {
    return this.admin.setPublished(id, dto.published);
  }

  @Get("reports")
  reports(@Query("status") status?: string) {
    return this.admin.reports(status);
  }

  @Patch("reports/:id")
  reportStatus(@Param("id") id: string, @Body(new ZodValidationPipe(reportStatusSchema)) dto: any) {
    return this.admin.setReportStatus(id, dto.status);
  }
}

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

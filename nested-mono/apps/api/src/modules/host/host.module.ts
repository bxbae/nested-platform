import { Controller, Get, UseGuards, Req, Injectable, Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { ReservationStatus } from "@prisma/client";

// Revenue counts only reservations that represent real income.
const EARNING_STATUSES: ReservationStatus[] = [ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED];

export interface HostDashboard {
  thisMonth: number;
  lastMonth: number;
  changePct: number | null; // null when lastMonth is 0 (no baseline)
  listingCount: number;
  reservationCount: number;
  occupancy: number; // 0–100
  newInquiries: number;
  trend: { month: string; value: number }[]; // last 6 months incl. current
}

@Injectable()
export class HostService {
  constructor(private readonly prisma: PrismaService) {}

  // One aggregated snapshot for the /host dashboard. Computed on demand — the
  // data volume here is tiny (one host's listings), so there's no cache to keep
  // in sync. If this ever gets hot, wrap it in Redis with a short TTL.
  async dashboard(hostId: string): Promise<HostDashboard> {
    const now = new Date();
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    // All earning reservations across this host's rooms, with just the fields
    // we need. One query; we bucket in memory (small N).
    const earning = await this.prisma.reservation.findMany({
      where: {
        room: { hostId },
        status: { in: EARNING_STATUSES },
      },
      select: { monthlyRent: true, createdAt: true },
    });

    const inRange = (d: Date, start: Date, end?: Date) =>
      d >= start && (end ? d < end : true);

    const thisMonth = earning
      .filter((r) => inRange(r.createdAt, thisMonthStart))
      .reduce((s, r) => s + r.monthlyRent, 0);
    const lastMonth = earning
      .filter((r) => inRange(r.createdAt, lastMonthStart, thisMonthStart))
      .reduce((s, r) => s + r.monthlyRent, 0);

    // 6-month trend (oldest → current). Bucket by calendar month.
    const trend: { month: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const value = earning
        .filter((r) => inRange(r.createdAt, mStart, mEnd))
        .reduce((s, r) => s + r.monthlyRent, 0);
      trend.push({ month: `${mStart.getMonth() + 1}월`, value });
    }

    const [listingCount, reservationCount, chatRooms] = await Promise.all([
      this.prisma.room.count({ where: { hostId } }),
      this.prisma.reservation.count({ where: { room: { hostId } } }),
      // Chat rooms are "문의". Count ones with at least one message the host
      // hasn't read yet (readBy doesn't include hostId).
      this.prisma.chatRoom.findMany({
        where: { hostId },
        select: {
          messages: {
            where: { NOT: { readBy: { has: hostId } }, senderId: { not: hostId } },
            select: { id: true },
            take: 1,
          },
        },
      }),
    ]);

    const newInquiries = chatRooms.filter((c) => c.messages.length > 0).length;

    // Occupancy: share of this host's rooms that currently have a CONFIRMED
    // reservation spanning today. A simple, explainable proxy.
    const activeRooms = await this.prisma.reservation.findMany({
      where: {
        room: { hostId },
        status: "CONFIRMED",
        checkIn: { lte: now },
        checkOut: { gt: now },
      },
      select: { roomId: true },
      distinct: ["roomId"],
    });
    const occupancy =
      listingCount > 0 ? Math.round((activeRooms.length / listingCount) * 100) : 0;

    return {
      thisMonth,
      lastMonth,
      changePct:
        lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null,
      listingCount,
      reservationCount,
      occupancy,
      newInquiries,
      trend,
    };
  }
}

// 호스트 대시보드 집계 API
@Controller("host")
@UseGuards(JwtAuthGuard)
export class HostController {
  constructor(private readonly host: HostService) {}

  // GET /host/dashboard — revenue + reservations + inquiries snapshot.
  @Get("dashboard")
  dashboard(@Req() req: any) {
    return this.host.dashboard(req.user.id);
  }
}

@Module({
  controllers: [HostController],
  providers: [HostService],
})
export class HostModule {}

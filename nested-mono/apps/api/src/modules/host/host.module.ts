import { Controller, Get, UseGuards, Req, Injectable, Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { ReservationStatus } from "@prisma/client";
import {
  EARNING_STATUSES,
  computeOccupancyPct,
  computeRoomRevenue,
  computeSettlementBreakdown,
  computeTrend,
  type RawReservation,
  type RoomRevenueRow,
  type SettlementBreakdown,
} from "./host-analytics.util";

const WINDOW_DAYS = 30;

export interface RecentInquiry {
  chatRoomId: string;
  roomName: string;
  guestName: string;
  lastMessage: string;
  isImage: boolean;
  createdAt: string;
}

export interface HostDashboard {
  thisMonth: number;
  lastMonth: number;
  changePct: number | null; // null when lastMonth is 0 (no baseline)
  listingCount: number;
  reservationCount: number;
  occupancy: number; // 0–100, trailing 30 days across all my rooms
  newInquiries: number;
  // 처리하지 않은 새 예약(결제 대기 중이라 승인/거절이 필요한 건)과, 최근
  // 30일 내 게스트/호스트가 취소한 건수. 둘 다 "예약 관리"에서 처리하는
  // 항목이라 하나의 카드에 같이 보여준다.
  newReservationCount: number;
  cancelledCount: number;
  trend: { month: string; revenue: number; occupancy: number }[]; // last 6 months
  roomRevenue: RoomRevenueRow[];
  settlement: SettlementBreakdown;
  recentInquiries: RecentInquiry[];
}

@Injectable()
export class HostService {
  constructor(private readonly prisma: PrismaService) {}

  // One aggregated snapshot for the /host dashboard. Computed on demand — the
  // data volume here is tiny (one host's listings), so there's no cache to
  // keep in sync. If this ever gets hot, wrap it in Redis with a short TTL.
  async dashboard(hostId: string): Promise<HostDashboard> {
    const now = new Date();
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

    const [rooms, allReservations, chatRooms] = await Promise.all([
      this.prisma.room.findMany({ where: { hostId }, select: { id: true, name: true } }),
      this.prisma.reservation.findMany({
        where: { room: { hostId } },
        select: {
          id: true,
          roomId: true,
          status: true,
          monthlyRent: true,
          months: true,
          checkIn: true,
          checkOut: true,
          createdAt: true,
        },
      }),
      // Chat rooms are "문의". Pull the latest unread-by-host message per
      // room so the dashboard can preview it, not just count it.
      this.prisma.chatRoom.findMany({
        where: { hostId },
        select: {
          id: true,
          room: { select: { name: true } },
          guest: { select: { name: true } },
          messages: {
            where: { NOT: { readBy: { has: hostId } }, senderId: { not: hostId } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, imageUrl: true, createdAt: true },
          },
        },
      }),
    ]);

    const reservations = allReservations as RawReservation[];
    const roomIds = rooms.map((r) => r.id);

    const inRange = (d: Date, start: Date, end?: Date) => d >= start && (end ? d < end : true);
    const earning = reservations.filter((r) => EARNING_STATUSES.includes(r.status));
    const gross = (r: RawReservation) => r.monthlyRent * r.months;

    const thisMonth = earning
      .filter((r) => inRange(r.createdAt, thisMonthStart))
      .reduce((s, r) => s + gross(r), 0);
    const lastMonth = earning
      .filter((r) => inRange(r.createdAt, lastMonthStart, thisMonthStart))
      .reduce((s, r) => s + gross(r), 0);

    const withUnread = chatRooms.filter((c) => c.messages.length > 0);
    const recentInquiries: RecentInquiry[] = withUnread
      .sort((a, b) => +b.messages[0]!.createdAt - +a.messages[0]!.createdAt)
      .slice(0, 5)
      .map((c) => {
        const last = c.messages[0]!;
        return {
          chatRoomId: c.id,
          roomName: c.room.name.trim(),
          guestName: c.guest?.name ?? "게스트",
          lastMessage: last.imageUrl ? "📷 사진" : (last.body ?? ""),
          isImage: !!last.imageUrl,
          createdAt: last.createdAt.toISOString(),
        };
      });

    const cancelledCount = reservations.filter(
      (r) =>
        (r.status === ReservationStatus.CANCELLED_BY_GUEST ||
          r.status === ReservationStatus.CANCELLED_BY_HOST) &&
        r.createdAt >= windowStart,
    ).length;

    return {
      thisMonth,
      lastMonth,
      changePct: lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null,
      listingCount: rooms.length,
      reservationCount: reservations.length,
      occupancy: computeOccupancyPct(reservations, roomIds, windowStart, now),
      newInquiries: withUnread.length,
      newReservationCount: reservations.filter(
        (r) => r.status === ReservationStatus.PENDING_PAYMENT,
      ).length,
      cancelledCount,
      trend: computeTrend(reservations, roomIds, now, 6),
      roomRevenue: computeRoomRevenue(reservations, rooms, windowStart, now),
      settlement: computeSettlementBreakdown(reservations, now),
      recentInquiries,
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

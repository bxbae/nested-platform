import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  UseGuards,
  Req,
  Injectable,
  Module,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { ReservationStatus } from "@prisma/client";

// Statuses that occupy a date on the calendar (a held or confirmed stay).
const OCCUPYING: ReservationStatus[] = [
  ReservationStatus.PENDING_PAYMENT,
  ReservationStatus.CONFIRMED,
];

export interface CalendarReservation {
  id: string;
  roomId: string;
  guestName: string;
  checkIn: string; // ISO date
  checkOut: string; // ISO date
  status: string;
}

export interface CalendarMonth {
  reservations: CalendarReservation[];
  blockedDates: string[]; // YYYY-MM-DD list of host-blocked days
}

@Injectable()
export class HostCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  // Confirm the host owns the room, or throw. Every calendar op is room-scoped.
  private async assertOwns(hostId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { hostId: true },
    });
    if (!room) throw new NotFoundException({ code: "ROOM_NOT_FOUND", message: "숙소를 찾을 수 없습니다." });
    if (room.hostId !== hostId) {
      throw new ForbiddenException({ code: "NOT_HOST", message: "본인 숙소만 관리할 수 있습니다." });
    }
  }

  // Reservations overlapping the month + blocked dates for one room.
  async month(hostId: string, roomId: string, year: number, month: number): Promise<CalendarMonth> {
    await this.assertOwns(hostId, roomId);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1); // exclusive

    const [reservations, blocks] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          roomId,
          status: { in: OCCUPYING },
          // overlaps the month: checkIn < monthEnd AND checkOut > monthStart
          checkIn: { lt: monthEnd },
          checkOut: { gt: monthStart },
        },
        select: {
          id: true,
          roomId: true,
          checkIn: true,
          checkOut: true,
          status: true,
          guest: { select: { name: true } },
        },
        orderBy: { checkIn: "asc" },
      }),
      this.prisma.calendarBlock.findMany({
        where: { roomId, blocked: true, date: { gte: monthStart, lt: monthEnd } },
        select: { date: true },
      }),
    ]);

    return {
      reservations: reservations.map((r) => ({
        id: r.id,
        roomId: r.roomId,
        guestName: r.guest?.name ?? "게스트",
        checkIn: r.checkIn.toISOString(),
        checkOut: r.checkOut.toISOString(),
        status: r.status,
      })),
      blockedDates: blocks.map((b) => isoDate(b.date)),
    };
  }

  // Mark a date unavailable. Idempotent (unique on [roomId, date]).
  async block(hostId: string, roomId: string, date: Date, reason?: string) {
    await this.assertOwns(hostId, roomId);
    const day = atMidnight(date);
    await this.prisma.calendarBlock.upsert({
      where: { roomId_date: { roomId, date: day } },
      update: { blocked: true, reason: reason ?? null },
      create: { roomId, date: day, blocked: true, reason: reason ?? null },
    });
    return { ok: true, date: isoDate(day) };
  }

  // Remove a block (make the date available again).
  async unblock(hostId: string, roomId: string, date: Date) {
    await this.assertOwns(hostId, roomId);
    const day = atMidnight(date);
    await this.prisma.calendarBlock.deleteMany({ where: { roomId, date: day } });
    return { ok: true, date: isoDate(day) };
  }
}

// ── validation ──
const monthQuery = z.object({
  roomId: z.string().min(1),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
const blockBody = z.object({
  roomId: z.string().min(1),
  date: z.coerce.date(),
  reason: z.string().trim().min(1).max(200).optional(),
});
const unblockBody = z.object({
  roomId: z.string().min(1),
  date: z.coerce.date(),
});

// 호스트 캘린더 API — 예약 현황 + 예약 불가일
@Controller("host/calendar")
@UseGuards(JwtAuthGuard)
export class HostCalendarController {
  constructor(private readonly cal: HostCalendarService) {}

  // GET /host/calendar?roomId=&year=&month=
  @Get()
  month(@Req() req: any, @Query(new ZodValidationPipe(monthQuery)) q: any) {
    return this.cal.month(req.user.id, q.roomId, q.year, q.month);
  }

  // POST /host/calendar/block  { roomId, date, reason? }
  @Post("block")
  block(@Req() req: any, @Body(new ZodValidationPipe(blockBody)) dto: any) {
    return this.cal.block(req.user.id, dto.roomId, dto.date, dto.reason);
  }

  // DELETE /host/calendar/block  { roomId, date }
  @Delete("block")
  unblock(@Req() req: any, @Body(new ZodValidationPipe(unblockBody)) dto: any) {
    return this.cal.unblock(req.user.id, dto.roomId, dto.date);
  }
}

@Module({
  controllers: [HostCalendarController],
  providers: [HostCalendarService],
})
export class HostCalendarModule {}

// ── helpers ──
function atMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

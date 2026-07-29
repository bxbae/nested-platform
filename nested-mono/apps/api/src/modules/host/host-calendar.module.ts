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
  BadRequestException,
} from "@nestjs/common";
import { BookingMode, ReservationStatus } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import {
  INVENTORY_HOLDING_STATUSES,
  addUtcDays,
  atUtcDayStart,
  calculateInventory,
  isoDate,
  overlaps,
} from "../reservations/reservation-inventory.util";

export interface CalendarReservation {
  id: string;
  roomId: string;
  guestName: string;
  companionNames: string[];
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  bookingMode: BookingMode;
  reservedSpots: number;
  changeType: string | null;
  changeStatus: string | null;
  requestedCheckOut: string | null;
}

export interface CalendarDay {
  date: string;
  blocked: boolean;
  blockReason: string | null;
  reservedSpots: number;
  pendingSpots: number;
  confirmedSpots: number;
  remainingSpots: number | null;
  fullyBooked: boolean;
  guestNames: string[];
  reservationIds: string[];
}

export interface CalendarMonth {
  room: {
    id: string;
    name: string;
    rentalUnit: string | null;
    capacity: number | null;
  };
  reservations: CalendarReservation[];
  blockedDates: string[];
  days: CalendarDay[];
}

@Injectable()
export class HostCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedRoom(hostId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        hostId: true,
        rentalUnit: true,
        capacity: true,
      },
    });
    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });
    }
    if (room.hostId !== hostId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소만 관리할 수 있습니다.",
      });
    }
    return room;
  }

  async month(
    hostId: string,
    roomId: string,
    year: number,
    month: number,
  ): Promise<CalendarMonth> {
    const room = await this.ownedRoom(hostId, roomId);
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));

    const [reservations, blocks] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          roomId,
          status: { in: INVENTORY_HOLDING_STATUSES },
          checkIn: { lt: monthEnd },
          checkOut: { gt: monthStart },
        },
        select: {
          id: true,
          roomId: true,
          checkIn: true,
          checkOut: true,
          status: true,
          bookingMode: true,
          reservedSpots: true,
          guest: { select: { name: true } },
          companionId: true,
          companionStatus: true,
          companion: { select: { name: true } },
          companions: {
            select: {
              status: true,
              user: { select: { name: true } },
            },
          },
          contractChanges: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              type: true,
              status: true,
              requestedCheckOut: true,
            },
          },
        },
        orderBy: { checkIn: "asc" },
      }),
      this.prisma.calendarBlock.findMany({
        where: {
          roomId,
          blocked: true,
          date: { gte: monthStart, lt: monthEnd },
        },
        select: { date: true, reason: true },
      }),
    ]);

    const mappedReservations: CalendarReservation[] = reservations.map((r) => {
      const memberNames = r.companions
        .filter((member) => member.status !== "DECLINED")
        .map((member) => member.user.name);
      const companionNames = [
        ...memberNames,
        ...(memberNames.length === 0 &&
        r.companion?.name &&
        r.companionStatus !== "DECLINED"
          ? [r.companion.name]
          : []),
      ];
      return {
        id: r.id,
        roomId: r.roomId,
        guestName: r.guest?.name ?? "게스트",
        companionNames: [...new Set(companionNames)],
        checkIn: r.checkIn.toISOString(),
        checkOut: r.checkOut.toISOString(),
        status: r.status,
        bookingMode: r.bookingMode,
        reservedSpots: Math.max(1, r.reservedSpots),
        changeType: r.contractChanges[0]?.type ?? null,
        changeStatus: r.contractChanges[0]?.status ?? null,
        requestedCheckOut:
          r.contractChanges[0]?.requestedCheckOut.toISOString() ?? null,
      };
    });

    const blockMap = new Map<string, string | null>(
      blocks.map((block) => [isoDate(block.date), block.reason ?? null] as const),
    );
    const days: CalendarDay[] = [];

    for (let day = monthStart; day < monthEnd; day = addUtcDays(day, 1)) {
      const nextDay = addUtcDays(day, 1);
      const date = isoDate(day);
      const active = reservations.filter((reservation) =>
        overlaps(
          reservation.checkIn,
          reservation.checkOut,
          day,
          nextDay,
        ),
      );
      const blocked = blockMap.has(date);
      const inventory = calculateInventory(
        room.rentalUnit,
        room.capacity,
        active,
        blocked,
      );
      const heldSpots = (reservation: (typeof reservations)[number]) => {
        if (room.rentalUnit !== "BED") return 1;
        if (reservation.bookingMode !== BookingMode.BED) {
          return Math.max(1, room.capacity ?? 1);
        }
        return Math.max(1, reservation.reservedSpots);
      };
      const pendingSpots = active
        .filter((reservation) => reservation.status === ReservationStatus.PENDING_PAYMENT)
        .reduce((sum, reservation) => sum + heldSpots(reservation), 0);
      const confirmedSpots = active
        .filter((reservation) => reservation.status !== ReservationStatus.PENDING_PAYMENT)
        .reduce((sum, reservation) => sum + heldSpots(reservation), 0);
      const guestNames: string[] = active.flatMap((reservation) => [
        reservation.guest?.name ?? "게스트",
        ...reservation.companions
          .filter((member) => member.status !== "DECLINED")
          .map((member) => member.user.name),
        ...(reservation.companions.length === 0 &&
        reservation.companion?.name &&
        reservation.companionStatus !== "DECLINED"
          ? [reservation.companion.name]
          : []),
      ]);

      days.push({
        date,
        blocked,
        blockReason: blockMap.get(date) ?? null,
        reservedSpots: inventory.reservedSpots,
        pendingSpots,
        confirmedSpots,
        remainingSpots: inventory.remainingSpots,
        fullyBooked: inventory.fullyBooked,
        guestNames: [...new Set(guestNames)],
        reservationIds: active.map((reservation) => reservation.id),
      });
    }

    return {
      room: {
        id: room.id,
        name: room.name.trim(),
        rentalUnit: room.rentalUnit,
        capacity: room.capacity,
      },
      reservations: mappedReservations,
      blockedDates: Array.from(blockMap.keys()),
      days,
    };
  }

  async block(hostId: string, roomId: string, date: Date, reason?: string) {
    await this.ownedRoom(hostId, roomId);
    const day = atUtcDayStart(date);
    await this.prisma.calendarBlock.upsert({
      where: { roomId_date: { roomId, date: day } },
      update: { blocked: true, reason: reason ?? null },
      create: { roomId, date: day, blocked: true, reason: reason ?? null },
    });
    return { ok: true, date: isoDate(day) };
  }

  async unblock(hostId: string, roomId: string, date: Date) {
    await this.ownedRoom(hostId, roomId);
    const day = atUtcDayStart(date);
    await this.prisma.calendarBlock.deleteMany({ where: { roomId, date: day } });
    return { ok: true, date: isoDate(day) };
  }

  async blockRange(
    hostId: string,
    roomId: string,
    startDate: Date,
    endDate: Date,
    reason?: string,
  ) {
    await this.ownedRoom(hostId, roomId);
    const start = atUtcDayStart(startDate);
    const end = atUtcDayStart(endDate);
    if (end < start) {
      throw new BadRequestException({
        code: "INVALID_DATE_RANGE",
        message: "종료일은 시작일보다 빠를 수 없습니다.",
      });
    }

    const dates: Date[] = [];
    for (let day = start; day <= end; day = addUtcDays(day, 1)) {
      dates.push(day);
    }
    await this.prisma.$transaction(
      dates.map((date) =>
        this.prisma.calendarBlock.upsert({
          where: { roomId_date: { roomId, date } },
          update: { blocked: true, reason: reason ?? null },
          create: { roomId, date, blocked: true, reason: reason ?? null },
        }),
      ),
    );
    return { ok: true, dates: dates.map(isoDate) };
  }

  async unblockRange(
    hostId: string,
    roomId: string,
    startDate: Date,
    endDate: Date,
  ) {
    await this.ownedRoom(hostId, roomId);
    const start = atUtcDayStart(startDate);
    const end = atUtcDayStart(endDate);
    if (end < start) {
      throw new BadRequestException({
        code: "INVALID_DATE_RANGE",
        message: "종료일은 시작일보다 빠를 수 없습니다.",
      });
    }
    await this.prisma.calendarBlock.deleteMany({
      where: { roomId, date: { gte: start, lte: end } },
    });
    return { ok: true };
  }
}

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
const rangeBody = z.object({
  roomId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().trim().min(1).max(200).optional(),
});

@Controller("host/calendar")
@UseGuards(JwtAuthGuard)
export class HostCalendarController {
  constructor(private readonly cal: HostCalendarService) {}

  @Get()
  month(@Req() req: any, @Query(new ZodValidationPipe(monthQuery)) q: any) {
    return this.cal.month(req.user.id, q.roomId, q.year, q.month);
  }

  @Post("block")
  block(@Req() req: any, @Body(new ZodValidationPipe(blockBody)) dto: any) {
    return this.cal.block(req.user.id, dto.roomId, dto.date, dto.reason);
  }

  @Delete("block")
  unblock(@Req() req: any, @Body(new ZodValidationPipe(unblockBody)) dto: any) {
    return this.cal.unblock(req.user.id, dto.roomId, dto.date);
  }

  @Post("block-range")
  blockRange(@Req() req: any, @Body(new ZodValidationPipe(rangeBody)) dto: any) {
    return this.cal.blockRange(
      req.user.id,
      dto.roomId,
      dto.startDate,
      dto.endDate,
      dto.reason,
    );
  }

  @Delete("block-range")
  unblockRange(
    @Req() req: any,
    @Body(new ZodValidationPipe(rangeBody.omit({ reason: true }))) dto: any,
  ) {
    return this.cal.unblockRange(
      req.user.id,
      dto.roomId,
      dto.startDate,
      dto.endDate,
    );
  }
}

@Module({
  controllers: [HostCalendarController],
  providers: [HostCalendarService],
})
export class HostCalendarModule {}

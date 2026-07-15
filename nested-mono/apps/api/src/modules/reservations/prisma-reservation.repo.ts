import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ReservationRepo,
  RoomRecord,
  ReservationRecord,
  CouponRecord,
  ReservationStatus,
} from "./ports";

// Prisma-backed implementation of the ReservationRepo port.
//
// NOTE: This references a PrismaService/PrismaClient that lives in
// apps/api/src/prisma. The key correctness detail is `createHold`, which runs
// the overlap check and the insert inside one SERIALIZABLE transaction so two
// concurrent bookings cannot both succeed (double-booking prevention,
// ARCHITECTURE.md §11). A DB-level exclusion constraint on (room_id, daterange)
// is the backstop.
//
// The `prisma` field is typed loosely here to keep this module self-contained
// for the reference build; wire the real PrismaService via DI in production.
@Injectable()
export class PrismaReservationRepo implements ReservationRepo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly prisma: PrismaService) {}

  async findRoom(roomId: string): Promise<RoomRecord | null> {
    return this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        monthlyRent: true,
        deposit: true,
        cleaningFee: true,
        maintenanceFee: true,
        minStayMonths: true,
        availableFrom: true,
      },
    });
  }

  async findCouponByCode(code: string): Promise<CouponRecord | null> {
    return this.prisma.coupon.findUnique({ where: { code } }) as Promise<CouponRecord | null>;
  }

  async findOverlapping(roomId: string, checkIn: Date, checkOut: Date): Promise<ReservationRecord[]> {
    return this.prisma.reservation.findMany({
      where: {
        roomId,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
        // overlap: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
  }

  async createHold(
    data: Omit<ReservationRecord, "id" | "createdAt">
  ): Promise<ReservationRecord> {
    // Serializable transaction: re-check overlap under lock, then insert.
    return this.prisma.$transaction(
      async (tx: any) => {
        const conflict = await tx.reservation.findFirst({
          where: {
            roomId: data.roomId,
            status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
            checkIn: { lt: data.checkOut },
            checkOut: { gt: data.checkIn },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException({
            code: "DATES_UNAVAILABLE",
            message: "선택한 기간은 이미 예약되었습니다.",
          });
        }
        return tx.reservation.create({ data });
      },
      { isolationLevel: "Serializable" }
    );
  }

  async findById(id: string): Promise<ReservationRecord | null> {
    return this.prisma.reservation.findUnique({ where: { id } });
  }

  async listByGuest(guestId: string) {
    const rows = await this.prisma.reservation.findMany({
      where: { guestId },
      orderBy: { createdAt: "desc" },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            region: true,
            images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
          },
        },
      },
    });
    return rows.map((r: (typeof rows)[number]) => ({
      ...r,
      room: {
        id: r.room.id,
        name: r.room.name,
        region: r.room.region,
        image: r.room.images[0]?.url ?? null,
      },
    }));
  }

  // Every reservation across the listings this host owns (the 예약 관리 inbox).
  // Filters by the room's hostId — the same pattern as `GET /rooms/mine`.
  async listByHost(hostId: string) {
    const rows = await this.prisma.reservation.findMany({
      where: { room: { hostId } },
      orderBy: { createdAt: "desc" },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            region: true,
            images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
          },
        },
        guest: { select: { id: true, name: true, avatarColor: true } },
      },
    });
    return rows.map((r: (typeof rows)[number]) => ({
      ...r,
      room: {
        id: r.room.id,
        name: r.room.name,
        region: r.room.region,
        image: r.room.images[0]?.url ?? null,
      },
      guest: {
        id: r.guest.id,
        name: r.guest.name,
        avatarColor: r.guest.avatarColor,
      },
    }));
  }

  // Resolve the host that owns a reservation's room, for ownership checks.
  async findRoomHostId(reservationId: string): Promise<string | null> {
    const row = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { room: { select: { hostId: true } } },
    });
    return row?.room.hostId ?? null;
  }

  async updateStatus(id: string, status: ReservationStatus): Promise<ReservationRecord> {
    return this.prisma.reservation.update({ where: { id }, data: { status } });
  }

  async markCouponUsed(couponId: string): Promise<void> {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }
}

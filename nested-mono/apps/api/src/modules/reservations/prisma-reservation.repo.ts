import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ReservationRepo,
  RoomRecord,
  ReservationRecord,
  CouponRecord,
  ReservationStatus,
  BookingMode,
  CreateHoldData,
  CompanionStatus,
} from "./ports";
import {
  INVENTORY_QUERY_STATUSES,
  atUtcDayStart,
  calculateRangeInventory,
} from "./reservation-inventory.util";

// Prisma-backed implementation of the ReservationRepo port.
//
// NOTE: This references a PrismaService/PrismaClient that lives in
// apps/api/src/prisma. The key correctness detail is `createHold`, which runs
// the overlap check and the insert inside one SERIALIZABLE transaction so two
// concurrent bookings cannot both succeed (double-booking prevention,
// ARCHITECTURE.md §11). The Room row lock is required because a daterange-only
// exclusion constraint would incorrectly block valid overlapping BED bookings.
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
        name: true,
        hostId: true,
        monthlyRent: true,
        deposit: true,
        cleaningFee: true,
        maintenanceFee: true,
        minStayMonths: true,
        availableFrom: true,
        rentalUnit: true,
        capacity: true,
      },
    });
  }

  async findCouponByCode(code: string): Promise<CouponRecord | null> {
    return this.prisma.coupon.findUnique({
      where: { code },
    }) as Promise<CouponRecord | null>;
  }

  async findOverlapping(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<ReservationRecord[]> {
    return this.prisma.reservation.findMany({
      where: {
        roomId,
        status: { in: INVENTORY_QUERY_STATUSES },
        // overlap: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
  }

  async findBlockedDates(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<Date[]> {
    const rows = await this.prisma.calendarBlock.findMany({
      where: {
        roomId,
        blocked: true,
        date: { gte: atUtcDayStart(checkIn), lt: atUtcDayStart(checkOut) },
      },
      select: { date: true },
    });
    return rows.map((row) => row.date);
  }

  async createHold(data: CreateHoldData): Promise<ReservationRecord> {
    const { companionIds = [], ...reservationData } = data;
    // 같은 숙소 행을 먼저 잠가서, 다인실의 남은 자리 계산과 예약 생성이
    // 하나의 임계 구역에서 수행되도록 한다. 단순 overlap 검사만으로는
    // 동시에 들어온 두 건이 남은 한 자리를 모두 확보할 수 있다.
    return this.prisma.$transaction(
      async (tx: any) => {
        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "Room" WHERE "id" = $1 FOR UPDATE',
          reservationData.roomId,
        );

        const room = await tx.room.findUnique({
          where: { id: reservationData.roomId },
          select: { rentalUnit: true, capacity: true },
        });
        if (!room) {
          throw new ConflictException({
            code: "ROOM_NOT_FOUND",
            message: "숙소를 찾을 수 없습니다.",
          });
        }

        const [overlaps, blocks] = await Promise.all([
          tx.reservation.findMany({
            where: {
              roomId: reservationData.roomId,
              status: { in: INVENTORY_QUERY_STATUSES },
              checkIn: { lt: reservationData.checkOut },
              checkOut: { gt: reservationData.checkIn },
            },
            select: {
              checkIn: true,
              checkOut: true,
              bookingMode: true,
              reservedSpots: true,
            },
          }),
          tx.calendarBlock.findMany({
            where: {
              roomId: reservationData.roomId,
              blocked: true,
              date: {
                gte: atUtcDayStart(reservationData.checkIn),
                lt: atUtcDayStart(reservationData.checkOut),
              },
            },
            select: { id: true },
            take: 1,
          }),
        ]);

        if (blocks.length > 0) throwHostBlocked();

        assertInventoryAvailable(
          room.rentalUnit,
          room.capacity,
          overlaps,
          reservationData.bookingMode,
          reservationData.reservedSpots,
          reservationData.checkIn,
          reservationData.checkOut,
        );

        return tx.reservation.create({
          data: {
            ...reservationData,
            ...(companionIds.length > 0
              ? {
                  companions: {
                    create: companionIds.map((userId) => ({ userId })),
                  },
                }
              : {}),
          },
        });
      },
      { isolationLevel: "Serializable" },
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
            images: {
              orderBy: { order: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
        // Payment is 1:1 with Reservation (nullable — PENDING_PAYMENT rows have none yet).
        payment: {
          select: {
            id: true,
            provider: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
        contractChanges: {
          orderBy: { createdAt: "desc" },
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
      payment: r.payment ?? null,
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
            rentalUnit: true,
            capacity: true,
            images: {
              orderBy: { order: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
        guest: { select: { id: true, name: true, avatarColor: true } },
        companions: {
          select: {
            status: true,
            user: { select: { id: true, name: true, avatarColor: true } },
          },
        },
        contractChanges: {
          orderBy: { createdAt: "desc" },
          take: 1,
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
        rentalUnit: r.room.rentalUnit,
        capacity: r.room.capacity,
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

  async findFriendIds(userId: string, candidateIds: string[]): Promise<string[]> {
    if (candidateIds.length === 0) return [];
    const rows = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { userAId: userId, userBId: { in: candidateIds } },
          { userBId: userId, userAId: { in: candidateIds } },
        ],
      },
      select: { userAId: true, userBId: true },
    });
    return rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId));
  }

  async findCompanionStatus(
    id: string,
    userId: string,
  ): Promise<CompanionStatus | null> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      select: {
        companionId: true,
        companionStatus: true,
        companions: {
          where: { userId },
          take: 1,
          select: { status: true },
        },
      },
    });
    if (!row) return null;
    return row.companions[0]?.status ??
      (row.companionId === userId ? row.companionStatus : null);
  }

  // 내가 동반자로 초대된 예약들. listByGuest 와 같은 형태로 돌려주어
  // 마이페이지에서 같은 카드 컴포넌트로 렌더할 수 있게 한다.
  async listByCompanion(companionId: string) {
    const rows = await this.prisma.reservation.findMany({
      where: {
        OR: [
          { companionId },
          { companions: { some: { userId: companionId } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            region: true,
            images: {
              orderBy: { order: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
        companions: {
          where: { userId: companionId },
          take: 1,
          select: { status: true, respondedAt: true },
        },
        payment: {
          select: {
            id: true,
            provider: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    return rows.map((r: (typeof rows)[number]) => {
      const { companions, ...reservation } = r;
      const membership = companions[0];
      return {
        ...reservation,
        companionId: companionId,
        companionStatus: membership?.status ?? r.companionStatus,
        companionRespondedAt: membership?.respondedAt ?? r.companionRespondedAt,
        room: {
          id: r.room.id,
          name: r.room.name,
          region: r.room.region,
          image: r.room.images[0]?.url ?? null,
        },
        payment: r.payment ?? null,
      };
    });
  }

  async updateCompanionStatus(
    id: string,
    userId: string,
    status: CompanionStatus,
  ): Promise<ReservationRecord> {
    return this.prisma.$transaction(async (tx) => {
      const respondedAt = new Date();
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation) {
        throw new ConflictException({
          code: "RESERVATION_NOT_FOUND",
          message: "예약을 찾을 수 없습니다.",
        });
      }

      const member = await tx.reservationCompanionMember.findUnique({
        where: { reservationId_userId: { reservationId: id, userId } },
        select: { id: true },
      });
      if (member) {
        await tx.reservationCompanionMember.update({
          where: { id: member.id },
          data: { status, respondedAt },
        });
      }

      if (reservation.companionId === userId) {
        return tx.reservation.update({
          where: { id },
          data: { companionStatus: status, companionRespondedAt: respondedAt },
        });
      }

      // ReservationRecord still exposes the legacy companion fields. Shape the
      // response for the friend who just answered without overwriting the first
      // companion's compatibility columns.
      return {
        ...reservation,
        companionId: userId,
        companionStatus: status,
        companionRespondedAt: respondedAt,
      };
    });
  }

  async updateStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<ReservationRecord> {
    return this.prisma.reservation.update({ where: { id }, data: { status } });
  }

  async approveEarlyCheckout(
    id: string,
    checkOut: Date,
  ): Promise<ReservationRecord> {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: "EARLY_CHECKOUT_APPROVED", checkOut },
    });
  }

  // ── 계약 연장 ──
  // Record the guest's requested months and park the reservation in
  // EXTENSION_REQUESTED until the host decides.
  async requestExtension(id: string, months: number): Promise<ReservationRecord> {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: "EXTENSION_REQUESTED", extensionMonths: months },
    });
  }

  // Approve: push checkOut out by `months`, grow the contract length, clear the
  // pending request and go back to CONFIRMED.
  async applyExtension(id: string, months: number): Promise<ReservationRecord> {
    return this.prisma.$transaction(
      async (tx: any) => {
        const current = await tx.reservation.findUnique({
          where: { id },
          select: {
            id: true,
            roomId: true,
            checkOut: true,
            months: true,
            bookingMode: true,
            reservedSpots: true,
          },
        });
        if (!current) throw new Error("RESERVATION_NOT_FOUND");

        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "Room" WHERE "id" = $1 FOR UPDATE',
          current.roomId,
        );
        const room = await tx.room.findUnique({
          where: { id: current.roomId },
          select: { rentalUnit: true, capacity: true },
        });
        if (!room) throw new Error("ROOM_NOT_FOUND");

        const newCheckOut = new Date(current.checkOut);
        newCheckOut.setMonth(newCheckOut.getMonth() + months);
        const [overlaps, blocks] = await Promise.all([
          tx.reservation.findMany({
            where: {
              id: { not: id },
              roomId: current.roomId,
              status: { in: INVENTORY_QUERY_STATUSES },
              checkIn: { lt: newCheckOut },
              checkOut: { gt: current.checkOut },
            },
            select: {
              checkIn: true,
              checkOut: true,
              bookingMode: true,
              reservedSpots: true,
            },
          }),
          tx.calendarBlock.findMany({
            where: {
              roomId: current.roomId,
              blocked: true,
              date: {
                gte: atUtcDayStart(current.checkOut),
                lt: atUtcDayStart(newCheckOut),
              },
            },
            select: { id: true },
            take: 1,
          }),
        ]);
        if (blocks.length > 0) throwHostBlocked();
        assertInventoryAvailable(
          room.rentalUnit,
          room.capacity,
          overlaps,
          current.bookingMode,
          current.reservedSpots,
          current.checkOut,
          newCheckOut,
        );

        return tx.reservation.update({
          where: { id },
          data: {
            checkOut: newCheckOut,
            months: current.months + months,
            status: "CONFIRMED",
            extensionMonths: null,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  // Reject / cancel a pending request.
  async clearExtension(id: string): Promise<ReservationRecord> {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", extensionMonths: null },
    });
  }

  async markCouponUsed(couponId: string): Promise<void> {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }
}


function assertInventoryAvailable(
  rentalUnit: "WHOLE" | "PRIVATE_ROOM" | "BED" | null,
  capacityValue: number | null,
  overlaps: Array<{
    checkIn: Date;
    checkOut: Date;
    bookingMode: BookingMode;
    reservedSpots: number;
  }>,
  requestedMode: BookingMode,
  requestedSpots: number,
  rangeStart: Date,
  rangeEnd: Date,
): void {
  const inventory = calculateRangeInventory(
    rentalUnit,
    capacityValue,
    overlaps,
    rangeStart,
    rangeEnd,
  );

  if (rentalUnit !== "BED") {
    if (inventory.fullyBooked) throwUnavailable();
    return;
  }

  if (requestedMode === "WHOLE_ROOM") {
    if (inventory.reservedSpots > 0) throwUnavailable();
    return;
  }

  const remaining = inventory.remainingSpots ?? 0;
  if (requestedSpots > remaining) {
    throw new ConflictException({
      code: "NOT_ENOUGH_SPOTS",
      message: `선택한 기간에 남은 자리가 ${remaining}개뿐입니다.`,
    });
  }
}

function throwHostBlocked(): never {
  throw new ConflictException({
    code: "HOST_BLOCKED_DATES",
    message: "선택한 기간에 호스트가 예약 불가로 설정한 날짜가 있습니다. 다른 기간을 선택해주세요.",
  });
}

function throwUnavailable(): never {
  throw new ConflictException({
    code: "DATES_UNAVAILABLE",
    message: "선택한 기간은 예약이 마감되었습니다. 다른 날짜를 선택해주세요.",
  });
}

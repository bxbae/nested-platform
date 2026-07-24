import { Injectable, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ReservationRepo,
  RoomRecord,
  ReservationRecord,
  CouponRecord,
  ReservationStatus,
  BookingMode,
} from "./ports";

const INVENTORY_HOLDING_STATUSES: ReservationStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "EARLY_CHECKOUT_REQUESTED",
  "EARLY_CHECKOUT_APPROVED",
  "EXTENSION_REQUESTED",
];

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
        status: { in: INVENTORY_HOLDING_STATUSES },
        // overlap: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
  }

  async createHold(
    data: Omit<ReservationRecord, "id" | "createdAt">,
  ): Promise<ReservationRecord> {
    // 같은 숙소 행을 먼저 잠가서, 다인실의 남은 자리 계산과 예약 생성이
    // 하나의 임계 구역에서 수행되도록 한다. 단순 overlap 검사만으로는
    // 동시에 들어온 두 건이 남은 한 자리를 모두 확보할 수 있다.
    return this.prisma.$transaction(
      async (tx: any) => {
        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "Room" WHERE "id" = $1 FOR UPDATE',
          data.roomId,
        );

        const room = await tx.room.findUnique({
          where: { id: data.roomId },
          select: { rentalUnit: true, capacity: true },
        });
        if (!room) {
          throw new ConflictException({
            code: "ROOM_NOT_FOUND",
            message: "숙소를 찾을 수 없습니다.",
          });
        }

        const overlaps = await tx.reservation.findMany({
          where: {
            roomId: data.roomId,
            status: { in: INVENTORY_HOLDING_STATUSES },
            checkIn: { lt: data.checkOut },
            checkOut: { gt: data.checkIn },
          },
          select: { bookingMode: true, reservedSpots: true },
        });

        assertInventoryAvailable(
          room.rentalUnit,
          room.capacity,
          overlaps,
          data.bookingMode,
          data.reservedSpots,
        );

        return tx.reservation.create({ data });
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
            images: {
              orderBy: { order: "asc" },
              take: 1,
              select: { url: true },
            },
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

  // 내가 동반자로 초대된 예약들. listByGuest 와 같은 형태로 돌려주어
  // 마이페이지에서 같은 카드 컴포넌트로 렌더할 수 있게 한다.
  async listByCompanion(companionId: string) {
    const rows = await this.prisma.reservation.findMany({
      where: { companionId },
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

  async updateCompanionStatus(
    id: string,
    status: "PENDING" | "ACCEPTED" | "DECLINED",
  ): Promise<ReservationRecord> {
    return this.prisma.reservation.update({
      where: { id },
      data: { companionStatus: status, companionRespondedAt: new Date() },
    });
  }

  async updateStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<ReservationRecord> {
    return this.prisma.reservation.update({ where: { id }, data: { status } });
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
    const current = await this.prisma.reservation.findUnique({
      where: { id },
      select: { checkOut: true, months: true },
    });
    if (!current) throw new Error("RESERVATION_NOT_FOUND");
    const newCheckOut = new Date(current.checkOut);
    newCheckOut.setMonth(newCheckOut.getMonth() + months);
    return this.prisma.reservation.update({
      where: { id },
      data: {
        checkOut: newCheckOut,
        months: current.months + months,
        status: "CONFIRMED",
        extensionMonths: null,
      },
    });
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
  overlaps: Array<{ bookingMode: BookingMode; reservedSpots: number }>,
  requestedMode: BookingMode,
  requestedSpots: number,
): void {
  if (rentalUnit !== "BED") {
    if (overlaps.length > 0) throwUnavailable();
    return;
  }

  const capacity = Math.max(1, capacityValue ?? 1);
  if (requestedMode === "WHOLE_ROOM") {
    if (overlaps.length > 0) throwUnavailable();
    return;
  }

  const occupied = overlaps.reduce((sum, reservation) => {
    // UNIT은 신규 BED 도입 전 생성된 예약일 수 있으므로, 기존 예약을
    // 한 자리로 축소 해석하지 않고 방 전체 점유로 보수적으로 처리한다.
    if (reservation.bookingMode !== "BED") return capacity;
    return sum + Math.max(1, reservation.reservedSpots);
  }, 0);

  if (occupied + requestedSpots > capacity) {
    throw new ConflictException({
      code: "NOT_ENOUGH_SPOTS",
      message: `선택한 기간에 남은 자리가 ${Math.max(0, capacity - occupied)}개뿐입니다.`,
    });
  }
}

function throwUnavailable(): never {
  throw new ConflictException({
    code: "DATES_UNAVAILABLE",
    message: "선택한 기간은 이미 예약되었습니다.",
  });
}

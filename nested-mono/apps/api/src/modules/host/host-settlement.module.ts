import { Controller, Get, Injectable, Module, Req, UseGuards } from "@nestjs/common";
import { BookingMode, ReservationStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { proratedMonthlyAmount } from "../reservations/pricing";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

const COMMISSION_RATE = 0.05;

const SETTLEABLE: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
  ReservationStatus.EARLY_CHECKOUT_REQUESTED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
  ReservationStatus.EXTENSION_REQUESTED,
];

export interface SettlementRow {
  reservationId: string;
  roomName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  months: number;
  occupants: number;
  bookingMode: BookingMode;
  reservedSpots: number;
  monthlyRent: number;
  deposit: number;
  gross: number;
  commission: number;
  net: number;
  extensionPaid: number;
  estimatedRefund: number;
  depositDeduction: number;
  finalRefund: number | null;
  changeType: "EARLY_CHECKOUT" | "EXTENSION" | null;
  changeStatus: string | null;
  status: "SCHEDULED" | "PAID";
}

export interface SettlementSummary {
  rows: SettlementRow[];
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  scheduledNet: number;
  paidNet: number;
  totalDeposit: number;
  totalOccupants: number;
}

@Injectable()
export class HostSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  async list(hostId: string): Promise<SettlementSummary> {
    const reservations = await this.prisma.reservation.findMany({
      where: { room: { hostId }, status: { in: SETTLEABLE } },
      include: {
        room: { select: { name: true, rentalUnit: true, capacity: true } },
        guest: { select: { name: true } },
        companions: {
          select: { userId: true, status: true },
        },
        contractChanges: {
          orderBy: { createdAt: "desc" },
          select: {
            type: true,
            status: true,
            additionalAmount: true,
            estimatedRefund: true,
            depositDeduction: true,
            finalRefund: true,
            paidAt: true,
          },
        },
      },
      orderBy: { checkIn: "desc" },
    });

    const rows: SettlementRow[] = reservations.map((reservation) => {
      const gross = proratedMonthlyAmount(
        reservation.monthlyRent,
        reservation.checkIn,
        reservation.checkOut,
      );
      const commission = Math.round(gross * COMMISSION_RATE);
      const net = gross - commission;
      const status: "SCHEDULED" | "PAID" =
        reservation.status === ReservationStatus.COMPLETED ||
        reservation.status === ReservationStatus.EARLY_CHECKOUT_APPROVED
          ? "PAID"
          : "SCHEDULED";

      const acceptedCompanionIds = new Set(
        reservation.companions
          .filter((companion) => companion.status === "ACCEPTED")
          .map((companion) => companion.userId),
      );
      const legacyAccepted =
        reservation.companionId &&
        reservation.companionStatus === "ACCEPTED" &&
        !acceptedCompanionIds.has(reservation.companionId)
          ? 1
          : 0;
      const occupants =
        reservation.bookingMode === BookingMode.BED ||
        reservation.bookingMode === BookingMode.WHOLE_ROOM
          ? Math.max(1, reservation.reservedSpots)
          : 1 + acceptedCompanionIds.size + legacyAccepted;

      const latestChange = reservation.contractChanges[0] ?? null;
      const extensionPaid = reservation.contractChanges
        .filter(
          (change) =>
            change.type === "EXTENSION" &&
            change.paidAt != null &&
            (change.status === "APPROVED" ||
              change.status === "COMPLETED"),
        )
        .reduce((total, change) => total + change.additionalAmount, 0);

      return {
        reservationId: reservation.id,
        roomName: reservation.room.name.trim(),
        guestName: reservation.guest?.name ?? "게스트",
        checkIn: reservation.checkIn.toISOString().slice(0, 10),
        checkOut: reservation.checkOut.toISOString().slice(0, 10),
        months: reservation.months,
        occupants,
        bookingMode: reservation.bookingMode,
        reservedSpots: Math.max(1, reservation.reservedSpots),
        monthlyRent: reservation.monthlyRent,
        deposit: reservation.deposit,
        gross,
        commission,
        net,
        extensionPaid,
        estimatedRefund: latestChange?.estimatedRefund ?? 0,
        depositDeduction: latestChange?.depositDeduction ?? 0,
        finalRefund: latestChange?.finalRefund ?? null,
        changeType: latestChange?.type ?? null,
        changeStatus: latestChange?.status ?? null,
        status,
      };
    });

    const sum = (pick: (row: SettlementRow) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);
    const today = new Date().toISOString().slice(0, 10);
    const active = rows.filter(
      (row) => row.status === "SCHEDULED" && row.checkIn <= today && row.checkOut > today,
    );

    return {
      rows,
      totalGross: sum((row) => row.gross),
      totalCommission: sum((row) => row.commission),
      totalNet: sum((row) => row.net),
      scheduledNet: rows
        .filter((row) => row.status === "SCHEDULED")
        .reduce((total, row) => total + row.net, 0),
      paidNet: rows
        .filter((row) => row.status === "PAID")
        .reduce((total, row) => total + row.net, 0),
      totalDeposit: active.reduce((total, row) => total + row.deposit, 0),
      totalOccupants: active.reduce((total, row) => total + row.occupants, 0),
    };
  }
}

@Controller("host/settlements")
@UseGuards(JwtAuthGuard)
export class HostSettlementController {
  constructor(private readonly svc: HostSettlementService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.id);
  }
}

@Module({
  controllers: [HostSettlementController],
  providers: [HostSettlementService],
})
export class HostSettlementModule {}

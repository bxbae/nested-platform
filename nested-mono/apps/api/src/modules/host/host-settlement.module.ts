import {
  Controller,
  Get,
  UseGuards,
  Req,
  Injectable,
  Module,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { ReservationStatus } from "@prisma/client";

// Platform commission rate on host earnings (mirrors SERVICE_FEE_RATE = 5%).
const COMMISSION_RATE = 0.05;

// Only reservations that represent real, owed income are settled.
const SETTLEABLE: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
  ReservationStatus.EARLY_CHECKOUT_APPROVED,
];

export interface SettlementRow {
  reservationId: string;
  roomName: string;
  guestName: string;
  checkIn: string; // ISO date
  checkOut: string; // ISO date
  months: number;
  occupants: number; // 1, or 2 when a companion joined the booking
  monthlyRent: number;
  deposit: number; // refundable — not part of host earnings
  gross: number; // monthlyRent * months
  commission: number; // platform fee
  net: number; // host take-home
  status: "SCHEDULED" | "PAID"; // COMPLETED → PAID, otherwise SCHEDULED
}

export interface SettlementSummary {
  rows: SettlementRow[];
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  scheduledNet: number; // sum of net for not-yet-paid rows
  paidNet: number; // sum of net already paid (COMPLETED)
  totalDeposit: number; // deposits currently held (active stays only)
  totalOccupants: number; // people currently living in (active stays only)
}

@Injectable()
export class HostSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  // Settlement is computed on demand from the host's settleable reservations —
  // no Settlement rows need to pre-exist. gross = monthlyRent × months,
  // commission = 5% of gross, net = gross − commission. A COMPLETED stay counts
  // as already paid out; others are scheduled.
  async list(hostId: string): Promise<SettlementSummary> {
    const reservations = await this.prisma.reservation.findMany({
      where: { room: { hostId }, status: { in: SETTLEABLE } },
      include: {
        room: { select: { name: true } },
        guest: { select: { name: true } },
      },
      orderBy: { checkIn: "desc" },
    });

    const rows: SettlementRow[] = reservations.map((r) => {
      const gross = r.monthlyRent * r.months;
      const commission = Math.round(gross * COMMISSION_RATE);
      const net = gross - commission;
      const status: "SCHEDULED" | "PAID" = r.status === "COMPLETED" ? "PAID" : "SCHEDULED";
      // A booking holds 1 person, or 2 when a companion was accepted.
      const occupants = r.companionId ? 2 : 1;
      return {
        reservationId: r.id,
        roomName: r.room.name.trim(),
        guestName: r.guest?.name ?? "게스트",
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        months: r.months,
        occupants,
        monthlyRent: r.monthlyRent,
        deposit: r.deposit,
        gross,
        commission,
        net,
        status,
      };
    });

    const sum = (pick: (row: SettlementRow) => number) =>
      rows.reduce((acc, row) => acc + pick(row), 0);

    // Deposits held and people living in count only *active* stays — a finished
    // or future booking shouldn't inflate "현재 입주 인원".
    const today = new Date().toISOString().slice(0, 10);
    const active = rows.filter(
      (r) => r.status === "SCHEDULED" && r.checkIn <= today && r.checkOut > today
    );

    return {
      rows,
      totalGross: sum((r) => r.gross),
      totalCommission: sum((r) => r.commission),
      totalNet: sum((r) => r.net),
      scheduledNet: rows.filter((r) => r.status === "SCHEDULED").reduce((a, r) => a + r.net, 0),
      paidNet: rows.filter((r) => r.status === "PAID").reduce((a, r) => a + r.net, 0),
      totalDeposit: active.reduce((a, r) => a + r.deposit, 0),
      totalOccupants: active.reduce((a, r) => a + r.occupants, 0),
    };
  }
}

// 호스트 정산 내역 (예약 기반 계산)
@Controller("host/settlements")
@UseGuards(JwtAuthGuard)
export class HostSettlementController {
  constructor(private readonly svc: HostSettlementService) {}

  // GET /host/settlements — settlement breakdown + totals for the host.
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

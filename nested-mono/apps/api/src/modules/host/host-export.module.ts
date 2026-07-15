import {
  Controller,
  Get,
  Res,
  Req,
  UseGuards,
  Injectable,
  Module,
} from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { ReservationStatus } from "@prisma/client";

const EARNING: ReservationStatus[] = [ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED];

// Korean status labels for the sheet.
const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "결제 대기",
  CONFIRMED: "예약 확정",
  COMPLETED: "이용 완료",
  NO_SHOW: "노쇼",
  CANCELLED_BY_GUEST: "게스트 취소",
  CANCELLED_BY_HOST: "호스트 취소",
};

// Build one CSV cell — quote it and escape embedded quotes so commas/newlines
// inside a value (e.g. a room name) don't break the columns.
function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const r of rows) lines.push(r.map(cell).join(","));
  // Prepend a UTF-8 BOM so Excel opens Korean text without mojibake.
  return "\uFEFF" + lines.join("\r\n");
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class HostExportService {
  constructor(private readonly prisma: PrismaService) {}

  // 수익 내역: one row per earning reservation (confirmed/completed).
  async revenueCsv(hostId: string): Promise<string> {
    const rows = await this.prisma.reservation.findMany({
      where: { room: { hostId }, status: { in: EARNING } },
      include: {
        room: { select: { name: true, region: true } },
        guest: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["예약일", "숙소", "지역", "입주자", "입주일", "개월수", "월세", "총액", "상태"];
    const data = rows.map((r) => [
      ymd(r.createdAt),
      r.room.name.trim(),
      r.room.region,
      r.guest?.name ?? "",
      ymd(r.checkIn),
      r.months,
      r.monthlyRent,
      r.monthlyRent * r.months,
      STATUS_LABEL[r.status] ?? r.status,
    ]);
    return toCsv(headers, data);
  }

  // 입주자 내역: one row per reservation (all statuses), tenant-focused.
  async tenantsCsv(hostId: string): Promise<string> {
    const rows = await this.prisma.reservation.findMany({
      where: { room: { hostId } },
      include: {
        room: { select: { name: true, region: true } },
        guest: { select: { name: true, email: true } },
      },
      orderBy: { checkIn: "desc" },
    });

    const headers = ["입주자", "이메일", "숙소", "지역", "입주일", "퇴실일", "개월수", "상태"];
    const data = rows.map((r) => [
      r.guest?.name ?? "",
      r.guest?.email ?? "",
      r.room.name.trim(),
      r.room.region,
      ymd(r.checkIn),
      ymd(r.checkOut),
      r.months,
      STATUS_LABEL[r.status] ?? r.status,
    ]);
    return toCsv(headers, data);
  }
}

// 호스트 데이터 내보내기 (CSV) — Excel에서 바로 열림
@Controller("host/export")
@UseGuards(JwtAuthGuard)
export class HostExportController {
  constructor(private readonly svc: HostExportService) {}

  @Get("revenue.csv")
  async revenue(@Req() req: any, @Res() res: Response) {
    const csv = await this.svc.revenueCsv(req.user.id);
    this.sendCsv(res, "revenue", csv);
  }

  @Get("tenants.csv")
  async tenants(@Req() req: any, @Res() res: Response) {
    const csv = await this.svc.tenantsCsv(req.user.id);
    this.sendCsv(res, "tenants", csv);
  }

  private sendCsv(res: Response, name: string, csv: string) {
    const filename = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  }
}

@Module({
  controllers: [HostExportController],
  providers: [HostExportService],
})
export class HostExportModule {}

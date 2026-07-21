import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { computePrice, couponDiscount, type PriceBreakdown } from "./pricing";
import type {
  ReservationRepo,
  PaymentGateway,
  ReservationRecord,
  ReservationStatus,
  CouponRecord,
} from "./ports";
import type {
  QuoteDto,
  CreateReservationDto,
  ConfirmPaymentDto,
} from "./dto/reservation.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";

// DI tokens for the ports (bound to Prisma/PSP impls in the module).
export const RESERVATION_REPO = Symbol("RESERVATION_REPO");
export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

@Injectable()
export class ReservationsService {
  constructor(
    @Inject(RESERVATION_REPO)
    private readonly repo: ReservationRepo,

    @Inject(PAYMENT_GATEWAY)
    private readonly payments: PaymentGateway,

    @Optional()
    private readonly prisma?: PrismaService,

    @Optional()
    private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  // ── QUOTE ── price preview. No writes, no side effects.
  async quote(dto: QuoteDto): Promise<PriceBreakdown & { checkOut: Date }> {
    const room = await this.repo.findRoom(dto.roomId);
    if (!room)
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });

    if (dto.months < room.minStayMonths) {
      throw new UnprocessableEntityException({
        code: "MIN_STAY",
        message: `최소 ${room.minStayMonths}개월 이상 예약해야 합니다.`,
      });
    }
    if (dto.checkIn < stripTime(room.availableFrom)) {
      throw new UnprocessableEntityException({
        code: "NOT_AVAILABLE_YET",
        message: "선택한 날짜에는 아직 입주할 수 없습니다.",
      });
    }

    // Same overlap check as create(). Without it a quote could report the dates
    // as bookable and then the reservation would fail with 409 — the user saw
    // "예약 가능한 날짜입니다" followed by "이미 예약되었습니다".
    const checkOut = addMonths(dto.checkIn, dto.months);
    const overlaps = await this.repo.findOverlapping(
      dto.roomId,
      dto.checkIn,
      checkOut,
    );
    if (overlaps.length > 0) {
      throw new ConflictException({
        code: "DATES_UNAVAILABLE",
        message: "선택한 기간은 이미 예약되었습니다.",
      });
    }

    const discount = await this.resolveDiscount(
      dto.couponCode,
      room.monthlyRent,
    );
    const breakdown = computePrice({
      monthlyRent: room.monthlyRent,
      deposit: room.deposit,
      cleaningFee: room.cleaningFee,
      maintenanceFee: room.maintenanceFee,
      months: dto.months,
      discount,
    });
    return { ...breakdown, checkOut };
  }

  // ── CREATE ── holds inventory as PENDING_PAYMENT. Rejects overlaps (409).
  async create(
    dto: CreateReservationDto,
    guestId: string,
  ): Promise<ReservationRecord> {
    const room = await this.repo.findRoom(dto.roomId);
    if (!room)
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });

    if (dto.companionId === guestId) {
      throw new BadRequestException({
        code: "INVALID_COMPANION",
        message: "자기 자신을 룸메이트로 지정할 수 없습니다.",
      });
    }

    const checkOut = addMonths(dto.checkIn, dto.months);

    // Pre-check overlap (the repo re-checks under a serializable lock on insert).
    const overlaps = await this.repo.findOverlapping(
      dto.roomId,
      dto.checkIn,
      checkOut,
    );
    if (overlaps.length > 0) {
      throw new ConflictException({
        code: "DATES_UNAVAILABLE",
        message: "선택한 기간은 이미 예약되었습니다.",
      });
    }

    const discount = await this.resolveDiscount(
      dto.couponCode,
      room.monthlyRent,
    );
    const price = computePrice({
      monthlyRent: room.monthlyRent,
      deposit: room.deposit,
      cleaningFee: room.cleaningFee,
      maintenanceFee: room.maintenanceFee,
      months: dto.months,
      discount,
    });

    // Price is computed server-side only; client never supplies the total.
    try {
      return await this.repo.createHold({
        roomId: room.id,
        guestId,
        // 공동 예약: 상대를 지정하면 초대 대기 상태로 시작한다.
        companionId: dto.companionId ?? null,
        companionStatus: dto.companionId ? "PENDING" : null,
        companionRespondedAt: null,
        checkIn: dto.checkIn,
        checkOut,
        months: dto.months,
        status: "PENDING_PAYMENT",
        monthlyRent: price.monthlyRent,
        deposit: price.deposit,
        cleaningFee: price.cleaningFee,
        maintenanceFee: price.maintenanceFee,
        serviceFee: price.serviceFee,
        discount: price.discount,
        totalDueNow: price.dueNow,
      });
    } catch (e) {
      // P2003 = foreign key violation: the guest id in the token no longer
      // maps to a User row (e.g. account removed). Ask them to sign in again
      // rather than surfacing a raw 500.
      if (
        e &&
        typeof e === "object" &&
        (e as { code?: string }).code === "P2003"
      ) {
        throw new UnauthorizedException({
          code: "ACCOUNT_NOT_FOUND",
          message: "세션이 만료되었어요. 다시 로그인한 뒤 예약해주세요.",
        });
      }
      throw e;
    }
  }

  // ── CONFIRM PAYMENT ── verify with PSP that `dueNow` was actually paid.
  async confirmPayment(
    dto: ConfirmPaymentDto,
    guestId: string,
  ): Promise<ReservationRecord> {
    const reservation = await this.repo.findById(dto.reservationId);
    if (!reservation)
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    if (reservation.guestId !== guestId) {
      throw new BadRequestException({
        code: "FORBIDDEN",
        message: "본인의 예약만 결제할 수 있습니다.",
      });
    }
    if (reservation.status !== "PENDING_PAYMENT") {
      // idempotent: already confirmed → return as-is; otherwise it's a bad state
      if (reservation.status === "CONFIRMED") return reservation;
      throw new ConflictException({
        code: "BAD_STATE",
        message: "결제할 수 없는 예약 상태입니다.",
      });
    }

    // The amount we expect is the authoritative server figure, not the client's.
    if (dto.amount !== reservation.totalDueNow) {
      throw new UnprocessableEntityException({
        code: "AMOUNT_MISMATCH",
        message: "결제 금액이 예약 금액과 일치하지 않습니다.",
      });
    }

    const verification = await this.payments.verify({
      provider: dto.provider,
      paymentKey: dto.paymentKey,
      expectedAmount: reservation.totalDueNow,
    });

    if (
      !verification.ok ||
      verification.paidAmount !== reservation.totalDueNow
    ) {
      throw new UnprocessableEntityException({
        code: "PAYMENT_UNVERIFIED",
        message: verification.reason ?? "결제 검증에 실패했습니다.",
      });
    }

    const room = await this.repo.findRoom(reservation.roomId);

    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });
    }

    const confirmedReservation = await this.repo.updateStatus(
      reservation.id,
      "CONFIRMED",
    );

    if (room.hostId !== guestId && this.prisma && this.notificationsGateway) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: room.hostId,
          type: "RESERVATION_REQUESTED",
          title: "새 예약이 들어왔어요",
          body: `"${room.name}" 숙소에 새로운 예약이 접수되었습니다.`,
          targetUrl: "/host/reservations",
        },
      });

      this.notificationsGateway.emitToUser(room.hostId, notification);
    }

    return confirmedReservation;
  }

  // ── helpers ──
  async getById(id: string): Promise<ReservationRecord> {
    const r = await this.repo.findById(id);
    if (!r)
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    return r;
  }

  // Cancel a reservation (guest-initiated). Guests can only cancel their own.
  // 동반자 초대 수락/거절. 초대받은 본인만 응답할 수 있고, 한 번 응답하면
  // 번복할 수 없다 — 예약자가 그 결과를 보고 다음 결정을 하기 때문이다.
  async respondToCompanionInvite(
    id: string,
    userId: string,
    decision: "accept" | "decline",
  ): Promise<ReservationRecord> {
    const r = await this.repo.findById(id);
    if (!r) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    }
    if (r.companionId !== userId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "초대받은 사람만 응답할 수 있습니다.",
      });
    }
    if (r.companionStatus !== "PENDING") {
      throw new BadRequestException({
        code: "ALREADY_RESPONDED",
        message: "이미 응답한 초대입니다.",
      });
    }
    return this.repo.updateCompanionStatus(
      id,
      decision === "accept" ? "ACCEPTED" : "DECLINED",
    );
  }

  // 내가 동반자로 초대된 예약 목록
  listCompanionInvites(userId: string) {
    return this.repo.listByCompanion(userId);
  }

  async cancel(id: string, guestId: string): Promise<ReservationRecord> {
    const reservation = await this.repo.findById(id);

    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    }

    if (reservation.guestId !== guestId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "본인의 예약만 취소할 수 있습니다.",
      });
    }

    // 같은 취소 요청이 반복되어도 알림을 중복 생성하지 않는다.
    if (reservation.status === "CANCELLED_BY_GUEST") {
      return reservation;
    }

    const room = await this.repo.findRoom(reservation.roomId);

    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });
    }

    const cancelledReservation = await this.repo.updateStatus(
      id,
      "CANCELLED_BY_GUEST",
    );

    if (room.hostId !== guestId && this.prisma && this.notificationsGateway) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: room.hostId,
          type: "RESERVATION_CANCELLED",
          title: "예약이 취소되었어요",
          body: `"${room.name}" 숙소의 예약이 게스트에 의해 취소되었습니다.`,
          targetUrl: "/host/reservations",
        },
      });

      this.notificationsGateway.emitToUser(room.hostId, notification);
    }

    return cancelledReservation;
  }

  // Guest requests an early checkout on a CONFIRMED reservation. This doesn't
  // end the stay yet — it flips to EARLY_CHECKOUT_REQUESTED and waits for the
  // host to approve or reject.
  async requestEarlyCheckout(
    id: string,
    guestId: string,
  ): Promise<ReservationRecord> {
    const reservation = await this.repo.findById(id);

    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    }

    if (reservation.guestId !== guestId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "본인의 예약만 조기 퇴실을 요청할 수 있습니다.",
      });
    }

    // 같은 요청이 다시 들어와도 알림을 중복 생성하지 않는다.
    if (reservation.status === "EARLY_CHECKOUT_REQUESTED") {
      return reservation;
    }

    if (reservation.status !== "CONFIRMED") {
      throw new BadRequestException({
        code: "NOT_CONFIRMED",
        message: "확정된 예약만 조기 퇴실을 요청할 수 있습니다.",
      });
    }

    const room = await this.repo.findRoom(reservation.roomId);

    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });
    }

    const updatedReservation = await this.repo.updateStatus(
      id,
      "EARLY_CHECKOUT_REQUESTED",
    );

    if (room.hostId !== guestId && this.prisma && this.notificationsGateway) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: room.hostId,
          type: "EARLY_CHECKOUT_REQUESTED",
          title: "조기 퇴실 요청이 들어왔어요",
          body: `"${room.name}" 숙소의 게스트가 조기 퇴실을 요청했습니다.`,
          targetUrl: "/host/reservations",
        },
      });

      this.notificationsGateway.emitToUser(room.hostId, notification);
    }

    return updatedReservation;
  }

  // Host approves or rejects an early-checkout request.
  // Approve → EARLY_CHECKOUT_APPROVED (the stay is treated as ending early).
  // Reject  → back to CONFIRMED.
  async decideEarlyCheckout(
    id: string,
    hostId: string,
    decision: "approve" | "reject",
  ): Promise<ReservationRecord> {
    const r = await this.repo.findById(id);
    if (!r)
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    const ownerId = await this.repo.findRoomHostId(id);
    if (ownerId !== hostId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소의 예약만 처리할 수 있습니다.",
      });
    }
    if (r.status !== "EARLY_CHECKOUT_REQUESTED") {
      throw new BadRequestException({
        code: "NOT_REQUESTED",
        message: "조기 퇴실이 요청된 예약만 처리할 수 있습니다.",
      });
    }
    return this.repo.updateStatus(
      id,
      decision === "approve" ? "EARLY_CHECKOUT_APPROVED" : "CONFIRMED",
    );
  }

  // ── 계약 연장 ──────────────────────────────────────────────
  // Guest asks to stay longer on a CONFIRMED reservation. Mirrors the
  // early-checkout flow: request → host approves/rejects.
  async requestExtension(
    id: string,
    guestId: string,
    months: number,
  ): Promise<ReservationRecord> {
    const r = await this.repo.findById(id);
    if (!r)
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    if (r.guestId !== guestId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "본인 예약만 요청할 수 있습니다.",
      });
    }
    if (r.status !== "CONFIRMED") {
      throw new BadRequestException({
        code: "NOT_CONFIRMED",
        message: "이용 중인(확정) 예약만 연장을 요청할 수 있습니다.",
      });
    }
    if (months < 1 || months > 24) {
      throw new BadRequestException({
        code: "INVALID_MONTHS",
        message: "연장 개월 수는 1~24개월 사이여야 합니다.",
      });
    }
    return this.repo.requestExtension(id, months);
  }

  // Host approves (extend checkOut) or rejects (back to CONFIRMED).
  async decideExtension(
    id: string,
    hostId: string,
    decision: "approve" | "reject",
  ): Promise<ReservationRecord> {
    const r = await this.repo.findById(id);
    if (!r)
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    const ownerId = await this.repo.findRoomHostId(id);
    if (ownerId !== hostId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소의 예약만 처리할 수 있습니다.",
      });
    }
    if (r.status !== "EXTENSION_REQUESTED") {
      throw new BadRequestException({
        code: "NOT_REQUESTED",
        message: "연장이 요청된 예약만 처리할 수 있습니다.",
      });
    }
    if (decision === "reject") return this.repo.clearExtension(id);

    const months = r.extensionMonths ?? 0;
    if (months < 1) {
      throw new BadRequestException({
        code: "INVALID_MONTHS",
        message: "요청된 연장 개월 수가 올바르지 않습니다.",
      });
    }
    return this.repo.applyExtension(id, months);
  }

  // All reservations for the logged-in guest (my trips).
  async listMine(guestId: string) {
    return this.repo.listByGuest(guestId);
  }

  // All reservations across every room this host owns (host 예약 관리 inbox).
  async listForHost(hostId: string) {
    return this.repo.listByHost(hostId);
  }

  // Host changes a reservation's status. Only the host that owns the room may
  // do this, and only to a status a host is allowed to set — a guest-cancel or
  // an arbitrary value must not be settable here.
  async updateStatusAsHost(
    id: string,
    hostId: string,
    status: ReservationStatus,
  ): Promise<ReservationRecord> {
    const allowed: ReservationStatus[] = [
      "CONFIRMED",
      "CANCELLED_BY_HOST",
      "COMPLETED",
      "NO_SHOW",
    ];
    if (!allowed.includes(status)) {
      throw new BadRequestException({
        code: "INVALID_STATUS",
        message: "호스트가 설정할 수 없는 상태입니다.",
      });
    }
    const ownerId = await this.repo.findRoomHostId(id);
    if (ownerId === null) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    }
    if (ownerId !== hostId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소의 예약만 처리할 수 있습니다.",
      });
    }
    return this.repo.updateStatus(id, status);
  }

  private async resolveDiscount(
    code: string | undefined,
    spend: number,
  ): Promise<number> {
    if (!code) return 0;
    const coupon = await this.repo.findCouponByCode(code);
    if (!coupon)
      throw new UnprocessableEntityException({
        code: "COUPON_INVALID",
        message: "쿠폰이 유효하지 않습니다.",
      });
    assertCouponUsable(coupon);
    return couponDiscount(coupon, spend);
  }
}

function assertCouponUsable(c: CouponRecord) {
  const now = new Date();
  if (now < c.validFrom || now > c.validTo) {
    throw new UnprocessableEntityException({
      code: "COUPON_EXPIRED",
      message: "쿠폰 사용 기간이 아닙니다.",
    });
  }
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) {
    throw new UnprocessableEntityException({
      code: "COUPON_EXHAUSTED",
      message: "쿠폰이 모두 소진되었습니다.",
    });
  }
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}
function stripTime(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

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
import {
  addCalendarMonths,
  computePrice,
  couponDiscount,
  fullCalendarMonthsBetween,
  stayCharge,
  SERVICE_FEE_RATE,
  MAX_STAY_MONTHS,
  type PriceBreakdown,
} from "./pricing";
import type {
  ReservationRepo,
  PaymentGateway,
  ReservationRecord,
  ReservationStatus,
  CouponRecord,
  RoomRecord,
  BookingMode,
} from "./ports";
import type {
  QuoteDto,
  CreateReservationDto,
  ConfirmPaymentDto,
  CompanionPaymentDto,
  ContractChangeQuoteDto,
  ContractChangePaymentDto,
} from "./dto/reservation.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { calculateRangeInventory } from "./reservation-inventory.util";
import {
  companionInviteExpiresAt,
  companionPaymentDeadline,
  daysUntilCheckIn,
  expireCompanionInvites,
} from "./companion-invite-expiration";

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
  async quote(
    dto: QuoteDto,
  ): Promise<
    PriceBreakdown & {
      checkOut: Date;
      bookingMode: BookingMode;
      reservedSpots: number;
      remainingSpots: number | null;
    }
  > {
    if (this.prisma) await expireCompanionInvites(this.prisma);
    const room = await this.repo.findRoom(dto.roomId);
    if (!room)
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });

    const stay = this.resolveStayWindow(dto.checkIn, dto.checkOut, dto.months);
    this.assertStayRules(room, dto.checkIn, stay.checkOut);

    const booking = this.normalizeBooking(room, dto.bookingMode, dto.reservedSpots);
    const checkOut = stay.checkOut;
    const [overlaps, blockedDates] = await Promise.all([
      this.repo.findOverlapping(dto.roomId, dto.checkIn, checkOut),
      this.repo.findBlockedDates(dto.roomId, dto.checkIn, checkOut),
    ]);
    this.assertNoHostBlocks(blockedDates);
    const remainingSpots = this.assertInventoryAvailable(
      room,
      overlaps,
      booking,
      dto.checkIn,
      checkOut,
    );

    const companionCount = Math.max(0, dto.companionCount ?? 0);
    if (
      companionCount > 0 &&
      (room.rentalUnit !== "BED" ||
        booking.bookingMode !== "BED" ||
        companionCount !== booking.reservedSpots - 1)
    ) {
      throw new BadRequestException({
        code: "COMPANION_COUNT_MISMATCH",
        message:
          "개별 결제 친구 수는 다인실 선택 자리 수보다 1명 적어야 합니다.",
      });
    }
    if (companionCount > 0 && daysUntilCheckIn(dto.checkIn) <= 0) {
      throw new BadRequestException({
        code: "SAME_DAY_COMPANION_INVITE_NOT_ALLOWED",
        message: "입주 당일에는 룸메이트 초대를 보낼 수 없습니다.",
      });
    }
    const units =
      room.rentalUnit === "BED"
        ? Math.max(1, booking.reservedSpots - companionCount)
        : 1;
    const pricingInput = this.scaledPricing(room, units);
    const coupon = await this.resolveCoupon(
      dto.couponCode,
      pricingInput.monthlyRent,
    );
    const breakdown = computePrice({
      ...pricingInput,
      checkIn: dto.checkIn,
      checkOut,
      discount: coupon.discount,
    });
    return {
      ...breakdown,
      checkOut,
      bookingMode: booking.bookingMode,
      reservedSpots: booking.reservedSpots,
      remainingSpots,
    };
  }

  // ── CREATE ── holds inventory as PENDING_PAYMENT.
  async create(
    dto: CreateReservationDto,
    guestId: string,
  ): Promise<ReservationRecord> {
    if (this.prisma) await expireCompanionInvites(this.prisma);
    const room = await this.repo.findRoom(dto.roomId);
    if (!room)
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });

    if (room.hostId === guestId) {
      throw new BadRequestException({
        code: "SELF_BOOKING_NOT_ALLOWED",
        message: "본인이 등록한 숙소는 예약할 수 없습니다.",
      });
    }

    const individualCompanionIds = [
      ...new Set(dto.companionIds ?? []),
    ];
    // companionId 는 대표자 전액 결제 방식의 기존 클라이언트 호환 필드다.
    // 신규 화면은 companionIds 를 사용하며 다인실 1자리씩 개별 결제한다.
    const legacyCompanionId =
      individualCompanionIds.length === 0 ? (dto.companionId ?? null) : null;
    const companionIds = [
      ...new Set([
        ...individualCompanionIds,
        ...(legacyCompanionId ? [legacyCompanionId] : []),
      ]),
    ];
    const usesIndividualCompanionPayment =
      individualCompanionIds.length > 0;

    if (companionIds.includes(guestId)) {
      throw new BadRequestException({
        code: "INVALID_COMPANION",
        message: "자기 자신을 룸메이트로 지정할 수 없습니다.",
      });
    }
    if (companionIds.includes(room.hostId)) {
      throw new BadRequestException({
        code: "INVALID_COMPANION",
        message: "숙소 호스트를 동반 입주자로 지정할 수 없습니다.",
      });
    }

    const stay = this.resolveStayWindow(dto.checkIn, dto.checkOut, dto.months);
    this.assertStayRules(room, dto.checkIn, stay.checkOut);
    const booking = this.normalizeBooking(
      room,
      dto.bookingMode,
      dto.reservedSpots,
    );

    if (
      usesIndividualCompanionPayment &&
      (room.rentalUnit !== "BED" || booking.bookingMode !== "BED")
    ) {
      throw new BadRequestException({
        code: "COMPANION_REQUIRES_SHARED_ROOM",
        message:
          "개별 결제 룸메이트 초대는 공유형 다인실의 여러 자리 예약에서만 사용할 수 있습니다.",
      });
    }
    if (room.rentalUnit === "BED" && companionIds.length > 0 && booking.reservedSpots < 2) {
      throw new BadRequestException({
        code: "COMPANION_REQUIRES_TWO_SPOTS",
        message: "친구와 함께 예약하려면 두 자리 이상을 선택해야 합니다.",
      });
    }
    if (
      room.rentalUnit === "BED" &&
      companionIds.length > Math.max(0, booking.reservedSpots - 1)
    ) {
      throw new BadRequestException({
        code: "TOO_MANY_COMPANIONS",
        message: `선택한 ${booking.reservedSpots}자리에는 친구를 최대 ${Math.max(0, booking.reservedSpots - 1)}명까지 초대할 수 있습니다.`,
      });
    }
    if (
      usesIndividualCompanionPayment &&
      individualCompanionIds.length !== booking.reservedSpots - 1
    ) {
      throw new BadRequestException({
        code: "COMPANION_COUNT_MISMATCH",
        message:
          "대표 예약자는 본인 1자리만 결제합니다. 선택한 전체 자리 수보다 1명 적게 친구를 선택해주세요.",
      });
    }
    if (usesIndividualCompanionPayment && daysUntilCheckIn(dto.checkIn) <= 0) {
      throw new BadRequestException({
        code: "SAME_DAY_COMPANION_INVITE_NOT_ALLOWED",
        message:
          "입주 당일에는 룸메이트 초대를 보낼 수 없습니다. 호스트에게 직접 문의해주세요.",
      });
    }
    if (companionIds.length > 0) {
      const friendIds = await this.repo.findFriendIds(guestId, companionIds);
      if (friendIds.length !== companionIds.length) {
        throw new ForbiddenException({
          code: "COMPANION_NOT_FRIEND",
          message: "현재 친구 목록에 있는 사용자만 동반 입주자로 선택할 수 있습니다.",
        });
      }
    }

    const checkOut = stay.checkOut;
    const [overlaps, blockedDates] = await Promise.all([
      this.repo.findOverlapping(dto.roomId, dto.checkIn, checkOut),
      this.repo.findBlockedDates(dto.roomId, dto.checkIn, checkOut),
    ]);
    this.assertNoHostBlocks(blockedDates);
    this.assertInventoryAvailable(
      room,
      overlaps,
      booking,
      dto.checkIn,
      checkOut,
    );

    // 친구 초대가 있으면 대표자는 본인 1자리만 결제한다.
    // 예약 행의 reservedSpots는 초대 자리까지 임시 확보하는 재고 값이다.
    const units =
      room.rentalUnit === "BED"
        ? usesIndividualCompanionPayment
          ? 1
          : booking.reservedSpots
        : 1;
    const pricingInput = this.scaledPricing(room, units);
    const coupon = await this.resolveCoupon(
      dto.couponCode,
      pricingInput.monthlyRent,
      guestId,
    );
    const price = computePrice({
      ...pricingInput,
      checkIn: dto.checkIn,
      checkOut,
      discount: coupon.discount,
    });

    try {
      const firstCompanionId = companionIds[0] ?? null;
      const inviteExpiresAt = usesIndividualCompanionPayment
        ? companionInviteExpiresAt(dto.checkIn)
        : null;
      const hold = await this.repo.createHold({
        roomId: room.id,
        guestId,
        companionIds,
        companionInviteExpiresAt: inviteExpiresAt,
        companionPrice: usesIndividualCompanionPayment
          ? {
              monthlyRent: price.monthlyRent,
              deposit: price.deposit,
              cleaningFee: price.cleaningFee,
              maintenanceFee: price.maintenanceFee,
              serviceFee: price.serviceFee,
              discount: 0,
              totalDueNow:
                price.monthlyRent +
                price.deposit +
                price.cleaningFee +
                price.maintenanceFee +
                price.serviceFee,
            }
          : undefined,
        companionRequiresIndividualPayment:
          usesIndividualCompanionPayment,
        companionId: firstCompanionId,
        companionStatus: firstCompanionId ? "PENDING" : null,
        companionRespondedAt: null,
        checkIn: dto.checkIn,
        checkOut,
        originalCheckOut: checkOut,
        actualCheckOut: null,
        months: stay.fullMonths,
        status: "PENDING_PAYMENT",
        bookingMode: booking.bookingMode,
        reservedSpots: booking.reservedSpots,
        monthlyRent: price.monthlyRent,
        deposit: price.deposit,
        cleaningFee: price.cleaningFee,
        maintenanceFee: price.maintenanceFee,
        serviceFee: price.serviceFee,
        discount: price.discount,
        totalDueNow: price.dueNow,
        couponId: coupon.couponId,
      });

      if (this.prisma && companionIds.length > 0) {
        await this.prisma.notification.createMany({
          data: companionIds.map((userId) => ({
            userId,
            type: "RESERVATION" as const,
            title: "룸메이트 초대가 도착했어요",
            body: usesIndividualCompanionPayment
              ? `"${room.name}"에서 본인 1자리 결제가 필요한 초대가 왔습니다.`
              : `"${room.name}" 룸메이트 초대가 왔습니다.`,
            targetUrl: "/me/trips",
          })),
        });
      }

      return hold;
    } catch (e) {
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
    if (this.prisma) await expireCompanionInvites(this.prisma);
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

    const confirmedReservation = await this.confirmReservationAfterPayment(
      reservation,
      guestId,
    );

    // 결제 검증(verify)까지 통과했는데도 Payment 테이블엔 아무것도 안 남기고
    // Reservation.status만 CONFIRMED로 바꾸고 끝났었다 — 관리자 매출 관리
    // 화면(총 거래액/수수료/환불액)이 전부 이 테이블만 보고 계산하는데,
    // 쓰는 코드가 아예 없어서 실제 확정된 예약이 있어도 항상 0으로 나왔다.
    // reservationId가 @unique라 이미 있으면(멱등 재호출) 에러 없이 건너뜀.
    if (this.prisma) {
      const existingPayment = await this.prisma.payment.findUnique({
        where: { reservationId: reservation.id },
        select: { id: true },
      });
      if (!existingPayment) {
        await this.prisma.payment.create({
          data: {
            reservationId: reservation.id,
            provider: dto.provider,
            providerTxnId: dto.paymentKey,
            amount: reservation.totalDueNow,
            status: "PAID",
          },
        });
      }
    }

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

  // 동반자 초대 수락/거절. 대표 예약은 초대한 자리까지 임시 점유하고,
  // 거절·만료 시 해당 1자리를 즉시 잔여 자리로 복구한다.
  async respondToCompanionInvite(
    id: string,
    userId: string,
    decision: "accept" | "decline",
  ) {
    // Unit tests and non-Prisma adapters keep the legacy in-memory response path.
    if (!this.prisma) {
      const reservation = await this.repo.findById(id);
      if (!reservation) {
        throw new NotFoundException({
          code: "RESERVATION_NOT_FOUND",
          message: "예약을 찾을 수 없습니다.",
        });
      }
      const companionStatus = await this.repo.findCompanionStatus(id, userId);
      if (!companionStatus) {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "초대받은 사람만 응답할 수 있습니다.",
        });
      }
      if (companionStatus !== "PENDING") {
        throw new BadRequestException({
          code: "ALREADY_RESPONDED",
          message: "이미 응답한 초대입니다.",
        });
      }
      return this.repo.updateCompanionStatus(
        id,
        userId,
        decision === "accept" ? "ACCEPTED" : "DECLINED",
      );
    }

    const prisma = this.requirePrisma();
    await expireCompanionInvites(prisma);

    return prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "Reservation" WHERE "id" = $1 FOR UPDATE',
        id,
      );

      const member = await tx.reservationCompanionMember.findUnique({
        where: {
          reservationId_userId: {
            reservationId: id,
            userId,
          },
        },
        include: {
          reservation: {
            include: {
              room: {
                select: {
                  id: true,
                  name: true,
                  hostId: true,
                },
              },
            },
          },
        },
      });

      if (!member) {
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "초대받은 사람만 응답할 수 있습니다.",
        });
      }
      if (member.status !== "PENDING") {
        throw new BadRequestException({
          code: "ALREADY_RESPONDED",
          message: "이미 응답했거나 만료된 초대입니다.",
        });
      }

      // 기존 초대는 대표자가 전체 금액을 결제한 흐름일 수 있다.
      // 마이그레이션 후에도 다시 결제시키지 않고 기존 수락/거절만 유지한다.
      if (!member.requiresIndividualPayment) {
        const respondedAt = new Date();
        const legacyStatus =
          decision === "accept" ? ("ACCEPTED" as const) : ("DECLINED" as const);

        await tx.reservationCompanionMember.update({
          where: { id: member.id },
          data: {
            status: legacyStatus,
            respondedAt,
          },
        });
        if (member.reservation.companionId === userId) {
          await tx.reservation.update({
            where: { id },
            data: {
              companionStatus: legacyStatus,
              companionRespondedAt: respondedAt,
            },
          });
        }

        return {
          status: legacyStatus,
          companionId: userId,
          companionStatus: legacyStatus,
          requiresIndividualPayment: false,
          paymentDeadline: null,
          totalDueNow: 0,
        };
      }

      if (member.reservation.status !== "CONFIRMED") {
        throw new ConflictException({
          code: "REPRESENTATIVE_PAYMENT_PENDING",
          message: "대표 예약자의 결제가 완료된 뒤 초대를 수락할 수 있습니다.",
        });
      }
      if (daysUntilCheckIn(member.reservation.checkIn) <= 0) {
        throw new BadRequestException({
          code: "SAME_DAY_COMPANION_INVITE_NOT_ALLOWED",
          message:
            "입주 당일에는 룸메이트 초대를 수락할 수 없습니다. 호스트에게 문의해주세요.",
        });
      }

      const respondedAt = new Date();

      if (decision === "decline") {
        await tx.reservationCompanionMember.update({
          where: { id: member.id },
          data: {
            status: "DECLINED",
            respondedAt,
          },
        });
        await tx.reservation.update({
          where: { id },
          data: {
            reservedSpots: Math.max(
              1,
              member.reservation.reservedSpots - 1,
            ),
            ...(member.reservation.companionId === userId
              ? {
                  companionStatus: "DECLINED",
                  companionRespondedAt: respondedAt,
                }
              : {}),
          },
        });
        await tx.notification.create({
          data: {
            userId: member.reservation.guestId,
            type: "RESERVATION",
            title: "룸메이트 초대가 거절되었어요",
            body: `"${member.reservation.room.name}" 초대 1건이 거절되어 자리가 다시 공개되었습니다.`,
            targetUrl: "/me/trips",
          },
        });
        return {
          status: "DECLINED" as const,
          companionId: userId,
          companionStatus: "DECLINED" as const,
          requiresIndividualPayment: true,
          paymentDeadline: null,
          totalDueNow: member.totalDueNow,
        };
      }

      const paymentDeadline = companionPaymentDeadline(
        member.reservation.checkIn,
        respondedAt,
      );
      await tx.reservationCompanionMember.update({
        where: { id: member.id },
        data: {
          status: "PAYMENT_PENDING",
          respondedAt,
          paymentDeadline,
        },
      });
      if (member.reservation.companionId === userId) {
        await tx.reservation.update({
          where: { id },
          data: {
            companionStatus: "PAYMENT_PENDING",
            companionRespondedAt: respondedAt,
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: member.reservation.guestId,
          type: "PAYMENT",
          title: "룸메이트가 초대를 수락했어요",
          body: `"${member.reservation.room.name}" 초대자가 본인 1자리 결제를 진행 중입니다.`,
          targetUrl: "/me/trips",
        },
      });

      return {
        status: "PAYMENT_PENDING" as const,
        companionId: userId,
        companionStatus: "PAYMENT_PENDING" as const,
        requiresIndividualPayment: true,
        paymentDeadline,
        totalDueNow: member.totalDueNow,
      };
    });
  }

  async confirmCompanionPayment(
    id: string,
    userId: string,
    dto: CompanionPaymentDto,
  ) {
    const prisma = this.requirePrisma();
    await expireCompanionInvites(prisma);

    const member = await prisma.reservationCompanionMember.findUnique({
      where: {
        reservationId_userId: {
          reservationId: id,
          userId,
        },
      },
      include: {
        reservation: {
          include: {
            room: {
              select: {
                name: true,
                hostId: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "초대받은 사람만 결제할 수 있습니다.",
      });
    }
    if (!member.requiresIndividualPayment) {
      throw new ConflictException({
        code: "LEGACY_COMPANION_INVITE",
        message: "기존 초대는 대표 예약자가 결제한 예약입니다.",
      });
    }
    if (member.status === "PAID") return member;
    if (member.status !== "PAYMENT_PENDING") {
      throw new ConflictException({
        code: "PAYMENT_NOT_PENDING",
        message: "결제 대기 중인 룸메이트 초대가 아닙니다.",
      });
    }
    if (
      !member.paymentDeadline ||
      member.paymentDeadline.getTime() < Date.now()
    ) {
      await expireCompanionInvites(prisma);
      throw new ConflictException({
        code: "COMPANION_PAYMENT_EXPIRED",
        message: "개인 결제 기한이 지나 확보된 자리가 해제되었습니다.",
      });
    }
    if (dto.amount !== member.totalDueNow) {
      throw new UnprocessableEntityException({
        code: "AMOUNT_MISMATCH",
        message: "결제 금액이 본인 1자리 금액과 일치하지 않습니다.",
      });
    }

    const verification = await this.payments.verify({
      provider: dto.provider,
      paymentKey: dto.paymentKey,
      expectedAmount: member.totalDueNow,
    });
    if (!verification.ok || verification.paidAmount !== member.totalDueNow) {
      throw new UnprocessableEntityException({
        code: "PAYMENT_UNVERIFIED",
        message: verification.reason ?? "결제 검증에 실패했습니다.",
      });
    }

    const paidAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.reservationCompanionMember.update({
        where: { id: member.id },
        data: {
          status: "PAID",
          paidAt,
          paymentProvider: dto.provider,
          paymentTxnId: verification.providerTxnId,
        },
      });

      if (member.reservation.companionId === userId) {
        await tx.reservation.update({
          where: { id },
          data: {
            companionStatus: "PAID",
            companionRespondedAt: paidAt,
          },
        });
      }

      const recipients = [
        member.reservation.guestId,
        member.reservation.room.hostId,
      ].filter((value, index, list) => list.indexOf(value) === index);

      await tx.notification.createMany({
        data: recipients.map((recipientId) => ({
          userId: recipientId,
          type: "PAYMENT" as const,
          title: "룸메이트 결제가 완료되었어요",
          body: `"${member.reservation.room.name}" 공동예약의 1자리 결제가 완료되었습니다.`,
          targetUrl:
            recipientId === member.reservation.room.hostId
              ? "/host/reservations"
              : "/me/trips",
        })),
      });

      return result;
    });

    return updated;
  }

  // 내가 동반자로 초대된 예약 목록
  async listCompanionInvites(userId: string) {
    if (this.prisma) await expireCompanionInvites(this.prisma);
    return this.repo.listByCompanion(userId);
  }

  // 취소되면 그 예약의 Payment도 REFUNDED로 바꾼다 — 안 그러면 관리자
  // 매출 관리의 "총 거래액(GMV)"이 취소된 예약 금액까지 그대로 포함해서
  // 계산된다 (GMV 쿼리가 status='PAID'인 것만 더하기 때문). 게스트 취소,
  // 호스트 취소 둘 다 이 메서드를 거친다.
  private async refundPayment(reservationId: string): Promise<void> {
    if (!this.prisma) return;
    await this.prisma.payment.updateMany({
      where: { reservationId, status: "PAID" },
      data: { status: "REFUNDED" },
    });
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
    await this.refundPayment(id);

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

  // ── 계약 변경 요청: 조기 퇴실 / 정확한 날짜 연장 ───────────────
  async quoteContractChange(
    id: string,
    guestId: string,
    dto: ContractChangeQuoteDto,
  ) {
    const reservation = await this.requireGuestReservation(id, guestId);
    return this.buildContractChangeQuote(
      reservation,
      dto.type,
      dto.requestedCheckOut,
    );
  }

  async requestEarlyCheckout(
    id: string,
    guestId: string,
    requestedCheckOut?: Date,
  ) {
    const reservation = await this.requireGuestReservation(id, guestId);
    if (reservation.status === "EARLY_CHECKOUT_REQUESTED") {
      if (!this.prisma) return reservation;
      return this.getActiveContractChange(id);
    }
    if (reservation.status !== "CONFIRMED") {
      throw new BadRequestException({
        code: "NOT_CONFIRMED",
        message: "확정된 예약만 조기 퇴실을 요청할 수 있습니다.",
      });
    }

    // Tests and non-Prisma adapters keep the previous status-only fallback.
    if (!this.prisma) {
      return this.repo.updateStatus(id, "EARLY_CHECKOUT_REQUESTED");
    }

    const target =
      requestedCheckOut ??
      effectiveEarlyCheckOut(reservation.checkIn, new Date());
    const quote = await this.buildContractChangeQuote(
      reservation,
      "EARLY_CHECKOUT",
      target,
    );
    await this.assertNoActiveContractChange(id);

    const prisma = this.prisma;
    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.contractChangeRequest.create({
        data: {
          reservationId: id,
          requesterId: guestId,
          type: "EARLY_CHECKOUT",
          status: "HOST_REVIEW",
          originalCheckOut: reservation.checkOut,
          requestedCheckOut: quote.requestedCheckOut,
          estimatedRefund: quote.estimatedRefund,
        },
      });
      await tx.reservation.update({
        where: { id },
        data: {
          status: "EARLY_CHECKOUT_REQUESTED",
          originalCheckOut:
            reservation.originalCheckOut ?? reservation.checkOut,
        },
      });
      return created;
    });

    const room = await this.repo.findRoom(reservation.roomId);
    if (room && room.hostId !== guestId) {
      await this.notifyUser(
        room.hostId,
        "EARLY_CHECKOUT_REQUESTED",
        "조기 퇴실 요청이 들어왔어요",
        `"${room.name}" 게스트가 ${quote.requestedCheckOut
          .toISOString()
          .slice(0, 10)} 퇴실을 요청했습니다.`,
        `/host/reservations?reservationId=${id}`,
      );
    }
    return request;
  }

  async requestExtension(
    id: string,
    guestId: string,
    requestedCheckOutOrMonths?: Date | number,
  ) {
    const reservation = await this.requireGuestReservation(id, guestId);
    if (reservation.status !== "CONFIRMED") {
      throw new BadRequestException({
        code: "NOT_CONFIRMED",
        message: "이용 중인 확정 예약만 연장을 요청할 수 있습니다.",
      });
    }

    if (!this.prisma) {
      const months =
        typeof requestedCheckOutOrMonths === "number"
          ? requestedCheckOutOrMonths
          : Math.max(
              1,
              fullCalendarMonthsBetween(
                reservation.checkOut,
                requestedCheckOutOrMonths ??
                  addCalendarMonths(reservation.checkOut, 1),
              ),
            );
      return this.repo.requestExtension(id, months);
    }

    const target =
      requestedCheckOutOrMonths instanceof Date
        ? requestedCheckOutOrMonths
        : addCalendarMonths(
            reservation.checkOut,
            typeof requestedCheckOutOrMonths === "number"
              ? requestedCheckOutOrMonths
              : 1,
          );
    const quote = await this.buildContractChangeQuote(
      reservation,
      "EXTENSION",
      target,
    );
    await this.assertNoActiveContractChange(id);

    const fullMonths = fullCalendarMonthsBetween(
      reservation.checkOut,
      quote.requestedCheckOut,
    );
    const prisma = this.prisma;
    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.contractChangeRequest.create({
        data: {
          reservationId: id,
          requesterId: guestId,
          type: "EXTENSION",
          status: "HOST_REVIEW",
          originalCheckOut: reservation.checkOut,
          requestedCheckOut: quote.requestedCheckOut,
          additionalRent: quote.additionalRent,
          additionalMaintenance: quote.additionalMaintenance,
          additionalServiceFee: quote.additionalServiceFee,
          additionalAmount: quote.additionalAmount,
        },
      });
      await tx.reservation.update({
        where: { id },
        data: {
          status: "EXTENSION_REQUESTED",
          extensionMonths: fullMonths > 0 ? fullMonths : null,
          originalCheckOut:
            reservation.originalCheckOut ?? reservation.checkOut,
        },
      });
      return created;
    });

    const room = await this.repo.findRoom(reservation.roomId);
    if (room && room.hostId !== guestId) {
      await this.notifyUser(
        room.hostId,
        "SYSTEM",
        "계약 연장 요청이 들어왔어요",
        `"${room.name}" 게스트가 ${quote.requestedCheckOut
          .toISOString()
          .slice(0, 10)}까지 연장을 요청했습니다.`,
        `/host/reservations?reservationId=${id}`,
      );
    }
    return request;
  }

  async cancelContractChange(id: string, guestId: string) {
    const reservation = await this.requireGuestReservation(id, guestId);
    const prisma = this.requirePrisma();
    const request = await this.getActiveContractChange(id);
    if (!request) {
      throw new BadRequestException({
        code: "NO_ACTIVE_CHANGE_REQUEST",
        message: "취소할 계약 변경 요청이 없습니다.",
      });
    }

    return prisma.$transaction(async (tx) => {
      await tx.contractChangeRequest.update({
        where: { id: request.id },
        data: { status: "CANCELLED" },
      });
      await tx.reservation.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          checkOut:
            request.type === "EXTENSION" &&
            request.status === "PAYMENT_PENDING"
              ? request.originalCheckOut
              : reservation.checkOut,
          extensionMonths: null,
        },
      });
      return { ok: true };
    });
  }

  async decideEarlyCheckout(
    id: string,
    hostId: string,
    decision: "approve" | "reject",
    reason?: string,
  ) {
    const reservation = await this.requireHostReservation(id, hostId);
    if (!this.prisma) {
      if (reservation.status !== "EARLY_CHECKOUT_REQUESTED") {
        throw new BadRequestException({
          code: "NOT_REQUESTED",
          message: "조기 퇴실이 요청된 예약만 처리할 수 있습니다.",
        });
      }
      return decision === "approve"
        ? this.repo.approveEarlyCheckout(
            id,
            effectiveEarlyCheckOut(reservation.checkIn, new Date()),
          )
        : this.repo.updateStatus(id, "CONFIRMED");
    }

    const request = await this.getActiveContractChange(
      id,
      "EARLY_CHECKOUT",
      "HOST_REVIEW",
    );
    if (!request) {
      throw new BadRequestException({
        code: "NOT_REQUESTED",
        message: "검토 대기 중인 조기 퇴실 요청이 없습니다.",
      });
    }

    const prisma = this.prisma;
    if (decision === "reject") {
      await prisma.$transaction([
        prisma.contractChangeRequest.update({
          where: { id: request.id },
          data: {
            status: "REJECTED",
            rejectReason: reason?.trim() || null,
            reviewedAt: new Date(),
          },
        }),
        prisma.reservation.update({
          where: { id },
          data: { status: "CONFIRMED" },
        }),
      ]);
      await this.notifyUser(
        reservation.guestId,
        "EARLY_CHECKOUT_REJECTED",
        "조기 퇴실 요청이 거절되었어요",
        reason?.trim() || "기존 계약 종료일이 유지됩니다.",
        "/me/trips",
      );
      return { status: "REJECTED" };
    }

    await prisma.$transaction([
      prisma.contractChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          appliedAt: new Date(),
        },
      }),
      prisma.reservation.update({
        where: { id },
        data: {
          status: "EARLY_CHECKOUT_APPROVED",
          checkOut: request.requestedCheckOut,
          originalCheckOut:
            reservation.originalCheckOut ?? request.originalCheckOut,
        },
      }),
    ]);
    await this.notifyUser(
      reservation.guestId,
      "EARLY_CHECKOUT_APPROVED",
      "조기 퇴실 요청이 승인되었어요",
      `퇴실 예정일이 ${request.requestedCheckOut
        .toISOString()
        .slice(0, 10)}로 변경되었습니다.`,
      "/me/trips",
    );
    return { status: "APPROVED", checkOut: request.requestedCheckOut };
  }

  async decideExtension(
    id: string,
    hostId: string,
    decision: "approve" | "reject",
    reason?: string,
  ) {
    const reservation = await this.requireHostReservation(id, hostId);
    if (!this.prisma) {
      if (reservation.status !== "EXTENSION_REQUESTED") {
        throw new BadRequestException({
          code: "NOT_REQUESTED",
          message: "연장이 요청된 예약만 처리할 수 있습니다.",
        });
      }
      const months = reservation.extensionMonths ?? 0;
      return decision === "approve"
        ? this.repo.applyExtension(id, months)
        : this.repo.clearExtension(id);
    }

    const request = await this.getActiveContractChange(
      id,
      "EXTENSION",
      "HOST_REVIEW",
    );
    if (!request) {
      throw new BadRequestException({
        code: "NOT_REQUESTED",
        message: "검토 대기 중인 연장 요청이 없습니다.",
      });
    }
    const prisma = this.prisma;

    if (decision === "reject") {
      await prisma.$transaction([
        prisma.contractChangeRequest.update({
          where: { id: request.id },
          data: {
            status: "REJECTED",
            rejectReason: reason?.trim() || null,
            reviewedAt: new Date(),
          },
        }),
        prisma.reservation.update({
          where: { id },
          data: {
            status: "CONFIRMED",
            extensionMonths: null,
          },
        }),
      ]);
      await this.notifyUser(
        reservation.guestId,
        "SYSTEM",
        "계약 연장 요청이 거절되었어요",
        reason?.trim() || "기존 계약 종료일이 유지됩니다.",
        "/me/trips",
      );
      return { status: "REJECTED" };
    }

    // 승인 직전 다시 확인한다. 결제 대기 24시간 동안에는 checkOut을
    // 임시 연장해 다른 예약이 해당 기간을 선점하지 못하게 한다.
    const quote = await this.buildContractChangeQuote(
      reservation,
      "EXTENSION",
      request.requestedCheckOut,
    );
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.$transaction([
      prisma.contractChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "PAYMENT_PENDING",
          reviewedAt: new Date(),
          paymentDeadline: deadline,
          additionalRent: quote.additionalRent,
          additionalMaintenance: quote.additionalMaintenance,
          additionalServiceFee: quote.additionalServiceFee,
          additionalAmount: quote.additionalAmount,
        },
      }),
      prisma.reservation.update({
        where: { id },
        data: {
          checkOut: request.requestedCheckOut,
          status: "EXTENSION_REQUESTED",
        },
      }),
    ]);
    await this.notifyUser(
      reservation.guestId,
      "PAYMENT",
      "계약 연장이 승인되었어요",
      `24시간 안에 추가 금액 ${quote.additionalAmount.toLocaleString(
        "ko-KR",
      )}원을 결제해주세요.`,
      "/me/trips",
    );
    return {
      status: "PAYMENT_PENDING",
      paymentDeadline: deadline,
      additionalAmount: quote.additionalAmount,
    };
  }

  async confirmExtensionPayment(
    id: string,
    guestId: string,
    dto: ContractChangePaymentDto,
  ) {
    const reservation = await this.requireGuestReservation(id, guestId);
    const prisma = this.requirePrisma();
    const request = await this.getActiveContractChange(
      id,
      "EXTENSION",
      "PAYMENT_PENDING",
    );
    if (!request) {
      throw new BadRequestException({
        code: "PAYMENT_NOT_PENDING",
        message: "추가 결제를 기다리는 연장 요청이 없습니다.",
      });
    }

    if (
      request.paymentDeadline &&
      request.paymentDeadline.getTime() < Date.now()
    ) {
      await prisma.$transaction([
        prisma.contractChangeRequest.update({
          where: { id: request.id },
          data: { status: "EXPIRED" },
        }),
        prisma.reservation.update({
          where: { id },
          data: {
            checkOut: request.originalCheckOut,
            status: "CONFIRMED",
            extensionMonths: null,
          },
        }),
      ]);
      throw new BadRequestException({
        code: "EXTENSION_PAYMENT_EXPIRED",
        message: "연장 결제 기한이 만료되었습니다. 다시 요청해주세요.",
      });
    }

    if (dto.amount !== request.additionalAmount) {
      throw new BadRequestException({
        code: "AMOUNT_MISMATCH",
        message: "서버에서 계산한 연장 금액과 결제 금액이 다릅니다.",
      });
    }
    const verified = await this.payments.verify({
      provider: dto.provider,
      paymentKey: dto.paymentKey,
      expectedAmount: request.additionalAmount,
    });
    if (
      !verified.ok ||
      verified.paidAmount !== request.additionalAmount
    ) {
      throw new BadRequestException({
        code: "PAYMENT_UNVERIFIED",
        message: "추가 결제를 확인하지 못했습니다.",
      });
    }

    const months = Math.max(
      1,
      fullCalendarMonthsBetween(
        reservation.checkIn,
        request.requestedCheckOut,
      ),
    );
    await prisma.$transaction([
      prisma.contractChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          paymentProvider: dto.provider,
          paymentTxnId: verified.providerTxnId,
          paidAt: new Date(),
          appliedAt: new Date(),
        },
      }),
      prisma.reservation.update({
        where: { id },
        data: {
          checkOut: request.requestedCheckOut,
          months,
          status: "CONFIRMED",
          extensionMonths: null,
          originalCheckOut:
            reservation.originalCheckOut ?? request.originalCheckOut,
        },
      }),
    ]);
    await this.notifyUser(
      reservation.guestId,
      "PAYMENT",
      "계약 연장이 확정되었어요",
      `새 퇴실일은 ${request.requestedCheckOut
        .toISOString()
        .slice(0, 10)}입니다.`,
      "/me/trips",
    );
    return {
      status: "CONFIRMED",
      checkOut: request.requestedCheckOut,
      paidAmount: request.additionalAmount,
    };
  }

  async completeEarlyCheckout(
    id: string,
    hostId: string,
    depositDeduction: number,
  ) {
    const reservation = await this.requireHostReservation(id, hostId);
    const prisma = this.requirePrisma();
    const request = await prisma.contractChangeRequest.findFirst({
      where: {
        reservationId: id,
        type: "EARLY_CHECKOUT",
        status: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
    });
    if (!request) {
      throw new BadRequestException({
        code: "EARLY_CHECKOUT_NOT_APPROVED",
        message: "승인된 조기 퇴실 요청이 없습니다.",
      });
    }
    const deduction = Math.min(
      Math.max(0, Math.trunc(depositDeduction)),
      reservation.deposit,
    );
    const finalRefund =
      request.estimatedRefund + Math.max(0, reservation.deposit - deduction);

    await prisma.$transaction([
      prisma.contractChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          depositDeduction: deduction,
          finalRefund,
          actualCheckOut: request.requestedCheckOut,
        },
      }),
      prisma.reservation.update({
        where: { id },
        data: {
          status: "COMPLETED",
          actualCheckOut: request.requestedCheckOut,
          checkOut: request.requestedCheckOut,
        },
      }),
    ]);
    await this.notifyUser(
      reservation.guestId,
      "SYSTEM",
      "조기 퇴실 정산이 완료되었어요",
      `예상 반환 금액은 ${finalRefund.toLocaleString(
        "ko-KR",
      )}원입니다. 실제 환불은 결제사 처리 결과를 확인해주세요.`,
      "/me/trips",
    );
    return { status: "COMPLETED", finalRefund };
  }

  // All reservations for the logged-in guest (my trips).
  async listMine(guestId: string) {
    await this.expireStaleExtensionPayments();
    if (this.prisma) await expireCompanionInvites(this.prisma);
    return this.repo.listByGuest(guestId);
  }

  // All reservations across every room this host owns (host 예약 관리 inbox).
  async listForHost(hostId: string) {
    await this.expireStaleExtensionPayments();
    if (this.prisma) await expireCompanionInvites(this.prisma);
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

    const reservation = await this.repo.findById(id);

    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    }

    const ownerId = await this.repo.findRoomHostId(id);

    if (ownerId !== hostId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소의 예약만 처리할 수 있습니다.",
      });
    }

    if (status === "NO_SHOW" && reservation.status !== "CONFIRMED") {
      throw new BadRequestException({
        code: "INVALID_NO_SHOW_STATUS",
        message: "확정된 예약만 노쇼 처리할 수 있습니다.",
      });
    }

    if (status === "COMPLETED") {
      if (reservation.status !== "CONFIRMED") {
        throw new BadRequestException({
          code: "INVALID_COMPLETED_STATUS",
          message: "확정된 예약만 이용 완료 처리할 수 있습니다.",
        });
      }
      if (stripTime(reservation.checkOut) > stripTime(new Date())) {
        throw new BadRequestException({
          code: "CHECKOUT_NOT_REACHED",
          message: `퇴실일 ${reservation.checkOut.toISOString().slice(0, 10)} 이후에 이용 완료 처리할 수 있습니다.`,
        });
      }
    }

    const updated = await this.repo.updateStatus(id, status);

    if (status === "CANCELLED_BY_HOST") {
      await this.refundPayment(id);
    }

    if (status === "NO_SHOW" && this.prisma) {
      const room = await this.repo.findRoom(reservation.roomId);
      const roomName = room?.name ?? "예약한 숙소";

      const notification = await this.prisma.notification.create({
        data: {
          userId: reservation.guestId,
          type: "SYSTEM",
          title: "예약이 노쇼로 처리되었어요",
          body: `"${roomName}" 예약이 호스트에 의해 노쇼로 처리되었습니다. 사실과 다르다면 호스트 또는 운영팀에 문의해주세요.`,
          targetUrl: "/me/trips",
        },
      });

      this.notificationsGateway?.emitToUser(reservation.guestId, notification);
    }

    if (status === "COMPLETED" && this.prisma) {
      const room = await this.repo.findRoom(reservation.roomId);
      const roomName = room?.name ?? "이용한 숙소";

      const notification = await this.prisma.notification.create({
        data: {
          userId: reservation.guestId,
          type: "REVIEW",
          title: "숙소 이용은 어떠셨나요?",
          body: `"${roomName}" 이용이 완료되었습니다. 다른 이용자들을 위해 숙소 후기를 남겨주세요.`,
          targetUrl: `/me/reviews?reservationId=${id}`,
        },
      });

      this.notificationsGateway?.emitToUser(reservation.guestId, notification);
    }

    return updated;
  }

  private requirePrisma(): PrismaService {
    if (!this.prisma) {
      throw new BadRequestException({
        code: "CONTRACT_CHANGE_STORAGE_UNAVAILABLE",
        message: "계약 변경 저장소를 사용할 수 없습니다.",
      });
    }
    return this.prisma;
  }

  private async requireGuestReservation(
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
        message: "본인의 예약만 변경할 수 있습니다.",
      });
    }
    return reservation;
  }

  private async requireHostReservation(
    id: string,
    hostId: string,
  ): Promise<ReservationRecord> {
    const reservation = await this.repo.findById(id);
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "예약을 찾을 수 없습니다.",
      });
    }
    const ownerId = await this.repo.findRoomHostId(id);
    if (ownerId !== hostId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소의 예약만 처리할 수 있습니다.",
      });
    }
    return reservation;
  }

  private async getActiveContractChange(
    reservationId: string,
    type?: "EARLY_CHECKOUT" | "EXTENSION",
    status?: "HOST_REVIEW" | "PAYMENT_PENDING",
  ): Promise<any | null> {
    if (!this.prisma) return null;
    return this.prisma.contractChangeRequest.findFirst({
      where: {
        reservationId,
        ...(type ? { type } : {}),
        status: status
          ? status
          : { in: ["HOST_REVIEW", "PAYMENT_PENDING"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async assertNoActiveContractChange(
    reservationId: string,
  ): Promise<void> {
    const active = await this.getActiveContractChange(reservationId);
    if (active) {
      throw new ConflictException({
        code: "ACTIVE_CHANGE_REQUEST_EXISTS",
        message: "이미 처리 중인 계약 변경 요청이 있습니다.",
      });
    }
  }

  private async buildContractChangeQuote(
    reservation: ReservationRecord,
    type: "EARLY_CHECKOUT" | "EXTENSION",
    requestedCheckOut: Date,
  ) {
    const target = stripTime(requestedCheckOut);
    const currentCheckOut = stripTime(reservation.checkOut);
    const checkIn = stripTime(reservation.checkIn);
    const room = await this.repo.findRoom(reservation.roomId);
    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });
    }

    if (type === "EARLY_CHECKOUT") {
      const today = stripTime(new Date());
      if (target < today || target <= checkIn) {
        throw new BadRequestException({
          code: "INVALID_EARLY_CHECKOUT_DATE",
          message: "희망 퇴실일은 오늘 이후이면서 입주일보다 뒤여야 합니다.",
        });
      }
      if (target >= currentCheckOut) {
        throw new BadRequestException({
          code: "NOT_EARLY_CHECKOUT",
          message: "조기 퇴실일은 현재 계약 퇴실일보다 빨라야 합니다.",
        });
      }

      const minimumContractEnd = addCalendarMonths(
        checkIn,
        Math.max(1, room.minStayMonths),
      );
      const billableCheckOut =
        target < minimumContractEnd ? minimumContractEnd : target;
      const oldRent = stayCharge(
        reservation.monthlyRent,
        checkIn,
        currentCheckOut,
      ).amount;
      const newRent = stayCharge(
        reservation.monthlyRent,
        checkIn,
        billableCheckOut,
      ).amount;
      const oldMaintenance = stayCharge(
        reservation.maintenanceFee,
        checkIn,
        currentCheckOut,
      ).amount;
      const newMaintenance = stayCharge(
        reservation.maintenanceFee,
        checkIn,
        billableCheckOut,
      ).amount;
      const estimatedRefund = Math.max(
        0,
        oldRent +
          oldMaintenance -
          newRent -
          newMaintenance,
      );

      return {
        type,
        originalCheckOut: currentCheckOut,
        requestedCheckOut: target,
        changedDays: Math.round(
          (currentCheckOut.getTime() - target.getTime()) / 86_400_000,
        ),
        minimumContractEnd,
        minimumStaySatisfied: target >= minimumContractEnd,
        additionalRent: 0,
        additionalMaintenance: 0,
        additionalServiceFee: 0,
        additionalAmount: 0,
        estimatedRefund,
      };
    }

    if (target <= currentCheckOut) {
      throw new BadRequestException({
        code: "INVALID_EXTENSION_DATE",
        message: "연장 퇴실일은 현재 퇴실일보다 뒤여야 합니다.",
      });
    }
    const maximumCheckOut = addCalendarMonths(checkIn, MAX_STAY_MONTHS);
    if (target > maximumCheckOut) {
      throw new BadRequestException({
        code: "MAX_STAY",
        message: `최대 ${MAX_STAY_MONTHS}개월까지 계약할 수 있습니다.`,
      });
    }

    const [overlaps, blockedDates] = await Promise.all([
      this.repo.findOverlapping(
        reservation.roomId,
        currentCheckOut,
        target,
      ),
      this.repo.findBlockedDates(
        reservation.roomId,
        currentCheckOut,
        target,
      ),
    ]);
    this.assertNoHostBlocks(blockedDates);
    this.assertInventoryAvailable(
      room,
      overlaps.filter((row) => row.id !== reservation.id),
      {
        bookingMode: reservation.bookingMode,
        reservedSpots: reservation.reservedSpots,
      },
      currentCheckOut,
      target,
    );

    const additionalRent = stayCharge(
      reservation.monthlyRent,
      currentCheckOut,
      target,
    ).amount;
    const additionalMaintenance = stayCharge(
      reservation.maintenanceFee,
      currentCheckOut,
      target,
    ).amount;
    const additionalServiceFee = Math.round(
      additionalRent * SERVICE_FEE_RATE,
    );
    const additionalAmount =
      additionalRent +
      additionalMaintenance +
      additionalServiceFee;

    return {
      type,
      originalCheckOut: currentCheckOut,
      requestedCheckOut: target,
      changedDays: Math.round(
        (target.getTime() - currentCheckOut.getTime()) / 86_400_000,
      ),
      minimumContractEnd: null,
      minimumStaySatisfied: true,
      additionalRent,
      additionalMaintenance,
      additionalServiceFee,
      additionalAmount,
      estimatedRefund: 0,
    };
  }

  private async expireStaleExtensionPayments(): Promise<void> {
    if (!this.prisma) return;
    const prisma = this.prisma;
    const expired = await prisma.contractChangeRequest.findMany({
      where: {
        type: "EXTENSION",
        status: "PAYMENT_PENDING",
        paymentDeadline: { lt: new Date() },
      },
      select: {
        id: true,
        reservationId: true,
        originalCheckOut: true,
      },
    });

    for (const request of expired) {
      await prisma.$transaction([
        prisma.contractChangeRequest.update({
          where: { id: request.id },
          data: { status: "EXPIRED" },
        }),
        prisma.reservation.update({
          where: { id: request.reservationId },
          data: {
            status: "CONFIRMED",
            checkOut: request.originalCheckOut,
            extensionMonths: null,
          },
        }),
      ]);
    }
  }

  private async notifyUser(
    userId: string,
    type: string,
    title: string,
    body: string,
    targetUrl: string,
  ): Promise<void> {
    if (!this.prisma) return;
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        body,
        targetUrl,
      },
    });
    this.notificationsGateway?.emitToUser(userId, notification);
  }

  private resolveStayWindow(
    checkIn: Date,
    checkOut?: Date,
    legacyMonths?: number,
  ): { checkOut: Date; fullMonths: number } {
    const resolvedCheckOut = checkOut
      ? stripTime(checkOut)
      : addCalendarMonths(stripTime(checkIn), legacyMonths ?? 0);
    const fullMonths = fullCalendarMonthsBetween(checkIn, resolvedCheckOut);

    if (resolvedCheckOut <= stripTime(checkIn)) {
      throw new UnprocessableEntityException({
        code: "INVALID_STAY_WINDOW",
        message: "퇴실일은 입주일보다 뒤여야 합니다.",
      });
    }
    if (resolvedCheckOut > addCalendarMonths(checkIn, MAX_STAY_MONTHS)) {
      throw new UnprocessableEntityException({
        code: "MAX_STAY",
        message: `최대 ${MAX_STAY_MONTHS}개월까지 예약할 수 있습니다.`,
      });
    }
    return { checkOut: resolvedCheckOut, fullMonths: Math.max(1, fullMonths) };
  }

  private assertStayRules(
    room: RoomRecord,
    checkIn: Date,
    checkOut: Date,
  ): void {
    const platformMinimum = addCalendarMonths(checkIn, 1);
    if (checkOut < platformMinimum) {
      throw new UnprocessableEntityException({
        code: "PLATFORM_MIN_STAY",
        message: `최소 거주 기간은 1개월입니다. 퇴실일을 ${platformMinimum.toISOString().slice(0, 10)} 이후로 선택해주세요.`,
      });
    }

    const roomMinimum = addCalendarMonths(checkIn, room.minStayMonths);
    if (checkOut < roomMinimum) {
      throw new UnprocessableEntityException({
        code: "MIN_STAY",
        message: `이 숙소의 최소 계약 기간은 ${room.minStayMonths}개월입니다. 퇴실일을 ${roomMinimum.toISOString().slice(0, 10)} 이후로 선택해주세요.`,
      });
    }
    if (checkIn < stripTime(room.availableFrom)) {
      throw new UnprocessableEntityException({
        code: "NOT_AVAILABLE_YET",
        message: "선택한 날짜에는 아직 입주할 수 없습니다.",
      });
    }
  }

  private normalizeBooking(
    room: RoomRecord,
    requestedMode?: BookingMode,
    requestedSpots?: number,
  ): { bookingMode: BookingMode; reservedSpots: number } {
    if (room.rentalUnit !== "BED") {
      if (requestedMode && requestedMode !== "UNIT") {
        throw new BadRequestException({
          code: "INVALID_BOOKING_MODE",
          message: "전체 숙소와 개인실은 숙소 단위로 예약해야 합니다.",
        });
      }
      if (requestedSpots != null && requestedSpots !== 1) {
        throw new BadRequestException({
          code: "INVALID_RESERVED_SPOTS",
          message: "이 숙소는 한 개의 예약 단위로만 예약할 수 있습니다.",
        });
      }
      return { bookingMode: "UNIT", reservedSpots: 1 };
    }

    const capacity = Math.max(1, room.capacity ?? 1);
    const bookingMode: BookingMode =
      requestedMode === "WHOLE_ROOM" ? "WHOLE_ROOM" : "BED";
    const reservedSpots =
      bookingMode === "WHOLE_ROOM" ? capacity : requestedSpots ?? 1;

    if (reservedSpots < 1 || reservedSpots > capacity) {
      throw new BadRequestException({
        code: "INVALID_RESERVED_SPOTS",
        message: `예약 인원은 1명부터 최대 ${capacity}명까지 선택할 수 있습니다.`,
      });
    }

    return { bookingMode, reservedSpots };
  }

  private assertInventoryAvailable(
    room: RoomRecord,
    overlaps: ReservationRecord[],
    booking: { bookingMode: BookingMode; reservedSpots: number },
    rangeStart: Date,
    rangeEnd: Date,
  ): number | null {
    const inventory = calculateRangeInventory(
      room.rentalUnit,
      room.capacity,
      overlaps,
      rangeStart,
      rangeEnd,
    );

    if (room.rentalUnit !== "BED") {
      if (inventory.fullyBooked) throwDatesUnavailable();
      return null;
    }

    if (booking.bookingMode === "WHOLE_ROOM") {
      if (inventory.reservedSpots > 0) throwDatesUnavailable();
      return 0;
    }

    const remaining = inventory.remainingSpots ?? 0;
    if (booking.reservedSpots > remaining) {
      throw new ConflictException({
        code: "NOT_ENOUGH_SPOTS",
        message: `선택한 기간에 남은 자리가 ${remaining}개뿐입니다.`,
      });
    }

    return remaining - booking.reservedSpots;
  }

  private assertNoHostBlocks(blockedDates: Date[]): void {
    if (blockedDates.length === 0) return;
    throw new ConflictException({
      code: "HOST_BLOCKED_DATES",
      message: "선택한 기간에 호스트가 예약 불가로 설정한 날짜가 있습니다. 다른 기간을 선택해주세요.",
    });
  }

  private scaledPricing(room: RoomRecord, units: number) {
    return {
      monthlyRent: room.monthlyRent * units,
      deposit: room.deposit * units,
      cleaningFee: room.cleaningFee * units,
      maintenanceFee: room.maintenanceFee * units,
    };
  }

  private async resolveCoupon(
    code: string | undefined,
    monthlyRent: number,
    userId?: string,
  ): Promise<{ couponId: string | null; discount: number }> {
    if (!code) return { couponId: null, discount: 0 };

    const coupon = await this.repo.findCouponByCode(code);
    if (!coupon) {
      throw new UnprocessableEntityException({
        code: "COUPON_INVALID",
        message: "쿠폰이 유효하지 않습니다.",
      });
    }

    assertCouponUsable(coupon);

    if (monthlyRent < coupon.minSpend) {
      throw new UnprocessableEntityException({
        code: "COUPON_MIN_SPEND",
        message: `첫 달 월세가 ${coupon.minSpend.toLocaleString()}원 이상일 때 사용할 수 있습니다.`,
      });
    }

    if (userId && coupon.ownerId && coupon.ownerId !== userId) {
      throw new ForbiddenException({
        code: "COUPON_NOT_OWNER",
        message: "본인에게 발급된 쿠폰만 사용할 수 있습니다.",
      });
    }

    if (userId && this.prisma) {
      const used = await this.prisma.reservation.findFirst({
        where: {
          guestId: userId,
          couponId: coupon.id,
          status: { not: "PENDING_PAYMENT" },
        },
        select: { id: true },
      });

      if (used) {
        throw new UnprocessableEntityException({
          code: "COUPON_ALREADY_USED",
          message: "이미 사용한 쿠폰입니다.",
        });
      }
    }

    return {
      couponId: coupon.id,
      // 보증금·청소비·관리비가 아닌 첫 달 월세만 할인 기준으로 전달한다.
      discount: couponDiscount(coupon, monthlyRent),
    };
  }

  private async confirmReservationAfterPayment(
    reservation: ReservationRecord,
    guestId: string,
  ): Promise<ReservationRecord> {
    if (!reservation.couponId || !this.prisma) {
      return this.repo.updateStatus(reservation.id, "CONFIRMED");
    }

    const prisma = this.prisma;
    return prisma.$transaction(
      async (tx: any) => {
        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "Coupon" WHERE "id" = $1 FOR UPDATE',
          reservation.couponId,
        );

        const coupon = await tx.coupon.findUnique({
          where: { id: reservation.couponId },
        });

        if (!coupon) {
          throw new UnprocessableEntityException({
            code: "COUPON_INVALID",
            message: "쿠폰을 찾을 수 없습니다.",
          });
        }

        assertCouponUsable(coupon);

        if (coupon.ownerId && coupon.ownerId !== guestId) {
          throw new ForbiddenException({
            code: "COUPON_NOT_OWNER",
            message: "본인에게 발급된 쿠폰만 사용할 수 있습니다.",
          });
        }

        const alreadyUsed = await tx.reservation.findFirst({
          where: {
            id: { not: reservation.id },
            guestId,
            couponId: coupon.id,
            status: { not: "PENDING_PAYMENT" },
          },
          select: { id: true },
        });

        if (alreadyUsed) {
          throw new UnprocessableEntityException({
            code: "COUPON_ALREADY_USED",
            message: "이미 사용한 쿠폰입니다.",
          });
        }

        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });

        return tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "CONFIRMED" },
        });
      },
      { isolationLevel: "Serializable" },
    ) as Promise<ReservationRecord>;
  }
}

function throwDatesUnavailable(): never {
  throw new ConflictException({
    code: "DATES_UNAVAILABLE",
    message: "선택한 기간은 예약이 마감되었습니다. 다른 날짜를 선택해주세요.",
  });
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

function effectiveEarlyCheckOut(checkIn: Date, approvedAt: Date): Date {
  // 퇴실 승인 당일은 기존 게스트가 사용한 날짜로 남기고 다음 날부터 재고를 푼다.
  // 아직 입주 전인 잘못된 요청이 들어와도 checkOut이 checkIn보다 앞서지 않게 한다.
  const approvedDay = stripTime(approvedAt);
  approvedDay.setUTCDate(approvedDay.getUTCDate() + 1);
  const minimum = stripTime(checkIn);
  minimum.setUTCDate(minimum.getUTCDate() + 1);
  return approvedDay > minimum ? approvedDay : minimum;
}

function stripTime(d: Date): Date {
  // 예약 날짜는 시각이 없는 달력 날짜다. 로컬 달력의 연·월·일을
  // UTC 자정으로 고정해 개발 환경(KST)과 배포 환경(UTC)의 날짜를 맞춘다.
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
  );
}

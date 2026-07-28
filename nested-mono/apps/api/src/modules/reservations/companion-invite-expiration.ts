import { PrismaService } from "../../prisma/prisma.service";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function utcDayStart(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function utcDayEnd(value: Date): Date {
  const out = utcDayStart(value);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

function addUtcDays(value: Date, days: number): Date {
  const out = utcDayStart(value);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function daysUntilCheckIn(checkIn: Date, now = new Date()): number {
  return Math.ceil(
    (utcDayStart(checkIn).getTime() - utcDayStart(now).getTime()) / DAY_MS,
  );
}

/**
 * 초대 자체가 자리를 임시 확보하는 기한.
 * D-4 이상: 발송 후 72시간과 입주 D-3 23:59 중 빠른 시각.
 * D-3~D-1: 즉시 결제 정책이므로 발송 후 30분.
 * D-day 이후: 초대 생성 불가이며 이미 있다면 즉시 만료.
 */
export function companionInviteExpiresAt(
  checkIn: Date,
  now = new Date(),
): Date {
  const days = daysUntilCheckIn(checkIn, now);
  if (days <= 0) return new Date(now);
  if (days <= 3) {
    return new Date(Math.min(checkIn.getTime(), now.getTime() + 30 * 60 * 1000));
  }

  const seventyTwoHours = new Date(now.getTime() + 72 * HOUR_MS);
  const threeDaysBefore = utcDayEnd(addUtcDays(checkIn, -3));
  return new Date(
    Math.min(seventyTwoHours.getTime(), threeDaysBefore.getTime()),
  );
}

/**
 * 초대를 수락한 뒤 개인 결제를 끝내야 하는 기한.
 * D-4 이상: 수락 후 72시간과 입주 D-3 23:59 중 빠른 시각.
 * D-3~D-1: 수락 후 30분.
 */
export function companionPaymentDeadline(
  checkIn: Date,
  now = new Date(),
): Date {
  return companionInviteExpiresAt(checkIn, now);
}

/**
 * 만료된 초대/개인결제 대기 건의 임시 자리를 대표 예약에서 빼서 복구한다.
 * 별도 Redis 스케줄러 없이 검색·달력·예약 조회 시 실행되는 안전한 lazy cleanup이다.
 */
export async function expireCompanionInvites(
  prisma: PrismaService,
  now = new Date(),
): Promise<number> {
  const candidates = await prisma.reservationCompanionMember.findMany({
    where: {
      requiresIndividualPayment: true,
      OR: [
        {
          status: "PENDING",
          inviteExpiresAt: { not: null, lt: now },
        },
        {
          status: "PAYMENT_PENDING",
          paymentDeadline: { not: null, lt: now },
        },
      ],
    },
    select: {
      id: true,
      reservationId: true,
      userId: true,
      status: true,
    },
  });

  let expiredCount = 0;

  for (const candidate of candidates) {
    const changed = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "Reservation" WHERE "id" = $1 FOR UPDATE',
        candidate.reservationId,
      );

      const member = await tx.reservationCompanionMember.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          userId: true,
          status: true,
          requiresIndividualPayment: true,
          inviteExpiresAt: true,
          paymentDeadline: true,
          reservation: {
            select: {
              id: true,
              guestId: true,
              companionId: true,
              reservedSpots: true,
              room: { select: { name: true } },
            },
          },
        },
      });

      if (!member || !member.requiresIndividualPayment) return false;

      const deadline =
        member.status === "PENDING"
          ? member.inviteExpiresAt
          : member.status === "PAYMENT_PENDING"
            ? member.paymentDeadline
            : null;

      if (!deadline || deadline.getTime() >= now.getTime()) return false;

      await tx.reservationCompanionMember.update({
        where: { id: member.id },
        data: {
          status: "EXPIRED",
          expiredAt: now,
        },
      });

      await tx.reservation.update({
        where: { id: member.reservation.id },
        data: {
          reservedSpots: Math.max(1, member.reservation.reservedSpots - 1),
          ...(member.reservation.companionId === member.userId
            ? {
                companionStatus: "EXPIRED",
                companionRespondedAt: now,
              }
            : {}),
        },
      });

      await tx.notification.createMany({
        data: [
          {
            userId: member.userId,
            type: "PAYMENT",
            title: "룸메이트 초대가 만료되었어요",
            body: `"${member.reservation.room.name}" 초대의 결제 기한이 지나 확보된 자리가 해제되었습니다.`,
            targetUrl: "/me/trips",
          },
          {
            userId: member.reservation.guestId,
            type: "RESERVATION",
            title: "룸메이트 초대 자리가 복구되었어요",
            body: `"${member.reservation.room.name}" 초대 1건이 만료되어 잔여 자리로 돌아갔습니다.`,
            targetUrl: "/me/trips",
          },
        ],
      });

      return true;
    });

    if (changed) expiredCount += 1;
  }

  return expiredCount;
}

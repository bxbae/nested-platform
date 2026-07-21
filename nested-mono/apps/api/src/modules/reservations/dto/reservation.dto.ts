import { z } from "zod";

// ── Quote ── price preview, no write. Matches POST /reservations/quote
export const quoteSchema = z.object({
  roomId: z.string().min(1),
  checkIn: z.coerce.date().refine((d) => d.getTime() >= startOfToday(), {
    message: "입주일은 오늘 이후여야 합니다.",
  }),
  months: z.number().int().min(1).max(24),
  couponCode: z.string().trim().min(1).optional(),
});
export type QuoteDto = z.infer<typeof quoteSchema>;

// ── Create reservation ── same inputs; server recomputes price.
// companionId 를 주면 공동 예약이 된다: 결제는 예약자가 전액 하고, 상대에게는
// 초대(PENDING)가 걸린다. 상대가 수락해야 함께 사는 것으로 확정된다.
export const createReservationSchema = quoteSchema.extend({
  companionId: z.string().min(1).optional(),
});
export type CreateReservationDto = z.infer<typeof createReservationSchema>;

// ── 동반자 초대 응답 ── 초대받은 사람이 수락 또는 거절
export const companionResponseSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});
export type CompanionResponseDto = z.infer<typeof companionResponseSchema>;

// ── Confirm payment ── verify against PSP then mark CONFIRMED
export const confirmPaymentSchema = z.object({
  reservationId: z.string().min(1),
  provider: z.enum(["TOSS", "PORTONE", "STRIPE"]),
  paymentKey: z.string().min(1), // Toss paymentKey / PortOne imp_uid
  amount: z.number().int().positive(),
});
export type ConfirmPaymentDto = z.infer<typeof confirmPaymentSchema>;

// ── Host status change ── the four statuses a host may set on a reservation
// for their own listing. Guest-cancel and PENDING_PAYMENT are intentionally
// excluded (the service double-checks this too).
export const hostStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED_BY_HOST", "COMPLETED", "NO_SHOW"]),
});
export type HostStatusDto = z.infer<typeof hostStatusSchema>;

// ── Early-checkout decision ── host approves or rejects a guest's request.
export const earlyCheckoutSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});
export type EarlyCheckoutDto = z.infer<typeof earlyCheckoutSchema>;

// ── 계약 연장 ── 게스트가 원하는 개월 수 / 호스트의 승인·거절
export const extensionRequestSchema = z.object({
  months: z.coerce.number().int().min(1).max(24),
});
export type ExtensionRequestDto = z.infer<typeof extensionRequestSchema>;

export const extensionDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});
export type ExtensionDecisionDto = z.infer<typeof extensionDecisionSchema>;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

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

// ── Create reservation ── same inputs; server recomputes price
export const createReservationSchema = quoteSchema;
export type CreateReservationDto = z.infer<typeof createReservationSchema>;

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

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

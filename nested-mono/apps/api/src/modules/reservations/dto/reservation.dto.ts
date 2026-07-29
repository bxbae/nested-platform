import { z } from "zod";

// ── Quote ── price preview, no write. Matches POST /reservations/quote
const stayRequestBaseSchema = z.object({
  roomId: z.string().min(1),
  checkIn: z.coerce.date().refine((d) => d.getTime() >= startOfToday(), {
    message: "입주일은 오늘 이후여야 합니다.",
  }),
  // Exact check-out is authoritative for new clients. `months` remains for
  // backward compatibility with older clients and extension-related tests.
  checkOut: z.coerce.date().optional(),
  months: z.coerce.number().int().min(1).max(24).optional(),
  bookingMode: z.enum(["UNIT", "BED", "WHOLE_ROOM"]).optional(),
  reservedSpots: z.coerce.number().int().min(1).max(20).optional(),
  // 견적에서 대표 예약자가 직접 결제하지 않는 초대 자리 수.
  companionCount: z.coerce.number().int().min(0).max(19).optional(),
  couponCode: z.string().trim().min(1).optional(),
});

type StayRequestData = z.infer<typeof stayRequestBaseSchema>;

function validateStayRequest(
  data: StayRequestData,
  ctx: z.RefinementCtx,
): void {
  if (!data.checkOut && !data.months) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkOut"],
      message: "퇴실일을 선택해주세요.",
    });
    return;
  }
  if (data.checkOut && data.checkOut <= data.checkIn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkOut"],
      message: "퇴실일은 입주일보다 뒤여야 합니다.",
    });
  }
}

export const quoteSchema = stayRequestBaseSchema.superRefine(validateStayRequest);
export type QuoteDto = z.infer<typeof quoteSchema>;

// ── Create reservation ── same inputs; server recomputes price.
// companionId/companionIds를 주면 대표자는 본인 1자리만 결제한다.
// 초대받은 친구는 수락 후 각자 1자리 금액을 결제해야 자리가 확정된다.
export const createReservationSchema = stayRequestBaseSchema
  .extend({
    // 기존 단일 초대 필드는 운영 중인 클라이언트와 예약 호환을 위해 유지한다.
    companionId: z.string().min(1).optional(),
    // 신규 다중 초대. 대표 예약자를 제외한 선택 자리 수만큼 친구를 지정할 수 있다.
    companionIds: z.array(z.string().min(1)).max(19).optional(),
  })
  .superRefine((data, ctx) => {
    validateStayRequest(data, ctx);
    if (!data.companionIds) return;
    if (new Set(data.companionIds).size !== data.companionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companionIds"],
        message: "같은 친구를 중복 선택할 수 없습니다.",
      });
    }
  });
export type CreateReservationDto = z.infer<typeof createReservationSchema>;

// ── 동반자 초대 응답 ── 초대받은 사람이 수락 또는 거절
export const companionResponseSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});
export type CompanionResponseDto = z.infer<typeof companionResponseSchema>;

// 초대받은 사용자의 본인 1자리 개별 결제.
export const companionPaymentSchema = z.object({
  provider: z.enum(["TOSS", "PORTONE", "STRIPE"]),
  paymentKey: z.string().min(1),
  amount: z.number().int().positive(),
});
export type CompanionPaymentDto = z.infer<typeof companionPaymentSchema>;

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

// ── 계약 변경 요청 ────────────────────────────────────────────────
export const contractChangeQuoteSchema = z.object({
  type: z.enum(["EARLY_CHECKOUT", "EXTENSION"]),
  requestedCheckOut: z.coerce.date(),
});
export type ContractChangeQuoteDto = z.infer<typeof contractChangeQuoteSchema>;

export const earlyCheckoutRequestSchema = z.object({
  requestedCheckOut: z.coerce.date(),
});
export type EarlyCheckoutRequestDto = z.infer<typeof earlyCheckoutRequestSchema>;

export const contractChangeDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});
export type ContractChangeDecisionDto = z.infer<typeof contractChangeDecisionSchema>;

// Exact requested check-out is authoritative. `months` is kept only so older
// clients do not break while the UI migrates to exact dates.
export const extensionRequestSchema = z
  .object({
    requestedCheckOut: z.coerce.date().optional(),
    months: z.coerce.number().int().min(1).max(24).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.requestedCheckOut && !data.months) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedCheckOut"],
        message: "변경할 퇴실일을 선택해주세요.",
      });
    }
  });
export type ExtensionRequestDto = z.infer<typeof extensionRequestSchema>;

export const contractChangePaymentSchema = z.object({
  provider: z.enum(["TOSS", "PORTONE", "STRIPE"]),
  paymentKey: z.string().min(1),
  amount: z.number().int().positive(),
});
export type ContractChangePaymentDto = z.infer<
  typeof contractChangePaymentSchema
>;

export const checkoutCompletionSchema = z.object({
  depositDeduction: z.coerce.number().int().min(0).default(0),
});
export type CheckoutCompletionDto = z.infer<
  typeof checkoutCompletionSchema
>;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

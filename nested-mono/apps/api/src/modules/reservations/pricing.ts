// ── Reservation pricing (pure domain logic) ─────────────────────────
// The single source of truth for how a reservation total is computed.
// Kept free of Nest/Prisma so it is trivially unit-testable and identical
// on the client (quote preview) and server (authoritative recompute).

export const SERVICE_FEE_RATE = 0.05; // 5% platform fee on first month

export interface PricingInput {
  monthlyRent: number; // KRW
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  months: number;
  discount?: number; // absolute KRW off, from a coupon
}

export interface PriceBreakdown {
  monthlyRent: number;
  months: number;
  rentSubtotal: number; // rent × months (informational)
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  discount: number;
  /** What the guest pays now to confirm: deposit + first month + fees − discount */
  dueNow: number;
  /** Full contract value over the whole stay */
  contractTotal: number;
}

export function computePrice(input: PricingInput): PriceBreakdown {
  const { monthlyRent, deposit, cleaningFee, maintenanceFee, months } = input;
  const discount = Math.max(0, Math.min(input.discount ?? 0, monthlyRent)); // never below zero month

  const serviceFee = Math.round(monthlyRent * SERVICE_FEE_RATE);
  const rentSubtotal = monthlyRent * months;

  // Due now = deposit + first month rent + cleaning + one month maintenance + fee − discount
  const dueNow =
    deposit + monthlyRent + cleaningFee + maintenanceFee + serviceFee - discount;

  const contractTotal =
    deposit + rentSubtotal + cleaningFee + maintenanceFee * months + serviceFee - discount;

  return {
    monthlyRent,
    months,
    rentSubtotal,
    deposit,
    cleaningFee,
    maintenanceFee,
    serviceFee,
    discount,
    dueNow,
    contractTotal,
  };
}

// Coupon application → returns absolute discount in KRW, respecting caps.
export function couponDiscount(
  coupon: { type: "FIXED" | "PERCENT"; value: number; maxDiscount?: number | null; minSpend: number },
  spend: number
): number {
  if (spend < coupon.minSpend) return 0;
  if (coupon.type === "FIXED") return Math.min(coupon.value, spend);
  const raw = Math.round((spend * coupon.value) / 100);
  return coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
}

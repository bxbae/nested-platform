// ── Reservation pricing (pure domain logic) ─────────────────────────
// Exact check-in/check-out dates are supported. Full calendar months are
// charged at the monthly rate and the final partial month is prorated by the
// number of days in that reservation month segment.

export const SERVICE_FEE_RATE = 0.05; // 5% platform fee on first month
export const MAX_STAY_MONTHS = 24;

export interface PricingInput {
  monthlyRent: number; // KRW
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  /** Legacy month-only callers remain supported. */
  months?: number;
  /** Exact stay window. When provided, this is the pricing source of truth. */
  checkIn?: Date;
  checkOut?: Date;
  discount?: number; // absolute KRW off, from a coupon
}

export interface PriceBreakdown {
  monthlyRent: number;
  /** Billing duration expressed as calendar-month units, including proration. */
  months: number;
  fullMonths: number;
  extraDays: number;
  rentSubtotal: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  maintenanceSubtotal: number;
  serviceFee: number;
  discount: number;
  /** What the guest pays now to confirm: deposit + first month + fees − discount */
  dueNow: number;
  /** Full contract value over the whole stay */
  contractTotal: number;
}

export interface StayCharge {
  fullMonths: number;
  extraDays: number;
  partialMonthDays: number;
  billingMonths: number;
  amount: number;
}

const DAY_MS = 86_400_000;

export function utcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** Add calendar months and clamp month-end dates (Jan 31 + 1 month → Feb 28/29). */
export function addCalendarMonths(date: Date, months: number): Date {
  const source = utcDay(date);
  const absoluteMonth = source.getUTCMonth() + months;
  const year = source.getUTCFullYear() + Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(source.getUTCDate(), lastDay)));
}

export function fullCalendarMonthsBetween(checkIn: Date, checkOut: Date): number {
  const start = utcDay(checkIn);
  const end = utcDay(checkOut);
  if (end <= start) return 0;

  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (addCalendarMonths(start, months) > end) months -= 1;
  return Math.max(0, months);
}

export function stayCharge(
  monthlyAmount: number,
  checkIn: Date,
  checkOut: Date,
): StayCharge {
  const start = utcDay(checkIn);
  const end = utcDay(checkOut);
  if (end <= start) {
    return {
      fullMonths: 0,
      extraDays: 0,
      partialMonthDays: 0,
      billingMonths: 0,
      amount: 0,
    };
  }

  const fullMonths = fullCalendarMonthsBetween(start, end);
  const anchor = addCalendarMonths(start, fullMonths);
  const nextAnchor = addCalendarMonths(anchor, 1);
  const extraDays = Math.max(0, Math.round((end.getTime() - anchor.getTime()) / DAY_MS));
  const partialMonthDays = Math.max(
    1,
    Math.round((nextAnchor.getTime() - anchor.getTime()) / DAY_MS),
  );
  const partialRatio = extraDays / partialMonthDays;
  const exactBillingMonths = fullMonths + partialRatio;
  const billingMonths = Number(exactBillingMonths.toFixed(6));
  const amount = Math.round(monthlyAmount * exactBillingMonths);

  return {
    fullMonths,
    extraDays,
    partialMonthDays,
    billingMonths,
    amount,
  };
}

export function proratedMonthlyAmount(
  monthlyAmount: number,
  checkIn: Date,
  checkOut: Date,
): number {
  return stayCharge(monthlyAmount, checkIn, checkOut).amount;
}

export function computePrice(input: PricingInput): PriceBreakdown {
  const { monthlyRent, deposit, cleaningFee, maintenanceFee } = input;
  const discount = Math.max(0, Math.min(input.discount ?? 0, monthlyRent));

  const duration =
    input.checkIn && input.checkOut
      ? stayCharge(monthlyRent, input.checkIn, input.checkOut)
      : {
          fullMonths: Math.max(0, input.months ?? 0),
          extraDays: 0,
          partialMonthDays: 0,
          billingMonths: Math.max(0, input.months ?? 0),
          amount: monthlyRent * Math.max(0, input.months ?? 0),
        };
  const maintenance =
    input.checkIn && input.checkOut
      ? stayCharge(maintenanceFee, input.checkIn, input.checkOut)
      : {
          amount: maintenanceFee * Math.max(0, input.months ?? 0),
        };

  const serviceFee = Math.round(monthlyRent * SERVICE_FEE_RATE);
  const rentSubtotal = duration.amount;
  const maintenanceSubtotal = maintenance.amount;

  // The platform minimum is one month, so the first monthly payment is always
  // payable in full at confirmation. Only the final partial month is prorated.
  const dueNow =
    deposit + monthlyRent + cleaningFee + maintenanceFee + serviceFee - discount;
  const contractTotal =
    deposit + rentSubtotal + cleaningFee + maintenanceSubtotal + serviceFee - discount;

  return {
    monthlyRent,
    months: duration.billingMonths,
    fullMonths: duration.fullMonths,
    extraDays: duration.extraDays,
    rentSubtotal,
    deposit,
    cleaningFee,
    maintenanceFee,
    maintenanceSubtotal,
    serviceFee,
    discount,
    dueNow,
    contractTotal,
  };
}

// Coupon application → returns absolute discount in KRW, respecting caps.
export function couponDiscount(
  coupon: {
    type: "FIXED" | "PERCENT";
    value: number;
    maxDiscount?: number | null;
    minSpend: number;
  },
  spend: number,
): number {
  if (spend < coupon.minSpend) return 0;
  if (coupon.type === "FIXED") return Math.min(coupon.value, spend);
  const raw = Math.round((spend * coupon.value) / 100);
  return coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
}

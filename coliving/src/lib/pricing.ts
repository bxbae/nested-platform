// ── Reservation pricing ─────────────────────────────────────────────
// Mirrors apps/api pricing.ts exactly so the client preview matches the
// server's authoritative recompute (ARCHITECTURE.md: quote is the price
// authority; the client only renders it).

export const SERVICE_FEE_RATE = 0.05; // 5% platform fee on first month

export interface PricingInput {
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  months: number;
  discount?: number;
}

export interface PriceBreakdown {
  monthlyRent: number;
  months: number;
  rentSubtotal: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  discount: number;
  dueNow: number; // deposit + first month + cleaning + one maintenance + fee − discount
  contractTotal: number; // full stay
}

export function computePrice(input: PricingInput): PriceBreakdown {
  const { monthlyRent, deposit, cleaningFee, maintenanceFee, months } = input;
  const discount = Math.max(0, Math.min(input.discount ?? 0, monthlyRent));

  const serviceFee = Math.round(monthlyRent * SERVICE_FEE_RATE);
  const rentSubtotal = monthlyRent * months;

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

// Add N months to a date, returning a new Date (check-out from check-in).
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

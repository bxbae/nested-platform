// ── Reservation pricing ─────────────────────────────────────────────
// Mirrors apps/api pricing.ts. Exact date ranges are supported: full calendar
// months are charged normally and the final partial month is prorated.

import { addCalendarMonths, parseISODate } from "@/lib/stay-dates";

export const SERVICE_FEE_RATE = 0.05;

export interface PricingInput {
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  months?: number;
  checkIn?: string;
  checkOut?: string;
  discount?: number;
}

export interface PriceBreakdown {
  monthlyRent: number;
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
  dueNow: number;
  contractTotal: number;
}

const DAY_MS = 86_400_000;

function fullCalendarMonthsBetween(checkIn: Date, checkOut: Date): number {
  if (checkOut <= checkIn) return 0;
  let months =
    (checkOut.getFullYear() - checkIn.getFullYear()) * 12 +
    (checkOut.getMonth() - checkIn.getMonth());
  if (addCalendarMonths(checkIn, months) > checkOut) months -= 1;
  return Math.max(0, months);
}

function stayCharge(monthlyAmount: number, checkIn: Date, checkOut: Date) {
  const fullMonths = fullCalendarMonthsBetween(checkIn, checkOut);
  const anchor = addCalendarMonths(checkIn, fullMonths);
  const nextAnchor = addCalendarMonths(anchor, 1);
  const extraDays = Math.max(
    0,
    Math.round((checkOut.getTime() - anchor.getTime()) / DAY_MS),
  );
  const partialMonthDays = Math.max(
    1,
    Math.round((nextAnchor.getTime() - anchor.getTime()) / DAY_MS),
  );
  const exactBillingMonths = fullMonths + extraDays / partialMonthDays;
  const billingMonths = Number(exactBillingMonths.toFixed(6));
  return {
    fullMonths,
    extraDays,
    billingMonths,
    amount: Math.round(monthlyAmount * exactBillingMonths),
  };
}

export function computePrice(input: PricingInput): PriceBreakdown {
  const { monthlyRent, deposit, cleaningFee, maintenanceFee } = input;
  const discount = Math.max(0, Math.min(input.discount ?? 0, monthlyRent));

  const exactRange = Boolean(input.checkIn && input.checkOut);
  const rent = exactRange
    ? stayCharge(
        monthlyRent,
        parseISODate(input.checkIn!),
        parseISODate(input.checkOut!),
      )
    : {
        fullMonths: Math.max(0, input.months ?? 0),
        extraDays: 0,
        billingMonths: Math.max(0, input.months ?? 0),
        amount: monthlyRent * Math.max(0, input.months ?? 0),
      };
  const maintenance = exactRange
    ? stayCharge(
        maintenanceFee,
        parseISODate(input.checkIn!),
        parseISODate(input.checkOut!),
      )
    : {
        amount: maintenanceFee * Math.max(0, input.months ?? 0),
      };

  const serviceFee = Math.round(monthlyRent * SERVICE_FEE_RATE);
  const dueNow =
    deposit + monthlyRent + cleaningFee + maintenanceFee + serviceFee - discount;
  const contractTotal =
    deposit + rent.amount + cleaningFee + maintenance.amount + serviceFee - discount;

  return {
    monthlyRent,
    months: rent.billingMonths,
    fullMonths: rent.fullMonths,
    extraDays: rent.extraDays,
    rentSubtotal: rent.amount,
    deposit,
    cleaningFee,
    maintenanceFee,
    maintenanceSubtotal: maintenance.amount,
    serviceFee,
    discount,
    dueNow,
    contractTotal,
  };
}

// Legacy helper retained for existing extension and demo code.
export function addMonths(date: Date, months: number): Date {
  return addCalendarMonths(date, months);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

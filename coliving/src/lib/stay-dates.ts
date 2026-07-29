export const PLATFORM_MIN_STAY_MONTHS = 1;
export const PLATFORM_MAX_STAY_MONTHS = 24;

export function normalizeISODate(value: string): string {
  const normalized = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

export function parseISODate(value: string): Date {
  const normalized = normalizeISODate(value);
  if (!normalized) return new Date(Number.NaN);

  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addCalendarMonths(date: Date, months: number): Date {
  const source = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const targetMonth = source.getMonth() + months;
  const targetYear = source.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return new Date(targetYear, normalizedMonth, Math.min(source.getDate(), lastDay));
}

export function addCalendarMonthsISO(value: string, months: number): string {
  const normalized = normalizeISODate(value);
  if (!normalized) return "";
  return toLocalISODate(addCalendarMonths(parseISODate(normalized), months));
}

export function minimumCheckOutISO(
  checkIn: string,
  minStayMonths = PLATFORM_MIN_STAY_MONTHS,
): string {
  return addCalendarMonthsISO(
    checkIn,
    Math.max(PLATFORM_MIN_STAY_MONTHS, minStayMonths),
  );
}

export function completedCalendarMonths(
  checkIn: string,
  checkOut: string,
): number {
  const startValue = normalizeISODate(checkIn);
  const endValue = normalizeISODate(checkOut);
  if (!startValue || !endValue) return 0;

  const start = parseISODate(startValue);
  const end = parseISODate(endValue);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return 0;
  }

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (addCalendarMonths(start, months) > end) months -= 1;
  return Math.max(0, months);
}

export function stayDurationParts(checkIn: string, checkOut: string): {
  months: number;
  days: number;
} {
  const startValue = normalizeISODate(checkIn);
  const endValue = normalizeISODate(checkOut);
  if (!startValue || !endValue || endValue <= startValue) {
    return { months: 0, days: 0 };
  }

  const months = completedCalendarMonths(startValue, endValue);
  const start = parseISODate(startValue);
  const end = parseISODate(endValue);
  const monthAnchor = addCalendarMonths(start, months);
  const days = Math.max(
    0,
    Math.round((end.getTime() - monthAnchor.getTime()) / 86_400_000),
  );
  return { months, days };
}

export function formatStayDuration(checkIn: string, checkOut: string): string {
  const { months, days } = stayDurationParts(checkIn, checkOut);
  if (months <= 0 && days <= 0) return "";
  if (months > 0 && days > 0) return `${months}개월 ${days}일`;
  if (months > 0) return `${months}개월`;
  return `${days}일`;
}

export function isStayAtLeastMonths(
  checkIn: string,
  checkOut: string,
  minStayMonths = PLATFORM_MIN_STAY_MONTHS,
): boolean {
  const normalizedCheckOut = normalizeISODate(checkOut);
  const minimum = minimumCheckOutISO(checkIn, minStayMonths);
  return Boolean(minimum && normalizedCheckOut && normalizedCheckOut >= minimum);
}

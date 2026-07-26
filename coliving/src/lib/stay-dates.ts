export const PLATFORM_MIN_STAY_MONTHS = 1;
export const PLATFORM_MAX_STAY_MONTHS = 24;

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return toLocalISODate(addCalendarMonths(parseISODate(value), months));
}

export function minimumCheckOutISO(
  checkIn: string,
  minStayMonths = PLATFORM_MIN_STAY_MONTHS,
): string {
  return addCalendarMonthsISO(checkIn, Math.max(PLATFORM_MIN_STAY_MONTHS, minStayMonths));
}

export function completedCalendarMonths(checkIn: string, checkOut: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return 0;
  }
  const start = parseISODate(checkIn);
  const end = parseISODate(checkOut);
  if (end <= start) return 0;

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
  const months = completedCalendarMonths(checkIn, checkOut);
  if (months <= 0 && checkOut <= checkIn) return { months: 0, days: 0 };

  const start = parseISODate(checkIn);
  const end = parseISODate(checkOut);
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
  const minimum = minimumCheckOutISO(checkIn, minStayMonths);
  return Boolean(minimum && checkOut >= minimum);
}

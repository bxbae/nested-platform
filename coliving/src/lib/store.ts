import type { Booking } from "./types";

// A tiny in-memory store standing in for a database. In production this is
// where Prisma / Postgres would live behind the same interface.
declare global {
  // eslint-disable-next-line no-var
  var __bookings: Booking[] | undefined;
}

const bookings: Booking[] = globalThis.__bookings ?? [];
globalThis.__bookings = bookings;

export const SERVICE_FEE_RATE = 0.05;

export function listBookings(): Booking[] {
  return [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addBooking(b: Booking): Booking {
  bookings.push(b);
  return b;
}

export function updateBooking(
  id: string,
  patch: Partial<Booking>
): Booking | undefined {
  const b = bookings.find((x) => x.id === id);
  if (!b) return undefined;
  Object.assign(b, patch);
  return b;
}

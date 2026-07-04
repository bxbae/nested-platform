// ── Reservations service ────────────────────────────────────────────
// Bridges two different reservation contracts:
//
//   Frontend BookingWidget (demo):  request-hold  →  pay
//   NestJS API (real):              quote → create(PENDING_PAYMENT) → payments/confirm
//
// Real path:
//   requestBooking()  → POST /reservations         (server recomputes price)
//   confirmBooking()  → POST /payments/confirm      (PSP-verified)
//   checkAvailability()→ POST /reservations/quote   (also validates dates)
//
// The quote endpoint doubles as availability + authoritative price. If it
// throws (e.g. past date, min-stay), we surface the message as "unavailable".

import { USE_REAL_API } from "./config";
import { api, ApiError } from "./client";
import { toISODate, addMonths } from "@/lib/pricing";

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  checkOut?: string;
}

export interface CreatedBooking {
  id: string;
  status: string;
  totalDueNow?: number;
}

// ── availability / quote ──
export async function checkAvailability(input: {
  houseId: string;
  checkIn: string;
  months: number;
}): Promise<AvailabilityResult> {
  if (!USE_REAL_API) {
    const params = new URLSearchParams({
      houseId: input.houseId,
      checkIn: input.checkIn,
      months: String(input.months),
    });
    const res = await fetch(`/api/availability?${params}`);
    return res.json();
  }

  try {
    await api.post("/reservations/quote", {
      roomId: input.houseId,
      checkIn: input.checkIn,
      months: input.months,
    });
    return {
      available: true,
      checkOut: toISODate(addMonths(new Date(input.checkIn), input.months)),
    };
  } catch (e) {
    const reason = e instanceof ApiError ? e.message : "예약할 수 없는 날짜입니다.";
    return { available: false, reason };
  }
}

// ── create a hold (PENDING_PAYMENT) ──
export async function requestBooking(input: {
  houseId: string;
  guestName: string;
  moveIn: string;
  months: number;
}): Promise<CreatedBooking> {
  if (!USE_REAL_API) {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "request",
        houseId: input.houseId,
        guestName: input.guestName,
        moveIn: input.moveIn,
        months: input.months,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "예약 요청에 실패했습니다.");
    }
    const { booking } = await res.json();
    return { id: booking.id, status: booking.status, totalDueNow: booking.totalDueNow };
  }

  const r = await api.post<{ id: string; status: string; totalDueNow?: number }>(
    "/reservations",
    {
      roomId: input.houseId,
      checkIn: input.moveIn,
      months: input.months,
    }
  );
  return { id: r.id, status: r.status, totalDueNow: r.totalDueNow };
}

// ── confirm payment ──
export async function confirmBooking(input: {
  reservationId: string;
  amount: number;
  // PSP fields — demo uses a stub key; production passes the real one.
  provider?: "TOSS" | "PORTONE" | "STRIPE";
  paymentKey?: string;
}): Promise<CreatedBooking> {
  if (!USE_REAL_API) {
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: input.reservationId, status: "paid" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "결제에 실패했습니다.");
    }
    const { booking } = await res.json();
    return { id: booking.id, status: booking.status };
  }

  const r = await api.post<{ id: string; status: string }>("/payments/confirm", {
    reservationId: input.reservationId,
    provider: input.provider ?? "TOSS",
    paymentKey: input.paymentKey ?? `demo_${Date.now()}`,
    amount: input.amount,
  });
  return { id: r.id, status: r.status };
}

export async function cancelBooking(reservationId: string): Promise<void> {
  if (!USE_REAL_API) {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reservationId, status: "cancelled" }),
    });
    return;
  }
  await api.patch(`/reservations/${reservationId}/cancel`);
}

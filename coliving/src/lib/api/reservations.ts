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

// ── My trips (예약 내역) ── GET /reservations, adapted to the Booking shape
// the TripsList UI expects. Demo mode reads the in-repo /api/bookings route.
import type { Booking } from "@/lib/types";

interface ApiReservation {
  id: string;
  months: number;
  checkIn: string;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  totalDueNow: number;
  status: string;
  createdAt: string;
  room: { id: string; name: string; region: string; image: string | null };
}

function mapStatus(s: string): Booking["status"] {
  if (s === "CONFIRMED") return "paid";
  if (s === "PENDING_PAYMENT") return "hold";
  return "cancelled";
}

// ── Host: reservations received on my listings ──
// The four statuses a host can act on, plus the raw server status so the UI can
// show "completed" / "no-show" distinctly (Booking's 3-state map is guest-side).
export type HostReservationStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED_BY_GUEST"
  | "CANCELLED_BY_HOST"
  | "COMPLETED"
  | "NO_SHOW";

export interface HostReservation {
  id: string;
  houseId: string;
  houseName: string;
  region: string;
  image: string | null;
  guestName: string;
  guestAvatarColor: string;
  moveIn: string; // YYYY-MM-DD
  months: number;
  monthlyRent: number;
  totalDueNow: number;
  status: HostReservationStatus;
  createdAt: string;
}

interface ApiHostReservation extends ApiReservation {
  guest: { id: string; name: string; avatarColor: string };
}

// GET /reservations/host — every reservation across the listings I host.
export async function listHostReservations(): Promise<HostReservation[]> {
  if (!USE_REAL_API) {
    // Demo mode: reuse the local bookings endpoint, filtered to my listings.
    try {
      const res = await fetch("/api/bookings");
      if (!res.ok) return [];
      const data = await res.json();
      const list: Booking[] = Array.isArray(data) ? data : (data.bookings ?? []);
      return list.map((b) => ({
        id: b.id,
        houseId: b.houseId,
        houseName: b.houseName,
        region: "",
        image: null,
        guestName: b.guestName || "게스트",
        guestAvatarColor: "#FF5A5F",
        moveIn: b.moveIn,
        months: b.months,
        monthlyRent: b.monthlyRent,
        totalDueNow: b.totalDueNow,
        status:
          b.status === "paid" ? "CONFIRMED" : b.status === "cancelled" ? "CANCELLED_BY_HOST" : "PENDING_PAYMENT",
        createdAt: b.createdAt,
      }));
    } catch {
      return [];
    }
  }
  try {
    const rows = await api.get<ApiHostReservation[]>("/reservations/host");
    return rows.map((r) => ({
      id: r.id,
      houseId: r.room.id,
      houseName: r.room.name,
      region: r.room.region,
      image: r.room.image,
      guestName: r.guest?.name ?? "게스트",
      guestAvatarColor: r.guest?.avatarColor ?? "#FF5A5F",
      moveIn: r.checkIn.slice(0, 10),
      months: r.months,
      monthlyRent: r.monthlyRent,
      totalDueNow: r.totalDueNow,
      status: r.status as HostReservationStatus,
      createdAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}

// PATCH /reservations/:id/host-status — approve / reject / complete / no-show.
export async function setHostReservationStatus(
  id: string,
  status: "CONFIRMED" | "CANCELLED_BY_HOST" | "COMPLETED" | "NO_SHOW"
): Promise<void> {
  if (!USE_REAL_API) {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: status === "CONFIRMED" ? "paid" : "cancelled" }),
    });
    return;
  }
  await api.patch(`/reservations/${id}/host-status`, { status });
}

export async function listMyBookings(): Promise<Booking[]> {
  if (!USE_REAL_API) {
    const res = await fetch("/api/bookings");
    if (!res.ok) return [];
    return res.json();
  }
  try {
    const rows = await api.get<ApiReservation[]>("/reservations");
    return rows.map((r) => ({
      id: r.id,
      houseId: r.room.id,
      houseName: r.room.name,
      guestName: "",
      moveIn: r.checkIn.slice(0, 10),
      months: r.months,
      monthlyRent: r.monthlyRent,
      deposit: r.deposit,
      cleaningFee: r.cleaningFee,
      maintenanceFee: r.maintenanceFee,
      serviceFee: r.serviceFee,
      totalDueNow: r.totalDueNow,
      serviceFeeRate: 0.05,
      status: mapStatus(r.status),
      createdAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}

// POST /host/overdue/:reservationId — send an overdue-payment notice to the
// reservation's guest (delivered as an in-app notification). Optional custom
// message; the server fills a default if omitted.
export async function sendOverdueNotice(reservationId: string, message?: string): Promise<void> {
  if (!USE_REAL_API) return;
  await api.post(`/host/overdue/${reservationId}`, message ? { message } : {});
}

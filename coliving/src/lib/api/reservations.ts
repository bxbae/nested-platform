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
import type { BookingMode } from "@/lib/types";

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  checkOut?: string;
  price?: QuotedPrice;
  couponError?: boolean;
}

// 서버가 계산한 금액 내역. 쿠폰 검증(유효기간·소진·최소금액)은 서버에만
// 있으므로, 화면은 이 값을 그대로 표시한다.
export interface QuotedPrice {
  monthlyRent: number;
  months: number;
  rentSubtotal: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  discount: number;
  dueNow: number;
  contractTotal: number;
  bookingMode?: "UNIT" | "BED" | "WHOLE_ROOM";
  reservedSpots?: number;
  remainingSpots?: number | null;
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
  couponCode?: string;
  bookingMode?: BookingMode;
  reservedSpots?: number;
}): Promise<AvailabilityResult> {
  if (!USE_REAL_API) {
    const params = new URLSearchParams({
      houseId: input.houseId,
      checkIn: input.checkIn,
      months: String(input.months),
      ...(input.bookingMode ? { bookingMode: input.bookingMode } : {}),
      ...(input.reservedSpots ? { reservedSpots: String(input.reservedSpots) } : {}),
    });
    const res = await fetch(`/api/availability?${params}`);
    return res.json();
  }

  try {
    const quote = await api.post<QuotedPrice & { checkOut: string }>(
      "/reservations/quote",
      {
        roomId: input.houseId,
        checkIn: input.checkIn,
        months: input.months,
        ...(input.bookingMode ? { bookingMode: input.bookingMode.toUpperCase() } : {}),
        ...(input.reservedSpots ? { reservedSpots: input.reservedSpots } : {}),
        ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      }
    );
    return {
      available: true,
      checkOut: quote.checkOut ?? toISODate(addMonths(new Date(input.checkIn), input.months)),
      price: quote,
    };
  } catch (e) {
    const reason = e instanceof ApiError ? e.message : "예약할 수 없는 날짜입니다.";
    const code =
      e instanceof ApiError && e.body && typeof e.body === "object"
        ? (e.body as { code?: string }).code
        : undefined;
    const couponError =
      code === "COUPON_INVALID" || code === "COUPON_EXPIRED" || code === "COUPON_EXHAUSTED";
    return { available: false, reason, couponError };
  }
}

// ── create a hold (PENDING_PAYMENT) ──
export async function requestBooking(input: {
  houseId: string;
  guestName: string;
  moveIn: string;
  months: number;
  couponCode?: string;
  /** 함께 살 룸메이트. 지정하면 상대에게 수락 대기 초대가 걸린다. */
  companionId?: string;
  bookingMode?: BookingMode;
  reservedSpots?: number;
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
        bookingMode: input.bookingMode,
        reservedSpots: input.reservedSpots,
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
      ...(input.bookingMode ? { bookingMode: input.bookingMode.toUpperCase() } : {}),
      ...(input.reservedSpots ? { reservedSpots: input.reservedSpots } : {}),
      ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      ...(input.companionId ? { companionId: input.companionId } : {}),
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

// ── 공동 예약 초대 (룸메이트와 함께) ─────────────────────────────────
export type CompanionStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface CompanionInvite {
  id: string;
  roomId: string;
  room: { id: string; name: string; region: string; image: string | null };
  checkIn: string;
  checkOut: string;
  months: number;
  companionStatus: CompanionStatus | null;
  totalDueNow: number;
  createdAt: string;
}

// GET /reservations/invites — 내가 룸메이트로 초대된 예약들
export async function listCompanionInvites(): Promise<CompanionInvite[]> {
  if (!USE_REAL_API) return [];
  try {
    return await api.get<CompanionInvite[]>("/reservations/invites");
  } catch {
    return [];
  }
}

// PATCH /reservations/:id/companion — 초대 수락 / 거절
export async function respondToInvite(
  reservationId: string,
  decision: "accept" | "decline",
): Promise<void> {
  await api.patch(`/reservations/${reservationId}/companion`, { decision });
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
  checkOut?: string;
  extensionMonths?: number | null;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  totalDueNow: number;
  status: string;
  bookingMode?: "UNIT" | "BED" | "WHOLE_ROOM";
  reservedSpots?: number;
  createdAt: string;
  room: { id: string; name: string; region: string; image: string | null };
  payment: { id: string; provider: string; amount: number; status: string; createdAt: string } | null;
}

function mapStatus(s: string): Booking["status"] {
  if (s === "CONFIRMED") return "paid";
  if (s === "PENDING_PAYMENT") return "hold";
  return "cancelled";
}

// ── My payments (결제 내역) ── derived from the same GET /reservations call,
// since Payment is 1:1 with Reservation. No separate endpoint needed.
export interface PaymentRecord {
  id: string;
  houseName: string;
  amount: number;
  method: string;
  date: string;
  status: "완료" | "환불";
}

const PROVIDER_LABELS: Record<string, string> = {
  TOSS: "토스페이먼츠",
  PORTONE: "포트원",
  STRIPE: "Stripe",
};

export async function listMyPayments(): Promise<PaymentRecord[]> {
  if (!USE_REAL_API) {
    const res = await fetch("/api/bookings");
    if (!res.ok) return [];
    const { bookings } = await res.json();
    return (bookings as Booking[])
      .filter((b) => b.status === "paid" || b.status === "cancelled")
      .map((b) => ({
        id: b.id,
        houseName: b.houseName,
        amount: b.totalDueNow,
        method: "카드결제",
        date: b.createdAt.slice(0, 10).replace(/-/g, "."),
        status: b.status === "paid" ? "완료" : "환불",
      }));
  }

  try {
    const rows = await api.get<ApiReservation[]>("/reservations");
    return rows
      .filter((r) => r.payment) // only reservations that actually reached payment
      .map((r) => ({
        id: r.payment!.id,
        houseName: r.room.name,
        amount: r.payment!.amount,
        method: PROVIDER_LABELS[r.payment!.provider] ?? r.payment!.provider,
        date: r.payment!.createdAt.slice(0, 10).replace(/-/g, "."),
        status: r.payment!.status === "COMPLETED" ? "완료" : "환불",
      }));
  } catch {
    return [];
  }
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
  | "NO_SHOW"
  | "EARLY_CHECKOUT_REQUESTED"
  | "EARLY_CHECKOUT_APPROVED"
  | "EXTENSION_REQUESTED";

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
  bookingMode?: BookingMode;
  reservedSpots?: number;
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
      bookingMode: r.bookingMode?.toLowerCase() as BookingMode | undefined,
      reservedSpots: r.reservedSpots ?? 1,
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
    const data = await res.json();
    return Array.isArray(data) ? data : (data.bookings ?? []);
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
      rawStatus: r.status,
      bookingMode: r.bookingMode?.toLowerCase() as BookingMode | undefined,
      reservedSpots: r.reservedSpots ?? 1,
      checkOut: r.checkOut?.slice(0, 10),
      extensionMonths: (r as { extensionMonths?: number | null }).extensionMonths ?? null,
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

// PATCH /reservations/:id/early-checkout — guest requests an early checkout on
// a confirmed reservation (waits for host approval).
export async function requestEarlyCheckout(reservationId: string): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/early-checkout`);
}

// PATCH /reservations/:id/early-checkout/decision — host approves or rejects.
export async function decideEarlyCheckout(
  reservationId: string,
  decision: "approve" | "reject"
): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/early-checkout/decision`, { decision });
}

// ── 계약 연장 ──
// PATCH /reservations/:id/extension — guest asks to stay N more months.
export async function requestExtension(reservationId: string, months: number): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/extension`, { months });
}

// PATCH /reservations/:id/extension/decision — host approves or rejects.
export async function decideExtension(
  reservationId: string,
  decision: "approve" | "reject"
): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/extension/decision`, { decision });
}

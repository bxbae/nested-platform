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
import type { BookingMode, ContractChangeRequest } from "@/lib/types";

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
  discountPercent: number;
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
  checkOut: string;
  couponCode?: string;
  bookingMode?: BookingMode;
  reservedSpots?: number;
  companionCount?: number;
}): Promise<AvailabilityResult> {
  if (!USE_REAL_API) {
    const params = new URLSearchParams({
      houseId: input.houseId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
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
        checkOut: input.checkOut,
        ...(input.bookingMode ? { bookingMode: input.bookingMode.toUpperCase() } : {}),
        ...(input.reservedSpots ? { reservedSpots: input.reservedSpots } : {}),
        ...(input.companionCount != null
          ? { companionCount: input.companionCount }
          : {}),
        ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      }
    );
    return {
      available: true,
      checkOut: quote.checkOut ?? input.checkOut,
      price: quote,
    };
  } catch (e) {
    const reason = e instanceof ApiError ? e.message : "예약할 수 없는 날짜입니다.";
    const code =
      e instanceof ApiError && e.body && typeof e.body === "object"
        ? (e.body as { code?: string }).code
        : undefined;
    const couponError =
      code === "COUPON_INVALID" ||
      code === "COUPON_EXPIRED" ||
      code === "COUPON_EXHAUSTED" ||
      code === "COUPON_MIN_SPEND" ||
      code === "COUPON_ALREADY_USED" ||
      code === "COUPON_NOT_OWNER";
    return { available: false, reason, couponError };
  }
}

// ── create a hold (PENDING_PAYMENT) ──
export async function requestBooking(input: {
  houseId: string;
  guestName: string;
  moveIn: string;
  checkOut: string;
  couponCode?: string;
  /** 기존 단일 동반자 필드. 이전 클라이언트 호환용. */
  companionId?: string;
  /** 함께 입주할 친구들. 친구 목록에서 선택한 고유 ID만 보낸다. */
  companionIds?: string[];
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
        checkOut: input.checkOut,
        bookingMode: input.bookingMode,
        reservedSpots: input.reservedSpots,
        companionIds: input.companionIds,
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
      checkOut: input.checkOut,
      ...(input.bookingMode ? { bookingMode: input.bookingMode.toUpperCase() } : {}),
      ...(input.reservedSpots ? { reservedSpots: input.reservedSpots } : {}),
      ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      ...(input.companionId ? { companionId: input.companionId } : {}),
      ...(input.companionIds?.length ? { companionIds: input.companionIds } : {}),
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
export type CompanionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "EXPIRED";

export interface CompanionInvite {
  id: string;
  roomId: string;
  room: { id: string; name: string; region: string; image: string | null };
  inviter?: { id: string; name: string };
  checkIn: string;
  checkOut: string;
  months: number;
  reservationStatus?: string;
  companionStatus: CompanionStatus | null;
  requiresIndividualPayment?: boolean;
  inviteExpiresAt?: string | null;
  paymentDeadline?: string | null;
  paidAt?: string | null;
  expiredAt?: string | null;
  individualPayment?: {
    monthlyRent: number;
    deposit: number;
    cleaningFee: number;
    maintenanceFee: number;
    serviceFee: number;
    discount: number;
    totalDueNow: number;
    provider?: string | null;
    providerTxnId?: string | null;
  } | null;
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
): Promise<{
  status: CompanionStatus;
  requiresIndividualPayment: boolean;
  paymentDeadline: string | null;
  totalDueNow: number;
}> {
  return api.patch(`/reservations/${reservationId}/companion`, { decision });
}

export async function confirmCompanionPayment(input: {
  reservationId: string;
  amount: number;
  provider?: "TOSS" | "PORTONE" | "STRIPE";
  paymentKey?: string;
}): Promise<void> {
  await api.post(`/reservations/${input.reservationId}/companion/payment`, {
    provider: input.provider ?? "TOSS",
    paymentKey: input.paymentKey ?? `demo_companion_${Date.now()}`,
    amount: input.amount,
  });
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

interface ApiContractChange {
  id: string;
  type: "EARLY_CHECKOUT" | "EXTENSION";
  status:
    | "HOST_REVIEW"
    | "PAYMENT_PENDING"
    | "APPROVED"
    | "REJECTED"
    | "CANCELLED"
    | "EXPIRED"
    | "COMPLETED";
  originalCheckOut: string;
  requestedCheckOut: string;
  additionalRent: number;
  additionalMaintenance: number;
  additionalServiceFee: number;
  additionalAmount: number;
  estimatedRefund: number;
  depositDeduction: number;
  finalRefund: number | null;
  rejectReason: string | null;
  paymentProvider: string | null;
  paymentDeadline: string | null;
  paidAt: string | null;
  appliedAt: string | null;
  actualCheckOut: string | null;
  createdAt: string;
}

function mapContractChange(
  change?: ApiContractChange | null,
): ContractChangeRequest | null {
  if (!change) return null;
  return {
    ...change,
    originalCheckOut: change.originalCheckOut.slice(0, 10),
    requestedCheckOut: change.requestedCheckOut.slice(0, 10),
    paymentDeadline: change.paymentDeadline ?? null,
    paidAt: change.paidAt ?? null,
    appliedAt: change.appliedAt ?? null,
    actualCheckOut: change.actualCheckOut
      ? change.actualCheckOut.slice(0, 10)
      : null,
  };
}

interface ApiReservation {
  id: string;
  months: number;
  checkIn: string;
  checkOut?: string;
  extensionMonths?: number | null;
  originalCheckOut?: string | null;
  actualCheckOut?: string | null;
  contractChanges?: ApiContractChange[];
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
  room: {
    id: string;
    name: string;
    region: string;
    image: string | null;
    rentalUnit?: "WHOLE" | "PRIVATE_ROOM" | "BED" | null;
    capacity?: number | null;
  };
  companions?: {
    status: CompanionStatus;
    requiresIndividualPayment?: boolean;
    inviteExpiresAt?: string | null;
    paymentDeadline?: string | null;
    paidAt?: string | null;
    expiredAt?: string | null;
    totalDueNow?: number;
    user: { id: string; name: string; avatarColor: string };
  }[];
  payment: { id: string; provider: string; amount: number; status: string; createdAt: string } | null;
}

function mapStatus(s: string): Booking["status"] {
  if (s === "PENDING_PAYMENT") return "hold";
  if (
    [
      "CONFIRMED",
      "EARLY_CHECKOUT_REQUESTED",
      "EARLY_CHECKOUT_APPROVED",
      "EXTENSION_REQUESTED",
      "COMPLETED",
    ].includes(s)
  ) {
    return "paid";
  }
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
    const records: PaymentRecord[] = [];

    for (const reservation of rows) {
      if (reservation.payment) {
        records.push({
          id: reservation.payment.id,
          houseName: reservation.room.name,
          amount: reservation.payment.amount,
          method:
            PROVIDER_LABELS[reservation.payment.provider] ??
            reservation.payment.provider,
          date: reservation.payment.createdAt
            .slice(0, 10)
            .replace(/-/g, "."),
          status:
            reservation.payment.status === "REFUNDED"
              ? "환불"
              : "완료",
        });
      }

      for (const change of reservation.contractChanges ?? []) {
        if (
          change.type === "EXTENSION" &&
          change.paidAt &&
          change.additionalAmount > 0
        ) {
          records.push({
            id: `extension-${change.id}`,
            houseName: `${reservation.room.name} · 계약 연장`,
            amount: change.additionalAmount,
            method:
              PROVIDER_LABELS[change.paymentProvider ?? ""] ??
              change.paymentProvider ??
              "추가 결제",
            date: change.paidAt.slice(0, 10).replace(/-/g, "."),
            status: "완료",
          });
        }

        if (
          change.type === "EARLY_CHECKOUT" &&
          change.status === "COMPLETED" &&
          (change.finalRefund ?? 0) > 0
        ) {
          records.push({
            id: `refund-${change.id}`,
            houseName: `${reservation.room.name} · 조기 퇴실 반환`,
            amount: change.finalRefund ?? 0,
            method: "환불·보증금 반환",
            date: (change.actualCheckOut ?? change.createdAt)
              .slice(0, 10)
              .replace(/-/g, "."),
            status: "환불",
          });
        }
      }
    }

    const companionInvites = await listCompanionInvites();
    for (const invite of companionInvites) {
      if (
        invite.companionStatus !== "PAID" ||
        !invite.paidAt ||
        !invite.individualPayment
      ) {
        continue;
      }
      records.push({
        id: `companion-${invite.id}`,
        houseName: `${invite.room.name} · 룸메이트 1자리`,
        amount: invite.individualPayment.totalDueNow,
        method:
          PROVIDER_LABELS[invite.individualPayment.provider ?? ""] ??
          invite.individualPayment.provider ??
          "개별 결제",
        date: invite.paidAt.slice(0, 10).replace(/-/g, "."),
        status: "완료",
      });
    }

    return records.sort((a, b) => b.date.localeCompare(a.date));
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
  checkOut: string; // YYYY-MM-DD
  months: number;
  monthlyRent: number;
  totalDueNow: number;
  status: HostReservationStatus;
  bookingMode?: BookingMode;
  reservedSpots?: number;
  rentalUnit?: "whole" | "private_room" | "bed" | null;
  capacity?: number | null;
  companions: {
    name: string;
    requiresIndividualPayment?: boolean;
    status: CompanionStatus;
    inviteExpiresAt?: string | null;
    paymentDeadline?: string | null;
    paidAt?: string | null;
    expiredAt?: string | null;
    totalDueNow?: number;
  }[];
  latestContractChange?: ContractChangeRequest | null;
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
        checkOut: b.checkOut ?? toISODate(addMonths(new Date(b.moveIn), b.months)),
        months: b.months,
        monthlyRent: b.monthlyRent,
        totalDueNow: b.totalDueNow,
        status:
          b.status === "paid" ? "CONFIRMED" : b.status === "cancelled" ? "CANCELLED_BY_HOST" : "PENDING_PAYMENT",
        bookingMode: b.bookingMode,
        reservedSpots: b.reservedSpots ?? 1,
        rentalUnit:
          b.bookingMode === "bed"
            ? "bed"
            : b.bookingMode === "whole_room"
              ? "whole"
              : "private_room",
        capacity: null,
        companions: [],
        latestContractChange: b.latestContractChange ?? null,
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
      checkOut: (r.checkOut ?? r.checkIn).slice(0, 10),
      months: r.months,
      monthlyRent: r.monthlyRent,
      totalDueNow: r.totalDueNow,
      status: r.status as HostReservationStatus,
      bookingMode: r.bookingMode?.toLowerCase() as BookingMode | undefined,
      reservedSpots: r.reservedSpots ?? 1,
      rentalUnit: r.room.rentalUnit?.toLowerCase() as HostReservation["rentalUnit"],
      capacity: r.room.capacity ?? null,
      companions: (r.companions ?? []).map((companion) => ({
        name: companion.user.name,
        requiresIndividualPayment:
          companion.requiresIndividualPayment ?? false,
        status: companion.status,
        inviteExpiresAt: companion.inviteExpiresAt ?? null,
        paymentDeadline: companion.paymentDeadline ?? null,
        paidAt: companion.paidAt ?? null,
        expiredAt: companion.expiredAt ?? null,
        totalDueNow: companion.totalDueNow ?? 0,
      })),
      latestContractChange: mapContractChange(r.contractChanges?.[0]),
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
      extensionMonths: r.extensionMonths ?? null,
      latestContractChange: mapContractChange(r.contractChanges?.[0]),
      companions: (r.companions ?? []).map((companion) => ({
        name: companion.user.name,
        requiresIndividualPayment:
          companion.requiresIndividualPayment ?? false,
        status: companion.status,
        paymentDeadline: companion.paymentDeadline ?? null,
        paidAt: companion.paidAt ?? null,
        totalDueNow: companion.totalDueNow ?? 0,
      })),
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

export interface ContractChangeQuote {
  type: "EARLY_CHECKOUT" | "EXTENSION";
  originalCheckOut: string;
  requestedCheckOut: string;
  changedDays: number;
  minimumContractEnd: string | null;
  minimumStaySatisfied: boolean;
  additionalRent: number;
  additionalMaintenance: number;
  additionalServiceFee: number;
  additionalAmount: number;
  estimatedRefund: number;
}

export async function quoteContractChange(
  reservationId: string,
  type: "EARLY_CHECKOUT" | "EXTENSION",
  requestedCheckOut: string,
): Promise<ContractChangeQuote> {
  if (!USE_REAL_API) {
    throw new Error("데모 모드에서는 계약 변경 견적을 지원하지 않습니다.");
  }
  const result = await api.post<
    Omit<
      ContractChangeQuote,
      "originalCheckOut" | "requestedCheckOut" | "minimumContractEnd"
    > & {
      originalCheckOut: string;
      requestedCheckOut: string;
      minimumContractEnd: string | null;
    }
  >(`/reservations/${reservationId}/contract-change/quote`, {
    type,
    requestedCheckOut,
  });

  return {
    ...result,
    originalCheckOut: result.originalCheckOut.slice(0, 10),
    requestedCheckOut: result.requestedCheckOut.slice(0, 10),
    minimumContractEnd: result.minimumContractEnd
      ? result.minimumContractEnd.slice(0, 10)
      : null,
  };
}

export async function requestEarlyCheckout(
  reservationId: string,
  requestedCheckOut: string,
): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/early-checkout`, {
    requestedCheckOut,
  });
}

export async function requestExtension(
  reservationId: string,
  requestedCheckOut: string,
): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/extension`, {
    requestedCheckOut,
  });
}

export async function cancelContractChange(
  reservationId: string,
): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/contract-change/cancel`);
}

export async function decideEarlyCheckout(
  reservationId: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/early-checkout/decision`, {
    decision,
    ...(reason ? { reason } : {}),
  });
}

export async function decideExtension(
  reservationId: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/reservations/${reservationId}/extension/decision`, {
    decision,
    ...(reason ? { reason } : {}),
  });
}

export async function confirmExtensionPayment(input: {
  reservationId: string;
  amount: number;
  provider?: "TOSS" | "PORTONE" | "STRIPE";
  paymentKey?: string;
}): Promise<void> {
  if (!USE_REAL_API) return;
  await api.post(`/reservations/${input.reservationId}/extension/payment`, {
    provider: input.provider ?? "TOSS",
    paymentKey: input.paymentKey ?? `extension_demo_${Date.now()}`,
    amount: input.amount,
  });
}

export async function completeEarlyCheckout(
  reservationId: string,
  depositDeduction: number,
): Promise<{ finalRefund: number }> {
  if (!USE_REAL_API) return { finalRefund: 0 };
  return api.patch<{ finalRefund: number }>(
    `/reservations/${reservationId}/checkout-complete`,
    { depositDeduction },
  );
}

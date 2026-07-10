// ── Ports ── abstract dependencies so services are testable with fakes.
// In production these are backed by Prisma and the Toss/PortOne SDKs.

export type ReservationStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED_BY_GUEST"
  | "CANCELLED_BY_HOST"
  | "COMPLETED"
  | "NO_SHOW";

export interface RoomRecord {
  id: string;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  minStayMonths: number;
  availableFrom: Date;
}

export interface ReservationRecord {
  id: string;
  roomId: string;
  guestId: string;
  checkIn: Date;
  checkOut: Date;
  months: number;
  status: ReservationStatus;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  discount: number;
  totalDueNow: number;
  createdAt: Date;
}

export interface CouponRecord {
  id: string;
  code: string;
  type: "FIXED" | "PERCENT";
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  validFrom: Date;
  validTo: Date;
  usageLimit: number | null;
  usedCount: number;
}

// Repository port
export interface ReservationRepo {
  findRoom(roomId: string): Promise<RoomRecord | null>;
  findCouponByCode(code: string): Promise<CouponRecord | null>;
  /** Reservations that overlap [checkIn, checkOut) for a room and still hold inventory. */
  findOverlapping(roomId: string, checkIn: Date, checkOut: Date): Promise<ReservationRecord[]>;
  /** Insert inside a serializable transaction; the impl re-checks overlap under lock. */
  createHold(data: Omit<ReservationRecord, "id" | "createdAt">): Promise<ReservationRecord>;
  findById(id: string): Promise<ReservationRecord | null>;
  /** All reservations for a guest, newest first, with room name + first image. */
  listByGuest(guestId: string): Promise<ReservationWithRoom[]>;
  updateStatus(id: string, status: ReservationStatus): Promise<ReservationRecord>;
  markCouponUsed(couponId: string): Promise<void>;
}

// Reservation joined with a little room context, for the "my trips" list.
export interface ReservationWithRoom extends ReservationRecord {
  room: { id: string; name: string; region: string; image: string | null };
}

// Payment gateway port — one method: verify a payment really happened for `amount`.
export interface PaymentVerification {
  ok: boolean;
  providerTxnId: string;
  paidAmount: number;
  reason?: string;
}
export interface PaymentGateway {
  verify(params: {
    provider: "TOSS" | "PORTONE" | "STRIPE";
    paymentKey: string;
    expectedAmount: number;
  }): Promise<PaymentVerification>;
}

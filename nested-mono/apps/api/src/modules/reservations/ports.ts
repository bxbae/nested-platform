// ── Ports ── abstract dependencies so services are testable with fakes.
// In production these are backed by Prisma and the Toss/PortOne SDKs.

export type RentalUnit = "WHOLE" | "PRIVATE_ROOM" | "BED";
export type BookingMode = "UNIT" | "BED" | "WHOLE_ROOM";

export type ReservationStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED_BY_GUEST"
  | "CANCELLED_BY_HOST"
  | "COMPLETED"
  | "NO_SHOW"
  | "EARLY_CHECKOUT_REQUESTED"
  | "EARLY_CHECKOUT_APPROVED"
  | "EXTENSION_REQUESTED";


export type ContractChangeType = "EARLY_CHECKOUT" | "EXTENSION";
export type ContractChangeStatus =
  | "HOST_REVIEW"
  | "PAYMENT_PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "COMPLETED";

export interface ContractChangeRequestRecord {
  id: string;
  reservationId: string;
  requesterId: string;
  type: ContractChangeType;
  status: ContractChangeStatus;
  originalCheckOut: Date;
  requestedCheckOut: Date;
  additionalRent: number;
  additionalMaintenance: number;
  additionalServiceFee: number;
  additionalAmount: number;
  estimatedRefund: number;
  depositDeduction: number;
  finalRefund: number | null;
  rejectReason: string | null;
  paymentProvider: string | null;
  paymentTxnId: string | null;
  paymentDeadline: Date | null;
  reviewedAt: Date | null;
  paidAt: Date | null;
  appliedAt: Date | null;
  actualCheckOut: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomRecord {
  id: string;
  name: string;
  hostId: string;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  minStayMonths: number;
  availableFrom: Date;
  rentalUnit: RentalUnit | null;
  capacity: number | null;
}

export type CompanionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "EXPIRED";

export interface ReservationRecord {
  id: string;
  roomId: string;
  guestId: string;
  // 공동 예약 대표자와 첫 번째 초대자 호환 필드.
  // 신규 초대자는 ReservationCompanionMember에서 각자 결제한다.
  companionId: string | null;
  companionStatus: CompanionStatus | null;
  companionRespondedAt: Date | null;
  checkIn: Date;
  checkOut: Date;
  originalCheckOut?: Date | null;
  actualCheckOut?: Date | null;
  months: number;
  status: ReservationStatus;
  bookingMode: BookingMode;
  reservedSpots: number;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  discount: number;
  totalDueNow: number;
  couponId?: string | null;
  createdAt: Date;
  // 연장 요청 시 게스트가 원한 개월 수 (대기 중에만 값 존재)
  extensionMonths?: number | null;
  contractChanges?: ContractChangeRequestRecord[];
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
  kind: string;
  ownerId: string | null;
}

// Repository port
export type CompanionPriceData = {
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  serviceFee: number;
  discount: number;
  totalDueNow: number;
};

export type CreateHoldData = Omit<ReservationRecord, "id" | "createdAt"> & {
  companionIds?: string[];
  companionInviteExpiresAt?: Date | null;
  companionPrice?: CompanionPriceData;
  companionRequiresIndividualPayment?: boolean;
};

export interface ReservationRepo {
  findRoom(roomId: string): Promise<RoomRecord | null>;
  findCouponByCode(code: string): Promise<CouponRecord | null>;
  /** Reservations that overlap [checkIn, checkOut) for a room and still hold inventory. */
  findOverlapping(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<ReservationRecord[]>;
  /** Host-blocked calendar days inside [checkIn, checkOut). */
  findBlockedDates(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
  ): Promise<Date[]>;
  /** Insert inside a serializable transaction; the impl re-checks overlap under lock. */
  createHold(data: CreateHoldData): Promise<ReservationRecord>;
  findById(id: string): Promise<ReservationRecord | null>;
  /** All reservations for a guest, newest first, with room name + first image. */
  listByGuest(guestId: string): Promise<ReservationWithRoom[]>;
  /** All reservations across every room a host owns, newest first, with room + guest context. */
  listByHost(hostId: string): Promise<ReservationForHost[]>;
  /** The host that owns the room this reservation is for (ownership checks). */
  findRoomHostId(reservationId: string): Promise<string | null>;
  /** 연장 요청 저장: 상태를 EXTENSION_REQUESTED 로 바꾸고 원하는 개월 수를 기록 */
  requestExtension(id: string, months: number): Promise<ReservationRecord>;
  /** 연장 확정: checkOut 을 months 만큼 미루고 총 개월 수를 늘린 뒤 CONFIRMED 복귀 */
  applyExtension(id: string, months: number): Promise<ReservationRecord>;
  /** 연장 요청 취소/거절: 요청 개월 수를 지우고 CONFIRMED 복귀 */
  clearExtension(id: string): Promise<ReservationRecord>;
  updateStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<ReservationRecord>;
  /** 조기 퇴실 승인 시 실제 퇴실 시각과 상태를 함께 반영한다. */
  approveEarlyCheckout(
    id: string,
    checkOut: Date,
  ): Promise<ReservationRecord>;
  /** 후보 중 실제 친구 관계인 사용자 ID만 반환한다. */
  findFriendIds(userId: string, candidateIds: string[]): Promise<string[]>;
  /** 예약에서 해당 사용자의 초대 상태를 찾는다. */
  findCompanionStatus(id: string, userId: string): Promise<CompanionStatus | null>;
  /** 동반자 초대 응답 (수락/거절) 기록. */
  updateCompanionStatus(
    id: string,
    userId: string,
    status: CompanionStatus,
  ): Promise<ReservationRecord>;
  /** 내가 동반자로 초대된 예약들 — 마이페이지에서 수락/거절하도록. */
  listByCompanion(companionId: string): Promise<ReservationWithRoom[]>;
  markCouponUsed(couponId: string): Promise<void>;
}

// Reservation joined with a little room context, for the "my trips" list.
export interface ReservationWithRoom extends ReservationRecord {
  /** 마이페이지 예약 관리 목록에서만 숨긴 상태. 상세·결제·관리자 기록에는 영향이 없다. */
  hiddenFromTrips?: boolean;
  room: { id: string; name: string; region: string; image: string | null };
  payment: {
    id: string;
    provider: string;
    amount: number;
    status: string;
    createdAt: Date;
  } | null;
  companions?: {
    status: CompanionStatus;
    requiresIndividualPayment?: boolean;
    inviteExpiresAt?: Date | null;
    paymentDeadline?: Date | null;
    paidAt?: Date | null;
    expiredAt?: Date | null;
    totalDueNow?: number;
    user: { id: string; name: string; avatarColor: string };
  }[];
}

// Reservation joined with room + guest context, for the host's "received
// reservations" inbox. The host needs to know which listing and which guest.
export interface ReservationForHost extends ReservationRecord {
  room: {
    id: string;
    name: string;
    region: string;
    image: string | null;
    rentalUnit: RentalUnit | null;
    capacity: number | null;
  };
  guest: { id: string; name: string; avatarColor: string };
  companions?: {
    status: CompanionStatus;
    requiresIndividualPayment?: boolean;
    inviteExpiresAt?: Date | null;
    paymentDeadline?: Date | null;
    paidAt?: Date | null;
    expiredAt?: Date | null;
    totalDueNow?: number;
    user: { id: string; name: string; avatarColor: string };
  }[];
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

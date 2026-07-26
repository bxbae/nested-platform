import { ReservationsService } from "../reservations.service";
import type {
  ReservationRepo,
  PaymentGateway,
  RoomRecord,
  ReservationRecord,
  CouponRecord,
  CreateHoldData,
  CompanionStatus,
} from "../ports";

// ── In-memory fakes ──
function makeRoom(over: Partial<RoomRecord> = {}): RoomRecord {
  return {
    id: "room1",
    name: "테스트 숙소",
    hostId: "host-1",
    monthlyRent: 800_000,
    deposit: 3_000_000,
    cleaningFee: 100_000,
    maintenanceFee: 50_000,
    minStayMonths: 3,
    availableFrom: new Date("2026-01-01"),
    rentalUnit: null,
    capacity: null,
    ...over,
  };
}

class FakeRepo implements ReservationRepo {
  rooms = new Map<string, RoomRecord>([["room1", makeRoom()]]);
  coupons = new Map<string, CouponRecord>();
  reservations: ReservationRecord[] = [];
  blockedDates = new Map<string, Set<string>>();
  companionMembers = new Map<string, Map<string, CompanionStatus>>();
  friends = new Set<string>(["mate1", "mate2", "mate3"]);
  seq = 1;

  async findRoom(id: string) {
    return this.rooms.get(id) ?? null;
  }
  async findCouponByCode(code: string) {
    return this.coupons.get(code) ?? null;
  }
  async findOverlapping(roomId: string, checkIn: Date, checkOut: Date) {
    return this.reservations.filter(
      (r) =>
        r.roomId === roomId &&
        [
          "PENDING_PAYMENT",
          "CONFIRMED",
          "EARLY_CHECKOUT_REQUESTED",
          "EARLY_CHECKOUT_APPROVED",
          "EXTENSION_REQUESTED",
        ].includes(r.status) &&
        r.checkIn < checkOut &&
        r.checkOut > checkIn,
    );
  }
  async findBlockedDates(roomId: string, checkIn: Date, checkOut: Date) {
    const blocked = this.blockedDates.get(roomId) ?? new Set<string>();
    const dates: Date[] = [];
    const cursor = new Date(Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate()));
    const end = new Date(Date.UTC(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate()));
    while (cursor < end) {
      const iso = cursor.toISOString().slice(0, 10);
      if (blocked.has(iso)) dates.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }
  async createHold(data: CreateHoldData) {
    const { companionIds = [], ...reservationData } = data;
    // emulate the room-row lock + capacity-aware inventory re-check
    const overlaps = await this.findOverlapping(
      reservationData.roomId,
      reservationData.checkIn,
      reservationData.checkOut,
    );
    const blocked = await this.findBlockedDates(
      reservationData.roomId,
      reservationData.checkIn,
      reservationData.checkOut,
    );
    if (blocked.length > 0) {
      const error: any = new Error("blocked");
      error.response = { code: "HOST_BLOCKED_DATES" };
      throw error;
    }
    const room = this.rooms.get(reservationData.roomId)!;
    const capacity = Math.max(1, room.capacity ?? 1);
    const occupied = overlaps.reduce((sum, reservation) => {
      if (reservation.bookingMode !== "BED") return capacity;
      return sum + reservation.reservedSpots;
    }, 0);
    const unavailable =
      room.rentalUnit !== "BED"
        ? overlaps.length > 0
        : reservationData.bookingMode === "WHOLE_ROOM"
          ? overlaps.length > 0
          : occupied + reservationData.reservedSpots > capacity;
    if (unavailable) {
      const e: any = new Error("conflict");
      e.code = "DATES_UNAVAILABLE";
      throw e;
    }
    const rec: ReservationRecord = {
      ...reservationData,
      id: `res${this.seq++}`,
      createdAt: new Date(),
    };
    this.reservations.push(rec);
    if (companionIds.length > 0) {
      this.companionMembers.set(
        rec.id,
        new Map(companionIds.map((id) => [id, "PENDING" as CompanionStatus])),
      );
    }
    return rec;
  }
  async findById(id: string) {
    return this.reservations.find((r) => r.id === id) ?? null;
  }
  async listByGuest(guestId: string) {
    return this.reservations
      .filter((r) => r.guestId === guestId)
      .map((r) => ({
        ...r,
        room: { id: r.roomId, name: "Test Room", region: "Test", image: null },
        payment: null,
      }));
  }
  // Test seam: which host owns which room. Defaults to "host1" for room1.
  roomHosts = new Map<string, string>([["room1", "host1"]]);
  async listByHost(hostId: string) {
    return this.reservations
      .filter((r) => this.roomHosts.get(r.roomId) === hostId)
      .map((r) => ({
        ...r,
        room: {
          id: r.roomId,
          name: "Test Room",
          region: "Test",
          image: null,
          rentalUnit: this.rooms.get(r.roomId)?.rentalUnit ?? null,
          capacity: this.rooms.get(r.roomId)?.capacity ?? null,
        },
        guest: { id: r.guestId, name: "Guest", avatarColor: "#FF5A5F" },
        companions: [],
      }));
  }
  async findRoomHostId(reservationId: string) {
    const r = this.reservations.find((x) => x.id === reservationId);
    if (!r) return null;
    return this.roomHosts.get(r.roomId) ?? null;
  }
  async updateStatus(id: string, status: ReservationRecord["status"]) {
    const r = this.reservations.find((x) => x.id === id)!;
    r.status = status;
    return r;
  }
  async approveEarlyCheckout(id: string, checkOut: Date) {
    const r = this.reservations.find((x) => x.id === id)!;
    r.status = "EARLY_CHECKOUT_APPROVED";
    r.checkOut = checkOut;
    return r;
  }
  // ── 계약 연장 (테스트용 최소 구현) ──
  async requestExtension(id: string, months: number) {
    const r = this.reservations.find((x) => x.id === id)!;
    r.status = "EXTENSION_REQUESTED";
    r.extensionMonths = months;
    return r;
  }
  async applyExtension(id: string, months: number) {
    const r = this.reservations.find((x) => x.id === id)!;
    const out = new Date(r.checkOut);
    out.setMonth(out.getMonth() + months);
    const blocked = await this.findBlockedDates(r.roomId, r.checkOut, out);
    if (blocked.length > 0) {
      const error: any = new Error("blocked");
      error.response = { code: "HOST_BLOCKED_DATES" };
      throw error;
    }
    const overlaps = (await this.findOverlapping(r.roomId, r.checkOut, out)).filter(
      (reservation) => reservation.id !== id,
    );
    const room = this.rooms.get(r.roomId)!;
    const capacity = Math.max(1, room.capacity ?? 1);
    const occupied = overlaps.reduce((sum, reservation) => {
      if (reservation.bookingMode !== "BED") return capacity;
      return sum + reservation.reservedSpots;
    }, 0);
    const unavailable =
      room.rentalUnit !== "BED"
        ? overlaps.length > 0
        : r.bookingMode === "WHOLE_ROOM"
          ? overlaps.length > 0
          : occupied + r.reservedSpots > capacity;
    if (unavailable) {
      const error: any = new Error("conflict");
      error.response = { code: "DATES_UNAVAILABLE" };
      throw error;
    }
    r.checkOut = out;
    r.months += months;
    r.status = "CONFIRMED";
    r.extensionMonths = null;
    return r;
  }
  async clearExtension(id: string) {
    const r = this.reservations.find((x) => x.id === id)!;
    r.status = "CONFIRMED";
    r.extensionMonths = null;
    return r;
  }
  async markCouponUsed() {}
  async findFriendIds(_userId: string, candidateIds: string[]) {
    return candidateIds.filter((id) => this.friends.has(id));
  }
  async findCompanionStatus(id: string, userId: string) {
    const member = this.companionMembers.get(id)?.get(userId);
    if (member) return member;
    const r = this.reservations.find((x) => x.id === id);
    return r?.companionId === userId ? r.companionStatus : null;
  }
  async updateCompanionStatus(
    id: string,
    userId: string,
    status: CompanionStatus,
  ) {
    const r = this.reservations.find((x) => x.id === id)!;
    const members = this.companionMembers.get(id);
    if (members?.has(userId)) members.set(userId, status);
    const respondedAt = new Date();
    if (r.companionId === userId) {
      r.companionStatus = status;
      r.companionRespondedAt = respondedAt;
      return r;
    }
    return {
      ...r,
      companionId: userId,
      companionStatus: status,
      companionRespondedAt: respondedAt,
    };
  }
  async listByCompanion(companionId: string) {
    return this.reservations
      .filter((r) => r.companionId === companionId || this.companionMembers.get(r.id)?.has(companionId))
      .map((r) => ({
        ...r,
        room: { id: r.roomId, name: "Test Room", region: "Test", image: null },
        payment: null,
      }));
  }
}

class FakeGateway implements PaymentGateway {
  constructor(
    private paidAmount: number,
    private ok = true,
  ) {}
  async verify(p: { expectedAmount: number }) {
    return {
      ok: this.ok,
      providerTxnId: "txn_1",
      paidAmount: this.paidAmount,
      reason: this.ok ? undefined : "declined",
    };
  }
}

// 날짜 테스트가 실행 시각과 로컬 시간대에 따라 흔들리지 않도록
// UTC 자정의 고정된 미래 날짜를 사용한다.
const future = new Date("2098-08-07T00:00:00.000Z");

describe("ReservationsService", () => {
  it("quotes a price without writing anything", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const q = await svc.quote({ roomId: "room1", checkIn: future, months: 6 });
    expect(q.dueNow).toBe(3_990_000);
    expect(repo.reservations).toHaveLength(0);
  });

  it("rejects stays below the room minimum", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await expect(
      svc.quote({ roomId: "room1", checkIn: future, months: 1 }),
    ).rejects.toMatchObject({
      response: { code: "MIN_STAY" },
    });
  });

  it("accepts an exact stay such as 3 months and 16 days", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const checkOut = new Date(future);
    checkOut.setMonth(checkOut.getMonth() + 3);
    checkOut.setDate(checkOut.getDate() + 16);

    const q = await svc.quote({
      roomId: "room1",
      checkIn: future,
      checkOut,
    });

    expect(q.fullMonths).toBe(3);
    expect(q.extraDays).toBe(16);
    expect(q.checkOut).toEqual(checkOut);
  });

  it("rejects an exact range shorter than the platform minimum month", async () => {
    const repo = new FakeRepo();
    repo.rooms.set("room1", makeRoom({ minStayMonths: 1 }));
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const checkOut = new Date(future);
    checkOut.setDate(checkOut.getDate() + 20);

    await expect(
      svc.quote({ roomId: "room1", checkIn: future, checkOut }),
    ).rejects.toMatchObject({
      response: { code: "PLATFORM_MIN_STAY" },
    });
  });

  it("creates a PENDING_PAYMENT hold with server-computed totals", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6 },
      "guestA",
    );
    expect(r.status).toBe("PENDING_PAYMENT");
    expect(r.totalDueNow).toBe(3_990_000);
    expect(r.guestId).toBe("guestA");
  });

  it("prevents double-booking overlapping dates (409)", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    await expect(
      svc.create({ roomId: "room1", checkIn: future, months: 3 }, "guestB"),
    ).rejects.toMatchObject({ response: { code: "DATES_UNAVAILABLE" } });
  });

  // Regression: quote used to skip the overlap check, so the UI showed
  // "예약 가능한 날짜입니다" for dates that create() then rejected with 409.
  it("quote rejects dates that are already booked (409)", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    await expect(
      svc.quote({ roomId: "room1", checkIn: future, months: 3 }),
    ).rejects.toMatchObject({ response: { code: "DATES_UNAVAILABLE" } });
  });

  it("호스트가 차단한 날짜가 포함되면 견적과 예약을 모두 거절한다", async () => {
    const repo = new FakeRepo();
    const blocked = new Date(future);
    blocked.setDate(blocked.getDate() + 3);
    repo.blockedDates.set("room1", new Set([blocked.toISOString().slice(0, 10)]));
    const svc = new ReservationsService(repo, new FakeGateway(0));

    await expect(
      svc.quote({ roomId: "room1", checkIn: future, months: 3 }),
    ).rejects.toMatchObject({ response: { code: "HOST_BLOCKED_DATES" } });
    await expect(
      svc.create({ roomId: "room1", checkIn: future, months: 3 }, "guestA"),
    ).rejects.toMatchObject({ response: { code: "HOST_BLOCKED_DATES" } });
  });

  it("quote still succeeds for free dates after a booking ends", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    // Start right after the existing stay ends — no overlap.
    const after = new Date(future);
    after.setMonth(after.getMonth() + 6);
    const q = await svc.quote({ roomId: "room1", checkIn: after, months: 3 });
    expect(q.dueNow).toBeGreaterThan(0);
  });

  it("confirms payment only when the PSP-verified amount matches", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(3_990_000, true));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6 },
      "guestA",
    );
    const confirmed = await svc.confirmPayment(
      {
        reservationId: r.id,
        provider: "TOSS",
        paymentKey: "pk_1",
        amount: 3_990_000,
      },
      "guestA",
    );
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("rejects confirmation when the client amount differs from the server total", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(3_990_000, true));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6 },
      "guestA",
    );
    await expect(
      svc.confirmPayment(
        {
          reservationId: r.id,
          provider: "TOSS",
          paymentKey: "pk_1",
          amount: 10_000,
        },
        "guestA",
      ),
    ).rejects.toMatchObject({ response: { code: "AMOUNT_MISMATCH" } });
  });

  it("rejects confirmation when the PSP says the amount was not actually paid", async () => {
    const repo = new FakeRepo();
    // PSP reports a different paid amount than expected
    const svc = new ReservationsService(repo, new FakeGateway(1_000, true));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6 },
      "guestA",
    );
    await expect(
      svc.confirmPayment(
        {
          reservationId: r.id,
          provider: "TOSS",
          paymentKey: "pk_1",
          amount: 3_990_000,
        },
        "guestA",
      ),
    ).rejects.toMatchObject({ response: { code: "PAYMENT_UNVERIFIED" } });
  });

  it("is idempotent: confirming an already-CONFIRMED reservation returns it", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(3_990_000, true));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6 },
      "guestA",
    );
    await svc.confirmPayment(
      {
        reservationId: r.id,
        provider: "TOSS",
        paymentKey: "pk_1",
        amount: 3_990_000,
      },
      "guestA",
    );
    const again = await svc.confirmPayment(
      {
        reservationId: r.id,
        provider: "TOSS",
        paymentKey: "pk_1",
        amount: 3_990_000,
      },
      "guestA",
    );
    expect(again.status).toBe("CONFIRMED");
  });

  it("조기 퇴실 승인 시 실제 퇴실일 다음 날부터 재고가 풀린다", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const reservation = await svc.create(
      { roomId: "room1", checkIn: future, months: 6 },
      "guestA",
    );
    reservation.status = "CONFIRMED";
    await svc.requestEarlyCheckout(reservation.id, "guestA");
    const originalCheckOut = new Date(reservation.checkOut);
    const updated = await svc.decideEarlyCheckout(reservation.id, "host1", "approve");
    expect(updated.status).toBe("EARLY_CHECKOUT_APPROVED");
    expect(updated.checkOut.getTime()).toBeLessThan(originalCheckOut.getTime());
  });

  it("이미 다음 예약이 있으면 계약 연장 승인을 거절한다", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const first = await svc.create(
      { roomId: "room1", checkIn: future, months: 3 },
      "guestA",
    );
    first.status = "CONFIRMED";
    const nextCheckIn = new Date(first.checkOut);
    await svc.create(
      { roomId: "room1", checkIn: nextCheckIn, months: 3 },
      "guestB",
    );
    await svc.requestExtension(first.id, "guestA", 1);
    await expect(
      svc.decideExtension(first.id, "host1", "approve"),
    ).rejects.toMatchObject({ response: { code: "DATES_UNAVAILABLE" } });
  });

  // ── 공동 예약 (룸메이트와 함께) ──
  it("companionId 를 주면 초대가 PENDING 으로 생성된다", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6, companionId: "mate1" },
      "guestA",
    );
    expect(r.companionId).toBe("mate1");
    expect(r.companionStatus).toBe("PENDING");
  });

  it("companionId 가 없으면 동반자 필드는 비어 있다", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6 },
      "guestA",
    );
    expect(r.companionId).toBeNull();
    expect(r.companionStatus).toBeNull();
  });

  it("자기 자신을 룸메이트로 지정할 수 없다", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await expect(
      svc.create(
        { roomId: "room1", checkIn: future, months: 6, companionId: "guestA" },
        "guestA",
      ),
    ).rejects.toMatchObject({ response: { code: "INVALID_COMPANION" } });
  });

  it("초대받은 사람이 수락하면 ACCEPTED 가 된다", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6, companionId: "mate1" },
      "guestA",
    );
    const updated = await svc.respondToCompanionInvite(r.id, "mate1", "accept");
    expect(updated.companionStatus).toBe("ACCEPTED");
  });

  it("제3자는 초대에 응답할 수 없다", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6, companionId: "mate1" },
      "guestA",
    );
    await expect(
      svc.respondToCompanionInvite(r.id, "stranger", "accept"),
    ).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
  });

  it("이미 응답한 초대는 번복할 수 없다", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6, companionId: "mate1" },
      "guestA",
    );
    await svc.respondToCompanionInvite(r.id, "mate1", "decline");
    await expect(
      svc.respondToCompanionInvite(r.id, "mate1", "accept"),
    ).rejects.toMatchObject({ response: { code: "ALREADY_RESPONDED" } });
  });

  it("blocks a guest from paying someone else's reservation", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(3_990_000, true));
    const r = await svc.create(
      { roomId: "room1", checkIn: future, months: 6 },
      "guestA",
    );
    await expect(
      svc.confirmPayment(
        {
          reservationId: r.id,
          provider: "TOSS",
          paymentKey: "pk_1",
          amount: 3_990_000,
        },
        "attacker",
      ),
    ).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
  });

  it("다인실은 남은 자리만큼 겹치는 기간에도 추가 예약할 수 있다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set("room1", makeRoom({ rentalUnit: "BED", capacity: 3 }));
    const svc = new ReservationsService(repo, new FakeGateway(0));

    const first = await svc.create(
      { roomId: "room1", checkIn: future, months: 3, bookingMode: "BED", reservedSpots: 1 },
      "guestA",
    );
    const second = await svc.create(
      { roomId: "room1", checkIn: future, months: 3, bookingMode: "BED", reservedSpots: 2 },
      "guestB",
    );

    expect(first.reservedSpots).toBe(1);
    expect(second.reservedSpots).toBe(2);
    await expect(
      svc.create(
        { roomId: "room1", checkIn: future, months: 3, bookingMode: "BED", reservedSpots: 1 },
        "guestC",
      ),
    ).rejects.toMatchObject({ response: { code: "NOT_ENOUGH_SPOTS" } });
  });

  it("다인실 여러 자리 금액은 자리 수만큼 계산한다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set("room1", makeRoom({ rentalUnit: "BED", capacity: 3 }));
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const quote = await svc.quote({
      roomId: "room1",
      checkIn: future,
      months: 6,
      bookingMode: "BED",
      reservedSpots: 2,
    });
    expect(quote.dueNow).toBe(7_980_000);
    expect(quote.reservedSpots).toBe(2);
    expect(quote.remainingSpots).toBe(1);
  });

  it("다인실 전체 예약은 기존 자리 예약이 있으면 거절한다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set("room1", makeRoom({ rentalUnit: "BED", capacity: 3 }));
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await svc.create(
      { roomId: "room1", checkIn: future, months: 3, bookingMode: "BED", reservedSpots: 1 },
      "guestA",
    );
    await expect(
      svc.create(
        { roomId: "room1", checkIn: future, months: 3, bookingMode: "WHOLE_ROOM" },
        "guestB",
      ),
    ).rejects.toMatchObject({ response: { code: "DATES_UNAVAILABLE" } });
  });


  it("다인실 여러 자리는 친구 목록에서 여러 명을 초대할 수 있다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set("room1", makeRoom({ rentalUnit: "BED", capacity: 3 }));
    const svc = new ReservationsService(repo, new FakeGateway(0));

    const reservation = await svc.create(
      {
        roomId: "room1",
        checkIn: future,
        months: 3,
        bookingMode: "BED",
        reservedSpots: 3,
        companionIds: ["mate1", "mate2"],
      },
      "guestA",
    );

    expect(reservation.companionId).toBe("mate1");
    expect(repo.companionMembers.get(reservation.id)?.get("mate1")).toBe("PENDING");
    expect(repo.companionMembers.get(reservation.id)?.get("mate2")).toBe("PENDING");

    const secondFriendResponse = await svc.respondToCompanionInvite(
      reservation.id,
      "mate2",
      "accept",
    );
    expect(secondFriendResponse.companionId).toBe("mate2");
    expect(secondFriendResponse.companionStatus).toBe("ACCEPTED");
  });

  it("친구가 아닌 사용자는 다인실 동반 입주자로 선택할 수 없다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set("room1", makeRoom({ rentalUnit: "BED", capacity: 3 }));
    const svc = new ReservationsService(repo, new FakeGateway(0));

    await expect(
      svc.create(
        {
          roomId: "room1",
          checkIn: future,
          months: 3,
          bookingMode: "BED",
          reservedSpots: 2,
          companionIds: ["stranger"],
        },
        "guestA",
      ),
    ).rejects.toMatchObject({ response: { code: "COMPANION_NOT_FRIEND" } });
  });

  it("예약 자리 수보다 많은 친구를 선택할 수 없다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set("room1", makeRoom({ rentalUnit: "BED", capacity: 3 }));
    const svc = new ReservationsService(repo, new FakeGateway(0));

    await expect(
      svc.create(
        {
          roomId: "room1",
          checkIn: future,
          months: 3,
          bookingMode: "BED",
          reservedSpots: 2,
          companionIds: ["mate1", "mate2"],
        },
        "guestA",
      ),
    ).rejects.toMatchObject({ response: { code: "TOO_MANY_COMPANIONS" } });
  });

  it("친구 초대가 있는 다인실 예약은 두 자리 이상이어야 한다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set("room1", makeRoom({ rentalUnit: "BED", capacity: 3 }));
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await expect(
      svc.create(
        {
          roomId: "room1",
          checkIn: future,
          months: 3,
          bookingMode: "BED",
          reservedSpots: 1,
          companionId: "mate1",
        },
        "guestA",
      ),
    ).rejects.toMatchObject({ response: { code: "COMPANION_REQUIRES_TWO_SPOTS" } });
  });

  it("며칠 연장 견적은 추가 기간만 일할 계산한다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set(
      "room1",
      makeRoom({ monthlyRent: 700_000, maintenanceFee: 50_000, minStayMonths: 1 }),
    );
    repo.reservations.push({
      id: "res-extension",
      roomId: "room1",
      guestId: "guestA",
      companionId: null,
      companionStatus: null,
      companionRespondedAt: null,
      checkIn: new Date("2099-08-05T00:00:00.000Z"),
      checkOut: new Date("2099-09-21T00:00:00.000Z"),
      originalCheckOut: new Date("2099-09-21T00:00:00.000Z"),
      actualCheckOut: null,
      months: 1,
      status: "CONFIRMED",
      bookingMode: "UNIT",
      reservedSpots: 1,
      monthlyRent: 700_000,
      deposit: 3_000_000,
      cleaningFee: 70_000,
      maintenanceFee: 50_000,
      serviceFee: 35_000,
      discount: 0,
      totalDueNow: 3_855_000,
      createdAt: new Date(),
    });
    const svc = new ReservationsService(repo, new FakeGateway(0));

    const quote = await svc.quoteContractChange(
      "res-extension",
      "guestA",
      {
        type: "EXTENSION",
        requestedCheckOut: new Date("2099-09-27T00:00:00.000Z"),
      },
    );

    expect(quote.changedDays).toBe(6);
    expect(quote.additionalRent).toBe(140_000);
    expect(quote.additionalMaintenance).toBe(10_000);
    expect(quote.additionalServiceFee).toBe(7_000);
    expect(quote.additionalAmount).toBe(157_000);
  });

  it("최소 계약 기간 전에 조기 퇴실해도 최소 계약 금액을 유지한다", async () => {
    const repo = new FakeRepo();
    repo.rooms.set(
      "room1",
      makeRoom({ monthlyRent: 700_000, maintenanceFee: 50_000, minStayMonths: 3 }),
    );
    repo.reservations.push({
      id: "res-early",
      roomId: "room1",
      guestId: "guestA",
      companionId: null,
      companionStatus: null,
      companionRespondedAt: null,
      checkIn: new Date("2099-01-01T00:00:00.000Z"),
      checkOut: new Date("2099-05-01T00:00:00.000Z"),
      originalCheckOut: new Date("2099-05-01T00:00:00.000Z"),
      actualCheckOut: null,
      months: 4,
      status: "CONFIRMED",
      bookingMode: "UNIT",
      reservedSpots: 1,
      monthlyRent: 700_000,
      deposit: 3_000_000,
      cleaningFee: 70_000,
      maintenanceFee: 50_000,
      serviceFee: 35_000,
      discount: 0,
      totalDueNow: 3_855_000,
      createdAt: new Date(),
    });
    const svc = new ReservationsService(repo, new FakeGateway(0));

    const quote = await svc.quoteContractChange("res-early", "guestA", {
      type: "EARLY_CHECKOUT",
      requestedCheckOut: new Date("2099-02-01T00:00:00.000Z"),
    });

    expect(quote.minimumStaySatisfied).toBe(false);
    expect(quote.minimumContractEnd).toEqual(
      new Date("2099-04-01T00:00:00.000Z"),
    );
    expect(quote.estimatedRefund).toBe(750_000);
  });

});

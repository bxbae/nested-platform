import { ReservationsService } from "../reservations.service";
import type {
  ReservationRepo,
  PaymentGateway,
  RoomRecord,
  ReservationRecord,
  CouponRecord,
} from "../ports";

// ── In-memory fakes ──
function makeRoom(over: Partial<RoomRecord> = {}): RoomRecord {
  return {
    id: "room1",
    monthlyRent: 800_000,
    deposit: 3_000_000,
    cleaningFee: 100_000,
    maintenanceFee: 50_000,
    minStayMonths: 3,
    availableFrom: new Date("2026-01-01"),
    ...over,
  };
}

class FakeRepo implements ReservationRepo {
  rooms = new Map<string, RoomRecord>([["room1", makeRoom()]]);
  coupons = new Map<string, CouponRecord>();
  reservations: ReservationRecord[] = [];
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
        (r.status === "PENDING_PAYMENT" || r.status === "CONFIRMED") &&
        r.checkIn < checkOut &&
        r.checkOut > checkIn
    );
  }
  async createHold(data: Omit<ReservationRecord, "id" | "createdAt">) {
    // emulate the serializable re-check
    const conflict = await this.findOverlapping(data.roomId, data.checkIn, data.checkOut);
    if (conflict.length) {
      const e: any = new Error("conflict");
      e.code = "DATES_UNAVAILABLE";
      throw e;
    }
    const rec: ReservationRecord = { ...data, id: `res${this.seq++}`, createdAt: new Date() };
    this.reservations.push(rec);
    return rec;
  }
  async findById(id: string) {
    return this.reservations.find((r) => r.id === id) ?? null;
  }
  async listByGuest(guestId: string) {
    return this.reservations
      .filter((r) => r.guestId === guestId)
      .map((r) => ({ ...r, room: { id: r.roomId, name: "Test Room", region: "Test", image: null } }));
  }
  // Test seam: which host owns which room. Defaults to "host1" for room1.
  roomHosts = new Map<string, string>([["room1", "host1"]]);
  async listByHost(hostId: string) {
    return this.reservations
      .filter((r) => this.roomHosts.get(r.roomId) === hostId)
      .map((r) => ({
        ...r,
        room: { id: r.roomId, name: "Test Room", region: "Test", image: null },
        guest: { id: r.guestId, name: "Guest", avatarColor: "#FF5A5F" },
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
  async markCouponUsed() {}
}

class FakeGateway implements PaymentGateway {
  constructor(private paidAmount: number, private ok = true) {}
  async verify(p: { expectedAmount: number }) {
    return {
      ok: this.ok,
      providerTxnId: "txn_1",
      paidAmount: this.paidAmount,
      reason: this.ok ? undefined : "declined",
    };
  }
}

const future = new Date();
future.setDate(future.getDate() + 30);

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
    await expect(svc.quote({ roomId: "room1", checkIn: future, months: 1 })).rejects.toMatchObject({
      response: { code: "MIN_STAY" },
    });
  });

  it("creates a PENDING_PAYMENT hold with server-computed totals", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    const r = await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    expect(r.status).toBe("PENDING_PAYMENT");
    expect(r.totalDueNow).toBe(3_990_000);
    expect(r.guestId).toBe("guestA");
  });

  it("prevents double-booking overlapping dates (409)", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    await expect(
      svc.create({ roomId: "room1", checkIn: future, months: 3 }, "guestB")
    ).rejects.toMatchObject({ response: { code: "DATES_UNAVAILABLE" } });
  });

  // Regression: quote used to skip the overlap check, so the UI showed
  // "예약 가능한 날짜입니다" for dates that create() then rejected with 409.
  it("quote rejects dates that are already booked (409)", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(0));
    await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    await expect(
      svc.quote({ roomId: "room1", checkIn: future, months: 3 })
    ).rejects.toMatchObject({ response: { code: "DATES_UNAVAILABLE" } });
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
    const r = await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    const confirmed = await svc.confirmPayment(
      { reservationId: r.id, provider: "TOSS", paymentKey: "pk_1", amount: 3_990_000 },
      "guestA"
    );
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("rejects confirmation when the client amount differs from the server total", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(3_990_000, true));
    const r = await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    await expect(
      svc.confirmPayment(
        { reservationId: r.id, provider: "TOSS", paymentKey: "pk_1", amount: 10_000 },
        "guestA"
      )
    ).rejects.toMatchObject({ response: { code: "AMOUNT_MISMATCH" } });
  });

  it("rejects confirmation when the PSP says the amount was not actually paid", async () => {
    const repo = new FakeRepo();
    // PSP reports a different paid amount than expected
    const svc = new ReservationsService(repo, new FakeGateway(1_000, true));
    const r = await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    await expect(
      svc.confirmPayment(
        { reservationId: r.id, provider: "TOSS", paymentKey: "pk_1", amount: 3_990_000 },
        "guestA"
      )
    ).rejects.toMatchObject({ response: { code: "PAYMENT_UNVERIFIED" } });
  });

  it("is idempotent: confirming an already-CONFIRMED reservation returns it", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(3_990_000, true));
    const r = await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    await svc.confirmPayment({ reservationId: r.id, provider: "TOSS", paymentKey: "pk_1", amount: 3_990_000 }, "guestA");
    const again = await svc.confirmPayment(
      { reservationId: r.id, provider: "TOSS", paymentKey: "pk_1", amount: 3_990_000 },
      "guestA"
    );
    expect(again.status).toBe("CONFIRMED");
  });

  it("blocks a guest from paying someone else's reservation", async () => {
    const repo = new FakeRepo();
    const svc = new ReservationsService(repo, new FakeGateway(3_990_000, true));
    const r = await svc.create({ roomId: "room1", checkIn: future, months: 6 }, "guestA");
    await expect(
      svc.confirmPayment({ reservationId: r.id, provider: "TOSS", paymentKey: "pk_1", amount: 3_990_000 }, "attacker")
    ).rejects.toMatchObject({ response: { code: "FORBIDDEN" } });
  });
});

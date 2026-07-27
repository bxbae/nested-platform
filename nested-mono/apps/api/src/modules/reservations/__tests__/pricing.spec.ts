import { computePrice, couponDiscount, SERVICE_FEE_RATE, stayCharge } from "../pricing";

describe("computePrice", () => {
  const base = {
    monthlyRent: 800_000,
    deposit: 3_000_000,
    cleaningFee: 100_000,
    maintenanceFee: 50_000,
    months: 6,
  };

  it("charges deposit + first month + cleaning + one maintenance + 5% fee at move-in", () => {
    const p = computePrice(base);
    expect(p.serviceFee).toBe(Math.round(800_000 * SERVICE_FEE_RATE)); // 40,000
    // 3,000,000 + 800,000 + 100,000 + 50,000 + 40,000
    expect(p.dueNow).toBe(3_990_000);
  });

  it("computes contract total across the whole stay", () => {
    const p = computePrice(base);
    // deposit + rent*6 + cleaning + maintenance*6 + fee
    // 3,000,000 + 4,800,000 + 100,000 + 300,000 + 40,000
    expect(p.contractTotal).toBe(8_240_000);
  });


  it("prorates the final partial month for an exact check-out date", () => {
    const p = computePrice({
      monthlyRent: 800_000,
      deposit: 3_000_000,
      cleaningFee: 100_000,
      maintenanceFee: 60_000,
      checkIn: new Date("2026-08-05T00:00:00.000Z"),
      checkOut: new Date("2026-09-21T00:00:00.000Z"),
    });

    // 8/5→9/5 one full month, then 16 of the 30 days in 9/5→10/5.
    expect(p.fullMonths).toBe(1);
    expect(p.extraDays).toBe(16);
    expect(p.rentSubtotal).toBe(1_226_667);
    expect(p.maintenanceSubtotal).toBe(92_000);
    expect(p.contractTotal).toBe(4_458_667);
  });


  it("prorates a short contract extension by the actual segment length", () => {
    const start = new Date("2026-09-21T00:00:00.000Z");
    const end = new Date("2026-09-27T00:00:00.000Z");

    expect(stayCharge(700_000, start, end).amount).toBe(140_000);
    expect(stayCharge(50_000, start, end).amount).toBe(10_000);
  });

  it("applies a discount to dueNow but never below one free month", () => {
    const p = computePrice({ ...base, discount: 200_000 });
    expect(p.discount).toBe(200_000);
    expect(p.dueNow).toBe(3_790_000);
  });

  it("caps discount at one month's rent", () => {
    const p = computePrice({ ...base, discount: 999_999_999 });
    expect(p.discount).toBe(base.monthlyRent);
  });

  it("never lets a negative discount increase the price", () => {
    const p = computePrice({ ...base, discount: -50_000 });
    expect(p.discount).toBe(0);
    expect(p.dueNow).toBe(3_990_000);
  });
});

describe("couponDiscount", () => {
  it("applies a fixed coupon", () => {
    expect(couponDiscount({ type: "FIXED", value: 50_000, maxDiscount: null, minSpend: 0 }, 800_000)).toBe(50_000);
  });
  it("applies a percent coupon with a cap", () => {
    expect(couponDiscount({ type: "PERCENT", value: 10, maxDiscount: 60_000, minSpend: 0 }, 800_000)).toBe(60_000);
  });
  it("returns 0 below min spend", () => {
    expect(couponDiscount({ type: "FIXED", value: 50_000, maxDiscount: null, minSpend: 1_000_000 }, 800_000)).toBe(0);
  });
});

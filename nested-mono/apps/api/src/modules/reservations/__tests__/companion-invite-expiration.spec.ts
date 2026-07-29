import {
  companionInviteExpiresAt,
  companionPaymentDeadline,
  daysUntilCheckIn,
} from "../companion-invite-expiration";

describe("companion invite deadlines", () => {
  it("D-4 이상은 72시간과 입주 D-3 종료 중 빠른 시각을 사용한다", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const checkIn = new Date("2026-08-01T00:00:00.000Z");

    expect(daysUntilCheckIn(checkIn, now)).toBe(4);
    expect(companionInviteExpiresAt(checkIn, now).toISOString()).toBe(
      "2026-07-29T23:59:59.999Z",
    );
  });

  it("D-3부터 D-1까지는 수락 후 30분 결제 기한을 사용한다", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const checkIn = new Date("2026-07-30T00:00:00.000Z");

    expect(daysUntilCheckIn(checkIn, now)).toBe(2);
    expect(companionPaymentDeadline(checkIn, now).toISOString()).toBe(
      "2026-07-28T12:30:00.000Z",
    );
  });

  it("입주 당일은 즉시 만료 시각을 반환한다", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const checkIn = new Date("2026-07-28T00:00:00.000Z");

    expect(daysUntilCheckIn(checkIn, now)).toBe(0);
    expect(companionInviteExpiresAt(checkIn, now).toISOString()).toBe(
      now.toISOString(),
    );
  });
});

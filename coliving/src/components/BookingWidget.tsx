"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getPriceUnitLabel, type BookingMode, type House } from "@/lib/types";
import { won } from "@/lib/format";
import { computePrice, toISODate } from "@/lib/pricing";
import {
  checkAvailability as checkAvailabilityApi,
  type QuotedPrice,
  requestBooking as requestBookingApi,
  confirmBooking as confirmBookingApi,
} from "@/lib/api/reservations";
import { listFriends, type FriendProfile } from "@/lib/api/friends";
import {
  couponStatusLabel,
  listMyCoupons,
  type MyCoupon,
} from "@/lib/api/coupons";
import { useAuth } from "@/lib/api/useAuth"; // 로그인한 사용자 정보 가져오기
import { BookingAvailabilityCalendar } from "@/components/BookingAvailabilityCalendar";
import {
  addCalendarMonthsISO,
  formatStayDuration,
  isStayAtLeastMonths,
  minimumCheckOutISO,
} from "@/lib/stay-dates";

type Step = "config" | "pay" | "done";

interface Availability {
  loading: boolean;
  available: boolean | null;
  reason?: string;
  checkOut?: string;
  /** Server-quoted breakdown (authoritative, includes coupon discount). */
  price?: QuotedPrice;
  /** The rejection was about the coupon, not the dates. */
  couponError?: boolean;
}

export function BookingWidget({
  house,
  initialCheckIn,
  initialCheckOut,
}: {
  house: House;
  initialCheckIn?: string;
  initialCheckOut?: string;
}) {
  const router = useRouter();
  const { user } = useAuth(); // 로그인한 사용자 정보

  // 로그인한 사용자가 이 숙소의 호스트 본인인지 확인
  const isOwnListing = !!user && !!house.host?.id && user.id === house.host.id;

  const todayISO = toISODate(new Date());
  const minimumCheckIn =
    house.availableFrom > todayISO ? house.availableFrom : todayISO;
  const requestedInitialCheckIn =
    initialCheckIn && /^\d{4}-\d{2}-\d{2}$/.test(initialCheckIn)
      ? initialCheckIn
      : minimumCheckIn;
  // 검색에서 전달된 날짜는 그대로 보여준다. 숙소의 입주 가능 시작일이나
  // 최소 계약 기간을 충족하지 않더라도 날짜를 조용히 다른 날로 바꾸지 않고,
  // 아래 가용성 검사에서 정확한 불가 사유를 보여준다.
  const normalizedInitialCheckIn = requestedInitialCheckIn;
  const minimumInitialCheckOut = minimumCheckOutISO(
    normalizedInitialCheckIn,
    house.minStayMonths,
  );
  const normalizedInitialCheckOut =
    initialCheckOut &&
    /^\d{4}-\d{2}-\d{2}$/.test(initialCheckOut) &&
    initialCheckOut > normalizedInitialCheckIn
      ? initialCheckOut
      : minimumInitialCheckOut;

  const [checkIn, setCheckIn] = useState(normalizedInitialCheckIn);
  const [checkOut, setCheckOut] = useState(normalizedInitialCheckOut);
  const companionInviteAllowed = checkIn > todayISO;
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("config");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [avail, setAvail] = useState<Availability>({ loading: true, available: null });
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponPickerOpen, setCouponPickerOpen] = useState(false);
  const [coupons, setCoupons] = useState<MyCoupon[]>([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const isBedBooking = house.rentalUnit === "bed";
  const roomCapacity = Math.max(1, house.capacity ?? 1);
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    isBedBooking ? "bed" : "unit",
  );
  const [reservedSpots, setReservedSpots] = useState(1);
  // 친구 초대가 있으면 대표자는 본인 1자리만 결제한다.
  // 나머지 친구는 초대를 수락한 뒤 각자 1자리 금액을 결제한다.
  const [inviteFriend, setInviteFriend] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedCompanionIds, setSelectedCompanionIds] = useState<string[]>([]);

  useEffect(() => {
    if (
      inviteFriend &&
      (!companionInviteAllowed ||
        bookingMode !== "bed" ||
        reservedSpots < 2)
    ) {
      setInviteFriend(false);
      setSelectedCompanionIds([]);
    }
  }, [
    inviteFriend,
    companionInviteAllowed,
    bookingMode,
    reservedSpots,
  ]);

  const minimumCheckOut = minimumCheckOutISO(checkIn, house.minStayMonths);
  const stayDuration = formatStayDuration(checkIn, checkOut);
  const validStay = isStayAtLeastMonths(
    checkIn,
    checkOut,
    house.minStayMonths,
  );

  // Local estimate, used only until the server quote arrives (and in demo mode).
  // The server is authoritative for money — coupon validity lives there — so
  // `price` below prefers the quoted breakdown whenever we have one.
  const priceUnits =
    isBedBooking && inviteFriend ? 1 : isBedBooking ? reservedSpots : 1;
  const localPrice = computePrice({
    monthlyRent: house.monthlyRent * priceUnits,
    deposit: house.deposit * priceUnits,
    cleaningFee: house.cleaningFee * priceUnits,
    maintenanceFee: house.maintenanceFee * priceUnits,
    checkIn,
    checkOut,
  });
  const price = avail.price ?? localPrice;
  const selectedCoupon = coupons.find((coupon) => coupon.code === appliedCoupon) ?? null;
  const effectiveCouponPercent =
    price.monthlyRent > 0 && price.discount > 0
      ? Number(((price.discount / price.monthlyRent) * 100).toFixed(1))
      : 0;

  const loadCoupons = useCallback(async () => {
    if (!user) {
      setError("로그인 후 보유 쿠폰을 확인할 수 있습니다.");
      return;
    }
    setCouponLoading(true);
    try {
      setCoupons(await listMyCoupons(house.monthlyRent * priceUnits));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "쿠폰을 불러오지 못했어요.");
      setCoupons([]);
    } finally {
      setCouponLoading(false);
    }
  }, [user, house.monthlyRent, priceUnits]);

  useEffect(() => {
    if (!couponPickerOpen) return;
    void loadCoupons();
  }, [couponPickerOpen, loadCoupons]);

  // ── 예약 가능 여부 ── re-check whenever dates change (debounced)
  const checkAvailability = useCallback(async () => {
    setAvail({ loading: true, available: null });
    try {
      const data = await checkAvailabilityApi({
        houseId: house.id,
        checkIn,
        checkOut,
        couponCode: appliedCoupon || undefined,
        bookingMode,
        reservedSpots,
        companionCount: inviteFriend ? Math.max(0, reservedSpots - 1) : 0,
      });
      setAvail({
        loading: false,
        available: data.available,
        reason: data.reason,
        checkOut: data.checkOut,
        price: data.price,
        couponError: data.couponError,
      });
    } catch {
      setAvail({ loading: false, available: null, reason: "확인 중 오류가 발생했습니다." });
    }
  }, [
    house.id,
    checkIn,
    checkOut,
    appliedCoupon,
    bookingMode,
    reservedSpots,
    inviteFriend,
  ]);

  useEffect(() => {
    const t = setTimeout(checkAvailability, 250);
    return () => clearTimeout(t);
  }, [checkAvailability]);

  function updateCheckIn(nextCheckIn: string) {
    const nextMinimum = minimumCheckOutISO(nextCheckIn, house.minStayMonths);
    setCheckIn(nextCheckIn);
    setCheckOut((current) => (current >= nextMinimum ? current : nextMinimum));
  }

  function updateStayRange(range: { checkIn: string; checkOut: string }) {
    setCheckIn(range.checkIn);
    setCheckOut(range.checkOut);
  }

  function applyQuickStay(months: number) {
    setCheckOut(addCalendarMonthsISO(checkIn, months));
  }

  // ── 예약 요청 → hold ──
  async function toggleFriendInvite(on: boolean) {
    if (on && !companionInviteAllowed) return;
    setInviteFriend(on);
    if (!on) {
      setSelectedCompanionIds([]);
      return;
    }
    if (friends.length > 0) return;
    setFriendsLoading(true);
    try {
      setFriends(await listFriends());
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }

  function chooseBedBooking(mode: "single" | "group" | "whole") {
    setInviteFriend(false);
    setSelectedCompanionIds([]);
    if (mode === "whole") {
      setBookingMode("whole_room");
      setReservedSpots(roomCapacity);
      return;
    }
    setBookingMode("bed");
    setReservedSpots(mode === "group" ? Math.min(roomCapacity, 2) : 1);
  }

  async function requestBooking() {
    setBusy(true);
    setError("");
    try {
      const booking = await requestBookingApi({
        couponCode: appliedCoupon || undefined,
        houseId: house.id,
        guestName: name || "게스트",
        moveIn: checkIn,
        checkOut,
        bookingMode,
        reservedSpots,
        companionIds: inviteFriend ? selectedCompanionIds : undefined,
      });
      setHoldId(booking.id);
      setStep("pay");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const [holdId, setHoldId] = useState<string | null>(null);

  // ── Payment form fields ──
  // Demo checkout, but the inputs are validated so an obviously invalid card
  // (blank, letters, symbols) or a name containing digits can't be submitted.
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  // Validate the payment form. Returns an error message, or null when OK.
  // Rules: name must be non-empty letters only (no digits/symbols); card number
  // must be 15–16 digits after stripping spaces/hyphens; expiry must be MM/YY
  // with a real month; CVC must be 3–4 digits.
  function validatePayment(): string | null {
    const trimmedName = name.trim();
    if (!trimmedName) return "예약자 이름을 입력해주세요.";
    if (/\d/.test(trimmedName)) return "예약자 이름에 숫자를 넣을 수 없습니다.";
    if (/[^\p{L}\s.'-]/u.test(trimmedName)) return "예약자 이름에 특수문자를 넣을 수 없습니다.";

    const digitsOnly = cardNumber.replace(/[\s-]/g, "");
    if (!digitsOnly) return "카드 번호를 입력해주세요.";
    if (!/^\d+$/.test(digitsOnly)) return "카드 번호는 숫자만 입력할 수 있습니다.";
    if (digitsOnly.length < 15 || digitsOnly.length > 16)
      return "카드 번호는 15~16자리여야 합니다.";

    const expiry = cardExpiry.replace(/\s/g, "");
    if (!expiry) return "유효기간을 입력해주세요.";
    const m = expiry.match(/^(\d{2})\/?(\d{2})$/);
    if (!m) return "유효기간은 MM/YY 형식으로 입력해주세요.";
    const month = Number(m[1]);
    if (month < 1 || month > 12) return "유효기간의 월이 올바르지 않습니다.";

    const cvc = cardCvc.trim();
    if (!cvc) return "CVC를 입력해주세요.";
    if (!/^\d{3,4}$/.test(cvc)) return "CVC는 숫자 3~4자리여야 합니다.";

    return null;
  }

  // ── 결제하기 → confirm ──
  async function pay() {
    if (!holdId) return;
    const invalid = validatePayment();
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await confirmBookingApi({ reservationId: holdId, amount: price.dueNow });
      setStep("done");
      setTimeout(() => router.push("/trips"), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canRequest =
    validStay &&
    avail.available === true &&
    !avail.loading &&
    (!inviteFriend ||
      (companionInviteAllowed &&
        bookingMode === "bed" &&
        selectedCompanionIds.length === Math.max(0, reservedSpots - 1)));
  const reservationClosed = avail.available === false && !avail.couponError;

  // 본인이 등록한 숙소면 예약 위젯 대신 숙소 관리로 이동하는 버튼을 표시
  if (isOwnListing) {
    const editUrl =
      `/host/listings?edit=${encodeURIComponent(house.id)}` +
      `#listing-${encodeURIComponent(house.id)}`;

    return (
      <div
        className="card map-sticky"
        style={{ padding: 22, textAlign: "center" }}
      >
        <strong style={{ display: "block", fontSize: 16 }}>
          내가 등록한 숙소입니다
        </strong>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--text-2)",
            lineHeight: 1.6,
            marginTop: 7,
          }}
        >
          숙소 정보와 가격, 사진, 예약 조건을 관리할 수 있습니다.
        </p>
        <button
          type="button"
          className="btn btn-primary press"
          onClick={() => router.push(editUrl)}
          style={{
            width: "100%",
            justifyContent: "center",
            marginTop: 16,
          }}
        >
          숙소 수정하기
        </button>
      </div>
    );
  }

  return (
    <div className="card map-sticky" style={{ padding: 22 }}>
      {/* price header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="display" style={{ fontSize: 26, fontWeight: 700 }}>
          {won(house.monthlyRent)}
        </span>
        <span style={{ color: "var(--text-2)" }}> / 월 · {getPriceUnitLabel(house.rentalUnit)}</span>
      </div>

      {step === "config" && (
        <>
          {/* 체크인 / 체크아웃 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              marginTop: 16,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              overflow: "hidden",
            }}
          >
            <label style={{ padding: "10px 12px", borderRight: "1px solid var(--border)" }}>
              <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>
                입주일
              </span>
              <input
                type="date"
                value={checkIn}
                min={minimumCheckIn}
                max={checkOut}
                onChange={(event) => updateCheckIn(event.target.value)}
                style={{ width: "100%", border: 0, background: "transparent", marginTop: 4 }}
              />
            </label>
            <label style={{ padding: "10px 12px" }}>
              <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>
                퇴실일
              </span>
              <input
                type="date"
                value={checkOut}
                min={minimumCheckOut}
                onChange={(event) => setCheckOut(event.target.value)}
                style={{ width: "100%", border: 0, background: "transparent", marginTop: 4 }}
              />
            </label>
          </div>

          <BookingAvailabilityCalendar
            roomId={house.id}
            checkIn={checkIn}
            checkOut={checkOut}
            minStayMonths={house.minStayMonths}
            requestedSpots={priceUnits}
            onChange={updateStayRange}
          />

          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>
              계약 기간
            </div>
            <div style={{ fontSize: 14, marginTop: 3 }}>
              {stayDuration || "날짜를 선택해주세요"}
              <span style={{ color: "var(--text-2)", fontSize: 12 }}>
                {` · 최소 ${house.minStayMonths}개월`}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 }}>
              {[house.minStayMonths, 3, 6, 12]
                .filter((value, index, values) => value >= house.minStayMonths && values.indexOf(value) === index)
                .map((monthCount) => (
                  <button
                    key={monthCount}
                    type="button"
                    className="chip press"
                    onClick={() => applyQuickStay(monthCount)}
                  >
                    {monthCount === house.minStayMonths ? `최소 ${monthCount}개월` : `${monthCount}개월`}
                  </button>
                ))}
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.5 }}>
              최소 기간 이후에는 1개월 16일처럼 퇴실일을 날짜 단위로 조정할 수 있습니다.
              마지막 부분 월의 월세와 관리비는 일할 계산됩니다.
            </p>
          </div>

          {/* 예약 가능 여부 */}
          <div style={{ marginTop: 12, minHeight: 22 }}>
            {avail.loading ? (
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>예약 가능 여부 확인 중…</span>
            ) : avail.available ? (
              <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                ✓ 예약 가능한 날짜입니다
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                ✕ {avail.reason}
              </span>
            )}
          </div>

          {/* 다인실 예약 방식 */}
          {isBedBooking && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
                예약 방식
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <BookingChoice
                  active={bookingMode === "bed" && reservedSpots === 1}
                  title="내 자리만 예약"
                  description="1자리만 결제하고 남은 자리는 다른 입주자가 예약할 수 있어요."
                  onClick={() => chooseBedBooking("single")}
                />
                {roomCapacity >= 2 && (
                  <BookingChoice
                    active={bookingMode === "bed" && reservedSpots >= 2}
                    title="여러 자리 예약"
                    description="친구 초대를 사용하면 대표자와 친구가 각자 본인 1자리 금액을 결제해요."
                    onClick={() => chooseBedBooking("group")}
                  />
                )}
                {roomCapacity >= 2 && (
                  <BookingChoice
                    active={bookingMode === "whole_room"}
                    title="방 전체 예약"
                    description={`${roomCapacity}자리를 모두 결제하고 다른 예약을 받지 않아요.`}
                    onClick={() => chooseBedBooking("whole")}
                  />
                )}
              </div>

              {bookingMode === "bed" && reservedSpots >= 2 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>예약 자리</div>
                    <div style={{ fontSize: 14, marginTop: 2 }}>{reservedSpots}자리</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Stepper
                      label="자리 줄이기"
                      disabled={reservedSpots <= 2}
                      onClick={() =>
                        setReservedSpots((value) => {
                          const next = Math.max(2, value - 1);
                          setSelectedCompanionIds((ids) => ids.slice(0, Math.max(0, next - 1)));
                          return next;
                        })
                      }
                    >
                      −
                    </Stepper>
                    <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{reservedSpots}</span>
                    <Stepper
                      label="자리 늘리기"
                      disabled={reservedSpots >= roomCapacity}
                      onClick={() => setReservedSpots((value) => Math.min(roomCapacity, value + 1))}
                    >
                      +
                    </Stepper>
                  </div>
                </div>
              )}

              {bookingMode === "bed" && reservedSpots >= 2 && (
                <div style={{ marginTop: 10 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13.5,
                      cursor: companionInviteAllowed ? "pointer" : "not-allowed",
                      opacity: companionInviteAllowed ? 1 : 0.6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={inviteFriend}
                      disabled={!companionInviteAllowed}
                      onChange={(event) => toggleFriendInvite(event.target.checked)}
                      style={{
                        width: 15,
                        height: 15,
                        cursor: companionInviteAllowed ? "pointer" : "not-allowed",
                      }}
                    />
                    친구 목록에서 동반 입주자 선택
                  </label>
                  {!companionInviteAllowed && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--primary)",
                        marginTop: 5,
                      }}
                    >
                      입주 당일에는 룸메이트 초대를 보낼 수 없습니다.
                    </p>
                  )}

                  {inviteFriend && (
                    <div style={{ marginTop: 8 }}>
                      {friendsLoading ? (
                        <p style={{ fontSize: 12.5, color: "var(--text-2)" }}>친구 목록을 불러오는 중…</p>
                      ) : friends.length === 0 ? (
                        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
                          선택할 수 있는 친구가 없습니다. 친구를 추가한 뒤 다시 시도해주세요.
                        </p>
                      ) : (
                        <>
                          <div
                            role="group"
                            aria-label="함께 예약할 친구 선택"
                            style={{
                              display: "grid",
                              gap: 7,
                              maxHeight: 210,
                              overflowY: "auto",
                              padding: 8,
                              border: "1px solid var(--border)",
                              borderRadius: "var(--r-sm)",
                              background: "var(--bg-2)",
                            }}
                          >
                            {friends.map((friend) => {
                              const checked = selectedCompanionIds.includes(friend.userId);
                              const maxFriends = Math.max(0, reservedSpots - 1);
                              const disabled = !checked && selectedCompanionIds.length >= maxFriends;
                              return (
                                <label
                                  key={friend.userId}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 9,
                                    padding: "8px 9px",
                                    borderRadius: 10,
                                    background: checked ? "var(--primary-soft)" : "var(--surface)",
                                    cursor: disabled ? "not-allowed" : "pointer",
                                    opacity: disabled ? 0.55 : 1,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={() =>
                                      setSelectedCompanionIds((ids) =>
                                        checked
                                          ? ids.filter((id) => id !== friend.userId)
                                          : [...ids, friend.userId],
                                      )
                                    }
                                  />
                                  <span style={{ minWidth: 0 }}>
                                    <strong style={{ display: "block", fontSize: 13.5 }}>{friend.name}</strong>
                                    <span style={{ display: "block", fontSize: 11.5, color: "var(--text-2)", marginTop: 1 }}>
                                      {friend.job ?? friend.tierLabel}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, lineHeight: 1.6 }}>
                            필요한 친구 {Math.max(0, reservedSpots - 1)}명 · 현재 {selectedCompanionIds.length}명 선택.
                            대표 예약자는 본인 1자리만 결제하고, 선택한 친구 {Math.max(0, reservedSpots - 1)}명은 초대 수락 후 각자 1자리 금액을 결제합니다.
                            {selectedCompanionIds.length !== Math.max(0, reservedSpots - 1) && (
                              <span style={{ display: "block", color: "var(--primary)", marginTop: 3 }}>
                                선택한 자리 수에 맞게 친구를 모두 선택해야 예약할 수 있습니다.
                              </span>
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {avail.price?.remainingSpots != null && bookingMode === "bed" && (
                <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8 }}>
                  예약 후 남는 자리: {avail.price.remainingSpots}자리
                </p>
              )}
            </div>
          )}

          {/* 보유 쿠폰 선택 — 할인 기준은 첫 달 월세만 */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost press"
                style={{ flex: 1, justifyContent: "space-between", fontSize: 13.5 }}
                onClick={() => setCouponPickerOpen((open) => !open)}
              >
                <span>{appliedCoupon ? `${selectedCoupon?.code ?? appliedCoupon} 적용 중` : "사용할 쿠폰 선택"}</span>
                <span aria-hidden="true">{couponPickerOpen ? "▴" : "▾"}</span>
              </button>
              {appliedCoupon && (
                <button
                  type="button"
                  className="btn btn-ghost press"
                  style={{ fontSize: 13, padding: "9px 14px" }}
                  onClick={() => setAppliedCoupon("")}
                >
                  해제
                </button>
              )}
            </div>

            {couponPickerOpen && (
              <div
                className="card"
                style={{
                  marginTop: 8,
                  padding: 10,
                  display: "grid",
                  gap: 8,
                  maxHeight: 260,
                  overflowY: "auto",
                  background: "var(--surface)",
                }}
              >
                {couponLoading ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", padding: 8 }}>
                    보유 쿠폰을 불러오는 중…
                  </p>
                ) : coupons.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", padding: 8 }}>
                    사용할 수 있는 쿠폰이 없습니다. 내 정보의 내 쿠폰에서 기간을 확인할 수 있습니다.
                  </p>
                ) : (
                  coupons.map((coupon) => {
                    const usable = coupon.status === "AVAILABLE";
                    const benefit =
                      coupon.discountAmount != null && coupon.effectivePercent != null
                        ? `${coupon.effectivePercent}% · -${won(coupon.discountAmount)}`
                        : coupon.type === "PERCENT"
                          ? `${coupon.value}%`
                          : `-${won(coupon.value)}`;
                    return (
                      <button
                        key={coupon.id}
                        type="button"
                        className="press"
                        disabled={!usable}
                        onClick={() => {
                          setAppliedCoupon(coupon.code);
                          setCouponPickerOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "11px 12px",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--r-sm)",
                          background: appliedCoupon === coupon.code ? "var(--primary-soft)" : "var(--surface)",
                          color: "var(--text)",
                          textAlign: "left",
                          opacity: usable ? 1 : 0.55,
                        }}
                      >
                        <span style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <strong>{coupon.kind === "BIRTHDAY" ? "생일 축하 쿠폰" : coupon.code}</strong>
                          <strong style={{ color: usable ? "var(--secondary)" : "var(--text-2)" }}>{benefit}</strong>
                        </span>
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>
                          첫 달 월세에만 적용 · {couponStatusLabel(coupon.status)} · {coupon.validTo.slice(0, 10)}까지
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {avail.couponError && avail.reason && (
              <p style={{ fontSize: 12.5, color: "var(--primary)", marginTop: 6 }}>{avail.reason}</p>
            )}
            {appliedCoupon && !avail.couponError && price.discount > 0 && (
              <div style={{ marginTop: 7, padding: "9px 11px", borderRadius: "var(--r-sm)", background: "var(--secondary-soft)" }}>
                <strong style={{ display: "block", fontSize: 12.5, color: "var(--secondary)" }}>
                  첫 달 월세 {effectiveCouponPercent}% 할인 · -{won(price.discount)}
                </strong>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text-2)", marginTop: 3 }}>
                  보증금·청소비·관리비·서비스 수수료에는 할인이 적용되지 않습니다.
                </span>
              </div>
            )}
          </div>

          {/* 실시간 가격 계산 (서버 견적 우선) */}
          <Ledger
            rows={[
              [`보증금${priceUnits > 1 ? ` (${priceUnits}자리)` : ""}`, won(price.deposit)],
              [`첫 달 월세${priceUnits > 1 ? ` (${priceUnits}자리)` : ""}`, won(price.monthlyRent)],
              ["청소비", won(price.cleaningFee)],
              ["관리비 (월)", won(price.maintenanceFee)],
              ["서비스 수수료 (5%)", won(price.serviceFee)],
              ...(price.discount > 0
                ? ([[`쿠폰 할인 (첫 달 월세 ${price.discountPercent}%)`, `-${won(price.discount)}`]] as [string, string][])
                : []),
            ]}
            total={["입주 시 결제 금액", won(price.dueNow)]}
          />

          {/* 예약 요청 */}
          <button
            className="btn btn-primary press"
            style={{ width: "100%", justifyContent: "center", marginTop: 16, opacity: canRequest ? 1 : 0.5 }}
            disabled={!canRequest || busy}
            onClick={requestBooking}
          >
            {busy ? "처리 중…" : reservationClosed ? "예약 마감" : "예약 요청하기"}
          </button>
          {error && <p style={{ color: "var(--primary)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{error}</p>}
          <p style={{ fontSize: 12, color: "var(--text-2)", textAlign: "center", marginTop: 10 }}>
            {priceUnits > 1 ? `${priceUnits}자리 · ` : ""}{stayDuration} 총 계약금액 {won(price.contractTotal)} · 아직 결제되지 않습니다
          </p>
        </>
      )}

      {step === "pay" && (
        <div style={{ marginTop: 18 }}>
          <strong style={{ fontSize: 15 }}>결제하기</strong>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            {checkIn} ~ {checkOut} · {stayDuration}{priceUnits > 1 ? ` · ${priceUnits}자리` : ""}
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <div className="field">
              <label>예약자 이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="신분증과 동일하게" />
            </div>
            <div className="field">
              <label>카드 번호</label>
              <input
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                maxLength={19}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field">
                <label>유효기간</label>
                <input
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="09/28"
                  inputMode="numeric"
                  maxLength={5}
                />
              </div>
              <div className="field">
                <label>CVC</label>
                <input
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  placeholder="123"
                  inputMode="numeric"
                  maxLength={4}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "var(--secondary-soft)",
              borderRadius: "var(--r-sm)",
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>결제 금액</span>
            <strong>{won(price.dueNow)}</strong>
          </div>
          {error && <p style={{ color: "var(--primary)", fontSize: 13, marginTop: 10 }}>{error}</p>}

          <button
            className="btn btn-primary press"
            style={{ width: "100%", justifyContent: "center", marginTop: 14 }}
            disabled={busy}
            onClick={pay}
          >
            {busy ? "결제 처리 중…" : `${won(price.dueNow)} 결제하기`}
          </button>
          <button
            className="btn btn-ghost press"
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
            onClick={() => setStep("config")}
          >
            뒤로
          </button>
          <p style={{ fontSize: 11.5, color: "var(--text-2)", textAlign: "center", marginTop: 10 }}>
            데모 결제 — 실제로 청구되지 않습니다.
          </p>
        </div>
      )}

      {step === "done" && (
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <svg width="52" height="52" viewBox="0 0 40 40" style={{ margin: "0 auto" }}>
            <circle cx="15" cy="20" r="11" stroke="var(--secondary)" strokeWidth="2.5" fill="none" />
            <circle cx="25" cy="20" r="11" stroke="var(--primary)" strokeWidth="2.5" fill="none" />
            <path d="M14 20 l4 4 l8 -9" stroke="var(--text)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <strong style={{ display: "block", marginTop: 14, fontSize: 17 }}>예약이 완료되었습니다</strong>
          <p style={{ color: "var(--text-2)", fontSize: 14, marginTop: 6 }}>
            {house.name.trim()} · 예약 내역으로 이동합니다…
          </p>
        </div>
      )}
    </div>
  );
}

function BookingChoice({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "var(--r-sm)",
        background: active ? "var(--primary-soft)" : "#fff",
        color: active ? "var(--text)" : "#17171a",
      }}
    >
      <strong style={{ display: "block", fontSize: 13.5 }}>{title}</strong>
      <span
        style={{
          display: "block",
          marginTop: 3,
          fontSize: 12,
          color: active ? "var(--text-2)" : "#5f6368",
          lineHeight: 1.5,
        }}
      >
        {description}
      </span>
    </button>
  );
}

function Stepper({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="press"
      style={{
        width: 30,
        height: 30,
        borderRadius: 99,
        border: "1px solid var(--border)",
        fontSize: 18,
        lineHeight: 1,
        color: disabled ? "var(--border)" : "var(--text)",
        background: "#fff",
      }}
    >
      {children}
    </button>
  );
}

function Ledger({
  rows,
  total,
}: {
  rows: [string, string][];
  total: [string, string];
}) {
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      {rows.map(([k, v]) => (
        <div
          key={k}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
            color: "var(--text-2)",
            padding: "5px 0",
          }}
        >
          <span>{k}</span>
          <span>{v}</span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 15.5,
          fontWeight: 700,
          borderTop: "1px solid var(--border)",
          marginTop: 8,
          paddingTop: 12,
        }}
      >
        <span>{total[0]}</span>
        <span>{total[1]}</span>
      </div>
    </div>
  );
}

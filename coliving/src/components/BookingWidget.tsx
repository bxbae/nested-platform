"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { House } from "@/lib/types";
import { won } from "@/lib/format";
import { computePrice, addMonths, toISODate } from "@/lib/pricing";
import {
  checkAvailability as checkAvailabilityApi,
  type QuotedPrice,
  requestBooking as requestBookingApi,
  confirmBooking as confirmBookingApi,
} from "@/lib/api/reservations";
import { getMatches, type MatchCandidate } from "@/lib/api/match";

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

export function BookingWidget({ house }: { house: House }) {
  const router = useRouter();

  const todayISO = toISODate(new Date());
  const initialCheckIn =
    house.availableFrom > todayISO ? house.availableFrom : todayISO;

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [months, setMonths] = useState(house.minStayMonths);
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("config");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [avail, setAvail] = useState<Availability>({ loading: true, available: null });
  // Coupon code the guest typed. `appliedCoupon` is the one currently sent to
  // the server — we only apply on click so every keystroke doesn't re-quote.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  // 룸메이트와 함께 예약. 성향 매칭에서 궁합이 맞는 상대만 고를 수 있다 —
  // 아무나 지정하는 게 아니라 이미 잘 맞는다고 판단된 사람과 함께 사는 흐름.
  const [withCompanion, setWithCompanion] = useState(false);
  const [mates, setMates] = useState<MatchCandidate[]>([]);
  const [matesLoading, setMatesLoading] = useState(false);
  const [companionId, setCompanionId] = useState("");

  // check-out is derived from check-in + months (월 단위 예약)
  const checkOut = toISODate(addMonths(new Date(checkIn), months));

  // Local estimate, used only until the server quote arrives (and in demo mode).
  // The server is authoritative for money — coupon validity lives there — so
  // `price` below prefers the quoted breakdown whenever we have one.
  const localPrice = computePrice({
    monthlyRent: house.monthlyRent,
    deposit: house.deposit,
    cleaningFee: house.cleaningFee,
    maintenanceFee: house.maintenanceFee,
    months,
  });
  const price = avail.price ?? localPrice;

  // ── 예약 가능 여부 ── re-check whenever dates change (debounced)
  const checkAvailability = useCallback(async () => {
    setAvail((a) => ({ ...a, loading: true }));
    try {
      const data = await checkAvailabilityApi({
        houseId: house.id,
        checkIn,
        months,
        couponCode: appliedCoupon || undefined,
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
  }, [house.id, checkIn, months, appliedCoupon]);

  useEffect(() => {
    const t = setTimeout(checkAvailability, 250);
    return () => clearTimeout(t);
  }, [checkAvailability]);

  // ── 예약 요청 → hold ──
  // 체크박스를 켤 때만 매칭 목록을 불러온다 — 대부분의 예약은 혼자 하므로
  // 화면 진입마다 부르면 불필요한 요청이 된다.
  async function toggleCompanion(on: boolean) {
    setWithCompanion(on);
    if (!on) {
      setCompanionId("");
      return;
    }
    if (mates.length > 0) return;
    setMatesLoading(true);
    try {
      setMates(await getMatches());
    } catch {
      setMates([]);
    } finally {
      setMatesLoading(false);
    }
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
        months,
        companionId: withCompanion && companionId ? companionId : undefined,
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

  const canRequest = avail.available === true && !avail.loading;

  return (
    <div className="card map-sticky" style={{ padding: 22 }}>
      {/* price header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="display" style={{ fontSize: 26, fontWeight: 700 }}>
          {won(house.monthlyRent)}
        </span>
        <span style={{ color: "var(--text-2)" }}>/ 월</span>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>체크인</div>
              <input
                type="date"
                value={checkIn}
                min={todayISO}
                onChange={(e) => setCheckIn(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 14, marginTop: 2, width: "100%" }}
              />
            </label>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>체크아웃</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{checkOut}</div>
            </div>
          </div>

          {/* 월 단위 예약 (기간 stepper) */}
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
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)" }}>계약 기간</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>
                {months}개월 <span style={{ color: "var(--text-2)", fontSize: 12 }}>(최소 {house.minStayMonths})</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Stepper
                label="기간 줄이기"
                disabled={months <= house.minStayMonths}
                onClick={() => setMonths((m) => Math.max(house.minStayMonths, m - 1))}
              >
                −
              </Stepper>
              <span style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{months}</span>
              <Stepper
                label="기간 늘리기"
                disabled={months >= 24}
                onClick={() => setMonths((m) => Math.min(24, m + 1))}
              >
                +
              </Stepper>
            </div>
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

          {/* 룸메이트와 함께 예약 (공동 예약) */}
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={withCompanion}
                onChange={(e) => toggleCompanion(e.target.checked)}
                style={{ width: 15, height: 15, cursor: "pointer" }}
              />
              룸메이트와 함께 살기
            </label>

            {withCompanion && (
              <div style={{ marginTop: 8 }}>
                {matesLoading ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-2)" }}>매칭된 상대를 불러오는 중…</p>
                ) : mates.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
                    아직 매칭된 상대가 없어요.{" "}
                    <a href="/me/preference" style={{ color: "var(--primary)" }}>생활 성향 설문</a>을
                    마치면 잘 맞는 룸메이트를 찾아드려요.
                  </p>
                ) : (
                  <>
                    <select
                      value={companionId}
                      onChange={(e) => setCompanionId(e.target.value)}
                      aria-label="룸메이트 선택"
                      style={{
                        width: "100%", padding: "9px 12px", fontSize: 13.5,
                        border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
                      }}
                    >
                      <option value="">룸메이트를 선택하세요</option>
                      {mates.map((mate) => (
                        <option key={mate.userId} value={mate.userId}>
                          {mate.name} · 궁합 {mate.score}%
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, lineHeight: 1.6 }}>
                      결제는 예약자인 내가 전액 진행하고, 상대에게는 수락 요청이 전달돼요.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 쿠폰 (할인 계산은 서버가 수행) */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && setAppliedCoupon(couponInput.trim())}
                placeholder="쿠폰 코드"
                aria-label="쿠폰 코드"
                style={{
                  flex: 1, padding: "9px 12px", border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)", fontSize: 13.5, textTransform: "uppercase",
                }}
              />
              {appliedCoupon ? (
                <button
                  className="btn btn-ghost press"
                  style={{ fontSize: 13, padding: "9px 14px" }}
                  onClick={() => {
                    setAppliedCoupon("");
                    setCouponInput("");
                  }}
                >
                  해제
                </button>
              ) : (
                <button
                  className="btn btn-ghost press"
                  style={{ fontSize: 13, padding: "9px 14px" }}
                  onClick={() => setAppliedCoupon(couponInput.trim())}
                  disabled={!couponInput.trim()}
                >
                  적용
                </button>
              )}
            </div>
            {avail.couponError && avail.reason && (
              <p style={{ fontSize: 12.5, color: "var(--primary)", marginTop: 6 }}>{avail.reason}</p>
            )}
            {appliedCoupon && !avail.couponError && price.discount > 0 && (
              <p style={{ fontSize: 12.5, color: "var(--secondary)", marginTop: 6 }}>
                쿠폰 {appliedCoupon} 적용됨
              </p>
            )}
          </div>

          {/* 실시간 가격 계산 (서버 견적 우선) */}
          <Ledger
            rows={[
              ["보증금", won(price.deposit)],
              [`첫 달 월세`, won(price.monthlyRent)],
              ["청소비", won(price.cleaningFee)],
              ["관리비 (월)", won(price.maintenanceFee)],
              ["서비스 수수료 (5%)", won(price.serviceFee)],
              ...(price.discount > 0
                ? ([["쿠폰 할인", `-${won(price.discount)}`]] as [string, string][])
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
            {busy ? "처리 중…" : "예약 요청하기"}
          </button>
          {error && <p style={{ color: "var(--primary)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{error}</p>}
          <p style={{ fontSize: 12, color: "var(--text-2)", textAlign: "center", marginTop: 10 }}>
            {months}개월 총 계약금액 {won(price.contractTotal)} · 아직 결제되지 않습니다
          </p>
        </>
      )}

      {step === "pay" && (
        <div style={{ marginTop: 18 }}>
          <strong style={{ fontSize: 15 }}>결제하기</strong>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            {checkIn} ~ {checkOut} · {months}개월
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

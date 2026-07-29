"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { formatStayDuration } from "@/lib/stay-dates";
import {
  confirmCompanionPayment,
  listCompanionInvites,
  respondToInvite,
  type CompanionInvite,
  type CompanionStatus,
} from "@/lib/api/reservations";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10).replace(/-/g, ".");
  }
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${formatDate(value)} ${String(date.getHours()).padStart(
    2,
    "0",
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function daysUntil(value: string): number {
  const target = new Date(value.slice(0, 10));
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function statusLabel(status: CompanionStatus | null): string {
  switch (status) {
    case "PENDING":
      return "응답 대기";
    case "PAYMENT_PENDING":
      return "수락 · 결제 대기";
    case "PAID":
      return "결제 완료";
    case "DECLINED":
      return "거절함";
    case "EXPIRED":
      return "기한 만료";
    case "ACCEPTED":
      return "수락 완료";
    default:
      return "상태 확인";
  }
}

function statusColor(status: CompanionStatus | null): string {
  if (status === "PAID" || status === "ACCEPTED") {
    return "var(--secondary)";
  }
  if (status === "PAYMENT_PENDING" || status === "PENDING") {
    return "var(--warning)";
  }
  return "var(--text-2)";
}

function validatePaymentForm(input: {
  payerName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}): string | null {
  if (!/^[가-힣a-zA-Z\s]{2,}$/.test(input.payerName.trim())) {
    return "결제자 이름을 정확히 입력해주세요.";
  }

  const cardNumber = input.cardNumber.replace(/\D/g, "");
  if (cardNumber.length < 15 || cardNumber.length > 16) {
    return "카드 번호 15~16자리를 입력해주세요.";
  }

  const expiryMatch = input.expiry.match(/^(\d{2})\/(\d{2})$/);
  const expiryMonth = expiryMatch ? Number(expiryMatch[1]) : 0;
  if (!expiryMatch || expiryMonth < 1 || expiryMonth > 12) {
    return "유효기간을 MM/YY 형식으로 입력해주세요.";
  }

  if (!/^\d{3,4}$/.test(input.cvc)) {
    return "CVC 3~4자리를 입력해주세요.";
  }

  return null;
}

export function CompanionInvites() {
  const [invites, setInvites] = useState<CompanionInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentOpenId, setPaymentOpenId] = useState<string | null>(null);
  const [payerName, setPayerName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setInvites(await listCompanionInvites());
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetPaymentForm() {
    setPaymentOpenId(null);
    setPayerName("");
    setCardNumber("");
    setExpiry("");
    setCvc("");
  }

  async function respond(
    invite: CompanionInvite,
    decision: "accept" | "decline",
  ) {
    if (busyId) return;
    setBusyId(invite.id);
    setError("");
    try {
      const result = await respondToInvite(invite.id, decision);
      if (
        decision === "accept" &&
        result.requiresIndividualPayment &&
        result.status === "PAYMENT_PENDING"
      ) {
        setPaymentOpenId(invite.id);
      } else {
        resetPaymentForm();
      }
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "룸메이트 초대 처리에 실패했습니다.",
      );
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function pay(invite: CompanionInvite) {
    if (busyId || !invite.individualPayment) return;

    const validationError = validatePaymentForm({
      payerName,
      cardNumber,
      expiry,
      cvc,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusyId(invite.id);
    setError("");
    try {
      await confirmCompanionPayment({
        reservationId: invite.id,
        amount: invite.individualPayment.totalDueNow,
      });
      resetPaymentForm();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "룸메이트 개인 결제에 실패했습니다.",
      );
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading || invites.length === 0) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 className="display" style={{ fontSize: 20, marginBottom: 4 }}>
        룸메이트 초대
      </h2>
      <p
        style={{
          color: "var(--text-2)",
          fontSize: 13.5,
          lineHeight: 1.65,
          marginBottom: 14,
        }}
      >
        신규 다인실 초대는 초대받은 사람도 본인 1자리 금액을 직접
        결제해야 예약이 확정됩니다. 결제 기한이 지나면 확보된 자리는
        자동으로 잔여 자리로 돌아갑니다.
      </p>

      {error && (
        <p style={{ color: "var(--primary)", fontSize: 13, marginBottom: 10 }}>
          {error}
        </p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {invites.map((invite) => {
          const status = invite.companionStatus;
          const requiresPayment =
            invite.requiresIndividualPayment === true;
          const urgent = daysUntil(invite.checkIn) <= 3;
          const amount = invite.individualPayment?.totalDueNow ?? 0;
          const representativePending =
            invite.reservationStatus === "PENDING_PAYMENT";
          const paymentFormOpen =
            paymentOpenId === invite.id && status === "PAYMENT_PENDING";

          return (
            <div
              key={invite.id}
              className="card"
              style={{
                padding: 18,
                opacity:
                  status === "DECLINED" || status === "EXPIRED" ? 0.68 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={`/homes/${invite.room.id}`}>
                    <strong style={{ fontSize: 15.5 }}>
                      {invite.room.name.trim()}
                    </strong>
                  </Link>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-2)",
                      marginTop: 4,
                    }}
                  >
                    {invite.inviter?.name
                      ? `${invite.inviter.name}님의 초대 · `
                      : ""}
                    {formatDate(invite.checkIn)} ~{" "}
                    {formatDate(invite.checkOut)} ·{" "}
                    {formatStayDuration(invite.checkIn, invite.checkOut)}
                  </div>

                  {requiresPayment && invite.individualPayment && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-2)",
                        marginTop: 6,
                        lineHeight: 1.6,
                      }}
                    >
                      본인 1자리 결제액 <strong>{won(amount)}</strong>
                      <br />
                      월세 {won(invite.individualPayment.monthlyRent)} · 보증금{" "}
                      {won(invite.individualPayment.deposit)} · 청소비{" "}
                      {won(invite.individualPayment.cleaningFee)} · 관리비{" "}
                      {won(invite.individualPayment.maintenanceFee)}
                    </div>
                  )}

                  {status === "PENDING" && requiresPayment && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "var(--bg-2)",
                        color: urgent ? "var(--primary)" : "var(--text-2)",
                        fontSize: 12.5,
                        lineHeight: 1.6,
                      }}
                    >
                      {urgent
                        ? "입주일까지 3일 이내입니다. 수락 후 30분 안에 바로 결제해야 하며, 미결제 시 자리가 자동 해제됩니다."
                        : `초대 유효기한: ${formatDateTime(
                            invite.inviteExpiresAt,
                          )}. 수락 후 72시간 또는 입주 3일 전 중 빠른 시각까지 결제해야 합니다.`}
                    </div>
                  )}

                  {status === "PAYMENT_PENDING" && requiresPayment && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "var(--bg-2)",
                        color: urgent ? "var(--primary)" : "var(--text-2)",
                        fontSize: 12.5,
                        lineHeight: 1.6,
                      }}
                    >
                      결제 마감: {formatDateTime(invite.paymentDeadline)}
                      <br />
                      기한 내 미결제 시 확보된 1자리가 자동으로 해제됩니다.
                    </div>
                  )}

                  {!requiresPayment && status === "PENDING" && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "var(--bg-2)",
                        color: "var(--text-2)",
                        fontSize: 12.5,
                        lineHeight: 1.6,
                      }}
                    >
                      기존 방식으로 생성된 초대입니다. 대표 예약자가 결제한
                      예약이므로 추가 결제 없이 수락할 수 있습니다.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 7,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  {status === "PENDING" && (
                    <>
                      <button
                        className="btn btn-primary press"
                        style={{ fontSize: 13, padding: "8px 14px" }}
                        onClick={() => void respond(invite, "accept")}
                        disabled={busyId === invite.id || representativePending}
                      >
                        {representativePending
                          ? "대표자 결제 대기"
                          : requiresPayment
                            ? "수락하고 결제하기"
                            : "초대 수락"}
                      </button>
                      <button
                        className="btn btn-ghost press"
                        style={{ fontSize: 13, padding: "8px 14px" }}
                        onClick={() => void respond(invite, "decline")}
                        disabled={busyId === invite.id}
                      >
                        거절
                      </button>
                    </>
                  )}

                  {status === "PAYMENT_PENDING" && requiresPayment && (
                    <button
                      className="btn btn-primary press"
                      style={{ fontSize: 13, padding: "8px 14px" }}
                      onClick={() =>
                        setPaymentOpenId((current) =>
                          current === invite.id ? null : invite.id,
                        )
                      }
                      disabled={busyId === invite.id}
                    >
                      본인 1자리 {won(amount)} 결제
                    </button>
                  )}

                  {!["PENDING", "PAYMENT_PENDING"].includes(status ?? "") && (
                    <span
                      className="chip"
                      style={{
                        fontSize: 11,
                        background:
                          status === "PAID" || status === "ACCEPTED"
                            ? "var(--secondary)"
                            : "var(--bg-2)",
                        color:
                          status === "PAID" || status === "ACCEPTED"
                            ? "#fff"
                            : statusColor(status),
                        border:
                          status === "PAID" || status === "ACCEPTED"
                            ? "none"
                            : "1px solid var(--border)",
                      }}
                    >
                      {statusLabel(status)}
                    </span>
                  )}
                </div>
              </div>

              {paymentFormOpen && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <strong style={{ display: "block", fontSize: 14 }}>
                    본인 1자리 결제
                  </strong>
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    <div className="field">
                      <label>결제자 이름</label>
                      <input
                        value={payerName}
                        onChange={(event) => setPayerName(event.target.value)}
                        placeholder="신분증과 동일하게"
                      />
                    </div>
                    <div className="field">
                      <label>카드 번호</label>
                      <input
                        value={cardNumber}
                        onChange={(event) =>
                          setCardNumber(event.target.value)
                        }
                        placeholder="4242 4242 4242 4242"
                        inputMode="numeric"
                        maxLength={19}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <div className="field">
                        <label>유효기간</label>
                        <input
                          value={expiry}
                          onChange={(event) => setExpiry(event.target.value)}
                          placeholder="09/28"
                          inputMode="numeric"
                          maxLength={5}
                        />
                      </div>
                      <div className="field">
                        <label>CVC</label>
                        <input
                          value={cvc}
                          onChange={(event) => setCvc(event.target.value)}
                          placeholder="123"
                          inputMode="numeric"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      marginTop: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "var(--secondary-soft)",
                      fontSize: 13,
                    }}
                  >
                    <span>결제 금액</span>
                    <strong>{won(amount)}</strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="btn btn-primary press"
                      onClick={() => void pay(invite)}
                      disabled={busyId === invite.id}
                    >
                      {busyId === invite.id
                        ? "결제 처리 중…"
                        : `${won(amount)} 결제하기`}
                    </button>
                    <button
                      className="btn btn-ghost press"
                      onClick={resetPaymentForm}
                      disabled={busyId === invite.id}
                    >
                      닫기
                    </button>
                  </div>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-2)",
                      marginTop: 8,
                    }}
                  >
                    데모 결제이며 실제로 청구되지 않습니다.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

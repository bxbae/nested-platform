"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { formatStayDuration } from "@/lib/stay-dates";
import {
  confirmCompanionPayment,
  listCompanionInvites,
  respondToInvite,
  setReservationListHidden,
  type CompanionInvite,
  type CompanionStatus,
} from "@/lib/api/reservations";

const TERMINAL_RESERVATION_STATUSES = new Set([
  "CANCELLED_BY_GUEST",
  "CANCELLED_BY_HOST",
  "COMPLETED",
  "NO_SHOW",
]);

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

function dateBeforeToday(value: string): boolean {
  const date = new Date(value.slice(0, 10));
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function isPastInvite(invite: CompanionInvite): boolean {
  const status = invite.companionStatus;
  return (
    status === "DECLINED" ||
    status === "EXPIRED" ||
    TERMINAL_RESERVATION_STATUSES.has(invite.reservationStatus ?? "") ||
    dateBeforeToday(invite.checkOut)
  );
}

function statusLabel(invite: CompanionInvite): string {
  const status = invite.companionStatus;

  if (isPastInvite(invite)) {
    if (status === "DECLINED") return "초대 거절";
    if (status === "EXPIRED") return "초대 만료";
    if (invite.reservationStatus === "NO_SHOW") return "노쇼";
    if (
      invite.reservationStatus === "CANCELLED_BY_GUEST" ||
      invite.reservationStatus === "CANCELLED_BY_HOST"
    ) {
      return "예약 취소";
    }
    return "기간 종료";
  }

  if (
    status === "PENDING" &&
    invite.reservationStatus === "PENDING_PAYMENT"
  ) {
    return "대표자 결제 대기";
  }

  switch (status) {
    case "PENDING":
      return "초대 수락 대기";
    case "PAYMENT_PENDING":
      return "결제 대기";
    case "PAID":
      return daysUntil(invite.checkIn) > 0
        ? "입주 예정"
        : "공동예약 진행 중";
    case "ACCEPTED":
      return daysUntil(invite.checkIn) > 0
        ? "입주 예정"
        : "공동예약 진행 중";
    case "DECLINED":
      return "초대 거절";
    case "EXPIRED":
      return "초대 만료";
    default:
      return "상태 확인";
  }
}

function statusColor(invite: CompanionInvite): string {
  const status = invite.companionStatus;

  if (isPastInvite(invite)) {
    return "var(--text-2)";
  }
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
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState("");
  const [lastHidden, setLastHidden] = useState<{
    id: string;
    roomName: string;
  } | null>(null);

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

  async function hidePastInvite(invite: CompanionInvite) {
    if (busyId) return;
    setBusyId(invite.id);
    setError("");

    try {
      await setReservationListHidden(invite.id, true);
      setInvites((current) =>
        current.map((item) =>
          item.id === invite.id
            ? { ...item, hiddenFromTrips: true }
            : item,
        ),
      );
      setLastHidden({
        id: invite.id,
        roomName: invite.room.name.trim(),
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "초대를 목록에서 숨기지 못했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function undoHidden() {
    if (!lastHidden || busyId) return;
    const target = lastHidden;
    setBusyId(target.id);
    setError("");

    try {
      await setReservationListHidden(target.id, false);
      setInvites((current) =>
        current.map((item) =>
          item.id === target.id
            ? { ...item, hiddenFromTrips: false }
            : item,
        ),
      );
      setLastHidden(null);
      setArchiveOpen(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "숨김을 되돌리지 못했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const visibleInvites = invites.filter(
    (invite) => invite.hiddenFromTrips !== true,
  );
  const activeInvites = visibleInvites.filter(
    (invite) => !isPastInvite(invite),
  );
  const pastInvites = visibleInvites.filter(isPastInvite);

  if (loading) return null;
  if (visibleInvites.length === 0 && !lastHidden) return null;

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 className="display" style={{ fontSize: 22, marginBottom: 4 }}>
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
        진행 중인 초대를 먼저 보여드려요. 취소·거절·만료되거나 이용
        기간이 끝난 초대는 아래 보관함으로 이동합니다.
      </p>

      {lastHidden && (
        <div
          role="status"
          className="card"
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            background: "var(--bg-2)",
          }}
        >
          <span style={{ fontSize: 13.5 }}>
            “{lastHidden.roomName}” 초대를 내 목록에서 숨겼습니다.
          </span>
          <button
            type="button"
            className="btn btn-ghost press"
            style={{ fontSize: 12.5, padding: "7px 12px" }}
            disabled={busyId === lastHidden.id}
            onClick={() => void undoHidden()}
          >
            되돌리기
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          style={{
            color: "var(--primary)",
            fontSize: 13,
            marginBottom: 10,
          }}
        >
          {error}
        </p>
      )}

      {activeInvites.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--text-2)",
            border: "1px dashed var(--border)",
            background: "transparent",
          }}
        >
          현재 진행 중인 룸메이트 초대가 없어요.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {activeInvites.map((invite) => {
            const status = invite.companionStatus;
            const requiresPayment =
              invite.requiresIndividualPayment === true;
            const urgent = daysUntil(invite.checkIn) <= 3;
            const amount = invite.individualPayment?.totalDueNow ?? 0;
            const representativePending =
              invite.reservationStatus === "PENDING_PAYMENT";
            const paymentFormOpen =
              paymentOpenId === invite.id &&
              status === "PAYMENT_PENDING";

            return (
              <div
                key={invite.id}
                className="card"
                style={{ padding: 18 }}
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
                      {formatStayDuration(
                        invite.checkIn,
                        invite.checkOut,
                      )}
                    </div>

                    <span
                      className="chip"
                      style={{
                        display: "inline-flex",
                        marginTop: 8,
                        background:
                          status === "PAID" || status === "ACCEPTED"
                            ? "var(--secondary)"
                            : status === "PENDING" ||
                                status === "PAYMENT_PENDING"
                              ? "var(--warning)"
                              : "var(--bg-2)",
                        color:
                          status === "PAID" || status === "ACCEPTED"
                            ? "#fff"
                            : status === "PENDING" ||
                                status === "PAYMENT_PENDING"
                              ? "#fff"
                              : statusColor(invite),
                        border: "none",
                        fontSize: 11,
                      }}
                    >
                      {statusLabel(invite)}
                    </span>

                    {requiresPayment && invite.individualPayment && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-2)",
                          marginTop: 8,
                          lineHeight: 1.6,
                        }}
                      >
                        본인 1자리 결제액 <strong>{won(amount)}</strong>
                        <br />
                        월세 {won(invite.individualPayment.monthlyRent)} ·
                        보증금 {won(invite.individualPayment.deposit)} ·
                        청소비 {won(invite.individualPayment.cleaningFee)} ·
                        관리비 {won(invite.individualPayment.maintenanceFee)}
                      </div>
                    )}

                    {status === "PENDING" && requiresPayment && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "var(--bg-2)",
                          color: urgent
                            ? "var(--primary)"
                            : "var(--text-2)",
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
                          color: urgent
                            ? "var(--primary)"
                            : "var(--text-2)",
                          fontSize: 12.5,
                          lineHeight: 1.6,
                        }}
                      >
                        결제 마감:{" "}
                        {formatDateTime(invite.paymentDeadline)}
                        <br />
                        기한 내 미결제 시 확보된 1자리가 자동으로
                        해제됩니다.
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
                        기존 방식으로 생성된 초대입니다. 대표 예약자가
                        결제한 예약이므로 추가 결제 없이 수락할 수
                        있습니다.
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
                          style={{
                            fontSize: 13,
                            padding: "8px 14px",
                          }}
                          onClick={() => void respond(invite, "accept")}
                          disabled={
                            busyId === invite.id || representativePending
                          }
                        >
                          {representativePending
                            ? "대표자 결제 대기"
                            : requiresPayment
                              ? "수락하고 결제하기"
                              : "초대 수락"}
                        </button>
                        <button
                          className="btn btn-ghost press"
                          style={{
                            fontSize: 13,
                            padding: "8px 14px",
                          }}
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
                        style={{
                          fontSize: 13,
                          padding: "8px 14px",
                        }}
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
                          onChange={(event) =>
                            setPayerName(event.target.value)
                          }
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
                            onChange={(event) =>
                              setExpiry(event.target.value)
                            }
                            placeholder="09/28"
                            inputMode="numeric"
                            maxLength={5}
                          />
                        </div>
                        <div className="field">
                          <label>CVC</label>
                          <input
                            value={cvc}
                            onChange={(event) =>
                              setCvc(event.target.value)
                            }
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
      )}

      {pastInvites.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-ghost"
            aria-expanded={archiveOpen}
            onClick={() => setArchiveOpen((current) => !current)}
            style={{
              width: "100%",
              justifyContent: "space-between",
              fontSize: 13.5,
              padding: "11px 14px",
            }}
          >
            <span>지난 룸메이트 초대 {pastInvites.length}건 보기</span>
            <span aria-hidden="true">{archiveOpen ? "▲" : "▼"}</span>
          </button>

          {archiveOpen && (
            <div
              style={{
                display: "grid",
                gap: 9,
                marginTop: 10,
              }}
            >
              {pastInvites.map((invite) => (
                <article
                  key={invite.id}
                  className="card"
                  style={{
                    padding: 15,
                    opacity: 0.85,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0, 1.3fr) minmax(160px, .8fr) auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/homes/${invite.room.id}`}>
                        <strong
                          style={{
                            display: "block",
                            fontSize: 14.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {invite.room.name.trim()}
                        </strong>
                      </Link>
                      <span
                        style={{
                          display: "block",
                          marginTop: 4,
                          color: "var(--text-2)",
                          fontSize: 12,
                        }}
                      >
                        {formatDate(invite.checkIn)} ~{" "}
                        {formatDate(invite.checkOut)}
                      </span>
                    </div>

                    <div>
                      <span
                        className="chip"
                        style={{
                          fontSize: 10.5,
                          background: "var(--bg-2)",
                          color: statusColor(invite),
                          border: "1px solid var(--border)",
                        }}
                      >
                        {statusLabel(invite)}
                      </span>
                      {invite.individualPayment && (
                        <strong
                          style={{
                            display: "block",
                            marginTop: 5,
                            fontSize: 13,
                          }}
                        >
                          {won(invite.individualPayment.totalDueNow)}
                        </strong>
                      )}
                    </div>

                    <details style={{ position: "relative" }}>
                      <summary
                        aria-label="지난 초대 메뉴 열기"
                        style={{
                          listStyle: "none",
                          cursor: "pointer",
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          border: "1px solid var(--border)",
                          display: "grid",
                          placeItems: "center",
                          userSelect: "none",
                        }}
                      >
                        ⋯
                      </summary>
                      <div
                        className="card"
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 40,
                          zIndex: 20,
                          width: 170,
                          padding: 7,
                          boxShadow: "var(--shadow)",
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            width: "100%",
                            border: 0,
                            background: "transparent",
                            padding: "9px 10px",
                            textAlign: "left",
                            cursor: "pointer",
                            color: "var(--text)",
                            fontSize: 13,
                          }}
                          disabled={busyId === invite.id}
                          onClick={() => void hidePastInvite(invite)}
                        >
                          내 목록에서 숨기기
                        </button>
                      </div>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

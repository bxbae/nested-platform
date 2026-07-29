"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  Booking,
  ContractChangeRequest,
  ContractChangeType,
} from "@/lib/types";
import { won } from "@/lib/format";
import {
  formatStayDuration,
  parseISODate,
  toLocalISODate,
} from "@/lib/stay-dates";
import {
  listMyBookings,
  cancelBooking,
  requestEarlyCheckout,
  requestExtension,
  quoteContractChange,
  cancelContractChange,
  confirmExtensionPayment,
  setReservationListHidden,
  type ContractChangeQuote,
  type ManagedBooking,
} from "@/lib/api/reservations";

type ChangeModalState = {
  booking: ManagedBooking;
  type: ContractChangeType;
} | null;

type ReservationTab = "current" | "past";

const ACTIVE_CHANGE_STATUSES = new Set([
  "HOST_REVIEW",
  "PAYMENT_PENDING",
]);

const TERMINAL_RESERVATION_STATUSES = new Set([
  "COMPLETED",
  "CANCELLED_BY_GUEST",
  "CANCELLED_BY_HOST",
  "NO_SHOW",
]);

function addDays(value: string, days: number): string {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toLocalISODate(date);
}

function changeStatusLabel(change: ContractChangeRequest): string {
  const prefix =
    change.type === "EARLY_CHECKOUT" ? "조기 퇴실" : "계약 연장";
  const labels: Record<ContractChangeRequest["status"], string> = {
    HOST_REVIEW: `${prefix} 요청 · 호스트 검토 중`,
    PAYMENT_PENDING: "연장 승인 · 추가 결제 대기",
    APPROVED:
      change.type === "EARLY_CHECKOUT"
        ? "조기 퇴실 승인"
        : "계약 연장 확정",
    REJECTED: `${prefix} 요청 거절`,
    CANCELLED: `${prefix} 요청 취소`,
    EXPIRED: "연장 결제 기한 만료",
    COMPLETED: "조기 퇴실·정산 완료",
  };
  return labels[change.status];
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isDateBeforeToday(value?: string | null): boolean {
  if (!value) return false;
  const date = parseISODate(value);
  return date < startOfToday();
}

function isDateAfterToday(value: string): boolean {
  const date = parseISODate(value);
  return date > startOfToday();
}

function isPastReservation(booking: ManagedBooking): boolean {
  const raw = booking.rawStatus ?? "";

  return (
    TERMINAL_RESERVATION_STATUSES.has(raw) ||
    isDateBeforeToday(booking.checkOut)
  );
}

function reservationStatusLabel(booking: ManagedBooking): string {
  const raw = booking.rawStatus ?? "";

  if (raw === "CANCELLED_BY_GUEST") return "게스트 취소";
  if (raw === "CANCELLED_BY_HOST") return "호스트 취소";
  if (raw === "COMPLETED") return "퇴실 완료";
  if (raw === "NO_SHOW") return "노쇼";
  if (raw === "PENDING_PAYMENT") return "결제 대기";
  if (raw === "EARLY_CHECKOUT_REQUESTED") return "조기 퇴실 요청 중";
  if (raw === "EARLY_CHECKOUT_APPROVED") return "조기 퇴실 승인";
  if (raw === "EXTENSION_REQUESTED") return "계약 연장 요청 중";

  if (isDateBeforeToday(booking.checkOut)) {
    return "기간 종료";
  }

  if (raw === "CONFIRMED") {
    return isDateAfterToday(booking.moveIn) ? "입주 예정" : "입주 중";
  }

  return booking.status === "cancelled" ? "취소됨" : "예약 확정";
}

function statusChipStyle(booking: ManagedBooking) {
  const past = isPastReservation(booking);
  const raw = booking.rawStatus ?? "";
  const warning = raw === "PENDING_PAYMENT";

  return {
    background: past
      ? "var(--bg-2)"
      : warning
        ? "var(--warning)"
        : "var(--secondary)",
    color: past ? "var(--text-2)" : "#fff",
    border: past ? "1px solid var(--border)" : "none",
  };
}

export function TripsList({ bare = false }: { bare?: boolean }) {
  const [bookings, setBookings] = useState<ManagedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<ChangeModalState>(null);
  const [requestedCheckOut, setRequestedCheckOut] = useState("");
  const [quote, setQuote] = useState<ContractChangeQuote | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReservationTab>("current");
  const [expandedPastIds, setExpandedPastIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lastHidden, setLastHidden] = useState<{
    id: string;
    houseName: string;
  } | null>(null);

  async function load() {
    try {
      const data = await listMyBookings();
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleBookings = bookings.filter(
    (booking) => booking.hiddenFromTrips !== true,
  );
  const currentBookings = visibleBookings.filter(
    (booking) => !isPastReservation(booking),
  );
  const pastBookings = visibleBookings.filter(isPastReservation);

  useEffect(() => {
    if (
      !loading &&
      currentBookings.length === 0 &&
      pastBookings.length > 0
    ) {
      setActiveTab("past");
    }
  }, [loading, currentBookings.length, pastBookings.length]);

  async function cancel(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await cancelBooking(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function openChange(booking: ManagedBooking, type: ContractChangeType) {
    if (!booking.checkOut) return;
    const defaultDate =
      type === "EXTENSION"
        ? addDays(booking.checkOut, 7)
        : (() => {
            const tomorrow = addDays(toLocalISODate(new Date()), 1);
            const weekBefore = addDays(booking.checkOut!, -7);
            return tomorrow < weekBefore ? weekBefore : tomorrow;
          })();
    setModal({ booking, type });
    setRequestedCheckOut(defaultDate);
    setQuote(null);
    setChangeError(null);
  }

  async function previewChange() {
    if (!modal || !requestedCheckOut) return;
    setBusyId(modal.booking.id);
    setChangeError(null);
    try {
      const result = await quoteContractChange(
        modal.booking.id,
        modal.type,
        requestedCheckOut,
      );
      setQuote(result);
    } catch (error) {
      setQuote(null);
      setChangeError(
        error instanceof Error
          ? error.message
          : "변경 금액을 계산하지 못했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function submitChange() {
    if (!modal || !requestedCheckOut) return;
    setBusyId(modal.booking.id);
    setChangeError(null);
    try {
      const currentQuote =
        quote ??
        (await quoteContractChange(
          modal.booking.id,
          modal.type,
          requestedCheckOut,
        ));
      setQuote(currentQuote);

      if (modal.type === "EARLY_CHECKOUT") {
        await requestEarlyCheckout(
          modal.booking.id,
          currentQuote.requestedCheckOut,
        );
      } else {
        await requestExtension(
          modal.booking.id,
          currentQuote.requestedCheckOut,
        );
      }
      setModal(null);
      await load();
    } catch (error) {
      setChangeError(
        error instanceof Error ? error.message : "요청을 보내지 못했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function cancelChange(booking: ManagedBooking) {
    if (busyId) return;
    setBusyId(booking.id);
    try {
      await cancelContractChange(booking.id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function payExtension(booking: ManagedBooking) {
    const change = booking.latestContractChange;
    if (!change || change.status !== "PAYMENT_PENDING" || busyId) return;
    setBusyId(booking.id);
    try {
      await confirmExtensionPayment({
        reservationId: booking.id,
        amount: change.additionalAmount,
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function hidePastBooking(booking: ManagedBooking) {
    if (busyId) return;
    setBusyId(booking.id);
    setListError(null);

    try {
      await setReservationListHidden(booking.id, true);
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? { ...item, hiddenFromTrips: true }
            : item,
        ),
      );
      setLastHidden({
        id: booking.id,
        houseName: booking.houseName.trim(),
      });
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "예약을 목록에서 숨기지 못했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function undoHidden() {
    if (!lastHidden || busyId) return;

    const target = lastHidden;
    setBusyId(target.id);
    setListError(null);

    try {
      await setReservationListHidden(target.id, false);
      setBookings((current) =>
        current.map((item) =>
          item.id === target.id
            ? { ...item, hiddenFromTrips: false }
            : item,
        ),
      );
      setLastHidden(null);
      setActiveTab("past");
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "숨김을 되돌리지 못했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function togglePastDetails(id: string) {
    setExpandedPastIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div
      className={bare ? "" : "wrap"}
      style={
        bare
          ? {}
          : { paddingTop: 40, paddingBottom: 60, maxWidth: 900 }
      }
    >
      {!bare && (
        <>
          <span className="eyebrow">예약 관리</span>
          <h1
            className="display"
            style={{ fontSize: 40, marginTop: 8, marginBottom: 24 }}
          >
            나의 예약
          </h1>
        </>
      )}

      {bare && (
        <h2 className="display" style={{ fontSize: 22, marginBottom: 14 }}>
          예약 내역
        </h2>
      )}

      <div
        role="tablist"
        aria-label="예약 내역 구분"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <ReservationTabButton
          selected={activeTab === "current"}
          onClick={() => setActiveTab("current")}
          label="진행 중·예정"
          count={currentBookings.length}
        />
        <ReservationTabButton
          selected={activeTab === "past"}
          onClick={() => setActiveTab("past")}
          label="지난 예약"
          count={pastBookings.length}
        />
      </div>

      {lastHidden && (
        <div
          role="status"
          className="card"
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            background: "var(--bg-2)",
          }}
        >
          <span style={{ fontSize: 13.5 }}>
            “{lastHidden.houseName}” 예약을 내 목록에서 숨겼습니다.
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

      {listError && (
        <p
          role="alert"
          style={{
            color: "var(--primary)",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {listError}
        </p>
      )}

      {loading && (
        <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>
      )}

      {!loading && visibleBookings.length === 0 && (
        <div
          className="card"
          style={{
            padding: 40,
            textAlign: "center",
            border: "1px dashed var(--border)",
            background: "transparent",
          }}
        >
          <p style={{ color: "var(--text-2)", marginBottom: 16 }}>
            아직 표시할 예약이 없어요. 새로운 집을 찾아보세요.
          </p>
          <Link href="/browse" className="btn btn-primary">
            숙소 둘러보기
          </Link>
        </div>
      )}

      {!loading &&
        visibleBookings.length > 0 &&
        activeTab === "current" &&
        currentBookings.length === 0 && (
          <EmptyReservationState message="현재 진행 중이거나 예정된 예약이 없어요." />
        )}

      {!loading &&
        visibleBookings.length > 0 &&
        activeTab === "past" &&
        pastBookings.length === 0 && (
          <EmptyReservationState message="아직 지난 예약이 없어요." />
        )}

      {activeTab === "current" && (
        <div style={{ display: "grid", gap: 14 }}>
          {currentBookings.map((booking) => {
            const raw = booking.rawStatus ?? "";
            const held = raw === "PENDING_PAYMENT";
            const change = booking.latestContractChange ?? null;
            const activeChange = Boolean(
              change && ACTIVE_CHANGE_STATUSES.has(change.status),
            );
            const companions = booking.companions ?? [];
            const confirmedCompanionCount = companions.filter(
              (companion) =>
                companion.status === "PAID" ||
                companion.status === "ACCEPTED",
            ).length;
            const confirmedGroupCount =
              companions.length > 0 ? 1 + confirmedCompanionCount : 1;

            return (
              <div
                key={booking.id}
                className="card"
                style={{ padding: 22 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ fontSize: 18 }}>
                        {booking.houseName.trim()}
                      </strong>
                      <span
                        className="chip"
                        style={{
                          ...statusChipStyle(booking),
                          fontSize: 11.5,
                        }}
                      >
                        {reservationStatusLabel(booking)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "var(--text-2)",
                        marginTop: 4,
                      }}
                    >
                      {booking.moveIn} ~ {booking.checkOut} ·{" "}
                      {booking.checkOut
                        ? formatStayDuration(
                            booking.moveIn,
                            booking.checkOut,
                          )
                        : `${booking.months}개월`}
                      {booking.reservedSpots &&
                      booking.reservedSpots > 1
                        ? ` · ${booking.reservedSpots}자리`
                        : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      className="display"
                      style={{ fontSize: 22, fontWeight: 600 }}
                    >
                      {won(booking.totalDueNow)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-2)",
                      }}
                    >
                      최초 예약 결제액
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 20,
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: "1px solid var(--border)",
                    fontSize: 13.5,
                    color: "var(--text-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <span>월세 {won(booking.monthlyRent)}</span>
                  <span>보증금 {won(booking.deposit)}</span>
                  <span>청소비 {won(booking.cleaningFee)}</span>
                  <span>수수료 {won(booking.serviceFee)}</span>
                </div>

                {companions.length > 0 && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "13px 14px",
                      borderRadius: 12,
                      background: "var(--bg-2)",
                      border: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <strong>
                      공동예약 현황 {confirmedGroupCount}/
                      {1 + companions.length}명 확정
                    </strong>
                    <div
                      style={{
                        display: "grid",
                        gap: 5,
                        marginTop: 8,
                        color: "var(--text-2)",
                      }}
                    >
                      <span>대표 예약자 · 결제 완료</span>
                      {companions.map((companion) => (
                        <span key={`${booking.id}-${companion.name}`}>
                          {companion.name} ·{" "}
                          {companionStatusText(companion.status)}
                          {companion.status === "PAYMENT_PENDING" &&
                          companion.paymentDeadline
                            ? ` · 결제 마감 ${formatDeadline(
                                companion.paymentDeadline,
                              )}`
                            : ""}
                        </span>
                      ))}
                    </div>
                    <p
                      style={{
                        marginTop: 8,
                        color: "var(--text-2)",
                        lineHeight: 1.55,
                      }}
                    >
                      미결제·거절·만료된 초대 자리는 자동으로 공개 잔여
                      자리로 복구됩니다.
                    </p>
                  </div>
                )}

                {change && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "13px 14px",
                      borderRadius: 12,
                      background: "var(--bg-2)",
                      border: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <strong>{changeStatusLabel(change)}</strong>
                    <div
                      style={{
                        color: "var(--text-2)",
                        marginTop: 5,
                        lineHeight: 1.6,
                      }}
                    >
                      기존 퇴실일 {change.originalCheckOut} → 요청 퇴실일{" "}
                      {change.requestedCheckOut}
                      {change.type === "EXTENSION" &&
                        change.additionalAmount > 0 && (
                          <>
                            <br />
                            추가 결제액 {won(change.additionalAmount)}
                          </>
                        )}
                      {change.type === "EARLY_CHECKOUT" &&
                        change.estimatedRefund > 0 && (
                          <>
                            <br />
                            예상 조정·환불액 {won(change.estimatedRefund)}
                          </>
                        )}
                      {change.rejectReason && (
                        <>
                          <br />
                          거절 사유: {change.rejectReason}
                        </>
                      )}
                    </div>

                    {change.status === "PAYMENT_PENDING" && (
                      <button
                        className="btn btn-primary press"
                        style={{ marginTop: 10, fontSize: 13 }}
                        disabled={busyId === booking.id}
                        onClick={() => void payExtension(booking)}
                      >
                        추가 금액 {won(change.additionalAmount)} 결제하기
                      </button>
                    )}

                    {activeChange && (
                      <button
                        className="btn btn-ghost press"
                        style={{
                          marginTop: 10,
                          marginLeft: 8,
                          fontSize: 13,
                        }}
                        disabled={busyId === booking.id}
                        onClick={() => void cancelChange(booking)}
                      >
                        요청 취소
                      </button>
                    )}
                  </div>
                )}

                {raw === "CONFIRMED" && !activeChange && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 13, padding: "8px 16px" }}
                      disabled={busyId === booking.id}
                      onClick={() => void cancel(booking.id)}
                    >
                      예약 취소
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 13, padding: "8px 16px" }}
                      onClick={() =>
                        openChange(booking, "EARLY_CHECKOUT")
                      }
                    >
                      조기 퇴실 요청
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 13, padding: "8px 16px" }}
                      onClick={() => openChange(booking, "EXTENSION")}
                    >
                      계약 연장 요청
                    </button>
                  </div>
                )}

                {held && (
                  <p
                    style={{
                      marginTop: 14,
                      color: "var(--text-2)",
                      fontSize: 13,
                    }}
                  >
                    결제가 완료되면 예약이 확정됩니다.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "past" && (
        <div style={{ display: "grid", gap: 10 }}>
          {pastBookings.map((booking) => {
            const expanded = expandedPastIds.has(booking.id);
            const companions = booking.companions ?? [];

            return (
              <article
                key={booking.id}
                className="card"
                style={{
                  padding: 17,
                  opacity: 0.9,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1.4fr) minmax(180px, .9fr) auto",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/homes/${booking.houseId}`}>
                      <strong
                        style={{
                          display: "block",
                          fontSize: 15.5,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {booking.houseName.trim()}
                      </strong>
                    </Link>
                    <span
                      style={{
                        display: "block",
                        marginTop: 4,
                        color: "var(--text-2)",
                        fontSize: 12.5,
                      }}
                    >
                      {booking.moveIn} ~ {booking.checkOut}
                    </span>
                  </div>

                  <div>
                    <span
                      className="chip"
                      style={{
                        ...statusChipStyle(booking),
                        fontSize: 11,
                      }}
                    >
                      {reservationStatusLabel(booking)}
                    </span>
                    <strong
                      style={{
                        display: "block",
                        marginTop: 6,
                        fontSize: 14,
                      }}
                    >
                      {won(booking.totalDueNow)}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 7,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12.5, padding: "7px 11px" }}
                      aria-expanded={expanded}
                      onClick={() => togglePastDetails(booking.id)}
                    >
                      {expanded ? "상세 닫기" : "상세 보기"}
                    </button>
                    <Link
                      href={`/homes/${booking.houseId}`}
                      className="btn btn-ghost"
                      style={{ fontSize: 12.5, padding: "7px 11px" }}
                    >
                      다시 예약
                    </Link>
                    <details style={{ position: "relative" }}>
                      <summary
                        aria-label="예약 메뉴 열기"
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
                          disabled={busyId === booking.id}
                          onClick={() => void hidePastBooking(booking)}
                        >
                          내 목록에서 숨기기
                        </button>
                      </div>
                    </details>
                  </div>
                </div>

                {expanded && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid var(--border)",
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 18,
                        flexWrap: "wrap",
                        color: "var(--text-2)",
                        fontSize: 13,
                      }}
                    >
                      <span>월세 {won(booking.monthlyRent)}</span>
                      <span>보증금 {won(booking.deposit)}</span>
                      <span>청소비 {won(booking.cleaningFee)}</span>
                      <span>관리비 {won(booking.maintenanceFee)}</span>
                      <span>수수료 {won(booking.serviceFee)}</span>
                    </div>

                    {companions.length > 0 && (
                      <div
                        style={{
                          padding: "11px 12px",
                          borderRadius: 10,
                          background: "var(--bg-2)",
                          fontSize: 12.5,
                          color: "var(--text-2)",
                        }}
                      >
                        <strong
                          style={{
                            color: "var(--text)",
                            display: "block",
                            marginBottom: 6,
                          }}
                        >
                          결제 참여자
                        </strong>
                        <span>대표 예약자</span>
                        {companions.map((companion) => (
                          <span
                            key={`${booking.id}-past-${companion.name}`}
                            style={{ display: "block", marginTop: 4 }}
                          >
                            {companion.name} ·{" "}
                            {companionStatusText(companion.status)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            modal.type === "EARLY_CHECKOUT"
              ? "조기 퇴실 요청"
              : "계약 연장 요청"
          }
          onClick={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0,0,0,.38)",
          }}
        >
          <div
            className="card"
            style={{ width: "min(520px, 100%)", padding: 24 }}
          >
            <h2 className="display" style={{ fontSize: 24, marginBottom: 6 }}>
              {modal.type === "EARLY_CHECKOUT"
                ? "조기 퇴실 요청"
                : "계약 연장 요청"}
            </h2>
            <p
              style={{
                color: "var(--text-2)",
                fontSize: 13.5,
                lineHeight: 1.6,
                marginBottom: 18,
              }}
            >
              기존 퇴실일은 {modal.booking.checkOut}입니다. 변경할 날짜와
              예상 금액을 확인한 뒤 호스트에게 요청합니다.
            </p>

            <label
              style={{
                display: "grid",
                gap: 7,
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              변경할 퇴실일
              <input
                type="date"
                value={requestedCheckOut}
                min={
                  modal.type === "EXTENSION"
                    ? addDays(modal.booking.checkOut!, 1)
                    : addDays(toLocalISODate(new Date()), 1)
                }
                max={
                  modal.type === "EARLY_CHECKOUT"
                    ? addDays(modal.booking.checkOut!, -1)
                    : undefined
                }
                onChange={(event) => {
                  setRequestedCheckOut(event.target.value);
                  setQuote(null);
                  setChangeError(null);
                }}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  font: "inherit",
                }}
              />
            </label>

            {quote && (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 12,
                  background: "var(--bg-2)",
                  lineHeight: 1.7,
                  fontSize: 13.5,
                }}
              >
                <div>
                  변경 기간: {quote.changedDays}일{" "}
                  {modal.type === "EARLY_CHECKOUT" ? "단축" : "연장"}
                </div>
                {modal.type === "EXTENSION" ? (
                  <>
                    <div>추가 월세 {won(quote.additionalRent)}</div>
                    <div>
                      추가 관리비 {won(quote.additionalMaintenance)}
                    </div>
                    <div>
                      추가 수수료 {won(quote.additionalServiceFee)}
                    </div>
                    <strong>
                      추가 결제 예정액 {won(quote.additionalAmount)}
                    </strong>
                  </>
                ) : (
                  <>
                    {!quote.minimumStaySatisfied && (
                      <div style={{ color: "var(--warning)" }}>
                        최소 계약 기간 전 퇴실이므로 최소 계약 금액이
                        유지됩니다.
                      </div>
                    )}
                    <strong>
                      예상 조정·환불액 {won(quote.estimatedRefund)}
                    </strong>
                    <div style={{ color: "var(--text-2)", fontSize: 12.5 }}>
                      실제 반환액은 미납금과 숙소 점검 결과에 따라 달라질
                      수 있습니다.
                    </div>
                  </>
                )}
              </div>
            )}

            {changeError && (
              <p
                style={{
                  marginTop: 12,
                  color: "var(--primary)",
                  fontSize: 13,
                }}
              >
                {changeError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => setModal(null)}
              >
                닫기
              </button>
              <button
                className="btn btn-ghost"
                disabled={
                  !requestedCheckOut || busyId === modal.booking.id
                }
                onClick={() => void previewChange()}
              >
                예상 금액 확인
              </button>
              <button
                className="btn btn-primary"
                disabled={
                  !requestedCheckOut ||
                  !quote ||
                  busyId === modal.booking.id
                }
                onClick={() => void submitChange()}
              >
                호스트에게 요청
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReservationTabButton({
  selected,
  onClick,
  label,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "11px 14px",
        marginBottom: -1,
        border: "none",
        borderBottom: selected
          ? "2px solid var(--primary)"
          : "2px solid transparent",
        background: "transparent",
        color: selected ? "var(--primary)" : "var(--text-2)",
        fontSize: 14,
        fontWeight: selected ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}
      <span
        style={{
          minWidth: 21,
          height: 21,
          padding: "0 6px",
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: selected
            ? "rgba(255, 90, 95, 0.12)"
            : "var(--bg-2)",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyReservationState({ message }: { message: string }) {
  return (
    <div
      className="card"
      style={{
        padding: 34,
        textAlign: "center",
        color: "var(--text-2)",
        border: "1px dashed var(--border)",
        background: "transparent",
      }}
    >
      {message}
    </div>
  );
}

function companionStatusText(
  status:
    | "PENDING"
    | "ACCEPTED"
    | "DECLINED"
    | "PAYMENT_PENDING"
    | "PAID"
    | "EXPIRED",
): string {
  if (status === "PAID") return "결제 완료";
  if (status === "PAYMENT_PENDING") return "수락 · 결제 대기";
  if (status === "DECLINED") return "초대 거절";
  if (status === "EXPIRED") return "기한 만료";
  if (status === "ACCEPTED") return "수락 완료";
  return "초대 확인 전";
}

function formatDeadline(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

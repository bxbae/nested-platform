"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import { formatStayDuration } from "@/lib/stay-dates";
import { reviewTenant } from "@/lib/api/badges";
import {
  listHostReservations,
  setHostReservationStatus,
  sendOverdueNotice,
  decideEarlyCheckout,
  decideExtension,
  completeEarlyCheckout,
  type HostReservation,
  type HostReservationStatus,
} from "@/lib/api/reservations";

// Full lifecycle labels/colors. Guest-side cancellations and host actions are
// shown distinctly so the host can tell what happened.
const STATUS: Record<HostReservationStatus, { label: string; color: string; muted?: boolean }> = {
  PENDING_PAYMENT: { label: "결제 대기", color: "var(--warning)" },
  CONFIRMED: { label: "예약 확정", color: "var(--secondary)" },
  COMPLETED: { label: "이용 완료", color: "var(--text-2)", muted: true },
  NO_SHOW: { label: "노쇼", color: "var(--text-2)", muted: true },
  CANCELLED_BY_GUEST: { label: "게스트 취소", color: "var(--text-2)", muted: true },
  CANCELLED_BY_HOST: { label: "거절/취소", color: "var(--text-2)", muted: true },
  EARLY_CHECKOUT_REQUESTED: { label: "조기 퇴실 요청", color: "var(--primary)" },
  EARLY_CHECKOUT_APPROVED: { label: "조기 퇴실 승인", color: "var(--text-2)", muted: true },
  EXTENSION_REQUESTED: { label: "연장 요청", color: "var(--primary)" },
};

type Filter = "all" | "PENDING_PAYMENT" | "CONFIRMED" | "done";

export default function HostReservations() {
  const [rows, setRows] = useState<HostReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noticed, setNoticed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [focusedReservationId, setFocusedReservationId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setRows(await listHostReservations());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Deep link from the dashboard's "새 예약/취소" card, e.g.
    // /host/reservations?filter=PENDING_PAYMENT. Read straight off the URL
    // (rather than useSearchParams) so this page doesn't need a Suspense
    // boundary just for an initial-filter deep link.
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("filter");
    if (q === "PENDING_PAYMENT" || q === "CONFIRMED" || q === "done") setFilter(q);
    const reservationId = params.get("reservationId");
    if (reservationId) {
      setFocusedReservationId(reservationId);
      setFilter("all");
    }
  }, []);

  useEffect(() => {
    if (!focusedReservationId || rows.length === 0) return;
    window.setTimeout(() => {
      document.getElementById(`reservation-${focusedReservationId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }, [focusedReservationId, rows]);

  // 노쇼는 되돌릴 수 없고 정산에도 영향을 주므로, 한 번 더 확인받는다.
  // 다른 화면(숙소 삭제·승인 취소)과 같은 "두 번 눌러야 실행" 패턴.
  const [confirmNoShowId, setConfirmNoShowId] = useState<string | null>(null);

  function requestNoShow(id: string) {
    if (busyId) return;
    if (confirmNoShowId !== id) {
      setConfirmNoShowId(id);
      return;
    }
    setConfirmNoShowId(null);
    void act(id, "NO_SHOW");
  }

  async function act(
    id: string,
    status: "CONFIRMED" | "CANCELLED_BY_HOST" | "COMPLETED" | "NO_SHOW"
  ) {
    if (busyId) return;
    setBusyId(id);
    try {
      await setHostReservationStatus(id, status);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  // Send an overdue-payment notice to this reservation's guest (in-app notification).
  async function notifyOverdue(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await sendOverdueNotice(id);
      setNoticed((prev) => new Set(prev).add(id));
    } finally {
      setBusyId(null);
    }
  }

  // Approve or reject a guest's early-checkout request.
  async function decideEarly(id: string, decision: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    try {
      await decideEarlyCheckout(id, decision);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  // Approve or reject a guest's contract-extension request.
  async function decideExt(id: string, decision: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    try {
      await decideExtension(id, decision);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function completeEarly(id: string) {
    if (busyId) return;
    const raw = window.prompt(
      "보증금에서 공제할 금액을 원 단위 숫자로 입력해주세요. 공제가 없으면 0",
      "0",
    );
    if (raw === null) return;
    const deduction = Math.max(0, Number(raw.replace(/,/g, "")) || 0);
    setBusyId(id);
    try {
      await completeEarlyCheckout(id, deduction);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  // ── Tenant review (호스트 → 입주자) ──
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function submitTenantReview(id: string) {
    if (busyId) return;
    if (!reviewBody.trim()) {
      setReviewError("평가 내용을 입력해주세요.");
      return;
    }
    setBusyId(id);
    setReviewError(null);
    try {
      await reviewTenant(id, rating, reviewBody.trim());
      setReviewed((prev) => new Set(prev).add(id));
      setReviewFor(null);
      setReviewBody("");
      setRating(5);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "평가를 등록하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  const shown = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "done") return ["COMPLETED", "NO_SHOW", "CANCELLED_BY_GUEST", "CANCELLED_BY_HOST"].includes(r.status);
    return r.status === filter;
  });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "PENDING_PAYMENT", label: "결제 대기" },
    { key: "CONFIRMED", label: "예약 확정" },
    { key: "done", label: "종료" },
  ];

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>예약 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>내 숙소로 들어온 예약을 확인하고 처리하세요.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f.key} className="chip" data-active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && shown.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          해당하는 예약이 없습니다. 게스트가 예약하면 여기에 표시됩니다.
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {shown.map((b) => {
          const st = STATUS[b.status];
          return (
            <div
              key={b.id}
              id={`reservation-${b.id}`}
              className="card"
              style={{
                padding: 20,
                border: focusedReservationId === b.id
                  ? "2px solid var(--primary)"
                  : "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontSize: 16 }}>{b.houseName.trim()}</strong>
                    {/* muted 상태(취소·완료 등)는 배경을 칠하지 않고 외곽선으로
                        차분하게 둔다. 예전에는 배경과 글자가 모두 var(--text-2)
                        여서 라벨이 회색 위 회색으로 묻혀 읽히지 않았다. */}
                    <span
                      className="chip"
                      style={
                        st.muted
                          ? {
                              fontSize: 11,
                              background: "var(--bg-2)",
                              color: "var(--text-2)",
                              border: "1px solid var(--border)",
                            }
                          : { fontSize: 11, background: st.color, color: "#fff", border: "none" }
                      }
                    >
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4 }}>
                    {b.guestName} · {b.moveIn} ~ {b.checkOut} · {formatStayDuration(b.moveIn, b.checkOut)}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>
                    {bookingTypeLabel(b)} · 예약 {Math.max(1, b.reservedSpots ?? 1)}자리
                    {b.rentalUnit === "bed" && b.capacity ? ` · 전체 ${b.capacity}자리` : ""}
                  </div>
                  {b.companions.length > 0 && (
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>
                      동반 입주자: {b.companions.map((companion) => `${companion.name}(${companionStatusLabel(companion.status)})`).join(", ")}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: 17 }}>{won(b.totalDueNow)}</strong>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>입주 시 결제</div>
                </div>
              </div>

              {/* Pending → approve / reject */}
              {b.status === "PENDING_PAYMENT" && (
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn btn-primary press" style={{ fontSize: 13, padding: "8px 16px" }} disabled={busyId === b.id} onClick={() => act(b.id, "CONFIRMED")}>
                    예약 승인
                  </button>
                  <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 16px" }} disabled={busyId === b.id} onClick={() => act(b.id, "CANCELLED_BY_HOST")}>
                    거절
                  </button>
                </div>
              )}

              {/* Confirmed → complete / no-show / overdue notice */}
              {b.status === "CONFIRMED" && (
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 16px" }} disabled={busyId === b.id} onClick={() => act(b.id, "COMPLETED")}>
                    이용 완료 처리
                  </button>
                  <button
                    className="btn btn-ghost press"
                    style={{
                      fontSize: 13,
                      padding: "8px 16px",
                      color: confirmNoShowId === b.id ? "#fff" : undefined,
                      background: confirmNoShowId === b.id ? "var(--primary)" : undefined,
                      borderColor: confirmNoShowId === b.id ? "var(--primary)" : undefined,
                    }}
                    disabled={busyId === b.id}
                    onClick={() => requestNoShow(b.id)}
                  >
                    {confirmNoShowId === b.id ? "정말 노쇼 처리할까요?" : "노쇼 처리"}
                  </button>
                  <button
                    className="btn btn-ghost press"
                    style={{ fontSize: 13, padding: "8px 16px", color: "var(--warning)" }}
                    disabled={busyId === b.id || noticed.has(b.id)}
                    onClick={() => notifyOverdue(b.id)}
                    title="입주자에게 연체 안내 알림을 보냅니다"
                  >
                    {noticed.has(b.id) ? "✓ 안내 발송됨" : " 연체 안내"}
                  </button>
                </div>
              )}

              {/* 조기 퇴실 요청 → 희망일·예상 환불 확인 후 승인/거절 */}
              {b.status === "EARLY_CHECKOUT_REQUESTED" &&
                b.latestContractChange?.type === "EARLY_CHECKOUT" && (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--bg-2)",
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                      <strong>조기 퇴실 요청</strong>
                      <br />
                      기존 퇴실일 {b.latestContractChange.originalCheckOut}
                      <br />
                      희망 퇴실일 {b.latestContractChange.requestedCheckOut}
                      <br />
                      예상 조정·환불액 {won(b.latestContractChange.estimatedRefund)}
                    </div>
                    {b.latestContractChange.status === "HOST_REVIEW" ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary press"
                          style={{ fontSize: 13, padding: "8px 16px" }}
                          disabled={busyId === b.id}
                          onClick={() => void decideEarly(b.id, "approve")}
                        >
                          퇴실 승인
                        </button>
                        <button
                          className="btn btn-ghost press"
                          style={{ fontSize: 13, padding: "8px 16px" }}
                          disabled={busyId === b.id}
                          onClick={() => void decideEarly(b.id, "reject")}
                        >
                          거절
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                        현재 상태: {b.latestContractChange.status}
                      </span>
                    )}
                  </div>
                )}

              {/* 연장 요청 → 희망일·추가 금액 확인 후 승인/거절 */}
              {b.status === "EXTENSION_REQUESTED" &&
                b.latestContractChange?.type === "EXTENSION" && (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--bg-2)",
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                      <strong>계약 연장 요청</strong>
                      <br />
                      기존 퇴실일 {b.latestContractChange.originalCheckOut}
                      <br />
                      요청 퇴실일 {b.latestContractChange.requestedCheckOut}
                      <br />
                      추가 월세 {won(b.latestContractChange.additionalRent)}
                      <br />
                      추가 관리비 {won(b.latestContractChange.additionalMaintenance)}
                      <br />
                      추가 결제액 {won(b.latestContractChange.additionalAmount)}
                    </div>
                    {b.latestContractChange.status === "HOST_REVIEW" ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary press"
                          style={{ fontSize: 13, padding: "8px 16px" }}
                          disabled={busyId === b.id}
                          onClick={() => void decideExt(b.id, "approve")}
                        >
                          연장 승인
                        </button>
                        <button
                          className="btn btn-ghost press"
                          style={{ fontSize: 13, padding: "8px 16px" }}
                          disabled={busyId === b.id}
                          onClick={() => void decideExt(b.id, "reject")}
                        >
                          거절
                        </button>
                      </div>
                    ) : b.latestContractChange.status === "PAYMENT_PENDING" ? (
                      <span style={{ fontSize: 13, color: "var(--warning)" }}>
                        호스트 승인 완료 · 게스트 추가 결제 대기
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                        현재 상태: {b.latestContractChange.status}
                      </span>
                    )}
                  </div>
                )}

              {b.status === "EARLY_CHECKOUT_APPROVED" &&
                b.latestContractChange?.type === "EARLY_CHECKOUT" &&
                b.latestContractChange.status === "APPROVED" && (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--bg-2)",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>
                      승인된 퇴실일 {b.latestContractChange.requestedCheckOut}
                    </span>
                    <button
                      className="btn btn-primary press"
                      style={{ width: "fit-content", fontSize: 13, padding: "8px 16px" }}
                      disabled={busyId === b.id}
                      onClick={() => void completeEarly(b.id)}
                    >
                      실제 퇴실·보증금 정산 완료
                    </button>
                  </div>
                )}

              {/* Finished stay → review the tenant */}
              {(b.status === "COMPLETED" || b.status === "EARLY_CHECKOUT_APPROVED") && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  {reviewed.has(b.id) ? (
                    <span style={{ fontSize: 13, color: "var(--text-2)" }}>✓ 입주자 평가를 등록했습니다.</span>
                  ) : reviewFor === b.id ? (
                    <div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 10 }} role="radiogroup" aria-label="입주자 평점">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={rating === n}
                            aria-label={`${n}점`}
                            onClick={() => setRating(n)}
                            style={{
                              background: "none", border: "none", cursor: "pointer", padding: 0,
                              fontSize: 22, lineHeight: 1,
                              color: rating >= n ? "#FF5A5F" : "var(--border)",
                            }}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewBody}
                        onChange={(e) => setReviewBody(e.target.value)}
                        placeholder="입주 기간 동안 어떤 입주자였나요? (청결, 소통, 규칙 준수 등)"
                        rows={3}
                        style={{
                          width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: 10,
                          border: "1px solid var(--border)", fontSize: 13.5, fontFamily: "inherit",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button className="btn btn-primary press" style={{ fontSize: 13, padding: "8px 16px" }} disabled={busyId === b.id} onClick={() => submitTenantReview(b.id)}>
                          {busyId === b.id ? "등록 중…" : "평가 등록"}
                        </button>
                        <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 12px" }} onClick={() => { setReviewFor(null); setReviewError(null); }}>
                          취소
                        </button>
                      </div>
                      {reviewError && (
                        <p style={{ fontSize: 12.5, color: "var(--primary)", marginTop: 8 }}>{reviewError}</p>
                      )}
                    </div>
                  ) : (
                    <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => setReviewFor(b.id)}>
                       입주자 평가하기
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function bookingTypeLabel(reservation: HostReservation): string {
  if (reservation.bookingMode === "bed") return "공유형 다인실 자리 예약";
  if (reservation.bookingMode === "whole_room") return "공유형 다인실 전체 예약";
  if (reservation.rentalUnit === "private_room") return "공유형 개인실 예약";
  return "단독형 숙소 예약";
}

function companionStatusLabel(status: "PENDING" | "ACCEPTED" | "DECLINED"): string {
  if (status === "ACCEPTED") return "수락";
  if (status === "DECLINED") return "거절";
  return "응답 대기";
}

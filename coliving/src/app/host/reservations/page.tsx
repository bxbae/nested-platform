"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import {
  listHostReservations,
  setHostReservationStatus,
  sendOverdueNotice,
  decideEarlyCheckout,
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
};

type Filter = "all" | "PENDING_PAYMENT" | "CONFIRMED" | "done";

export default function HostReservations() {
  const [rows, setRows] = useState<HostReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noticed, setNoticed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");

  async function load() {
    setLoading(true);
    setRows(await listHostReservations());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
            <div key={b.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontSize: 16 }}>{b.houseName.trim()}</strong>
                    <span className="chip" style={{ fontSize: 11, background: st.color, color: st.muted ? "var(--text-2)" : "#fff", border: "none" }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4 }}>
                    {b.guestName} · 입주 {b.moveIn} · {b.months}개월
                  </div>
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
                  <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 16px" }} disabled={busyId === b.id} onClick={() => act(b.id, "NO_SHOW")}>
                    노쇼 처리
                  </button>
                  <button
                    className="btn btn-ghost press"
                    style={{ fontSize: 13, padding: "8px 16px", color: "var(--warning)" }}
                    disabled={busyId === b.id || noticed.has(b.id)}
                    onClick={() => notifyOverdue(b.id)}
                    title="입주자에게 연체 안내 알림을 보냅니다"
                  >
                    {noticed.has(b.id) ? "✓ 안내 발송됨" : "🔔 연체 안내"}
                  </button>
                </div>
              )}

              {/* Early-checkout request → approve / reject */}
              {b.status === "EARLY_CHECKOUT_REQUESTED" && (
                <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                    입주자가 계약 기간 전 퇴실을 요청했습니다.
                  </span>
                  <button className="btn btn-primary press" style={{ fontSize: 13, padding: "8px 16px" }} disabled={busyId === b.id} onClick={() => decideEarly(b.id, "approve")}>
                    퇴실 승인
                  </button>
                  <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 16px" }} disabled={busyId === b.id} onClick={() => decideEarly(b.id, "reject")}>
                    거절
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

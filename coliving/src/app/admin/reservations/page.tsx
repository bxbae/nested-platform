"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import {
  listReservations,
  type AdminReservation,
  type AdminReservationStatus,
} from "@/lib/api/admin";

// Status → Korean label + colour. Covers all eight ReservationStatus values.
const STATUS: Record<AdminReservationStatus, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: "결제 대기", color: "var(--warning)" },
  CONFIRMED: { label: "예약 확정", color: "var(--secondary)" },
  COMPLETED: { label: "이용 완료", color: "var(--text-2)" },
  CANCELLED_BY_GUEST: { label: "게스트 취소", color: "var(--text-2)" },
  CANCELLED_BY_HOST: { label: "호스트 취소", color: "var(--text-2)" },
  NO_SHOW: { label: "노쇼", color: "var(--text-2)" },
  EARLY_CHECKOUT_REQUESTED: { label: "조기퇴실 요청", color: "var(--warning)" },
  EARLY_CHECKOUT_APPROVED: { label: "조기퇴실 승인", color: "var(--secondary)" },
};

// Filter chips: "all" plus the statuses an admin most often filters by.
const FILTERS: { value: "all" | AdminReservationStatus; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "PENDING_PAYMENT", label: "결제 대기" },
  { value: "CONFIRMED", label: "예약 확정" },
  { value: "COMPLETED", label: "이용 완료" },
  { value: "CANCELLED_BY_GUEST", label: "취소" },
];

const PAGE_SIZE = 50;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminReservations() {
  const [rows, setRows] = useState<AdminReservation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | AdminReservationStatus>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listReservations(
      filter === "all" ? undefined : filter,
      PAGE_SIZE,
      page * PAGE_SIZE,
    )
      .then((res) => {
        if (!alive) return;
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch(() => {
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filter, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>예약 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        전체 {total}건
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className="chip"
            data-active={filter === f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(0);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && rows.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          해당하는 예약이 없습니다.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="admin-table-head" style={{ gridTemplateColumns: "2fr 1.5fr 1.2fr 1fr 1fr" }}>
            <span>숙소</span><span>게스트</span><span>입주일</span><span>금액</span><span>상태</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="admin-table-row" style={{ gridTemplateColumns: "2fr 1.5fr 1.2fr 1fr 1fr" }}>
              <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.room.name.trim()}</span>
              <span style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.guest.name}</span>
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>{fmtDate(r.checkIn)}</span>
              <span style={{ fontSize: 13.5 }}>{won(r.totalDueNow)}</span>
              <span>
                {/* 회색 계열(취소·완료 등)은 배경을 칠하면 글자가 같은 회색이
                    되어 묻힌다. 그런 상태는 외곽선 배지로 표시한다. */}
                {(() => {
                  const st = STATUS[r.status];
                  const muted = st.color === "var(--text-2)";
                  return (
                    <span
                      className="chip"
                      style={
                        muted
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
                  );
                })()}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 20 }}>
          <button className="chip" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            이전
          </button>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>
            {page + 1} / {totalPages}
          </span>
          <button className="chip" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            다음
          </button>
        </div>
      )}
    </div>
  );
}

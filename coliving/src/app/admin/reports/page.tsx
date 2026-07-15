"use client";

// 신고 관리 — same pattern as /admin/members (typed shape → client fn → effect).
//
// A report moves through a fixed status flow:
//   RECEIVED → IN_REVIEW → RESOLVED
// The admin advances it one step at a time; RESOLVED is terminal.

import { useCallback, useEffect, useState } from "react";
import {
  listReports,
  setReportStatus,
  type AdminReport,
  type ReportStatus,
} from "@/lib/api/admin";

const STATUS_LABEL: Record<ReportStatus, string> = {
  RECEIVED: "접수",
  IN_REVIEW: "검토중",
  RESOLVED: "처리완료",
};

const TARGET_LABEL: Record<string, string> = {
  ROOM: "숙소",
  REVIEW: "리뷰",
  USER: "사용자",
  MESSAGE: "메시지",
};

// The next step in the flow, or null if already resolved.
const NEXT_STATUS: Record<ReportStatus, ReportStatus | null> = {
  RECEIVED: "IN_REVIEW",
  IN_REVIEW: "RESOLVED",
  RESOLVED: null,
};

const FILTERS: { key: ReportStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "RECEIVED", label: "접수" },
  { key: "IN_REVIEW", label: "검토중" },
  { key: "RESOLVED", label: "처리완료" },
];

export default function AdminReports() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [filter, setFilter] = useState<ReportStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (status: ReportStatus | "ALL") => {
    setLoading(true);
    setError(null);
    try {
      setReports(await listReports(status === "ALL" ? undefined : status));
    } catch (e) {
      setError(e instanceof Error ? e.message : "신고 목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function advance(r: AdminReport) {
    const next = NEXT_STATUS[r.status];
    if (!next || busyId) return;
    setBusyId(r.id);
    setError(null);
    try {
      await setReportStatus(r.id, next);
      // If we're viewing a filtered list, the row may no longer belong here —
      // reload rather than patch in place.
      if (filter !== "ALL") {
        await load(filter);
      } else {
        setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태를 변경하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  const unresolved = reports.filter((r) => r.status !== "RESOLVED").length;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>신고 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        {loading ? "불러오는 중…" : `미처리 ${unresolved}건 · 전체 ${reports.length}건`}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="chip"
            data-active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>
      )}

      {!loading && reports.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-2)" }}>
          신고가 없어요.
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {reports.map((r) => {
          const next = NEXT_STATUS[r.status];
          return (
            <div key={r.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="chip" style={{ fontSize: 11 }}>
                    {TARGET_LABEL[r.targetType] ?? r.targetType}
                  </span>
                  <StatusChip status={r.status} />
                </div>
                <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                  {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>

              <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>{r.reason}</p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                  신고자 {r.reporterName} · 대상 ID {r.targetId.slice(0, 8)}…
                </span>
                {next ? (
                  <button
                    className="btn btn-ghost press"
                    style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap" }}
                    onClick={() => advance(r)}
                    disabled={busyId === r.id}
                  >
                    {busyId === r.id
                      ? "처리 중…"
                      : `${STATUS_LABEL[next]}(으)로`}
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>완료됨</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: ReportStatus }) {
  const bg =
    status === "RESOLVED" ? "var(--secondary)" :
    status === "IN_REVIEW" ? "var(--primary)" :
    "var(--text-2)";
  return (
    <span className="chip" style={{ fontSize: 11, border: "none", color: "#fff", background: bg }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

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
  getReportContext,
  notifyReportParty,
  type AdminReport,
  type ReportStatus,
  type ReportContext,
} from "@/lib/api/admin";
import ReportChatModal from "./ReportChatModal";

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

  // 신고 상세 컨텍스트(신고자/피신고자 계정, 연결된 채팅 위치) — 신고건별로
  // 필요할 때 한 번만 조회해 캐시해둔다.
  const [contexts, setContexts] = useState<Record<string, ReportContext>>({});
  const [contextBusyId, setContextBusyId] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<ReportContext["chat"]>(null);
  const [notifyBusyKey, setNotifyBusyKey] = useState<string | null>(null);

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

  // 신고건의 컨텍스트(신고자/피신고자 계정 + 연결된 채팅 위치)를 필요 시점에
  // 가져와 캐시한다. 이미 가져온 적이 있으면 그대로 재사용.
  const ensureContext = useCallback(
    async (r: AdminReport): Promise<ReportContext | null> => {
      if (contexts[r.id]) return contexts[r.id];
      setContextBusyId(r.id);
      setError(null);
      try {
        const ctx = await getReportContext(r.id);
        setContexts((prev) => ({ ...prev, [r.id]: ctx }));
        return ctx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "신고 상세 정보를 불러오지 못했어요.");
        return null;
      } finally {
        setContextBusyId(null);
      }
    },
    [contexts],
  );

  async function viewChat(r: AdminReport) {
    const ctx = await ensureContext(r);
    if (ctx?.chat) setChatTarget(ctx.chat);
  }

  async function viewAccount(r: AdminReport, which: "reporter" | "reported") {
    const ctx = await ensureContext(r);
    const account = which === "reporter" ? ctx?.reporter : ctx?.reported;
    if (account) {
      window.open(`/users/${account.id}`, "_blank", "noopener,noreferrer");
    } else if (ctx) {
      setError("피신고자 계정을 확인할 수 없어요.");
    }
  }

  async function notify(r: AdminReport, target: "REPORTER" | "REPORTED") {
    const ctx = await ensureContext(r);
    const account = target === "REPORTER" ? ctx?.reporter : ctx?.reported;
    if (!ctx || !account) {
      setError("알림을 받을 계정을 확인할 수 없어요.");
      return;
    }
    if (!confirm(`${account.name}님에게 신고 처리 알림을 보낼까요?`)) return;

    const key = `${r.id}:${target}`;
    setNotifyBusyKey(key);
    setError(null);
    try {
      await notifyReportParty(r.id, target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알림을 보내지 못했어요.");
    } finally {
      setNotifyBusyKey(null);
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
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

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                {r.targetType === "MESSAGE" && (
                  <button
                    className="chip"
                    style={{ fontSize: 12, cursor: "pointer" }}
                    onClick={() => void viewChat(r)}
                    disabled={contextBusyId === r.id}
                  >
                    채팅 보기
                  </button>
                )}
                <button
                  className="chip"
                  style={{ fontSize: 12, cursor: "pointer" }}
                  onClick={() => void viewAccount(r, "reporter")}
                  disabled={contextBusyId === r.id}
                >
                  신고자 계정 조회
                </button>
                <button
                  className="chip"
                  style={{ fontSize: 12, cursor: "pointer" }}
                  onClick={() => void viewAccount(r, "reported")}
                  disabled={contextBusyId === r.id}
                >
                  피신고자 계정 조회
                </button>
                <button
                  className="chip"
                  style={{ fontSize: 12, cursor: "pointer" }}
                  onClick={() => void notify(r, "REPORTER")}
                  disabled={contextBusyId === r.id || notifyBusyKey === `${r.id}:REPORTER`}
                >
                  {notifyBusyKey === `${r.id}:REPORTER` ? "전송 중…" : "신고자에게 처리 알림"}
                </button>
                <button
                  className="chip"
                  style={{ fontSize: 12, cursor: "pointer" }}
                  onClick={() => void notify(r, "REPORTED")}
                  disabled={contextBusyId === r.id || notifyBusyKey === `${r.id}:REPORTED`}
                >
                  {notifyBusyKey === `${r.id}:REPORTED` ? "전송 중…" : "피신고자에게 처리 알림"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ReportChatModal chat={chatTarget} onClose={() => setChatTarget(null)} />
    </div>
  );
}

function StatusChip({ status }: { status: ReportStatus }) {
  // RESOLVED = teal, IN_REVIEW = coral, RECEIVED = outlined (no fill).
  // The old RECEIVED used a gray fill (var(--text-2)) with white text, which
  // washed out in dark mode. An outlined chip reads clearly in both themes.
  if (status === "RECEIVED") {
    return (
      <span
        className="chip"
        style={{ fontSize: 11, color: "var(--text)", background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {STATUS_LABEL[status]}
      </span>
    );
  }
  const bg = status === "RESOLVED" ? "var(--secondary)" : "var(--primary)";
  return (
    <span className="chip" style={{ fontSize: 11, border: "none", color: "#fff", background: bg }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

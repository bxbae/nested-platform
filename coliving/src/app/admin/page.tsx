"use client";

// 관리자 대시보드 — real platform totals + live preview of the approval and
// report queues. Pulls three endpoints in parallel:
//   GET /admin/stats            → headline numbers
//   GET /admin/rooms/pending    → 승인 대기 목록
//   GET /admin/reports          → 최근 신고
//
// GET /admin/stats returns totals only (no time series), so there's no chart
// here — that's a separate feature. See /admin/stats for the trend view.

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import {
  getStats,
  listPendingRooms,
  listReports,
  type AdminStats,
  type AdminReport,
  type PendingListing,
} from "@/lib/api/admin";

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "접수",
  IN_REVIEW: "검토중",
  RESOLVED: "처리완료",
};
const TARGET_LABEL: Record<string, string> = {
  ROOM: "숙소", REVIEW: "리뷰", USER: "사용자", MESSAGE: "메시지",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Fetch in parallel — the three are independent.
        const [s, p, r] = await Promise.all([
          getStats(),
          listPendingRooms(),
          listReports(),
        ]);
        setStats(s);
        setPending(p);
        setReports(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "현황을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openReports = reports.filter((r) => r.status !== "RESOLVED");

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>대시보드</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>플랫폼 전체 현황을 확인하세요.</p>

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 16 }}>{error}</p>
      )}

      {/* GMV hero */}
      <div style={{ background: "linear-gradient(135deg, var(--text), #3a3a42)", borderRadius: "var(--r-lg)", padding: 26, color: "#fff", marginBottom: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>누적 거래액 (GMV)</div>
        <div className="display" style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>
          {loading || !stats ? "—" : won(stats.gmv)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
          수수료 수익 {loading || !stats ? "—" : won(stats.commission)}
        </div>
      </div>

      <div className="stat-row">
        <Stat label="총 회원" value={fmt(stats?.users, loading)} />
        <Stat label="총 숙소" value={fmt(stats?.rooms, loading)} />
        <Stat label="승인 대기" value={loading ? "—" : `${pending.length}`} accent href="/admin/approvals" />
        <Stat label="미처리 신고" value={loading ? "—" : `${openReports.length}`} accent href="/admin/reports" />
      </div>

      <div className="admin-two" style={{ marginTop: 20 }}>
        <Panel title="숙소 승인 대기" href="/admin/approvals">
          {loading ? (
            <Empty text="불러오는 중…" />
          ) : pending.length === 0 ? (
            <Empty text="대기 중인 숙소가 없어요." />
          ) : (
            pending.slice(0, 4).map((p) => (
              <Row key={p.id} left={p.name} sub={p.region ?? ""} right={won(p.monthlyRent)} />
            ))
          )}
        </Panel>

        <Panel title="최근 신고" href="/admin/reports">
          {loading ? (
            <Empty text="불러오는 중…" />
          ) : reports.length === 0 ? (
            <Empty text="신고가 없어요." />
          ) : (
            reports.slice(0, 4).map((r) => (
              <Row
                key={r.id}
                left={r.reason}
                sub={`${TARGET_LABEL[r.targetType] ?? r.targetType} · 신고자 ${r.reporterName}`}
                right={STATUS_LABEL[r.status] ?? r.status}
              />
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}

function fmt(n: number | undefined, loading: boolean) {
  if (loading || n === undefined) return "—";
  return n.toLocaleString();
}

function Stat({ label, value, accent, href }: { label: string; value: string; accent?: boolean; href?: string }) {
  const inner = (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: accent ? "var(--primary)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href} className="hover-card" style={{ display: "block", borderRadius: "var(--r-lg)" }}>{inner}</Link> : inner;
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>{title}</strong>
        <Link href={href} style={{ color: "var(--secondary)", fontSize: 13, fontWeight: 600 }}>전체 →</Link>
      </div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ left, sub, right }: { left: string; sub: string; right: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</div>
        <div style={{ fontSize: 12, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      </div>
      <span style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "nowrap", marginLeft: 8 }}>{right}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 16, textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>{text}</div>;
}

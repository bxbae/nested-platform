"use client";

// 관리자 대시보드 (2단계)
// ─────────────────────────────────────────────────────────────────────
// 실데이터 연결:
//   · getStats()             → 누적 GMV / 수수료 / 회원 수 / 숙소 수
//   · getDashboardSummary()  → 오늘의 운영현황 6종(전일대비) / 이번 달 매출·순수익
//                              / 호스트 수 / 평균 평점 / 예약 현황
//   · listPendingRooms()     → 승인 대기 수 + 목록
//   · listReports()          → 미처리 신고 수 + 최근 신고 목록
// 아직 스켈레톤(3단계 대상): 매출 추이 차트, 답변대기·리뷰·정산·쿠폰 카운트.

import { useEffect, useState } from "react";
import Link from "next/link";
import { won, wonShort } from "@/lib/format";
import { RevenueTrendChart } from "./RevenueTrendChart";
import {
  getStats,
  getDashboardSummary,
  getRevenueTrend,
  listPendingRooms,
  listReports,
  type AdminStats,
  type DashboardSummary,
  type RevenueTrend,
  type MetricPoint,
  type AdminReport,
  type PendingListing,
} from "@/lib/api/admin";

const TARGET_LABEL: Record<string, string> = {
  ROOM: "숙소",
  REVIEW: "리뷰",
  USER: "사용자",
  MESSAGE: "메시지",
  COMMUNITY_POST: "게시글",
  COMMUNITY_COMMENT: "댓글",
};

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "접수",
  IN_REVIEW: "검토중",
  RESOLVED: "처리완료",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<RevenueTrend | null>(null);
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
// getDashboardSummary()로 집계, getRevenueTrend()로 월별 추이를 받는다.
        // listReports()는 이제 { rows, total, ... } 페이지 객체를 리턴한다
        // (신고 관리 페이지 페이징 처리 때문). 여기서는 "미처리 신고"
        // 개수·미리보기용으로 쓰는 거라 넉넉히 한 번에 받아온다.
        const [s, sum, tr, p, r] = await Promise.all([
          getStats(),
          getDashboardSummary(),
          getRevenueTrend(6),
          listPendingRooms(),
          listReports(),
        ]);
        setStats(s);
        setSummary(sum);
        setTrend(tr);
        setPending(p);
        setReports(r.rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "현황을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openReports = reports.filter((r) => r.status !== "RESOLVED");
  const t = summary?.today;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>
          대시보드
        </h1>
        <p style={{ color: "var(--text-2)" }}>
          플랫폼 운영 현황을 한눈에 확인하세요.
        </p>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 16 }}>
          {error}
        </p>
      )}

      {/* ── 오늘의 운영 현황 ── */}
      <Section title="오늘의 운영 현황" hint="* 오늘 00:00 기준">
        <div className="metric-row">
          <MetricCard label="오늘 예약" icon="📅" point={t?.reservations} loading={loading} />
          <MetricCard label="신규 회원" icon="👤" point={t?.newUsers} loading={loading} />
          <MetricCard label="신규 호스트" icon="🧑‍💼" point={t?.newHosts} loading={loading} />
          <MetricCard label="문의" icon="💬" point={t?.inquiries} loading={loading} />
          <MetricCard label="신고" icon="🚩" point={t?.reports} loading={loading} />
          <MetricCard label="예약 취소" icon="🚫" point={t?.cancels} loading={loading} />
        </div>
      </Section>

      {/* ── 핵심 KPI ── */}
      <Section title="핵심 KPI">
        <div className="kpi-grid">
          <KpiCard label="누적 거래액 (GMV)" value={stats ? won(stats.gmv) : "—"} loading={loading} />
          <KpiCard label="수수료 수익" value={stats ? won(stats.commission) : "—"} loading={loading} />
          <KpiCard label="이번 달 매출" value={summary ? won(summary.month.revenue) : "—"} loading={loading} />
          <KpiCard label="이번 달 순수익" value={summary ? won(summary.month.netProfit) : "—"} loading={loading} />

          <KpiCard label="회원 수" value={stats ? stats.users.toLocaleString() : "—"} suffix="명" loading={loading} />
          <KpiCard label="호스트 수" value={summary ? summary.totals.hosts.toLocaleString() : "—"} suffix="명" loading={loading} />
          <KpiCard label="숙소 수" value={stats ? stats.rooms.toLocaleString() : "—"} suffix="개" loading={loading} />
          <KpiCard
            label="평균 평점"
            value={summary ? (summary.totals.avgRating != null ? summary.totals.avgRating.toFixed(2) : "—") : "—"}
            suffix="/ 5"
            loading={loading}
          />
        </div>
      </Section>

      {/* ── 예약 현황 ── */}
      <Section title="예약 현황" hint="* 전체 누적">
        <div className="metric-row">
          <MiniStat label="결제 대기" value={summary?.reservationStatus.pendingPayment} loading={loading} />
          <MiniStat label="예약 확정" value={summary?.reservationStatus.confirmed} loading={loading} />
          <MiniStat label="이용 완료" value={summary?.reservationStatus.completed} loading={loading} />
          <MiniStat label="예약 취소" value={summary?.reservationStatus.cancelled} loading={loading} />
          <MiniStat label="노쇼" value={summary?.reservationStatus.noShow} loading={loading} />
        </div>
      </Section>

      {/* ── Action Center + 매출 추이 ── */}
      <div className="dash-main">
        <Section title="처리해야 할 업무">
          <div className="action-grid">
            <ActionCard icon="🏠" label="승인 대기 숙소" sub="승인 대기 중인 숙소" count={loading ? null : pending.length} href="/admin/approvals" />
            <ActionCard icon="🚩" label="미처리 신고" sub="검토가 필요한 신고" count={loading ? null : openReports.length} href="/admin/reports" accent />
            <ActionCard icon="💬" label="답변 대기 문의" sub="답변하지 않은 문의" pending href="/admin/inquiries" />
            <ActionCard icon="⭐" label="검토 필요 리뷰" sub="확인이 필요한 리뷰" pending href="/admin/reports" />
            <ActionCard icon="💰" label="정산 예정" sub="이번 주 정산 예정" pending href="/admin/revenue" />
            <ActionCard icon="🎟" label="만료 예정 쿠폰" sub="7일 이내 만료" pending href="/admin/coupons" />
          </div>
        </Section>

        <Section title="매출 추이">
          <div className="card" style={{ padding: 20, minHeight: 220 }}>
            {trend ? (
              <RevenueTrendChart data={trend.trend} />
            ) : (
              <Pending text="일별 · 주별 · 월별 매출 차트" />
            )}
          </div>
        </Section>
      </div>

      {/* ── 최근 신고 + 승인 대기 목록 ── */}
      <div className="admin-two" style={{ marginTop: 8 }}>
        <Panel title="숙소 승인 대기" href="/admin/approvals">
          {loading ? (
            <Empty text="불러오는 중…" />
          ) : pending.length === 0 ? (
            <Empty text="대기 중인 숙소가 없어요." />
          ) : (
            pending.slice(0, 5).map((p) => (
              <RowItem key={p.id} left={p.name} sub={`${p.region ?? ""} · ${p.hostName}`} right={wonShort(p.monthlyRent)} />
            ))
          )}
        </Panel>

        <Panel title="최근 신고" href="/admin/reports">
          {loading ? (
            <Empty text="불러오는 중…" />
          ) : reports.length === 0 ? (
            <Empty text="신고가 없어요." />
          ) : (
            reports.slice(0, 5).map((r) => (
              <RowItem
                key={r.id}
                left={r.reason}
                sub={`${TARGET_LABEL[r.targetType] ?? r.targetType} · 신고자 ${r.reporterName}`}
                right={STATUS_LABEL[r.status] ?? r.status}
              />
            ))
          )}
        </Panel>
      </div>

      <DashboardStyles />
    </div>
  );
}

/* ── 재사용 컴포넌트 ── */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        {hint && <span style={{ fontSize: 12, color: "var(--text-2)" }}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

// 전일 대비 증감률 배지
function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span style={{ fontSize: 12, color: "var(--text-2)" }}>전일 대비 —</span>;
  }
  const up = delta >= 0;
  return (
    <span style={{ fontSize: 12, color: up ? "var(--secondary)" : "var(--primary)" }}>
      {up ? "▲" : "▼"} {Math.abs(delta)}%
    </span>
  );
}

function MetricCard({
  label,
  icon,
  point,
  loading,
}: {
  label: string;
  icon: string;
  point?: MetricPoint;
  loading?: boolean;
}) {
  return (
    <div className="card metric-card">
      <div className="metric-icon" aria-hidden>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
        <div className="display metric-value">
          {loading || !point ? "—" : point.value.toLocaleString()}
        </div>
        {loading || !point ? (
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>전일 대비</div>
        ) : (
          <DeltaBadge delta={point.delta} />
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, loading }: { label: string; value?: number; loading?: boolean }) {
  return (
    <div className="card metric-card" style={{ justifyContent: "center" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
        <div className="display metric-value">
          {loading || value === undefined ? "—" : value.toLocaleString()}
          <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4, color: "var(--text-2)" }}>건</span>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  loading,
}: {
  label: string;
  value?: string;
  suffix?: string;
  loading?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div className="display" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
        {loading ? "—" : value}
        {suffix && !loading && (
          <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4, color: "var(--text-2)" }}>
            {suffix}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>전일 대비</div>
    </div>
  );
}

function ActionCard({
  icon,
  label,
  sub,
  count,
  href,
  accent,
  pending,
}: {
  icon: string;
  label: string;
  sub: string;
  count?: number | null;
  href: string;
  accent?: boolean;
  pending?: boolean;
}) {
  const badge = pending ? (
    <span className="action-badge pending-badge">—</span>
  ) : count === null ? (
    <span className="action-badge">…</span>
  ) : (
    <span className="action-badge" style={{ background: accent ? "var(--primary)" : "var(--secondary)" }}>
      {count}
    </span>
  );
  return (
    <Link href={href} className="hover-card action-card card">
      <div className="action-icon" aria-hidden>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>{sub}</div>
      </div>
      {badge}
    </Link>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>{title}</strong>
        <Link href={href} style={{ color: "var(--secondary)", fontSize: 13, fontWeight: 600 }}>
          전체 →
        </Link>
      </div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function RowItem({ left, sub, right }: { left: string; sub: string; right: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
      }}
    >
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

function Pending({ text }: { text: string }) {
  return (
    <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-2)", fontSize: 13 }}>
      <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.4 }}>📈</div>
      {text}
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>집계 준비 중</div>
    </div>
  );
}

function DashboardStyles() {
  return (
    <style>{`
      .metric-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
      .metric-card { padding: 16px; display: flex; gap: 12px; align-items: center; }
      .metric-icon {
        width: 40px; height: 40px; flex: none;
        display: grid; place-items: center;
        background: var(--primary-soft); border-radius: var(--r-sm); font-size: 18px;
      }
      .metric-value { font-size: 22px; font-weight: 700; margin: 2px 0; }
      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .dash-main { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
      .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .action-card { display: flex; align-items: center; gap: 12px; padding: 16px; text-decoration: none; color: inherit; }
      .action-icon {
        width: 36px; height: 36px; flex: none;
        display: grid; place-items: center;
        background: var(--secondary-soft); border-radius: var(--r-sm); font-size: 16px;
      }
      .action-badge {
        flex: none; min-width: 26px; height: 26px; padding: 0 8px;
        display: grid; place-items: center; border-radius: 999px;
        background: var(--secondary); color: #fff; font-size: 13px; font-weight: 700;
      }
      .pending-badge { background: var(--border); color: var(--text-2); }
      .chart-placeholder { padding: 20px; min-height: 220px; display: grid; place-items: center; }

      @media (max-width: 1100px) {
        .metric-row { grid-template-columns: repeat(3, 1fr); }
        .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        .dash-main { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) {
        .metric-row { grid-template-columns: repeat(2, 1fr); }
        .action-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

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

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { won, wonShort } from "@/lib/format";
import { RevenueTrendChart, RevenueTrendLegend } from "./RevenueTrendChart";
import { listAllInquiries } from "@/lib/api/inquiries";
import {
  getStats,
  getDashboardSummary,
  getRevenueTrendV2,
  listPendingRooms,
  listReports,
  listCoupons,
  type AdminStats,
  type DashboardSummary,
  type RevenueTrendV2Point,
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
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingInquiries, setPendingInquiries] = useState<number>(0);
  const [expiringCoupons, setExpiringCoupons] = useState<number>(0);

  // 매출 추이 차트는 일/주/월 토글이 있어서, 나머지 데이터랑 분리된
  // 별도 useEffect로 그때그때 다시 불러온다.
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [trend, setTrend] = useState<RevenueTrendV2Point[] | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // getDashboardSummary()로 집계를 받는다.
        // listReports()는 이제 { rows, total, ... } 페이지 객체를 리턴한다
        // (신고 관리 페이지 페이징 처리 때문). 여기서는 "미처리 신고"
        // 개수·미리보기용으로 쓰는 거라 넉넉히 한 번에 받아온다.
        const [s, sum, p, r, iq, cp] = await Promise.all([
          getStats(),
          getDashboardSummary(),
          listPendingRooms(),
          listReports(),
          listAllInquiries(),
          listCoupons(),
        ]);
        setStats(s);
        setSummary(sum);
        setPending(p);
        setReports(r.rows);
        setPendingInquiries(iq.filter((i) => i.answer === null).length);
        setExpiringCoupons(
          cp.filter((c) => {
            const daysLeft = (new Date(c.validTo).getTime() - Date.now()) / 86_400_000;
            return c.active && daysLeft >= 0 && daysLeft <= 7;
          }).length
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "현황을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    setTrendLoading(true);
    getRevenueTrendV2(granularity)
      .then((d) => {
        if (alive) setTrend(d);
      })
      .catch(() => {
        if (alive) setTrend(null);
      })
      .finally(() => {
        if (alive) setTrendLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [granularity]);

  const openReports = reports.filter((r) => r.status !== "RESOLVED");
  const t = summary?.today;

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>
          대시보드
        </h1>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 16 }}>
          {error}
        </p>
      )}

      {/* ── 오늘의 운영 현황 + 처리해야 할 업무 (카드 2개, 가로 정렬) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div className="admin-card" style={{ padding: "10px 20px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <strong style={{ fontSize: 15 }}>오늘의 운영 현황</strong>
            <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>* 오늘 00:00 기준</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 12, columnGap: 16 }}>
            <TodayMetric icon="calendar" label="오늘 예약" point={t?.reservations} loading={loading} href="/admin/reservations" />
            <TodayMetric icon="cancel" label="예약 취소" point={t?.cancels} loading={loading} href="/admin/reservations" />
            <TodayMetric icon="user" label="신규 회원" point={t?.newUsers} loading={loading} href="/admin/members" />
            <TodayMetric icon="host" label="신규 호스트" point={t?.newHosts} loading={loading} href="/admin/members" />
            <TodayMetric icon="chat" label="문의" point={t?.inquiries} loading={loading} href="/admin/inquiries" />
            <TodayMetric icon="flag" label="신고" point={t?.reports} loading={loading} href="/admin/reports" />
          </div>
        </div>

        <div className="admin-card" style={{ padding: "10px 20px" }}>
          <strong style={{ fontSize: 15, display: "block", marginBottom: 14 }}>처리해야 할 업무</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, justifyContent: "space-between", alignItems: "end" }}>
            <ActionItem icon="calendar" label="신규 예약/취소" count={loading ? null : (t?.reservations.value ?? 0) + (t?.cancels.value ?? 0)} href="/admin/reservations" />
            <ActionItem icon="home" label="승인 대기 숙소" count={loading ? null : pending.length} href="/admin/approvals" />
            <ActionItem icon="chat" label="답변 대기 문의" count={loading ? null : pendingInquiries} href="/admin/inquiries" />
            <ActionItem icon="flag" label="미처리 신고" count={loading ? null : openReports.length} href="/admin/reports" accent />
            <ActionItem icon="wallet" label="정산 지연" count={loading ? null : summary?.settlementDelayed ?? 0} href="/admin/revenue" />
            <ActionItem icon="coupon" label="만료 예정 쿠폰" count={loading ? null : expiringCoupons} href="/admin/coupons" />
          </div>
        </div>
      </div>

      {/* ── 핵심 KPI + 매출 추이 (가로 배치) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 16, marginBottom: 10 }}>
        <div className="admin-card" style={{ padding: 20 }}>
          <strong style={{ fontSize: 15, display: "block", marginBottom: 14 }}>핵심 KPI</strong>

          {/* 이번 달 순수익 — 한 행 통으로 강조 */}
          <div style={{ marginBottom: 16 }}>
            <KpiField
              label="이번 달 순수익"
              value={summary ? won(summary.month.netProfit) : "—"}
              deltaPct={summary?.kpiDelta.revenue}
              loading={loading}
              big
            />
          </div>

          {/* 나머지 6개 — 2열 × 3행 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 12px" }}>
            <KpiField label="누적 거래액 (GMV)" value={stats ? won(stats.gmv) : "—"} deltaPct={summary?.kpiDelta.revenue} loading={loading} />
            <KpiField label="수수료 수익" value={stats ? won(stats.commission) : "—"} deltaPct={summary?.kpiDelta.revenue} loading={loading} />
            <KpiField label="이번 달 매출" value={summary ? won(summary.month.revenue) : "—"} deltaPct={summary?.kpiDelta.revenue} loading={loading} />
            <KpiField label="회원 수" value={stats ? stats.users.toLocaleString() : "—"} suffix="명" deltaPct={summary?.kpiDelta.members} loading={loading} />
            <KpiField label="호스트 수" value={summary ? summary.totals.hosts.toLocaleString() : "—"} suffix="명" deltaPct={summary?.kpiDelta.hosts} loading={loading} />
            <KpiField label="숙소 수" value={stats ? stats.rooms.toLocaleString() : "—"} suffix="개" deltaPct={summary?.kpiDelta.rooms} loading={loading} />
          </div>
        </div>

        <div className="admin-card" style={{ padding: 20, minHeight: 220 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <strong style={{ fontSize: 15 }}>매출 추이</strong>
              <RevenueTrendLegend />
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["day", "week", "month"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  style={{
                    fontSize: 12, padding: "5px 12px", borderRadius: "var(--r-sm)", cursor: "pointer",
                    border: "1px solid var(--border)",
                    background: granularity === g ? "var(--bg-2)" : "transparent",
                    fontWeight: granularity === g ? 700 : 400,
                    color: "var(--text)",
                  }}
                >
                  {g === "day" ? "일별" : g === "week" ? "주별" : "월별"}
                </button>
              ))}
            </div>
          </div>

          {trendLoading || !trend ? (
            <Pending text="일별 · 주별 · 월별 매출 차트" />
          ) : (
            <RevenueTrendChart data={trend} />
          )}
        </div>
      </div>

      {/* ── 예약 현황 ──
      <Section title="예약 현황" hint="* 전체 누적">
        <div className="metric-row">
          <MiniStat label="결제 대기" value={summary?.reservationStatus.pendingPayment} loading={loading} />
          <MiniStat label="예약 확정" value={summary?.reservationStatus.confirmed} loading={loading} />
          <MiniStat label="이용 완료" value={summary?.reservationStatus.completed} loading={loading} />
          <MiniStat label="예약 취소" value={summary?.reservationStatus.cancelled} loading={loading} />
          <MiniStat label="노쇼" value={summary?.reservationStatus.noShow} loading={loading} />
        </div>
      </Section> */}

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
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
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
    return <span style={{ fontSize: 12, color: "var(--text-2)" }}>—</span>;
  }
  const up = delta >= 0;
  return (
    <span style={{ fontSize: 12, color: up ? "var(--secondary)" : "var(--primary)" }}>
      {up ? "▲" : "▼"} {Math.abs(delta)}%
    </span>
  );
}

function TodayMetric({
  label,
  icon,
  point,
  loading,
  href,
}: {
  label: string;
  icon: string;
  point?: MetricPoint;
  loading?: boolean;
  href: string;
}) {
  return (
    <Link href={href}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 34, height: 34, borderRadius: 3, background: "var(--primary-soft)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <img src={`/icons/dashboard/${icon}.png`} alt="" width={16} height={16} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: -3 }}>{label}</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>
              {loading || !point ? "—" : point.value.toLocaleString()}
            </span>
            {loading || !point ? (
              <span style={{ fontSize: 11, color: "var(--text-2)" }}>—</span>
            ) : (
              <DeltaBadge delta={point.delta} />
            )}
          </div>
        </div>
      </div>
    </Link>
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

function KpiField({
  label,
  value,
  suffix,
  loading,
  deltaPct,
  big,
}: {
  label: string;
  value?: string;
  suffix?: string;
  loading?: boolean;
  deltaPct?: number | null;
  big?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: big ? 12.5 : 11, color: "var(--text-2)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: big ? 10 : 0 }}>
        <div style={{ fontSize: big ? 26 : 17, fontWeight: 700, color: "var(--text)" }}>
          {loading ? "—" : value}
          {suffix && !loading && (
            <span style={{ fontSize: big ? 14 : 12, fontWeight: 500, marginLeft: 3, color: "var(--text-2)" }}>
              {suffix}
            </span>
          )}
        </div>
        {big && !loading && (
          <span style={{ fontSize: 13, color: deltaPct != null ? (deltaPct >= 0 ? "var(--secondary)" : "var(--primary)") : "var(--text-2)" }}>
            &nbsp; 지난달 대비 {deltaPct != null ? `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(deltaPct)}%` : "—"}
          </span>
        )}
      </div>
      {
        !big && !loading && (
          <div style={{ fontSize: 10.5, color: deltaPct != null ? (deltaPct >= 0 ? "var(--secondary)" : "var(--primary)") : "var(--text-2)", marginTop: 2 }}>
            지난달 대비 &nbsp; {deltaPct != null ? `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(deltaPct)}%` : "—"}
          </div>
        )
      }
    </div>
  );
}

function ActionItem({
  icon,
  label,
  count,
  href,
  accent,
  pending,
}: {
  icon: string;
  label: string;
  count?: number | null;
  href: string;
  accent?: boolean;
  pending?: boolean;
}) {
  const badgeStyle: CSSProperties = {
    minWidth: 22, height: 22, padding: "0 6px", borderRadius: 99,
    fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0,
  };
  const badge = pending ? (
    <span style={{ ...badgeStyle, background: "var(--border)", color: "var(--text-2)", fontWeight: 400 }}>—</span>
  ) : count === null ? (
    <span style={{ ...badgeStyle, background: "var(--border)", color: "var(--text-2)", fontWeight: 400 }}>…</span>
  ) : (
    <span style={{ ...badgeStyle, background: accent ? "var(--primary)" : "var(--secondary)", color: "#fff" }}>
      {count}
    </span>
  );
  return (
    <Link
      href={href}
      className="hover-card-custom"
      style={{
        display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--border)",
        borderRadius: 3, padding: 8,
      }}
    >
      <span
        style={{
          width: 26, height: 26, borderRadius: 8, background: "var(--secondary-soft)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <img src={`/icons/dashboard/${icon}.png`} alt="" width={13} height={13} />
      </span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600 }}>{label}</div>
      {badge}
    </Link>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="admin-card" style={{ padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
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
        padding: "4px 5px",
        borderBottom: "1px solid var(--border)",
        // borderRadius: "var(--r-sm)",
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

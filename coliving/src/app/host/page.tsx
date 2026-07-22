"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
// import { myListings } from "@/lib/host";
import {
  getHostDashboard,
  downloadRevenueCsv,
  downloadTenantsCsv,
  type HostDashboard,
} from "@/lib/api/host";

export default function HostDashboardPage() {
  const [data, setData] = useState<HostDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  // const listings = myListings();

  useEffect(() => {
    getHostDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function download(kind: "revenue" | "tenants") {
    if (downloading) return;
    setDownloading(kind);
    try {
      if (kind === "revenue") await downloadRevenueCsv();
      else await downloadTenantsCsv();
    } catch {
      // Non-fatal — the browser just won't get a file.
    } finally {
      setDownloading(null);
    }
  }

  const trend = data?.trend ?? [];
  // const max = trend.length ? Math.max(...trend.map((t) => t.value), 1) : 1;
  const roomRevenue = data?.roomRevenue ?? [];
  const settlement = data?.settlement;
  const recentInquiries = data?.recentInquiries ?? [];


  return (
    <div>
      {/* ── header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 className="display" style={{ fontSize: 30 }}>📊 수익 대시보드</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 14px" }} disabled={downloading !== null} onClick={() => download("revenue")}>
            {downloading === "revenue" ? "내보내는 중…" : "⬇ 수익내역 CSV"}
          </button>
          <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 14px" }} disabled={downloading !== null} onClick={() => download("tenants")}>
            {downloading === "tenants" ? "내보내는 중…" : "⬇ 입주자내역 CSV"}
          </button>
        </div>
      </div>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>
        이번 달 운영 현황을 한눈에 확인하세요.
      </p>

      <div style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))", borderRadius: "var(--r-lg)", padding: 26, color: "#fff", marginBottom: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.9 }}>이번 달 예상 수익</div>
        <div className="display" style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>
          {loading ? "…" : won(data?.thisMonth ?? 0)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
          {data?.changePct == null
            ? "지난달 데이터 없음"
            : `지난달 대비 ${data.changePct >= 0 ? "▲" : "▼"} ${Math.abs(data.changePct)}%`}
        </div>
      </div>

      {/* ── 4 KPI cards ── */}
      {/* 등록 숙소, 총 예약, 입주율, 새 문의 -> 새 예약/취소, 점유율, 새 문의 */}
      <div className="stat-row">
        <ClickableStat
          href="/host/reservations?filter=PENDING_PAYMENT"
          label="새 예약 / 취소"
          value={loading ? "…" : `${data?.newReservationCount ?? 0} / ${data?.cancelledCount ?? 0}`}
          hint="처리 대기 · 최근 취소"
          accent={!!data && (data.newReservationCount > 0 || data.cancelledCount > 0)}
        />
        <ClickableStat
          label="이번 달 매출"
          value={loading ? "…" : won(data?.thisMonth ?? 0)}
          hint={
            data?.changePct == null
              ? "지난달 데이터 없음"
              : `지난달 대비 ${data.changePct >= 0 ? "▲" : "▼"} ${Math.abs(data.changePct)}%`
          }
        />
        <ClickableStat
          href="/host/calendar"
          label="점유율"
          value={loading ? "…" : `${data?.occupancy ?? 0}%`}
          hint="최근 30일"
        />
        <ClickableStat
          href="/host/inquiries"
          label="새 문의"
          value={loading ? "…" : `${data?.newInquiries ?? 0}`}
          hint="최근 7일"
          accent={!!data && data.newInquiries > 0}
        />
      </div>

      {/* ── 최근 6개월 수익 추이 -> 📈 월별 매출 추이 ── */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <strong style={{ fontSize: 15 }}>📈 월별 매출 추이</strong>
          <Legend />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 6 }}>최근 6개월 매출과 점유율</p>
        {loading ? (
          <p style={{ color: "var(--text-2)", fontSize: 13, padding: "40px 0" }}>불러오는 중…</p>
        ) : trend.length === 0 ? (
          <p style={{ color: "var(--text-2)", fontSize: 13, padding: "40px 0" }}>수익 데이터가 아직 없습니다.</p>
        ) : (
          <TrendLineChart points={trend} />
        )}
      </div>

      {/* ── 내 숙소 -> 🏠 객실별 수익 테이블 ── */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <strong style={{ fontSize: 15 }}>🏠 객실별 수익</strong>
          <Link href="/host/listings" style={{ color: "var(--secondary)", fontSize: 13.5, fontWeight: 600 }}>
            숙소 관리 →
          </Link>
        </div>
        {loading ? (
          <p style={{ color: "var(--text-2)", fontSize: 13 }}>불러오는 중…</p>
        ) : roomRevenue.length === 0 ? (
          <p style={{ color: "var(--text-2)", fontSize: 13 }}>등록된 숙소가 없습니다.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-2, #f7f7f7)", textAlign: "left" }}>
                  <Th>객실명</Th>
                  <Th right>예약 건수</Th>
                  <Th right>점유율</Th>
                  <Th right>매출</Th>
                  <Th right>순수익</Th>
                </tr>
              </thead>
              <tbody>
                {/* roomRevenue is one row per registered room (mapped from the
                    host's room list, not from reservations) — a room with no
                    bookings yet still shows up here with 0/0%/₩0, and the
                    "등록된 숙소가 없습니다" case above already handles the
                    truly-empty state, so this only ever renders real rooms. */}
                {roomRevenue.map((r) => (
                  <tr key={r.roomId} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td>{r.roomName}</Td>
                    <Td right>{r.reservationCount}건</Td>
                    <Td right>{r.occupancyPct}%</Td>
                    <Td right>{won(r.revenue)}</Td>
                    <Td right strong>{won(r.netRevenue)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 💰 정산 현황 + 🧾 최근 문의 내역 (side by side on wide screens) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginTop: 20 }} className="dashboard-bottom-grid">
        <div className="card" style={{ padding: 22 }}>
          <strong style={{ fontSize: 15 }}>💰 정산 현황</strong>
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <SettlementRow
              label="정산 완료"
              amount={settlement?.paid.amount ?? 0}
              detail={settlement?.paid.lastPaidDate ? `${settlement.paid.lastPaidDate} 지급` : "지급 내역 없음"}
              loading={loading}
              tone="done"
            />
            <SettlementRow
              label="정산 예정"
              amount={settlement?.scheduled.amount ?? 0}
              detail={settlement?.scheduled.nextDate ? `${settlement.scheduled.nextDate} 예정` : "예정 없음"}
              loading={loading}
              tone="scheduled"
            />
            <SettlementRow
              label="미정산"
              amount={settlement?.unsettled.amount ?? 0}
              detail={
                (settlement?.unsettled.count ?? 0) > 0
                  ? `${settlement?.unsettled.count}건 · 이용 완료 처리 필요`
                  : "없음"
              }
              loading={loading}
              tone="unsettled"
            />
          </div>
          <Link
            href="/host/settlements"
            style={{ display: "block", textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--secondary)", fontWeight: 600 }}
          >
            정산 내역 자세히 보기 →
          </Link>
        </div>


        {/* 최근 문의 내역 */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 15 }}>🧾 최근 문의 내역</strong>
              {!!data && data.newInquiries > 0 && (
                <span
                  className="chip"
                  style={{ fontSize: 11, background: "var(--primary)", color: "#fff", border: "none" }}
                >
                  새 문의 {data.newInquiries}
                </span>
              )}
            </div>
            <Link href="/host/inquiries" style={{ color: "var(--secondary)", fontSize: 13.5, fontWeight: 600 }}>
              전체 보기 →
            </Link>
          </div>
          {loading ? (
            <p style={{ color: "var(--text-2)", fontSize: 13 }}>불러오는 중…</p>
          ) : recentInquiries.length === 0 ? (
            <p style={{ color: "var(--text-2)", fontSize: 13.5, padding: "12px 0" }}>미처리 문의가 없습니다.</p>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {recentInquiries.map((i) => (
                <Link
                  key={i.chatRoomId}
                  href="/host/inquiries"
                  style={{
                    display: "flex", justifyContent: "space-between", gap: 12,
                    padding: "10px 8px", borderRadius: "var(--r-sm)",
                  }}
                  className="press"
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {i.guestName} <span style={{ fontWeight: 400, color: "var(--text-2)" }}>· {i.roomName}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12.5, color: "var(--text-2)", marginTop: 2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320,
                      }}
                    >
                      {i.isImage ? "📷 사진" : i.lastMessage}
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-2)", flexShrink: 0, paddingTop: 2 }}>{i.createdAt}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
//   return (
//     <div className="card" style={{ padding: 18 }}>
//       <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
//       <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: accent ? "var(--primary)" : "var(--text)" }}>
//         {value}
//       </div>
//     </div>
//   );
// }

// ── KPI card, optionally a link ──
function ClickableStat({
  href, label, value, hint, accent,
}: { href?: string; label: string; value: string; hint?: string; accent?: boolean }) {
  const body = (
    <div className="card press" style={{ padding: 18, height: "100%", cursor: href ? "pointer" : "default" }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: accent ? "var(--primary)" : "var(--text)" }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SettlementRow({
  label, amount, detail, loading, tone,
}: { label: string; amount: number; detail: string; loading: boolean; tone: "done" | "scheduled" | "unsettled" }) {
  const dot = tone === "done" ? "var(--text-2)" : tone === "scheduled" ? "var(--secondary)" : "var(--primary)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>{detail}</div>
        </div>
      </div>
      <strong style={{ fontSize: 15 }}>{loading ? "…" : won(amount)}</strong>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-2)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", display: "inline-block" }} />
          매출
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--secondary)", display: "inline-block" }} />
        점유율
      </span>
    </div>
  );
}

// ── Dual-line chart (revenue + occupancy), plain SVG — no chart library ──
function TrendLineChart({ points }: { points: { month: string; revenue: number; occupancy: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const PAD_X = 8;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 28;
  const maxRevenue = Math.max(...points.map((p) => p.revenue), 1);
  const n = points.length;
  const stepX = n > 1 ? (W - PAD_X * 2) / (n - 1) : 0;
  const baseline = H - PAD_BOTTOM;

  const xAt = (i: number) => PAD_X + stepX * i;
  const yRevenue = (v: number) => PAD_TOP + (1 - (v ?? 0) / maxRevenue) * (baseline - PAD_TOP);
  const yOcc = (v: number) => PAD_TOP + (1 - (v ?? 0) / 100) * (baseline - PAD_TOP);

  const occPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yOcc(p.occupancy)}`).join(" ");

  // Bar geometry - leave a gap between bars, proportional to the column width.
  const BAR_W = Math.min(28, stepX * 0.45 || 28);

  // Tooltip is drawn in the same SVG coordinate space as everything else
  // (rather than an absolutely-positioned HTML element), so it scales and
  // stays aligned automatically as the viewBox is resized by CSS.
  const TIP_W = 100;
  const TIP_H = 46;
  const tipXFor = (i: number) => Math.min(Math.max(xAt(i) - TIP_W / 2, PAD_X), W - PAD_X - TIP_W);
  const tipYFor = (i: number) => Math.min(yRevenue(points[i].revenue), yOcc(points[i].occupancy)) - TIP_H - 10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 200, overflow: "visible" }}>
      {/* baseline */}
      <line x1={PAD_X} y1={H - PAD_BOTTOM} x2={W - PAD_X} y2={H - PAD_BOTTOM} stroke="var(--border)" strokeWidth={1} />

      {hover !== null && (
        <line
          x1={xAt(hover)} y1={PAD_TOP} x2={xAt(hover)} y2={baseline}
          stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3"
        />
      )}

      {/* ── revenue - bar ── */}
      {points.map((p, i) => (
        <rect
          key={`bar-${p.month}`}
          x={xAt(i) - BAR_W / 2}
          y={yRevenue(p.revenue)}
          width={BAR_W}
          height={Math.max(0, baseline - yRevenue(p.revenue))}
          rx={4}
          fill="var(--primary)"
          opacity={hover === null || hover === i ? 1 : 0.45}
        />
      ))}

      {/* ── occupancy - dot & line ── */}
      <path
        d={occPath}
        fill="none"
        stroke="var(--secondary)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="5 4"
      />

      {points.map((p, i) => (
        <g key={p.month}>
          <circle cx={xAt(i)} cy={yOcc(p.occupancy)} r={hover === i ? 4.5 : 3.5} fill="var(--secondary)" />
          <text x={xAt(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-2)">
            {p.month}
          </text>
          {/* invisible full-height hit column — easier to hover than the line itself */}
          <rect
            x={xAt(i) - stepX / 2} y={0} width={stepX || W} height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
        </g>
      ))}

      {hover !== null && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={tipXFor(hover)} y={tipYFor(hover)} width={TIP_W} height={TIP_H} rx={8}
            fill="transparent" opacity={0.94}
          />
          <text
            x={tipXFor(hover) + TIP_W / 2}
            y={tipYFor(hover) + TIP_H / 2 - 40}
            textAnchor="middle"
          >
            <tspan x={tipXFor(hover) + TIP_W / 2} dy="20" fontSize={10} fill="var(--primary)" fontWeight={700}>
              {points[hover].month}
            </tspan>
            <tspan x={tipXFor(hover) + TIP_W / 2} dy="20" fontSize={11} fill="var(--text)" fontWeight={600}>
              {won(points[hover].revenue)}
            </tspan>
            <tspan x={tipXFor(hover) + TIP_W / 2} dy="18" fontSize={11} fill="var(--text)" fontWeight={600}>
              {points[hover].occupancy || 0}%
            </tspan>
          </text>
        </g>
      )}
    </svg>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-2)", textAlign: right ? "right" : "left", whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

function Td({ children, right, strong, muted }: { children: React.ReactNode; right?: boolean; strong?: boolean; muted?: boolean }) {
  return (
    <td style={{ padding: "12px 16px", textAlign: right ? "right" : "left", fontWeight: strong ? 700 : 400, color: muted ? "var(--text-2)" : "var(--text)", whiteSpace: "nowrap" }}>
      {children}
    </td>
  );
}
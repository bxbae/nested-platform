"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { won } from "@/lib/format";
import { getRevenueTrend, getRevenueTrendV2, type RevenueTrend, type RevenueTrendV2Point } from "@/lib/api/admin";

export default function AdminRevenue() {
  const [data, setData] = useState<RevenueTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [chartTrend, setChartTrend] = useState<RevenueTrendV2Point[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getRevenueTrend(6)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setChartLoading(true);
    getRevenueTrendV2(granularity)
      .then((d) => {
        if (alive) setChartTrend(d);
      })
      .catch(() => {
        if (alive) setChartTrend([]);
      })
      .finally(() => {
        if (alive) setChartLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [granularity]);

  if (loading) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>매출 관리</h1>
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>매출 관리</h1>
        <p style={{ color: "var(--text-2)" }}>매출 데이터를 불러오지 못했어요.</p>
      </div>
    );
  }

  const maxRevenue = Math.max(1, ...data.trend.map((t) => t.revenue));
  const maxReservations = Math.max(1, ...data.trend.map((t) => t.reservations));

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>매출 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>플랫폼 거래액과 수수료를 확인하세요.</p>

      <div className="stat-row">
        <Stat label="총 거래액 (GMV)" value={won(data.gmv)} />
        <Stat label="수수료 수익" value={won(data.commission)} accent />
        <Stat label="호스트 정산액" value={won(data.payouts)} />
        <Stat label="환불액" value={won(data.refunds)} />
      </div>

      {/* 쿠폰 할인액 — GMV/수수료랑 성격이 달라서(매출이 아니라 사이트가
          대신 부담하는 비용) stat-row 그리드에 안 끼워넣고 따로 뺐다.
          옆에는 "수수료 수익에서 쿠폰 할인액을 뺀, 관리자에게 실제로
          남는 돈"을 바로 대조해서 보여준다. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginTop: 14 }}>
        <div className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <div>
          <strong style={{ fontSize: 15 }}>쿠폰 할인액</strong>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>사이트 부담</p>
        </div>
        <div className="display" style={{ fontSize: 22, fontWeight: 700, color: "var(--secondary)" }}>
          -{won(data.couponDiscount)}
        </div>
      </div>

        <div className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, background: "linear-gradient(135deg, #333333, #666666)" }}>
          <div>
            <strong style={{ fontSize: 15, color: "white" }}>실제 순수익</strong>
            <p style={{ fontSize: 13, color: "#bbbbbb", marginTop: 3 }}>수수료 수익 - 쿠폰 할인액(사이트 부담)</p>
          </div>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, color: "white" }}>
            {won(data.commission - data.couponDiscount)}
          </div>
        </div>
      </div>

      {/* 매출·순수익 추이 — 같은 스케일(원)로 두 꺾은선을 겹쳐서 본다.
          일/주/월 토글은 별도 엔드포인트(revenue-trend-v2)에서 받아오고,
          위쪽 요약 카드(총거래액 등)는 계속 6개월 고정 데이터를 쓴다. */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 14, marginTop: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 14, marginBottom: 8, fontSize: 12.5 }}>
              <strong style={{ fontSize: 15 }}>매출 추이</strong>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--primary)", color: "var(--text-2)" }} />
                매출
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--secondary)", color: "var(--text-2)" }} />
                예약 건수
              </span>
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
          {chartLoading || chartTrend.length === 0 ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontSize: 13 }}>
              {chartLoading ? "불러오는 중…" : "데이터가 없어요."}
            </div>
          ) : (
            <RevenueDualLineChart trend={chartTrend} />
          )}
        </div>

        {/* 이번 달 / 지난 달 매출 — 세로로 정렬. 토글이랑 무관하게 항상
            실제 달력상 이번 달·지난 달 값을 보여준다(6개월 고정 데이터
            data.trend의 마지막 두 항목 = 이번달, 지난달). */}
        <div style={{ display: "grid", gridTemplateRows: "3fr 2fr", gap: 14 }}>
        {(() => {
            const t = data.trend;
            const thisMonth = t[t.length - 1]?.revenue ?? 0;
            const lastMonth = t[t.length - 2]?.revenue ?? 0;
            const deltaPct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10 : null;
                return (
              <>
                <div className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: "var(--text-2)" }}>이번 달 매출</div>
                  <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{won(thisMonth)}</div>
                  {deltaPct != null ? (
                    <div style={{ fontSize: 12.5, color: deltaPct >= 0 ? "var(--secondary)" : "var(--primary)", marginTop: 6 }}>
                      지난 달 대비 {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}%
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>지난 달 데이터 없음</div>
                  )}
                </div>
                <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, color: "var(--text-2)" }}>지난 달 매출</div>
                  <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{won(lastMonth)}</div>
                </div>
              </>
          );
        })()}
        </div>
      </div>

      {/* settlement note */}
      <div className="card" style={{ padding: 20, marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong style={{ fontSize: 15 }}>이번 달 정산 예정</strong>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>매월 25일 호스트에게 자동 정산됩니다.</div>
        </div>
        <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{won(data.payouts)}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: accent ? "var(--primary)" : "var(--text)" }}>{value}</div>
    </div>
  );
}

function RevenueDualLineChart({ trend }: { trend: { label: string; revenue: number; reservations: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 700;
  const H = 200;
  const PAD_X = 36;
  const PAD_RIGHT = 30; // 오른쪽 예약건수 축 눈금 자리
  const PAD_TOP = 10;
  const PAD_BOTTOM = 26;

  // 매출(원)과 예약 건수는 단위가 완전히 달라서 같은 세로축에 못 그린다
  // — 왼쪽은 매출용, 오른쪽은 예약건수용으로 스케일을 따로 잡고, 둘 다
  // 0~niceMax 사이를 같은 세로 위치 비율로 매핑해서 겹쳐 그린다.
  const maxRevenue = Math.max(1, ...trend.map((t) => t.revenue));
  const niceMaxRevenue = Math.ceil(maxRevenue / 5e7) * 5e7 || 5e7;
  const maxReservations = Math.max(1, ...trend.map((t) => t.reservations));
  const niceMaxReservations = Math.ceil(maxReservations / 5) * 5 || 5;

  const revTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMaxRevenue * f);
  const resTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMaxReservations * f);

  const n = trend.length;
  const stepX = n > 1 ? (W - PAD_X - PAD_RIGHT) / (n - 1) : 0;
  const xAt = (i: number) => PAD_X + stepX * i;
  const yAtRatio = (ratio: number) => PAD_TOP + (1 - ratio) * (H - PAD_TOP - PAD_BOTTOM);

  const revPoints = trend.map((t, i) => ({ ...t, x: xAt(i), y: yAtRatio(t.revenue / niceMaxRevenue) }));
  const resPoints = trend.map((t, i) => ({ ...t, x: xAt(i), y: yAtRatio(t.reservations / niceMaxReservations) }));
  const revPath = revPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const resPath = resPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const labelEvery = n > 12 ? Math.ceil(n / 7) : n > 6 ? 2 : 1;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    revPoints.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHover(nearest);
  }

  const activeRev = hover != null ? revPoints[hover] : null;
  const activeRes = hover != null ? resPoints[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", aspectRatio: `${W} / ${H}`, marginTop: 8, overflow: "visible" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* 가로 회색 기준선 5단계 — 매출 눈금은 왼쪽, 예약건수 눈금은
            오른쪽에. 같은 y 위치가 두 축에서 서로 다른 값을 가리킨다. */}
        {revTicks.map((t, i) => (
          <g key={t}>
            <line x1={PAD_X} y1={yAtRatio(i / 4)} x2={W - PAD_RIGHT} y2={yAtRatio(i / 4)} stroke="var(--border)" strokeWidth={1} />
            <text x={0} y={yAtRatio(i / 4) + 4} fontSize={11} fill="var(--primary)">
              {t === 0 ? "0" : `${Math.round(t / 1_000_000)}M`}
            </text>
            <text x={W} y={yAtRatio(i / 4) + 4} fontSize={11} fill="var(--secondary)" textAnchor="end">
              {resTicks[i]}
            </text>
          </g>
        ))}
        {hover != null && activeRev && (
          <line x1={activeRev.x} y1={PAD_TOP} x2={activeRev.x} y2={H - PAD_BOTTOM} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        <path d={revPath} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <path d={resPath} fill="none" stroke="var(--secondary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {revPoints.map((p, i) => (
          <circle key={`r${i}`} cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="var(--primary)" stroke="#fff" strokeWidth={1.5} />
        ))}
        {resPoints.map((p, i) => (
          <circle key={`s${i}`} cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="var(--secondary)" stroke="#fff" strokeWidth={1.5} />
        ))}
        {trend.map((t, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`lbl${i}`}
              x={xAt(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={11}
              fill="var(--text-2)"
            >
              {t.label}
            </text>
          ) : null,
        )}
      </svg>
      {hover != null && activeRev && activeRes && (
        <div
          style={{
            position: "absolute",
            left: `${(activeRev.x / W) * 100}%`,
            top: `${(Math.min(activeRev.y, activeRes.y) / H) * 100}%`,
            transform: `${
              hover === 0 ? "translateX(0)" : hover === n - 1 ? "translateX(-100%)" : "translateX(-50%)"
            } translateY(-100%) translateY(-10px)`,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12.5,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "var(--text-2)", marginBottom: 4 }}>{activeRev.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--primary)" }} />
            매출 &nbsp;<strong>{won(activeRev.revenue)}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--secondary)" }} />
            예약 건수 <strong>{activeRes.reservations}건</strong>
          </div>
        </div>
      )}
    </div>
  );
}

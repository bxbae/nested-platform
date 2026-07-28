"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import { getRevenueTrend, type RevenueTrend } from "@/lib/api/admin";

export default function AdminRevenue() {
  const [data, setData] = useState<RevenueTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
        <div className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong style={{ fontSize: 15 }}>쿠폰 할인액 (사이트 부담)</strong>
        </div>
        <div className="display" style={{ fontSize: 22, fontWeight: 700, color: "var(--primary)" }}>
          -{won(data.couponDiscount)}
        </div>
      </div>

        <div className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <strong style={{ fontSize: 15 }}>실제 순수익</strong>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>
              사이트 순 수익 = 수수료 수익 - 쿠폰 할인액(사이트 부담)
            </div>
          </div>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, color: "var(--secondary)" }}>
            {won(data.commission - data.couponDiscount)}
          </div>
        </div>
      </div>

      {/* 매출 추이 차트 */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>최근 6개월 거래액 추이</strong>
        {(() => {
          const W = 600;
          const H = 200;
          const PAD_X = 30;
          const PAD_TOP = 34; // 점 위 숫자 라벨이 잘리지 않게 여유를 둔다
          const PAD_BOTTOM = 28;
          const n = data.trend.length;
          const stepX = n > 1 ? (W - PAD_X * 2) / (n - 1) : 0;
          const xAt = (i: number) => PAD_X + stepX * i;
          const yAt = (v: number) =>
            PAD_TOP + (1 - v / maxRevenue) * (H - PAD_TOP - PAD_BOTTOM);
          const points = data.trend.map((t, i) => ({ ...t, x: xAt(i), y: yAt(t.revenue) }));
          const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

          return (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, marginTop: 12 }}>
              <line
                x1={PAD_X} y1={H - PAD_BOTTOM} x2={W - PAD_X} y2={H - PAD_BOTTOM}
                stroke="var(--border)" strokeWidth={1}
              />
              <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p) => (
                <g key={p.month}>
                  <circle cx={p.x} cy={p.y} r={4} fill="var(--primary)" />
                  <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text)">
                    {p.revenue > 0 ? `${Math.round(p.revenue / 10000)}만` : "0"}
                  </text>
                  <text x={p.x} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--text-2)">
                    {p.month}
                  </text>
                </g>
          ))}
            </svg>
          );
        })()}
      </div>

      {/* 예약 건수 추이 차트 */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>최근 6개월 예약 건수</strong>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 160, marginTop: 20 }}>
          {data.trend.map((t) => (
            <div key={t.month} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 6 }}>{t.reservations}건</div>
              <div
                style={{
                  height: `${(t.reservations / maxReservations) * 110}px`,
                  minHeight: t.reservations > 0 ? 4 : 0,
                  background: t.reservations === maxReservations ? "var(--primary)" : "var(--secondary)",
                  opacity: t.reservations === maxReservations ? 1 : 0.5,
                  borderRadius: "8px 8px 0 0",
                }}
              />
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>{t.month}</div>
            </div>
          ))}
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

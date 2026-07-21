"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import {
  getStats,
  getRevenueTrend,
  type AdminStats,
  type RevenueTrend,
} from "@/lib/api/admin";

// Platform statistics from real data: totals (GET /admin/stats) plus the
// monthly revenue/reservation trend (GET /admin/revenue/monthly).
export default function AdminStatsPage() {
  const [totals, setTotals] = useState<AdminStats | null>(null);
  const [trend, setTrend] = useState<RevenueTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats().catch(() => null), getRevenueTrend(6).catch(() => null)])
      .then(([s, t]) => {
        setTotals(s);
        setTrend(t);
      })
      .finally(() => setLoading(false));
  }, []);

  const points = trend?.trend ?? [];
  const maxRevenue = points.length ? Math.max(...points.map((p) => p.revenue), 1) : 1;
  const maxRes = points.length ? Math.max(...points.map((p) => p.reservations), 1) : 1;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>통계</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>
        플랫폼 전체 지표와 월별 추이를 확인하세요.
      </p>

      {/* platform totals */}
      <div className="stat-row">
        <Stat label="전체 회원" value={loading ? "…" : (totals?.users ?? 0).toLocaleString()} />
        <Stat label="등록 숙소" value={loading ? "…" : (totals?.rooms ?? 0).toLocaleString()} />
        <Stat label="누적 예약" value={loading ? "…" : (totals?.reservations ?? 0).toLocaleString()} />
        <Stat label="플랫폼 수수료" value={loading ? "…" : won(totals?.commission ?? 0)} accent />
      </div>

      {/* GMV / refunds summary */}
      <div className="stat-row" style={{ marginTop: 12 }}>
        <Stat label="총 거래액(GMV)" value={loading ? "…" : won(totals?.gmv ?? trend?.gmv ?? 0)} />
        <Stat label="환불액" value={loading ? "…" : won(trend?.refunds ?? 0)} muted />
        <Stat label="호스트 정산액" value={loading ? "…" : won(trend?.payouts ?? 0)} />
        <Stat
          label="예약당 평균"
          value={
            loading
              ? "…"
              : totals && totals.reservations > 0
                ? won(Math.round(totals.gmv / totals.reservations))
                : won(0)
          }
          muted
        />
      </div>

      {loading && <div style={{ color: "var(--text-2)", marginTop: 20 }}>불러오는 중…</div>}

      {/* monthly revenue chart */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>월별 매출 추이</strong>
        {!loading && points.length === 0 && (
          <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 16 }}>
            아직 매출 데이터가 없습니다.
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 170, marginTop: 20 }}>
          {points.map((p) => (
            <div key={p.month} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>
                {p.revenue > 0 ? won(p.revenue) : ""}
              </div>
              <div
                style={{
                  height: `${(p.revenue / maxRevenue) * 120}px`,
                  background: p.revenue === maxRevenue ? "var(--primary)" : "var(--secondary)",
                  borderRadius: "8px 8px 0 0",
                  opacity: p.revenue === maxRevenue ? 1 : 0.55,
                  transition: "height .3s var(--ease-out)",
                }}
              />
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>{p.month}</div>
            </div>
          ))}
        </div>
      </div>

      {/* monthly reservations chart */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>월별 예약 건수</strong>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 150, marginTop: 20 }}>
          {points.map((p) => (
            <div key={p.month} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>
                {p.reservations > 0 ? `${p.reservations}건` : ""}
              </div>
              <div
                style={{
                  height: `${(p.reservations / maxRes) * 100}px`,
                  background: "var(--secondary)",
                  borderRadius: "8px 8px 0 0",
                  opacity: 0.75,
                }}
              />
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>{p.month}</div>
            </div>
          ))}
          {!loading && points.length === 0 && (
            <div style={{ color: "var(--text-2)", fontSize: 13 }}>데이터 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div
        className="display"
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginTop: 4,
          color: accent ? "var(--primary)" : muted ? "var(--text-2)" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

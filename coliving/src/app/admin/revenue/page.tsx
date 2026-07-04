import { won } from "@/lib/format";
import { revenue } from "@/lib/admin";

export const metadata = { title: "매출 관리 · Nested 관리자" };

export default function AdminRevenue() {
  const r = revenue();
  const max = Math.max(...r.trend.map((t) => t.value));

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>매출 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>플랫폼 거래액과 수수료를 확인하세요.</p>

      <div className="stat-row">
        <Stat label="총 거래액 (GMV)" value={won(r.gmv)} />
        <Stat label="수수료 수익" value={won(r.commission)} accent />
        <Stat label="호스트 정산액" value={won(r.payouts)} />
        <Stat label="환불액" value={won(r.refunds)} />
      </div>

      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>최근 6개월 거래액 추이</strong>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 180, marginTop: 20 }}>
          {r.trend.map((t) => (
            <div key={t.month} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 6 }}>{Math.round(t.value / 10000)}만</div>
              <div
                style={{
                  height: `${(t.value / max) * 130}px`,
                  background: t.value === max ? "var(--primary)" : "var(--secondary)",
                  opacity: t.value === max ? 1 : 0.5,
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
        <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{won(r.payouts)}</div>
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

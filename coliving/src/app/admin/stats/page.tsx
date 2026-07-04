import { stats } from "@/lib/admin";

export const metadata = { title: "통계 · Nested 관리자" };

export default function AdminStats() {
  const s = stats();
  const maxTrend = Math.max(...s.trend.map((t) => t.value));

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>통계</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>서비스 이용 지표를 확인하세요.</p>

      <div className="stat-row">
        <Stat label="DAU" value={s.dau.toLocaleString()} />
        <Stat label="MAU" value={s.mau.toLocaleString()} />
        <Stat label="신규 가입 (오늘)" value={`${s.newSignups}`} />
        <Stat label="예약 전환율" value={`${s.conversion}%`} />
      </div>

      {/* weekly active trend */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>요일별 활성 사용자</strong>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160, marginTop: 20 }}>
          {s.trend.map((t) => (
            <div key={t.label} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: `${(t.value / maxTrend) * 130}px`,
                  background: t.value === maxTrend ? "var(--primary)" : "var(--secondary)",
                  opacity: t.value === maxTrend ? 1 : 0.55,
                  borderRadius: "8px 8px 0 0",
                }}
                title={`${t.value * 12}명`}
              />
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* region share */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>지역별 예약 비중</strong>
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {s.regionShare.map((r) => (
            <div key={r.region}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 5 }}>
                <span>{r.region}</span>
                <span style={{ color: "var(--text-2)" }}>{r.pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: "var(--bg-2)", overflow: "hidden" }}>
                <div style={{ width: `${r.pct}%`, height: "100%", background: "linear-gradient(90deg, var(--primary), var(--secondary))" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

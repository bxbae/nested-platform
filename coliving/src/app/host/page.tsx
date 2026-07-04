import Link from "next/link";
import { won } from "@/lib/format";
import { revenueSummary, revenueTrend, myListings, inquiries } from "@/lib/host";

export const metadata = { title: "수익 대시보드 · Nested 호스트" };

export default function HostDashboard() {
  const s = revenueSummary();
  const trend = revenueTrend();
  const listings = myListings();
  const newInquiries = inquiries().filter((i) => i.unread).length;
  const max = Math.max(...trend.map((t) => t.value));

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>
        수익 대시보드
      </h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>
        이번 달 운영 현황을 한눈에 확인하세요.
      </p>

      {/* Revenue hero card (mockup: 이번 달 수익) */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--primary), var(--secondary))",
          borderRadius: "var(--r-lg)",
          padding: 26,
          color: "#fff",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.9 }}>이번 달 예상 수익</div>
        <div className="display" style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>
          {won(s.thisMonth)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
          지난달 대비 ▲ {Math.round(((s.thisMonth - s.lastMonth) / s.lastMonth) * 100)}%
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-row">
        <Stat label="등록 숙소" value={`${s.listingCount}`} />
        <Stat label="총 예약" value={`${s.reservationCount}`} />
        <Stat label="입주율" value={`${s.occupancy}%`} />
        <Stat label="새 문의" value={`${newInquiries}`} accent />
      </div>

      {/* Revenue trend */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>최근 6개월 수익 추이</strong>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 14,
            height: 160,
            marginTop: 20,
          }}
        >
          {trend.map((t) => (
            <div key={t.month} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: `${(t.value / max) * 130}px`,
                  background:
                    t.value === max
                      ? "var(--primary)"
                      : "linear-gradient(180deg, var(--secondary), var(--secondary))",
                  borderRadius: "8px 8px 0 0",
                  opacity: t.value === max ? 1 : 0.55,
                  transition: "height .3s var(--ease-out)",
                }}
                title={won(t.value)}
              />
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>{t.month}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent listings quick view */}
      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <strong style={{ fontSize: 15 }}>내 숙소</strong>
          <Link href="/host/listings" style={{ color: "var(--secondary)", fontSize: 13.5, fontWeight: 600 }}>
            전체 보기 →
          </Link>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {listings.map((h) => (
            <Link
              key={h.id}
              href={`/host/listings`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <strong style={{ fontSize: 14.5 }}>{h.name.trim()}</strong>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  {h.region} · {h.residents}/{h.capacity}명 입주
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 14 }}>
                <strong>{won(h.monthlyRent)}</strong>
                <span style={{ color: "var(--text-2)", fontSize: 12 }}> / 월</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div
        className="display"
        style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: accent ? "var(--primary)" : "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}

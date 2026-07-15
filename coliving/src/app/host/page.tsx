"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { myListings } from "@/lib/host";
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
  const listings = myListings();

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
  const max = trend.length ? Math.max(...trend.map((t) => t.value), 1) : 1;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 className="display" style={{ fontSize: 30 }}>수익 대시보드</h1>
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

      <div className="stat-row">
        <Stat label="등록 숙소" value={loading ? "…" : `${data?.listingCount ?? 0}`} />
        <Stat label="총 예약" value={loading ? "…" : `${data?.reservationCount ?? 0}`} />
        <Stat label="입주율" value={loading ? "…" : `${data?.occupancy ?? 0}%`} />
        <Stat label="새 문의" value={loading ? "…" : `${data?.newInquiries ?? 0}`} accent />
      </div>

      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <strong style={{ fontSize: 15 }}>최근 6개월 수익 추이</strong>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 160, marginTop: 20 }}>
          {trend.map((t) => (
            <div key={t.month} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: `${(t.value / max) * 130}px`,
                  background: t.value === max && t.value > 0 ? "var(--primary)" : "var(--secondary)",
                  borderRadius: "8px 8px 0 0",
                  opacity: t.value === max ? 1 : 0.55,
                  transition: "height .3s var(--ease-out)",
                }}
                title={won(t.value)}
              />
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>{t.month}</div>
            </div>
          ))}
          {!loading && trend.length === 0 && (
            <div style={{ color: "var(--text-2)", fontSize: 13 }}>수익 데이터가 아직 없습니다.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <strong style={{ fontSize: 15 }}>내 숙소</strong>
          <Link href="/host/listings" style={{ color: "var(--secondary)", fontSize: 13.5, fontWeight: 600 }}>
            전체 보기 →
          </Link>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {listings.map((h) => (
            <Link key={h.id} href={`/host/listings`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
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
      <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: accent ? "var(--primary)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

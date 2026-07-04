import Link from "next/link";
import { won } from "@/lib/format";
import { members, pendingListings, reports, stats, revenue } from "@/lib/admin";

export const metadata = { title: "관리자 대시보드 · Nested" };

export default function AdminDashboard() {
  const m = members();
  const pending = pendingListings();
  const openReports = reports().filter((r) => r.status !== "처리완료");
  const s = stats();
  const rev = revenue();

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>대시보드</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>플랫폼 전체 현황을 확인하세요.</p>

      {/* GMV hero */}
      <div style={{ background: "linear-gradient(135deg, var(--text), #3a3a42)", borderRadius: "var(--r-lg)", padding: 26, color: "#fff", marginBottom: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>이번 달 거래액 (GMV)</div>
        <div className="display" style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>{won(rev.gmv)}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>수수료 수익 {won(rev.commission)}</div>
      </div>

      <div className="stat-row">
        <Stat label="총 회원" value={`${m.length * 340}`} />
        <Stat label="DAU" value={s.dau.toLocaleString()} />
        <Stat label="승인 대기" value={`${pending.length}`} accent href="/admin/approvals" />
        <Stat label="미처리 신고" value={`${openReports.length}`} accent href="/admin/reports" />
      </div>

      {/* two-column: pending approvals + reports */}
      <div className="admin-two" style={{ marginTop: 20 }}>
        <Panel title="숙소 승인 대기" href="/admin/approvals">
          {pending.slice(0, 4).map((p) => (
            <Row key={p.id} left={p.name} sub={`${p.host} · ${p.region}`} right={won(p.monthlyRent)} />
          ))}
        </Panel>
        <Panel title="최근 신고" href="/admin/reports">
          {reports().slice(0, 4).map((r) => (
            <Row key={r.id} left={r.target} sub={`${r.targetType} · ${r.reason}`} right={r.status} />
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, href }: { label: string; value: string; accent?: boolean; href?: string }) {
  const inner = (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: accent ? "var(--primary)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href} className="hover-card" style={{ display: "block", borderRadius: "var(--r-lg)" }}>{inner}</Link> : inner;
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>{title}</strong>
        <Link href={href} style={{ color: "var(--secondary)", fontSize: 13, fontWeight: 600 }}>전체 →</Link>
      </div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ left, sub, right }: { left: string; sub: string; right: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</div>
        <div style={{ fontSize: 12, color: "var(--text-2)" }}>{sub}</div>
      </div>
      <span style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "nowrap", marginLeft: 8 }}>{right}</span>
    </div>
  );
}

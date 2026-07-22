"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Grouped by how admins actually work: 대시보드 alone, then
// 통계/매출/쿠폰(수치·정책), 신고/승인/회원/예약(케이스 처리), 공지/배너(콘텐츠).
// Each group renders as its own block so the gaps between them are just
// spacing — no divider lines or labels, matching the reference design.
const groups: { href: string; label: string; exact?: boolean }[][] = [
  [{ href: "/admin", label: "대시보드", exact: true }],
  [
  { href: "/admin/stats", label: "통계"},
  { href: "/admin/revenue", label: "매출 관리"},
  { href: "/admin/coupons", label: "쿠폰 관리"},
  ],
  [
    { href: "/admin/reports", label: "신고 관리"},
    { href: "/admin/approvals", label: "숙소 승인"},
    { href: "/admin/members", label: "회원 관리"},
    { href: "/admin/reservations", label: "예약 관리"},
  ],
  [
    { href: "/admin/notices", label: "공지사항"},
    { href: "/admin/banners", label: "배너 관리"},
  ],
];

export function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="host-sidebar">
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 14px" }}>
        <span
          aria-hidden="true"
          style={{ width: 30, height: 30, borderRadius: 8, background: "var(--text)", color: "var(--bg)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}
        >
          A
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>관리자</div>
          <div style={{ fontSize: 11, color: "var(--text-2)" }}>Nested Admin</div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        {groups.map((group, gi) => (
          <nav
            key={gi}
            style={{
              display: "grid",
              gap: 2,
              // A hairline above every group but the first — separates
              // "대시보드" and each category, without a label.
              ...(gi > 0 && { borderTop: "1px solid var(--border)", paddingTop: 14 }),
            }}
          >
            {group.map((it) => {
          const active = it.exact ? path === it.href : path.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: "var(--r-sm)",
                fontSize: 14,
                fontWeight: active ? 600 : 450,
                color: active ? "var(--text)" : "var(--text-2)",
                background: active ? "var(--bg-2)" : "transparent",
              }}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
        ))}
      </div>
    </aside>
  );
}

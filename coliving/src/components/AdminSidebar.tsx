"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "대시보드", icon: "📊", exact: true },
  { href: "/admin/members", label: "회원 관리", icon: "👥" },
  { href: "/admin/approvals", label: "숙소 승인", icon: "✅" },
  { href: "/admin/reports", label: "신고 관리", icon: "🚩" },
  { href: "/admin/reservations", label: "예약 관리", icon: "📋" },
  { href: "/admin/stats", label: "통계", icon: "📈" },
  { href: "/admin/revenue", label: "매출 관리", icon: "💰" },
  { href: "/admin/notices", label: "공지사항", icon: "📢" },
  { href: "/admin/coupons", label: "쿠폰 관리", icon: "🎟️" },
  { href: "/admin/banners", label: "배너 관리", icon: "🖼️" },
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
      <nav style={{ display: "grid", gap: 2 }}>
        {items.map((it) => {
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
              <span aria-hidden="true">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

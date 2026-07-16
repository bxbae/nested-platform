"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/host", label: "수익 대시보드", icon: "📊", exact: true },
  { href: "/host/listings", label: "숙소 관리", icon: "🏠" },
  { href: "/host/listings/new", label: "숙소 등록", icon: "➕" },
  { href: "/host/reservations", label: "예약 관리", icon: "📋" },
  { href: "/host/settlements", label: "정산 내역", icon: "💰" },
  { href: "/host/calendar", label: "예약 캘린더", icon: "📅" },
  { href: "/host/seekers", label: "입주 희망자 찾기", icon: "🔍" },
  { href: "/host/inquiries", label: "문의 관리", icon: "💬" },
  { href: "/host/reviews", label: "리뷰 관리", icon: "⭐" },
];

export function HostSidebar() {
  const path = usePathname();
  return (
    <aside className="host-sidebar">
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", padding: "0 8px 10px" }}>
        호스트 콘솔
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
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                fontSize: 14.5,
                fontWeight: active ? 600 : 450,
                color: active ? "var(--text)" : "var(--text-2)",
                background: active ? "var(--surface-2, var(--bg-2))" : "transparent",
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

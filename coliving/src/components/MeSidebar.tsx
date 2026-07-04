"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentUser } from "@/lib/me";

const items = [
  { href: "/me", label: "프로필", icon: "👤", exact: true },
  { href: "/me/trips", label: "예약 내역", icon: "📋" },
  { href: "/me/wishlist", label: "찜 목록", icon: "♥" },
  { href: "/me/payments", label: "결제 내역", icon: "💳" },
  { href: "/me/chat", label: "메시지", icon: "💬" },
  { href: "/me/notifications", label: "알림", icon: "🔔" },
  { href: "/me/reviews", label: "리뷰 관리", icon: "⭐" },
  { href: "/me/settings", label: "설정", icon: "⚙️" },
];

export function MeSidebar() {
  const path = usePathname();
  return (
    <aside className="host-sidebar">
      {/* profile mini-header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 16px" }}>
        <span
          aria-hidden="true"
          style={{
            width: 40, height: 40, borderRadius: 99, flexShrink: 0,
            background: currentUser.avatarColor,
            display: "grid", placeItems: "center", color: "#fff", fontWeight: 700,
          }}
        >
          {currentUser.name[0]}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{currentUser.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>{currentUser.role}</div>
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
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                fontSize: 14.5,
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentUser } from "@/lib/me";
import { useAuth } from "@/lib/api/useAuth";

const items = [
  { href: "/me", label: "프로필", icon: "", exact: true },
  { href: "/me/trips", label: "예약 내역", icon: "" },
  { href: "/me/wishlist", label: "찜 목록", icon: "" },
  { href: "/me/friends", label: "친구 목록", icon: "" },
  { href: "/me/messages", label: "메시지", icon: "" },
  { href: "/me/payments", label: "결제 내역", icon: "" },
  { href: "/me/notifications", label: "알림", icon: "" },
  { href: "/me/reviews", label: "리뷰 관리", icon: "" },
  { href: "/me/preference", label: "생활 성향", icon: "" },
  { href: "/me/settings", label: "설정", icon: "" },
];

export function MeSidebar() {
  const path = usePathname();
  const { user } = useAuth();

  // 로그인 상태에서는 실제 사용자 정보를 사용하고,
  // 오프라인 데모 모드에서는 기존 목업 정보를 사용합니다.
  const name =
    user?.nicknameCompleted === false
      ? "닉네임 설정 필요"
      : (user?.name ?? user?.email ?? currentUser.name);

  const role =
    user?.role === "HOST" ? "호스트" : user ? "게스트" : currentUser.role;

  const avatarUrl = user?.avatarUrl ?? null;
  const avatarColor = user?.avatarColor ?? currentUser.avatarColor;

  const avatarFallback =
    user?.nicknameCompleted === false
      ? "닉"
      : (name.trim().charAt(0) || "N").toUpperCase();

  return (
    <aside className="host-sidebar">
      {/* profile mini-header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "4px 8px 16px",
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${name} 프로필 사진`}
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              flexShrink: 0,
              objectFit: "cover",
              display: "block",
              border: "1px solid var(--border)",
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              flexShrink: 0,
              background: avatarColor,
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {avatarFallback}
          </span>
        )}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            {role}
          </div>
        </div>
      </div>

      <nav
        style={{
          display: "grid",
          gap: 2,
        }}
      >
        {items.map((item) => {
          const active = item.exact
            ? path === item.href
            : path.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
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
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

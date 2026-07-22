"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Rings } from "./Rings";
import { ThemeToggle } from "./ThemeToggle";
import { AuthModal } from "./AuthModal";
import { useAuth } from "@/lib/api/useAuth";
import { NotificationBell } from "./NotificationBell";
import { MessageBell } from "./MessageBell";
import { UserAvatar } from "./UserAvatar";

const links = [
  { href: "/search", label: "숙소 검색" },
  { href: "/match", label: "룸메이트" },
  { href: "/community", label: "커뮤니티" },
  { href: "/host", label: "호스트" },
  { href: "/me", label: "마이" },
  { href: "/admin", label: "관리자" },
];

const ROOM_LINKS = [
  { icon: "⌂", label: "전체 숙소", description: "지역과 조건으로 둘러보기", href: "/search" },
  { icon: "▣", label: "개인실·원룸", description: "개인 공간을 확보한 주거", href: "/search?roomTypes=one_room" },
  { icon: "♟", label: "쉐어룸", description: "합리적인 비용으로 함께", href: "/search?roomTypes=share_room" },
  { icon: "◇", label: "독채", description: "집 전체를 단독으로 사용", href: "/search?roomTypes=whole_house" },
];

const FEATURE_LINKS = [
  { label: "직장 근처 숙소", description: "통근 시간 짧은 순으로 검색", href: "/browse" },
  { label: "검증된 숙소", description: "호스트 확인·관리자 승인 숙소", href: "/search?verified=true" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const displayName = user?.nicknameCompleted === false ? "닉네임 설정" : (user?.name ?? "마이");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasAuthFlag = new URLSearchParams(window.location.search).get("auth") === "1";
    if (hasAuthFlag && !isAuthenticated) {
      setAuthOpen(true);
      router.replace(path);
    }
  }, [isAuthenticated, router, path]);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--glass)", backdropFilter: "saturate(160%) blur(18px)", WebkitBackdropFilter: "saturate(160%) blur(18px)", borderBottom: "1px solid var(--border)" }}>
      <div className="wrap nav-shell" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", height: 68, gap: 20 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, justifySelf: "start" }}>
          <Rings size={28} />
          <span className="display" style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.03em" }}>Nested</span>
        </Link>

        <nav className="nav-links" aria-label="주요 메뉴" style={{ justifySelf: "center", display: "flex", alignItems: "center", gap: 2 }}>
          {links.map((link) => {
            const active = path.startsWith(link.href);
            const linkElement = (
              <Link href={link.href} style={{ fontSize: 14.5, fontWeight: active ? 650 : 480, padding: "8px 13px", borderRadius: 999, color: active ? "var(--text)" : "var(--text-2)", background: active ? "#fff" : "transparent", border: active ? "1px solid var(--border)" : "1px solid transparent" }} className="navlink">
                {link.label}
              </Link>
            );

            if (link.href !== "/search") return <span key={link.href}>{linkElement}</span>;

            return (
              <div key={link.href} style={{ position: "relative" }} onMouseEnter={() => setSearchOpen(true)} onMouseLeave={() => setSearchOpen(false)}>
                {linkElement}
                {searchOpen && (
                  <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-34%)", paddingTop: 10, zIndex: 60 }}>
                    <div className="card" style={{ width: 560, padding: 16, borderRadius: 18, boxShadow: "0 18px 48px rgba(0,0,0,.14)", display: "grid", gridTemplateColumns: "1.45fr .9fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 700, marginBottom: 8 }}>주거 형태로 찾기</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {ROOM_LINKS.map((item) => (
                            <Link key={item.href} href={item.href} onClick={() => setSearchOpen(false)} className="hover-card" style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 9, padding: 10, borderRadius: 12, border: "1px solid var(--border)" }}>
                              <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 999, background: "var(--bg-2)", display: "grid", placeItems: "center" }}>{item.icon}</span>
                              <span><strong style={{ display: "block", fontSize: 13.5 }}>{item.label}</strong><span style={{ display: "block", fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>{item.description}</span></span>
                            </Link>
                          ))}
                        </div>
                      </div>
                      <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
                        <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 700, marginBottom: 8 }}>목적으로 찾기</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {FEATURE_LINKS.map((item) => (
                            <Link key={item.href} href={item.href} onClick={() => setSearchOpen(false)} className="hover-card" style={{ padding: 11, borderRadius: 12, background: "var(--bg-2)" }}>
                              <strong style={{ display: "block", fontSize: 13.5 }}>{item.label} →</strong>
                              <span style={{ display: "block", fontSize: 11.5, color: "var(--text-2)", marginTop: 3 }}>{item.description}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <Link href="/me" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 650 }}>
                <UserAvatar name={displayName} avatarUrl={user?.avatarUrl} avatarColor={user?.avatarColor} size={28} />
                <span>{displayName}</span>
              </Link>
              <MessageBell />
              <NotificationBell />
              <button onClick={logout} className="press" style={{ fontSize: 13.5, color: "var(--text-2)", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "7px 14px", cursor: "pointer" }}>로그아웃</button>
            </>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="btn btn-primary press" style={{ padding: "9px 18px" }}>시작하기</button>
          )}
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

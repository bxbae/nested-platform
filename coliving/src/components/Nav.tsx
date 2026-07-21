"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Rings } from "./Rings";
import { ThemeToggle } from "./ThemeToggle";
import { AuthModal } from "./AuthModal";
import { useAuth } from "@/lib/api/useAuth";
import { NotificationBell } from "./NotificationBell";
import { MessageBell } from "./MessageBell";

const links = [
  { href: "/search", label: "숙소 검색" },
  // { href: "/browse", label: "직장 근처 숙소" },
  { href: "/match", label: "룸메이트" },
  { href: "/community", label: "커뮤니티" },
  { href: "/host", label: "호스트" },
  { href: "/me", label: "마이" },
  { href: "/admin", label: "관리자" },
];

// Hover menu under "숙소 검색" — room-type filters plus the commute search.
const SEARCH_DROPDOWN = [
  { label: "원룸", href: "/search?roomTypes=one_room" },
  { label: "쉐어룸", href: "/search?roomTypes=share_room" },
  { label: "독채", href: "/search?roomTypes=whole_house" },
  { label: "아파트", href: "/search?roomTypes=apartment" },
  { label: "직장 근처 숙소", href: "/browse" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Opened via ?auth=1 (e.g. redirected here from a guarded page while logged
  // out). Read the query straight off the URL so we don't need a Suspense
  // boundary around useSearchParams for the global nav.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasAuthFlag =
      new URLSearchParams(window.location.search).get("auth") === "1";
    if (hasAuthFlag && !isAuthenticated) {
      setAuthOpen(true);
      router.replace(path); // strip the query so it doesn't re-trigger
    }
  }, [isAuthenticated, router, path]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--glass)",
        backdropFilter: "saturate(160%) blur(18px)",
        WebkitBackdropFilter: "saturate(160%) blur(18px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 68,
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <Rings size={28} />
          <span
            className="display"
            style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.03em" }}
          >
            Nested
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <nav className="nav-links" aria-label="Primary">
            {links.map((l) => {
              const active = path.startsWith(l.href);
              const linkEl = (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{
                    fontSize: 14.5,
                    fontWeight: active ? 600 : 450,
                    padding: "8px 14px",
                    borderRadius: 999,
                    // Active pill is always white, so force a dark text color
                    // (var(--text) is light in dark mode and would vanish here).
                    color: active ? "#222222" : "var(--text-2)",
                    background: active ? "#fff" : "transparent",
                    border: active
                      ? "1px solid var(--border)"
                      : "1px solid transparent",
                  }}
                  className="navlink"
                >
                  {l.label}
                </Link>
              );

              // "숙소 검색" gets a hover dropdown (room-type filters + commute
              // search). The wrapper spans both the link and the panel so
              // moving the mouse from one into the other doesn't close it.
              if (l.href !== "/search") return linkEl;

              return (
                <div
                  key={l.href}
                  style={{ position: "relative" }}
                  onMouseEnter={() => setSearchOpen(true)}
                  onMouseLeave={() => setSearchOpen(false)}
                >
                  {linkEl}
                  {searchOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 6,
                        minWidth: 168,
                        background: "var(--surface, #fff)",
                        border: "1px solid var(--border)",
                        borderRadius: 14,
                        boxShadow: "0 12px 32px rgba(0,0,0,.12)",
                        padding: 6,
                        display: "grid",
                        zIndex: 60,
                      }}
                    >
                      {SEARCH_DROPDOWN.map((item, i) => (
                        <div key={item.href}>
                          {i === SEARCH_DROPDOWN.length - 1 && (
                            <div
                              style={{ height: 1, background: "var(--border)", margin: "6px 8px" }}
                            />
                          )}
                          <Link
                            href={item.href}
                            onClick={() => setSearchOpen(false)}
                            style={{
                              display: "block",
                              fontSize: 14,
                              color: "var(--text)",
                              padding: "9px 12px",
                              borderRadius: 9,
                            }}
                            className="navlink-item"
                          >
                            {item.label}
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <ThemeToggle />
          {isAuthenticated ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link
                href="/me"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: "var(--brand, #FF5A5F)",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {(user?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
                </span>
                {user?.name ?? "마이"}
              </Link>

              <MessageBell />
              <NotificationBell />

              <button
                onClick={logout}
                className="press"
                style={{
                  fontSize: 13.5,
                  color: "var(--text-2)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  padding: "7px 14px",
                  cursor: "pointer",
                }}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="btn btn-primary nav-cta press"
              style={{ padding: "9px 18px", border: "none", cursor: "pointer" }}
            >
              Get started
            </button>
          )}
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

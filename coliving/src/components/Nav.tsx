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
import { LanguageToggle } from "./LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/lib/i18n/translations";

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const { locale } = useLanguage();
  const t = translations[locale].nav;

  const links = [
    { href: "/search", label: t.search },
    { href: "/match", label: t.roommate },
    { href: "/community", label: t.community },
    { href: "/host", label: t.host },
    { href: "/me", label: t.my },
    // "관리자" tab only for admins. /admin itself should also be gated
    // server/route-side (AdminGate) — this just keeps a non-admin from
    // seeing the link in the first place.
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: t.admin }] : []),
  ];

  const roomLinks = [
    {
      icon: "⌂",
      label: t.allHomes,
      description: t.allHomesDescription,
      href: "/search",
    },
    {
      icon: "▣",
      label: t.oneRoom,
      description: t.oneRoomDescription,
      href: "/search?roomTypes=one_room",
    },
    {
      icon: "♟",
      label: t.shareRoom,
      description: t.shareRoomDescription,
      href: "/search?roomTypes=share_room",
    },
    {
      icon: "◇",
      label: t.wholeHouse,
      description: t.wholeHouseDescription,
      href: "/search?roomTypes=whole_house",
    },
  ];

  const featureLinks = [
    {
      label: t.commuteSearch,
      description: t.commuteSearchDescription,
      href: "/browse",
    },
    {
      label: t.verifiedHomes,
      description: t.verifiedHomesDescription,
      href: "/search?verified=true",
    },
  ];
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const displayName =
    user?.nicknameCompleted === false ? t.nicknameSetup : (user?.name ?? t.my);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasAuthFlag =
      new URLSearchParams(window.location.search).get("auth") === "1";
    if (hasAuthFlag && !isAuthenticated) {
      setAuthOpen(true);
      router.replace(path);
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
        className="wrap nav-shell"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          height: 68,
          gap: 20,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifySelf: "start",
          }}
        >
          <Rings size={28} />
          <span
            className="display"
            style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.03em" }}
          >
            Nested
          </span>
        </Link>

        <nav
          className="nav-links"
          aria-label="주요 메뉴"
          style={{
            justifySelf: "center",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {links.map((link) => {
            const active = path.startsWith(link.href);
            const linkElement = (
              <Link
                href={link.href}
                style={{
                  fontSize: 14.5,
                  fontWeight: active ? 650 : 480,
                  padding: "8px 13px",
                  borderRadius: 999,
                  color: active ? "var(--text)" : "var(--text-2)",
                  background: active ? "#fff" : "transparent",
                  border: active
                    ? "1px solid var(--border)"
                    : "1px solid transparent",
                }}
                className="navlink"
              >
                {link.label}
              </Link>
            );

            if (link.href !== "/search")
              return <span key={link.href}>{linkElement}</span>;

            return (
              <div
                key={link.href}
                style={{ position: "relative" }}
                onMouseEnter={() => setSearchOpen(true)}
                onMouseLeave={() => setSearchOpen(false)}
              >
                {linkElement}
                {searchOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-34%)",
                      paddingTop: 10,
                      zIndex: 60,
                    }}
                  >
                    <div
                      className="card"
                      style={{
                        width: 560,
                        padding: 16,
                        borderRadius: 18,
                        boxShadow: "0 18px 48px rgba(0,0,0,.14)",
                        display: "grid",
                        gridTemplateColumns: "1.45fr .9fr",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-2)",
                            fontWeight: 700,
                            marginBottom: 8,
                          }}
                        >
                          {t.findByHousingType}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                          }}
                        >
                          {roomLinks.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setSearchOpen(false)}
                              className="hover-card"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "30px 1fr",
                                gap: 9,
                                padding: 10,
                                borderRadius: 12,
                                border: "1px solid var(--border)",
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 999,
                                  background: "var(--bg-2)",
                                  display: "grid",
                                  placeItems: "center",
                                }}
                              >
                                {item.icon}
                              </span>
                              <span>
                                <strong
                                  style={{ display: "block", fontSize: 13.5 }}
                                >
                                  {item.label}
                                </strong>
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: 11.5,
                                    color: "var(--text-2)",
                                    marginTop: 2,
                                  }}
                                >
                                  {item.description}
                                </span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                      <div
                        style={{
                          borderLeft: "1px solid var(--border)",
                          paddingLeft: 16,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-2)",
                            fontWeight: 700,
                            marginBottom: 8,
                          }}
                        >
                          {t.findByPurpose}
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {featureLinks.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setSearchOpen(false)}
                              className="hover-card"
                              style={{
                                padding: 11,
                                borderRadius: 12,
                                background: "var(--bg-2)",
                              }}
                            >
                              <strong
                                style={{ display: "block", fontSize: 13.5 }}
                              >
                                {item.label} →
                              </strong>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 11.5,
                                  color: "var(--text-2)",
                                  marginTop: 3,
                                }}
                              >
                                {item.description}
                              </span>
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

        <div
          style={{
            justifySelf: "end",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <LanguageToggle />
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <Link
                href="/me"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 14,
                  fontWeight: 650,
                }}
              >
                <UserAvatar
                  name={displayName}
                  avatarUrl={user?.avatarUrl}
                  avatarColor={user?.avatarColor}
                  size={28}
                />
                <span>{displayName}</span>
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
                {t.logout}
              </button>
            </>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="btn btn-primary press"
              style={{ padding: "9px 18px" }}
            >
              {t.getStarted}
            </button>
          )}
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

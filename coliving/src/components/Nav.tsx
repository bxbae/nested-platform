"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rings } from "./Rings";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/search", label: "숙소 검색" },
  { href: "/browse", label: "통근 검색" },
  { href: "/match", label: "룸메이트" },
  { href: "/community", label: "커뮤니티" },
  { href: "/host", label: "호스트" },
  { href: "/me", label: "마이" },
  { href: "/admin", label: "관리자" },
];

export function Nav() {
  const path = usePathname();
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
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{
                    fontSize: 14.5,
                    fontWeight: active ? 600 : 450,
                    padding: "8px 14px",
                    borderRadius: 999,
                    color: active ? "var(--text)" : "var(--text-2)",
                    background: active ? "#fff" : "transparent",
                    border: active ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                  className="navlink"
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
          <Link
            href="/browse"
            className="btn btn-primary nav-cta press"
            style={{ padding: "9px 18px" }}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Dark-mode toggle. Adds/removes `.dark` on <html>, persisted in localStorage.
// Respects the OS preference on first visit (no stored choice).
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  if (!mounted) return <span style={{ width: 40 }} aria-hidden="true" />;

  return (
    <button
      onClick={toggle}
      className="press"
      aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={dark ? "라이트 모드" : "다크 모드"}
      style={{
        width: 38,
        height: 38,
        borderRadius: 99,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        fontSize: 16,
        display: "grid",
        placeItems: "center",
      }}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

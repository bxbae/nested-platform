"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PushEvent } from "@/lib/chat-types";
import { useAuth } from "@/lib/api/useAuth";

// Global push-notification listener. Polls the push queue and shows a toast
// (stand-in for FCM / Web Push). Mounted once in the root layout.
export function PushListener() {
  const [toasts, setToasts] = useState<PushEvent[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    // No session, no push queue to drain. Polling while logged out kept
    // connections pinned to the origin and starved /auth/me on the OAuth
    // callback, which left social logins stuck on "확인하는 중…".
    if (!user) return;
    const poll = async () => {
      try {
        // Abort rather than letting a hung serverless call hold a connection.
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch("/api/chat/push", { signal: ctrl.signal });
        window.clearTimeout(t);
        const data = await res.json();
        if (data.events?.length) {
          setToasts((t) => [...t, ...data.events].slice(-3));
          data.events.forEach((e: PushEvent) => {
            window.setTimeout(() => {
              setToasts((t) => t.filter((x) => x.id !== e.id));
            }, 5000);
          });
        }
      } catch {
        /* ignore */
      }
    };
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [user]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 80,
        right: 20,
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 320,
      }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <Link
          key={t.id}
          href="/me/messages"
          onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          className="card"
          style={{
            padding: 14,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            boxShadow: "var(--shadow-lg)",
            animation: "riseIn .3s var(--ease-out) both",
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 20 }}>💬</span>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: 14 }}>{t.title}</strong>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.body}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

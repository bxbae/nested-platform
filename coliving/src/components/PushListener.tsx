"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PushEvent } from "@/lib/chat-types";

// Global push-notification listener. Polls the push queue and shows a toast
// (stand-in for FCM / Web Push). Mounted once in the root layout.
export function PushListener() {
  const [toasts, setToasts] = useState<PushEvent[]>([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/chat/push");
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
  }, []);

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
          href="/me/chat"
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

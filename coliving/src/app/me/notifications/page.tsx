"use client";

import { useEffect, useState } from "react";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  relativeTime,
  TYPE_LABEL,
  type ApiNotification,
  type NotificationType,
} from "@/lib/api/notifications";

const TYPE_COLOR: Record<NotificationType, string> = {
  RESERVATION: "#00A699",
  PAYMENT: "#3E9BC4",
  MESSAGE: "#FF5A5F",
  REVIEW: "#FFB400",
  SYSTEM: "#7C6FE0",
};

export default function Notifications() {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    (async () => {
      const { items } = await listNotifications();
      setItems(items);
      setLoading(false);
    })();
  }, []);

  // Optimistic: flip locally, then persist. A failed write just leaves the
  // server as-is; the next load reconciles.
  async function readOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      /* ignore */
    }
  }

  async function readAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>알림</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>
            {loading ? "불러오는 중…" : `읽지 않은 알림 ${unread}개`}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn btn-ghost press" onClick={readAll}>
            모두 읽음
          </button>
        )}
      </div>

      {!loading && items.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          아직 알림이 없어요.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => readOne(n.id)}
              className="card press"
              style={{
                padding: 16, textAlign: "left", display: "flex", gap: 14, alignItems: "flex-start",
                background: !n.read ? "var(--bg-2)" : "#fff",
              }}
            >
              <span
                className="chip"
                style={{
                  fontSize: 11,
                  background: `${TYPE_COLOR[n.type]}18`,
                  color: TYPE_COLOR[n.type],
                  border: "none",
                  flexShrink: 0,
                }}
              >
                {TYPE_LABEL[n.type]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 14.5 }}>{n.title}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 3 }}>{n.body}</div>
              </div>
              {!n.read && (
                <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--primary)", flexShrink: 0, marginTop: 6 }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

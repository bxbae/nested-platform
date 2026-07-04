"use client";

import { useState } from "react";
import { notifications as loadNoti } from "@/lib/me";

const TYPE_COLOR: Record<string, string> = {
  예약: "#00A699", 결제: "#3E9BC4", 메시지: "#FF5A5F", 리뷰: "#FFB400", 시스템: "#7C6FE0",
};

export default function Notifications() {
  const [items, setItems] = useState(() => loadNoti());
  const unread = items.filter((n) => n.unread).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>알림</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>읽지 않은 알림 {unread}개</p>
        </div>
        {unread > 0 && (
          <button
            className="btn btn-ghost press"
            onClick={() => setItems((prev) => prev.map((n) => ({ ...n, unread: false })))}
          >
            모두 읽음
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))}
            className="card press"
            style={{
              padding: 16, textAlign: "left", display: "flex", gap: 14, alignItems: "flex-start",
              background: n.unread ? "var(--bg-2)" : "#fff",
            }}
          >
            <span
              className="chip"
              style={{ fontSize: 11, background: `${TYPE_COLOR[n.type]}18`, color: TYPE_COLOR[n.type], border: "none", flexShrink: 0 }}
            >
              {n.type}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 14.5 }}>{n.title}</strong>
                <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>{n.time}</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 3 }}>{n.body}</div>
            </div>
            {n.unread && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--primary)", flexShrink: 0, marginTop: 6 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

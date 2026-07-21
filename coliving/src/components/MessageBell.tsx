"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { authStore } from "@/lib/api/auth-store";
import { SOCKET_URL } from "@/lib/api/config";
import { unreadMessageNotificationCount, type ApiNotification } from "@/lib/api/notifications";

export function MessageBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const count = await unreadMessageNotificationCount();
      if (alive) setUnread(count);
    };
    void load();

    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: { token: authStore.getAccessToken() ?? "" },
      transports: ["websocket"],
    });
    const onNew = (notification: ApiNotification) => {
      if (notification.type === "MESSAGE") setUnread((value) => value + 1);
    };
    const onRefresh = () => void load();
    socket.on("notification:new", onNew);
    window.addEventListener("messages:read", onRefresh);
    return () => {
      alive = false;
      socket.off("notification:new", onNew);
      socket.disconnect();
      window.removeEventListener("messages:read", onRefresh);
    };
  }, []);

  return (
    <Link
      href="/me/messages"
      aria-label={`메시지 ${unread}개`}
      style={{
        position: "relative",
        width: 38,
        height: 38,
        borderRadius: 999,
        border: "1px solid var(--border)",
        display: "grid",
        placeItems: "center",
        fontSize: 17,
      }}
    >
      💬
      {unread > 0 && (
        <span
          style={{
            position: "absolute",
            top: -5,
            right: -5,
            minWidth: 19,
            height: 19,
            padding: "0 5px",
            borderRadius: 999,
            background: "var(--primary)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            border: "2px solid var(--bg)",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

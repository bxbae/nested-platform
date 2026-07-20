"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  relativeTime,
  type ApiNotification,
} from "@/lib/api/notifications";
import { useRouter } from "next/navigation";

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((item) => !item.read).length;

  async function loadNotifications() {
    const result = await listNotifications();
    setItems(result.items);
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();

    // 처음에는 10초마다 확인하는 폴링 방식 사용
    const timer = window.setInterval(loadNotifications, 10000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOutside);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
    };
  }, []);

  function handleNotificationClick(item: ApiNotification) {
    // 먼저 화면에서 읽음 상태로 변경
    setItems((prev) =>
      prev.map((notification) =>
        notification.id === item.id
          ? { ...notification, read: true }
          : notification,
      ),
    );

    // 서버에도 읽음 처리 요청
    if (!item.read) {
      void markNotificationRead(item.id).catch(() => {
        void loadNotifications();
      });
    }

    // 알림창 닫기
    setOpen(false);

    // 연결된 페이지가 있으면 이동
    if (item.targetUrl) {
      router.push(item.targetUrl);
    }
  }

  async function readOne(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );

    try {
      await markNotificationRead(id);
    } catch {
      await loadNotifications();
    }
  }

  async function readAll() {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));

    try {
      await markAllNotificationsRead();
    } catch {
      await loadNotifications();
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`알림 ${unread}개`}
        aria-expanded={open}
        style={{
          position: "relative",
          width: 38,
          height: 38,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "transparent",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: 17,
            lineHeight: 1,
          }}
        >
          🔔
        </span>

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
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="알림 목록"
          style={{
            position: "absolute",
            top: 46,
            right: 0,
            width: 360,
            maxHeight: 470,
            overflow: "hidden",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "var(--shadow-lg)",
            zIndex: 200,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <strong>알림</strong>

            {unread > 0 && (
              <button
                type="button"
                onClick={readAll}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-2)",
                  cursor: "pointer",
                  fontSize: 12.5,
                }}
              >
                모두 읽음
              </button>
            )}
          </div>

          <div
            style={{
              maxHeight: 360,
              overflowY: "auto",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-2)",
                  fontSize: 13,
                }}
              >
                불러오는 중…
              </div>
            ) : items.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "var(--text-2)",
                  fontSize: 13,
                }}
              >
                아직 알림이 없어요.
              </div>
            ) : (
              items.slice(0, 8).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    background: item.read ? "transparent" : "var(--bg-2)",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      marginTop: 6,
                      flexShrink: 0,
                      borderRadius: 999,
                      background: item.read ? "transparent" : "var(--primary)",
                    }}
                  />

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: item.read ? 500 : 700,
                      }}
                    >
                      {item.title}
                    </div>

                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 12.5,
                        color: "var(--text-2)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.body}
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 11.5,
                        color: "var(--text-2)",
                      }}
                    >
                      {relativeTime(item.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <Link
            href="/me/notifications"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: 13,
              textAlign: "center",
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            모든 알림 보기
          </Link>
        </div>
      )}
    </div>
  );
}

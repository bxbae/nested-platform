"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  relativeTime,
  TYPE_COLOR,
  TYPE_LABEL,
  type ApiNotification,
} from "@/lib/api/notifications";
import {
  getNotificationCategory,
  type NotificationTab,
} from "@/lib/notification-tabs";
import { authStore } from "@/lib/api/auth-store";
import { SOCKET_URL } from "@/lib/api/config";

type BellTab = "ALL" | "RESERVATION" | "ROOM" | "OTHER";

const BELL_TABS: {
  key: BellTab;
  label: string;
}[] = [
  { key: "ALL", label: "전체" },
  { key: "RESERVATION", label: "예약" },
  { key: "ROOM", label: "숙소" },
  { key: "OTHER", label: "기타" },
];

function matchesBellTab(notification: ApiNotification, tab: BellTab): boolean {
  if (tab === "ALL") {
    return true;
  }

  const category = getNotificationCategory(notification);

  if (tab === "RESERVATION") {
    return category === "RESERVATION";
  }

  if (tab === "ROOM") {
    return category === "ROOM";
  }

  return category === "PAYMENT_REVIEW" || category === "OTHER";
}

export function NotificationBell() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [activeTab, setActiveTab] = useState<BellTab>("ALL");
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((item) => !item.read).length;

  const visibleItems = useMemo(
    () => items.filter((item) => matchesBellTab(item, activeTab)).slice(0, 8),
    [items, activeTab],
  );

  async function loadNotifications() {
    const result = await listNotifications();

    setItems(result.items);
    setLoading(false);
  }

  function getTabUnreadCount(tab: BellTab) {
    return items.filter((item) => !item.read && matchesBellTab(item, tab))
      .length;
  }

  useEffect(() => {
    void loadNotifications();

    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: (callback) => {
        callback({
          token: authStore.getAccessToken(),
        });
      },
      transports: ["websocket"],
    });

    function handleNewNotification(notification: ApiNotification) {
      setItems((prev) => [
        notification,
        ...prev.filter((item) => item.id !== notification.id),
      ]);
    }

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.disconnect();
    };
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

  function handleNotificationClick(notification: ApiNotification) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );

    if (!notification.read) {
      void markNotificationRead(notification.id).catch(() => {
        void loadNotifications();
      });
    }

    setOpen(false);

    if (notification.targetUrl) {
      router.push(notification.targetUrl);
    }
  }

  async function readAll() {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        read: true,
      })),
    );

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
        <img
          src="/icons/notification-icon.png"
          alt=""
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            objectFit: "contain",
            display: "block",
            flexShrink: 0,
          }}
        />

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
            width: 380,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: 520,
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
              padding: "14px 16px 10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>알림</strong>

              <div
                style={{
                  marginTop: 2,
                  fontSize: 11.5,
                  color: "var(--text-2)",
                }}
              >
                {unread > 0
                  ? `읽지 않은 알림 ${unread}개`
                  : "모든 알림을 확인했어요."}
              </div>
            </div>

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
              display: "flex",
              gap: 6,
              padding: "4px 12px 12px",
              borderBottom: "1px solid var(--border)",
              overflowX: "auto",
            }}
          >
            {BELL_TABS.map((tab) => {
              const tabUnread = getTabUnreadCount(tab.key);
              const active = activeTab === tab.key;

              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    border: active
                      ? "1px solid var(--primary)"
                      : "1px solid var(--border)",
                    background: active ? "var(--primary)" : "transparent",
                    color: active ? "#fff" : "var(--text-2)",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {tab.label}

                  {tabUnread > 0 && (
                    <span
                      style={{
                        minWidth: 17,
                        height: 17,
                        padding: "0 4px",
                        borderRadius: 99,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        background: active
                          ? "rgba(255,255,255,0.22)"
                          : "var(--primary)",
                        color: "#fff",
                      }}
                    >
                      {tabUnread > 99 ? "99+" : tabUnread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            style={{
              maxHeight: 350,
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
                불러오는 중...
              </div>
            ) : visibleItems.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "var(--text-2)",
                  fontSize: 13,
                }}
              >
                {items.length === 0
                  ? "아직 알림이 없어요."
                  : "이 분류에는 알림이 없어요."}
              </div>
            ) : (
              visibleItems.map((item) => {
                const color = TYPE_COLOR[item.type];

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      width: "100%",
                      padding: "13px 16px",
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
                        marginTop: 7,
                        flexShrink: 0,
                        borderRadius: 999,
                        background: item.read
                          ? "transparent"
                          : "var(--primary)",
                      }}
                    />

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            flexShrink: 0,
                            borderRadius: 999,
                            padding: "2px 6px",
                            background: `${color}18`,
                            color,
                            fontSize: 10.5,
                            fontWeight: 600,
                          }}
                        >
                          {TYPE_LABEL[item.type]}
                        </span>

                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 13.5,
                            fontWeight: item.read ? 500 : 700,
                          }}
                        >
                          {item.title}
                        </span>
                      </div>

                      <div
                        style={{
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
                );
              })
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
              borderTop: "1px solid var(--border)",
            }}
          >
            모든 알림 보기
          </Link>
        </div>
      )}
    </div>
  );
}

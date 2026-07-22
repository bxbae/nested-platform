"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  relativeTime,
  TYPE_LABEL,
  TYPE_COLOR,
  type ApiNotification,
} from "@/lib/api/notifications";
import {
  matchesNotificationTab,
  NOTIFICATION_TABS,
  type NotificationTab,
} from "@/lib/notification-tabs";

export default function Notifications() {
  const router = useRouter();

  const [items, setItems] = useState<ApiNotification[]>([]);
  const [activeTab, setActiveTab] = useState<NotificationTab>("ALL");
  const [loading, setLoading] = useState(true);

  const unread = items.filter((item) => !item.read).length;

  const visibleItems = useMemo(
    () => items.filter((item) => matchesNotificationTab(item, activeTab)),
    [items, activeTab],
  );

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function loadNotifications() {
    const result = await listNotifications();
    setItems(result.items);
    setLoading(false);
  }

  function getUnreadCount(tab: NotificationTab) {
    return items.filter(
      (item) => !item.read && matchesNotificationTab(item, tab),
    ).length;
  }

  function openNotification(notification: ApiNotification) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );

    if (!notification.read) {
      void markNotificationRead(notification.id);
    }

    if (notification.targetUrl) {
      router.push(notification.targetUrl);
    }
  }

  async function readAll() {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));

    try {
      await markAllNotificationsRead();
    } catch {
      // 다음 조회 때 서버 상태와 다시 동기화한다.
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>
            알림
          </h1>

          <p style={{ color: "var(--text-2)", marginTop: 4 }}>
            {loading
              ? "불러오는 중..."
              : unread > 0
                ? `읽지 않은 알림 ${unread}개`
                : "모든 알림을 확인했어요."}
          </p>
        </div>

        {unread > 0 && (
          <button
            type="button"
            className="btn btn-ghost press"
            onClick={readAll}
          >
            모두 읽음
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        {NOTIFICATION_TABS.map((tab) => {
          const tabUnread = getUnreadCount(tab.key);

          return (
            <button
              type="button"
              key={tab.key}
              className="chip press"
              data-active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              {tab.label}

              {tabUnread > 0 && (
                <span
                  style={{
                    minWidth: 19,
                    height: 19,
                    padding: "0 5px",
                    borderRadius: 99,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    background: "var(--primary)",
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

      {!loading && visibleItems.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--text-2)",
          }}
        >
          {items.length === 0
            ? "아직 알림이 없어요."
            : "이 분류에는 알림이 없어요."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {visibleItems.map((notification) => {
            const color = TYPE_COLOR[notification.type];

            return (
              <button
                type="button"
                key={notification.id}
                onClick={() => openNotification(notification)}
                className="card press"
                style={{
                  padding: 16,
                  textAlign: "left",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  background: !notification.read
                    ? "var(--bg-2)"
                    : "var(--surface, #fff)",
                }}
              >
                <span
                  className="chip"
                  style={{
                    fontSize: 11,
                    background: `${color}18`,
                    color,
                    border: "none",
                    flexShrink: 0,
                  }}
                >
                  {TYPE_LABEL[notification.type]}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <strong style={{ fontSize: 14.5 }}>
                      {notification.title}
                    </strong>

                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-2)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {relativeTime(notification.createdAt)}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 13.5,
                      color: "var(--text-2)",
                      marginTop: 3,
                    }}
                  >
                    {notification.body}
                  </div>
                </div>

                {!notification.read && (
                  <span
                    aria-label="읽지 않은 알림"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      background: "var(--primary)",
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

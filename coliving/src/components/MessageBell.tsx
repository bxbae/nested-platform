"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { authStore } from "@/lib/api/auth-store";
import { SOCKET_URL } from "@/lib/api/config";
import { useAuth } from "@/lib/api/useAuth";
import {
  getMessageUnreadCount,
  listChatRooms,
  listDirectConversations,
  markAllMessagesRead,
  type ApiChatRoom,
  type ApiDirectConversation,
} from "@/lib/api/messages";
import { relativeTime } from "@/lib/api/notifications";

type MessagePreviewItem = {
  key: string;
  href: string;
  name: string;
  context: string;
  preview: string;
  createdAt: string;
  unread: boolean;
  avatarColor: string;
  avatarUrl: string | null;
};

export function MessageBell() {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<MessagePreviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingAll, setReadingAll] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const [count, rooms, directs] = await Promise.all([
      getMessageUnreadCount(),
      listChatRooms(),
      listDirectConversations(),
    ]);

    const roomItems = rooms.map((room) => roomToPreview(room, user?.id));

    const directItems = directs.map((conversation) =>
      directToPreview(conversation, user?.id),
    );

    const combined = [...roomItems, ...directItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    setUnread(count.total);
    setItems(combined);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadMessages();

    const token = authStore.getAccessToken();

    const socket = io(`${SOCKET_URL}/messages`, {
      auth: {
        token: token ?? "",
      },
      transports: ["websocket"],
    });

    const handleChanged = () => {
      void loadMessages();
    };

    const handleFocus = () => {
      void loadMessages();
    };

    socket.on("messages:changed", handleChanged);

    window.addEventListener("messages:read", handleChanged);

    window.addEventListener("focus", handleFocus);

    return () => {
      socket.off("messages:changed", handleChanged);

      socket.disconnect();

      window.removeEventListener("messages:read", handleChanged);

      window.removeEventListener("focus", handleFocus);
    };
  }, [loadMessages]);

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

  function toggleOpen() {
    setOpen((previous) => {
      const next = !previous;

      if (next) {
        void loadMessages();
      }

      return next;
    });
  }

  async function readAllMessages() {
    if (readingAll || unread === 0) {
      return;
    }

    setReadingAll(true);

    const previousUnread = unread;
    const previousItems = items;

    setUnread(0);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        unread: false,
      })),
    );

    try {
      await markAllMessagesRead();

      window.dispatchEvent(new Event("messages:read"));
    } catch {
      setUnread(previousUnread);
      setItems(previousItems);
      await loadMessages();
    } finally {
      setReadingAll(false);
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
        onClick={toggleOpen}
        aria-label={`메시지 ${unread}개`}
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
          src="/icons/message-icon.png"
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
          aria-label="메시지 목록"
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
            <strong>메시지</strong>

            {unread > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    color: "var(--text-2)",
                    fontSize: 12.5,
                  }}
                >
                  안 읽음 {unread}개
                </span>

                <button
                  type="button"
                  onClick={() => void readAllMessages()}
                  disabled={readingAll}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--primary)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: readingAll ? "default" : "pointer",
                    padding: 0,
                    opacity: readingAll ? 0.55 : 1,
                  }}
                >
                  {readingAll ? "처리 중…" : "모두 읽음"}
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              maxHeight: 360,
              overflowY: "auto",
            }}
          >
            {loading ? (
              <EmptyState>불러오는 중…</EmptyState>
            ) : items.length === 0 ? (
              <EmptyState>아직 메시지가 없어요.</EmptyState>
            ) : (
              items.slice(0, 8).map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: item.unread ? "var(--bg-2)" : "transparent",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                  }}
                >
                  <Avatar
                    name={item.name}
                    color={item.avatarColor}
                    url={item.avatarUrl}
                  />

                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <strong
                        style={{
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 13.5,
                          fontWeight: item.unread ? 750 : 600,
                        }}
                      >
                        {item.name}
                      </strong>

                      <span
                        style={{
                          flexShrink: 0,
                          color: "var(--text-2)",
                          fontSize: 11,
                        }}
                      >
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 2,
                        color: "var(--text-2)",
                        fontSize: 11.5,
                      }}
                    >
                      {item.context}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: item.unread ? "var(--text)" : "var(--text-2)",
                        fontSize: 12.5,
                        fontWeight: item.unread ? 650 : 400,
                      }}
                    >
                      {item.preview}
                    </div>
                  </div>

                  {item.unread && (
                    <span
                      aria-label="안 읽은 메시지"
                      style={{
                        width: 8,
                        height: 8,
                        marginTop: 7,
                        flexShrink: 0,
                        borderRadius: 999,
                        background: "var(--primary)",
                      }}
                    />
                  )}
                </Link>
              ))
            )}
          </div>

          <Link
            href="/me/messages"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: 13,
              textAlign: "center",
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            모든 메시지 보기
          </Link>
        </div>
      )}
    </div>
  );
}

function roomToPreview(
  room: ApiChatRoom,
  currentUserId?: string,
): MessagePreviewItem {
  const last = room.messages?.[0];

  const other = room.hostId === currentUserId ? room.guest : room.host;

  const unread = Boolean(
    last &&
    last.senderId !== currentUserId &&
    !last.readBy.includes(currentUserId ?? ""),
  );

  return {
    key: `room:${room.id}`,
    href: `/me/messages?room=${encodeURIComponent(room.id)}`,
    name: other?.name ?? "상대방",
    context: room.room?.name ?? "숙소 관련 대화",
    preview: last?.imageUrl
      ? "📷 사진"
      : (last?.body ?? "아직 메시지가 없어요."),
    createdAt: last?.createdAt ?? room.createdAt,
    unread,
    avatarColor: other?.avatarColor ?? "var(--primary)",
    avatarUrl: other?.avatarUrl ?? null,
  };
}

function directToPreview(
  conversation: ApiDirectConversation,
  currentUserId?: string,
): MessagePreviewItem {
  const last = conversation.messages?.[0];

  const other = conversation.other;

  const unread = Boolean(
    last &&
    last.senderId !== currentUserId &&
    !last.readBy.includes(currentUserId ?? ""),
  );

  return {
    key: `direct:${conversation.id}`,
    href: `/me/messages?direct=${encodeURIComponent(conversation.id)}`,
    name: other?.name ?? "친구",
    context: "친구 메시지",
    preview: last?.imageUrl
      ? "📷 사진"
      : (last?.body ?? "아직 메시지가 없어요."),
    createdAt: last?.createdAt ?? conversation.updatedAt,
    unread,
    avatarColor: other?.avatarColor ?? "var(--primary)",
    avatarUrl: other?.avatarUrl ?? null,
  };
}

function Avatar({
  name,
  color,
  url,
}: {
  name: string;
  color: string;
  url: string | null;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name} 프로필`}
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: 38,
        height: 38,
        borderRadius: 999,
        background: color,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {name.charAt(0)}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 30,
        textAlign: "center",
        color: "var(--text-2)",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

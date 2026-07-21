"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/api/useAuth";
import {
  listChatRooms,
  listMessages,
  type ApiChatRoom,
  type ApiMessage,
} from "@/lib/api/messages";
import { uploadImage } from "@/lib/api/storage";
import { createChatSocket } from "@/lib/api/socket";
import type { Socket } from "socket.io-client";

// Inbox: conversation list on the left, thread on the right. Threads are
// created from a listing page ("호스트에게 문의"), so an empty state here just
// means the user hasn't started one yet.
export default function Messages() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ApiChatRoom[]>([]);
  const [active, setActive] = useState<ApiChatRoom | null>(null);
  const [msgs, setMsgs] = useState<ApiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageBottomRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    (async () => {
      const list = await listChatRooms();
      setRooms(list);
      // If we arrived with ?room=<id> (e.g. host just started a chat), open it.
      const wanted =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("room")
          : null;
      const initial =
        (wanted && list.find((r) => r.id === wanted)) || list[0] || null;
      setActive(initial);
      setLoading(false);
    })();
  }, []);

  const loadThread = useCallback(async (chatRoomId: string) => {
    setMsgs(await listMessages(chatRoomId));
  }, []);

  useEffect(() => {
    if (active) {
      void loadThread(active.id);
    }
  }, [active, loadThread]);

  // 채팅방이 바뀌면 가장 아래로 이동
  useEffect(() => {
    shouldStickToBottomRef.current = true;

    const frame = window.requestAnimationFrame(() => {
      messageBottomRef.current?.scrollIntoView({
        block: "end",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [active?.id]);

  // 새 메시지가 추가됐을 때 맨 아래를 보고 있다면 자동 이동
  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      messageBottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [msgs]);

  // 채팅 소켓 연결
  useEffect(() => {
    if (!active) {
      return;
    }

    const roomId = active.id;
    const socket = createChatSocket(roomId);

    socketRef.current = socket;

    function markMessagesAsRead() {
      socket.emit("message:read", {
        roomId,
      });
    }

    function handleChatReady(data: { roomId: string }) {
      if (data.roomId !== roomId) {
        return;
      }

      markMessagesAsRead();
    }

    function handleNewMessage(message: ApiMessage) {
      setMsgs((prev) => {
        if (prev.some((item) => item.id === message.id)) {
          return prev;
        }

        return [...prev, message];
      });

      markMessagesAsRead();
    }

    function handleMessageRead(data: {
      roomId: string;
      userId: string;
      updatedCount: number;
    }) {
      if (data.roomId !== roomId) {
        return;
      }

      setMsgs((prev) =>
        prev.map((message) => {
          const readBy = message.readBy ?? [];

          if (message.senderId === data.userId) {
            return message;
          }

          if (readBy.includes(data.userId)) {
            return message;
          }

          return {
            ...message,
            readBy: [...readBy, data.userId],
          };
        }),
      );
    }

    socket.on("chat:ready", handleChatReady);
    socket.on("message:new", handleNewMessage);
    socket.on("message:read", handleMessageRead);

    return () => {
      socket.off("chat:ready", handleChatReady);
      socket.off("message:new", handleNewMessage);
      socket.off("message:read", handleMessageRead);
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [active]);

  function send() {
    const body = draft.trim();
    const socket = socketRef.current;

    if (!body || !active || sending) {
      return;
    }

    shouldStickToBottomRef.current = true;

    if (!socket?.connected) {
      setError("채팅 서버에 연결되지 않았어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    setSending(true);
    setError(null);

    socket.timeout(5000).emit(
      "message:send",
      {
        roomId: active.id,
        body,
      },
      (socketError: Error | null, created?: ApiMessage) => {
        setSending(false);

        if (socketError || !created) {
          setError("메시지를 보내지 못했어요.");
          return;
        }

        setDraft("");

        setMsgs((prev) => {
          if (prev.some((message) => message.id === created.id)) {
            return prev;
          }

          return [...prev, created];
        });
      },
    );
  }

  async function onPickImage(files: FileList | null) {
    const file = files?.[0];
    const socket = socketRef.current;

    if (!file || !active || uploading) {
      return;
    }

    shouldStickToBottomRef.current = true;

    if (!socket?.connected) {
      setError("채팅 서버에 연결되지 않았어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const url = await uploadImage(file, "chat");

      const created = await new Promise<ApiMessage>((resolve, reject) => {
        socket.timeout(5000).emit(
          "message:send",
          {
            roomId: active.id,
            imageUrl: url,
          },
          (socketError: Error | null, message?: ApiMessage) => {
            if (socketError || !message) {
              reject(socketError ?? new Error("메시지 응답이 없습니다."));
              return;
            }

            resolve(message);
          },
        );
      });

      setMsgs((prev) => {
        if (prev.some((message) => message.id === created.id)) {
          return prev;
        }

        return [...prev, created];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 보내지 못했어요.");
    } finally {
      setUploading(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>
          메시지
        </h1>
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>
          메시지
        </h1>
        <div
          className="card"
          style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}
        >
          아직 대화가 없어요.
          <div style={{ fontSize: 13.5, marginTop: 8 }}>
            숙소 상세 페이지에서 “호스트에게 문의”를 눌러 대화를 시작해보세요.
          </div>
        </div>
      </div>
    );
  }

  function handleMessageScroll() {
    const element = messageListRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    shouldStickToBottomRef.current = distanceFromBottom < 100;
  }

  const counterpart = active
    ? active.hostId === user?.id
      ? active.guest
      : active.host
    : null;

  const counterpartName =
    counterpart?.name ?? (active?.hostId === user?.id ? "게스트" : "호스트");

  const counterpartColor = counterpart?.avatarColor ?? "var(--primary)";

  const counterpartAvatarUrl = counterpart?.avatarUrl ?? null;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>
        메시지
      </h1>

      <div className="inquiry-split">
        {/* conversation list */}
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          {rooms.map((r) => {
            const last = r.messages?.[0];
            const title = r.room?.name ?? "숙소";
            return (
              <button
                key={r.id}
                onClick={() => setActive(r)}
                className="card press"
                style={{
                  padding: 14,
                  textAlign: "left",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  border:
                    active?.id === r.id
                      ? "1.5px solid var(--text)"
                      : "1px solid var(--border)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 99,
                    flexShrink: 0,
                    background: "var(--primary)",
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {title[0]}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{title}</strong>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {r.hostId === user?.id
                      ? "게스트와의 대화"
                      : "호스트와의 대화"}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-2)",
                      marginTop: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {last?.imageUrl
                      ? "📷 사진"
                      : (last?.body ?? "아직 메시지가 없어요")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* thread */}
        {active && (
          <div
            className="card"
            style={{
              padding: 0,
              display: "flex",
              flexDirection: "column",
              height: "min(72vh, 720px)",
              minHeight: 520,
              overflow: "hidden",
            }}
          >
            {/* 상단 상대방 정보 */}
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                background: "#fff",
              }}
            >
              {counterpartAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={counterpartAvatarUrl}
                  alt={`${counterpartName} 프로필`}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    flexShrink: 0,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  aria-hidden="true"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: counterpartColor,
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {counterpartName.charAt(0)}
                </div>
              )}

              <div style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: 16,
                  }}
                >
                  {counterpartName}
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 12.5,
                    color: "var(--text-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {active.room?.name ?? "숙소"}
                </span>
              </div>
            </div>

            {/* 메시지 스크롤 영역 */}
            <div
              ref={messageListRef}
              onScroll={handleMessageScroll}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "18px 18px 24px",
                background: "var(--bg-2)",
              }}
            >
              {msgs.length === 0 && (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--text-2)",
                    fontSize: 14,
                  }}
                >
                  첫 메시지를 보내보세요.
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gap: 9,
                  alignContent: "start",
                }}
              >
                {msgs.map((m, index) => {
                  const mine = m.senderId === user?.id;
                  const previous = msgs[index - 1];

                  const showDate =
                    !previous ||
                    dateKey(previous.createdAt) !== dateKey(m.createdAt);

                  const samePreviousSender =
                    !showDate && previous?.senderId === m.senderId;

                  const showAvatar = !mine && !samePreviousSender;

                  const otherUserId =
                    active.hostId === user?.id ? active.guestId : active.hostId;

                  const isRead = mine && (m.readBy ?? []).includes(otherUserId);

                  return (
                    <Fragment key={m.id}>
                      {/* 날짜 구분선 */}
                      {showDate && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            margin: index === 0 ? "2px 0 12px" : "18px 0 12px",
                          }}
                        >
                          <span
                            style={{
                              padding: "6px 11px",
                              borderRadius: 999,
                              background: "rgba(0, 0, 0, 0.07)",
                              color: "var(--text-2)",
                              fontSize: 11.5,
                            }}
                          >
                            {formatDateLabel(m.createdAt)}
                          </span>
                        </div>
                      )}

                      {/* 메시지 한 줄 */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: mine ? "flex-end" : "flex-start",
                          alignItems: "flex-end",
                          gap: 7,
                        }}
                      >
                        {/* 상대방 프로필 */}
                        {!mine && (
                          <div
                            style={{
                              width: 34,
                              flexShrink: 0,
                            }}
                          >
                            {showAvatar &&
                              (counterpartAvatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={counterpartAvatarUrl}
                                  alt={`${counterpartName} 프로필`}
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 999,
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <div
                                  aria-hidden="true"
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 999,
                                    display: "grid",
                                    placeItems: "center",
                                    background: counterpartColor,
                                    color: "#fff",
                                    fontSize: 13,
                                    fontWeight: 700,
                                  }}
                                >
                                  {counterpartName.charAt(0)}
                                </div>
                              ))}
                          </div>
                        )}

                        {/* 내 메시지의 안 읽음 표시와 시간 */}
                        {mine && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              justifyContent: "flex-end",
                              gap: 1,
                              marginBottom: 2,
                              color: "var(--text-2)",
                              fontSize: 10.5,
                              lineHeight: 1.2,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {!isRead && (
                              <span
                                aria-label="안 읽음"
                                title="안 읽음"
                                style={{
                                  color: "var(--primary)",
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                1
                              </span>
                            )}

                            <span>{formatMessageTime(m.createdAt)}</span>
                          </div>
                        )}

                        {/* 말풍선 */}
                        <div
                          style={{
                            minWidth: 0,
                            maxWidth: "min(72%, 420px)",
                          }}
                        >
                          {!mine && showAvatar && (
                            <div
                              style={{
                                margin: "0 0 5px 3px",
                                color: "var(--text-2)",
                                fontSize: 11.5,
                              }}
                            >
                              {counterpartName}
                            </div>
                          )}

                          <div
                            style={{
                              background: mine ? "var(--primary)" : "#fff",
                              color: mine ? "#fff" : "var(--text)",
                              padding: m.imageUrl ? 4 : "10px 13px",
                              borderRadius: mine
                                ? "16px 16px 4px 16px"
                                : "16px 16px 16px 4px",
                              border: mine ? "none" : "1px solid var(--border)",
                              fontSize: 14,
                              lineHeight: 1.45,
                              wordBreak: "break-word",
                            }}
                          >
                            {m.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.imageUrl}
                                alt="전송된 사진"
                                style={{
                                  width: "auto",
                                  maxWidth: 240,
                                  maxHeight: 280,
                                  borderRadius: 12,
                                  display: "block",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              m.body
                            )}
                          </div>
                        </div>

                        {/* 상대방 메시지 시간 */}
                        {!mine && (
                          <span
                            style={{
                              marginBottom: 2,
                              color: "var(--text-2)",
                              fontSize: 10.5,
                              lineHeight: 1.2,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatMessageTime(m.createdAt)}
                          </span>
                        )}
                      </div>
                    </Fragment>
                  );
                })}

                {/* 자동 스크롤 기준점 */}
                <div ref={messageBottomRef} />
              </div>
            </div>

            {/* 하단 고정 입력창 */}
            <div
              style={{
                flexShrink: 0,
                padding: "12px 14px",
                borderTop: "1px solid var(--border)",
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="press"
                  aria-label="이미지 전송"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    fontSize: 17,
                    background: "var(--bg-2)",
                    flexShrink: 0,
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  {uploading ? "…" : "🖼️"}
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => onPickImage(event.target.files)}
                />

                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder="메시지를 입력하세요"
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                />

                <button
                  className="btn btn-primary press"
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  style={{
                    flexShrink: 0,
                  }}
                >
                  {sending ? "전송 중…" : "보내기"}
                </button>
              </div>

              {error && (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--primary)",
                    margin: "8px 0 0",
                  }}
                >
                  {error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function dateKey(iso: string): string {
  const date = new Date(iso);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}

function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

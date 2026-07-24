"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Socket } from "socket.io-client";
import { useAuth } from "@/lib/api/useAuth";
import {
  listChatRooms,
  listMessages,
  listDirectConversations,
  listDirectMessages,
  sendDirectMessage,
  markDirectConversationRead,
  type ApiChatRoom,
  type ApiMessage,
  type ApiDirectConversation,
  type ApiDirectMessage,
} from "@/lib/api/messages";
import { uploadImage } from "@/lib/api/storage";
import { createChatSocket } from "@/lib/api/socket";
import { reportMessage } from "@/lib/api/reports";

type Conversation =
  | { kind: "room"; id: string; raw: ApiChatRoom }
  | { kind: "direct"; id: string; raw: ApiDirectConversation };

type UnifiedMessage = {
  id: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  readBy?: string[];
  createdAt: string;
};

export default function MessagesPage() {
  const { user } = useAuth();
  const [roomChats, setRoomChats] = useState<ApiChatRoom[]>([]);
  const [directChats, setDirectChats] = useState<ApiDirectConversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 전송 전 미리보기: 파일을 고르면 바로 업로드하지 않고 여기 담아뒀다가
  // 사용자가 확인 후 "보내기"를 눌러야 실제로 업로드+전송한다.
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const pendingImageRef = useRef<{ file: File; previewUrl: string } | null>(null);
  // 신고 팝업 상태
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageBottomRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => setPortalMounted(true), []);

  // 언마운트 시 남아있는 미리보기 objectURL을 정리한다.
  useEffect(() => {
    return () => {
      if (pendingImageRef.current) URL.revokeObjectURL(pendingImageRef.current.previewUrl);
    };
  }, []);

  const conversations = useMemo<Conversation[]>(
    () => [
      ...directChats.map((raw) => ({
        kind: "direct" as const,
        id: raw.id,
        raw,
      })),
      ...roomChats.map((raw) => ({ kind: "room" as const, id: raw.id, raw })),
    ],
    [directChats, roomChats],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rooms, directs] = await Promise.all([
          listChatRooms(),
          listDirectConversations(),
        ]);
        if (!alive) return;
        setRoomChats(rooms);
        setDirectChats(directs);

        const params = new URLSearchParams(window.location.search);
        const wantedRoom = params.get("room");
        const wantedDirect = params.get("direct");
        const all: Conversation[] = [
          ...directs.map((raw) => ({
            kind: "direct" as const,
            id: raw.id,
            raw,
          })),
          ...rooms.map((raw) => ({ kind: "room" as const, id: raw.id, raw })),
        ];

        setActive(
          all.find((item) =>
            item.kind === "direct"
              ? item.id === wantedDirect
              : item.id === wantedRoom,
          ) ??
            all[0] ??
            null,
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const loadActiveThread = useCallback(async (conversation: Conversation) => {
    const result =
      conversation.kind === "direct"
        ? await listDirectMessages(conversation.id)
        : await listMessages(conversation.id);
    setMessages(result as UnifiedMessage[]);

    if (conversation.kind === "direct") {
      await markDirectConversationRead(conversation.id);
      window.dispatchEvent(new Event("messages:read"));
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setMessages([]);
      return;
    }

    void loadActiveThread(active);

    if (active.kind !== "direct") return;
    const timer = window.setInterval(() => void loadActiveThread(active), 3000);
    return () => window.clearInterval(timer);
  }, [active, loadActiveThread]);

  useEffect(() => {
    if (!active || active.kind !== "room") return;

    const roomId = active.id;
    const socket = createChatSocket(roomId);
    socketRef.current = socket;

    const markMessagesAsRead = () => socket.emit("message:read", { roomId });
    const handleReady = (data: { roomId: string }) => {
      if (data.roomId === roomId) markMessagesAsRead();
    };
    const handleNew = (message: ApiMessage) => {
      setMessages((prev) =>
        prev.some((item) => item.id === message.id) ? prev : [...prev, message],
      );
      markMessagesAsRead();
    };
    const handleRead = (data: { roomId: string; userId: string }) => {
      if (data.roomId !== roomId) return;
      setMessages((prev) =>
        prev.map((message) => {
          if (message.senderId === data.userId) return message;
          const readBy = message.readBy ?? [];
          return readBy.includes(data.userId)
            ? message
            : { ...message, readBy: [...readBy, data.userId] };
        }),
      );
      window.dispatchEvent(new Event("messages:read"));
    };

    socket.on("chat:ready", handleReady);
    socket.on("message:new", handleNew);
    socket.on("message:read", handleRead);

    return () => {
      socket.off("chat:ready", handleReady);
      socket.off("message:new", handleNew);
      socket.off("message:read", handleRead);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      messageBottomRef.current?.scrollIntoView({ block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active?.id]);

  // 대화방을 바꾸면 이전 방에서 고르던 사진 미리보기는 버린다.
  useEffect(() => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, [active?.id]);

  useEffect(() => {
    pendingImageRef.current = pendingImage;
  }, [pendingImage]);


  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      messageBottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  async function submit(body?: string, imageUrl?: string) {
    if (!active || sending || (!body?.trim() && !imageUrl)) return false;
    setSending(true);
    setError(null);
    shouldStickToBottomRef.current = true;

    try {
      if (active.kind === "direct") {
        const created = await sendDirectMessage(
          active.id,
          body?.trim(),
          imageUrl,
        );
        setMessages((prev) =>
          prev.some((item) => item.id === created.id)
            ? prev
            : [...prev, created],
        );
        setDraft("");
        return true;
      }

      const socket = socketRef.current;
      if (!socket?.connected) {
        throw new Error(
          "채팅 서버에 연결되지 않았어요. 잠시 후 다시 시도해주세요.",
        );
      }

      const created = await new Promise<ApiMessage>((resolve, reject) => {
        socket
          .timeout(5000)
          .emit(
            "message:send",
            { roomId: active.id, body: body?.trim(), imageUrl },
            (socketError: Error | null, message?: ApiMessage) => {
              if (socketError || !message) {
                reject(socketError ?? new Error("메시지를 보내지 못했어요."));
                return;
              }
              resolve(message);
            },
          );
      });

      setMessages((prev) =>
        prev.some((item) => item.id === created.id) ? prev : [...prev, created],
      );
      setDraft("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "메시지를 보내지 못했습니다.");
      return false;
    } finally {
      setSending(false);
    }
  }

  // 파일을 고르면 미리보기만 준비하고, 실제 업로드는 하지 않는다.
  function onPickImage(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  }

  // 미리보기에서 X를 눌러 전송을 취소한다.
  function cancelPendingImage() {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  // 미리보기 중인 사진을 실제로 업로드하고, 입력 중인 텍스트가 있으면
  // 캡션으로 함께 보낸다. 전송에 성공했을 때만 미리보기를 지운다.
  async function sendPendingImage() {
    if (!pendingImage || uploading || sending) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(pendingImage.file, "chat");
      const ok = await submit(draft.trim() || undefined, url);
      if (ok) {
        URL.revokeObjectURL(pendingImage.previewUrl);
        setPendingImage(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "이미지를 보내지 못했습니다.",
      );
    } finally {
      setUploading(false);
    }
  }

  // 입력창의 "보내기"/Enter는 대기 중인 사진이 있으면 사진(+캡션)을,
  // 없으면 기존처럼 텍스트만 보낸다.
  async function handleSend() {
    if (pendingImage) {
      await sendPendingImage();
      return;
    }
    await submit(draft);
  }

  function handleMessageScroll() {
    const element = messageListRef.current;
    if (!element) return;
    shouldStickToBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 100;
  }

  // 상대방 메시지 옆 "신고" 버튼 → 팝업 열기
  function openReportModal(messageId: string) {
    setReportTargetId(messageId);
    setReportReason("");
    setReportError(null);
    setReportDone(false);
  }

  function closeReportModal() {
    if (reportSubmitting) return;
    setReportTargetId(null);
  }

  // 신고 접수: 백엔드가 Report(targetType=MESSAGE)로 저장하고,
  // 관리자는 /admin/reports 화면에서 그대로 조회/처리한다.
  async function submitReport() {
    if (!reportTargetId || reportSubmitting) return;
    if (!reportReason.trim()) {
      setReportError("신고 사유를 입력해주세요.");
      return;
    }
    setReportSubmitting(true);
    setReportError(null);
    try {
      await reportMessage(reportTargetId, reportReason.trim());
      setReportDone(true);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : "신고 접수에 실패했습니다.");
    } finally {
      setReportSubmitting(false);
    }
  }

  if (loading) {
    return <p style={{ color: "var(--text-2)" }}>메시지를 불러오는 중…</p>;
  }

  const counterpart = getCounterpart(active, user?.id);
  const counterpartName = counterpart.name;
  const counterpartColor = counterpart.avatarColor ?? "var(--primary)";
  const counterpartAvatarUrl = counterpart.avatarUrl;
  const otherUserId = counterpart.id;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>
        메시지
      </h1>

      {conversations.length === 0 ? (
        <div
          className="card"
          style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}
        >
          아직 대화가 없어요.
        </div>
      ) : (
        <div className="inquiry-split">
          <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
            {conversations.map((conversation) => {
              const meta = getConversationMeta(conversation, user?.id);
              return (
                <button
                  key={`${conversation.kind}:${conversation.id}`}
                  onClick={() => setActive(conversation)}
                  className="card press"
                  style={{
                    padding: 14,
                    textAlign: "left",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    border:
                      active?.id === conversation.id &&
                      active.kind === conversation.kind
                        ? "1.5px solid var(--text)"
                        : "1px solid var(--border)",
                  }}
                >
                  <Avatar
                    name={meta.name}
                    color={meta.color}
                    url={meta.avatarUrl}
                    size={40}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ fontSize: 14 }}>{meta.name}</strong>
                    <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {conversation.kind === "direct"
                        ? "친구 메시지"
                        : meta.context}
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
                      {meta.preview}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

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
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <Avatar
                  name={counterpartName}
                  color={counterpartColor}
                  url={counterpartAvatarUrl}
                  size={42}
                />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 16 }}>
                    {counterpartName}
                  </strong>
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: 12.5,
                      color: "var(--text-2)",
                    }}
                  >
                    {active.kind === "direct"
                      ? "친구와의 대화"
                      : (active.raw.room?.name ?? "숙소 관련 대화")}
                  </span>
                </div>
              </div>

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
                {messages.length === 0 && (
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

                <div style={{ display: "grid", gap: 9, alignContent: "start" }}>
                  {messages.map((message, index) => {
                    const mine = message.senderId === user?.id;
                    const previous = messages[index - 1];
                    const showDate =
                      !previous ||
                      dateKey(previous.createdAt) !==
                        dateKey(message.createdAt);
                    const samePreviousSender =
                      !showDate && previous?.senderId === message.senderId;
                    const showAvatar = !mine && !samePreviousSender;
                    const isRead =
                      mine &&
                      Boolean(
                        otherUserId &&
                        (message.readBy ?? []).includes(otherUserId),
                      );

                    return (
                      <Fragment key={message.id}>
                        {showDate && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              margin:
                                index === 0 ? "2px 0 12px" : "18px 0 12px",
                            }}
                          >
                            <span
                              style={{
                                padding: "6px 11px",
                                borderRadius: 999,
                                background: "rgba(0,0,0,.07)",
                                color: "var(--text-2)",
                                fontSize: 11.5,
                              }}
                            >
                              {formatDateLabel(message.createdAt)}
                            </span>
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            justifyContent: mine ? "flex-end" : "flex-start",
                            alignItems: "flex-end",
                            gap: 7,
                          }}
                        >
                          {!mine && (
                            <div style={{ width: 34, flexShrink: 0 }}>
                              {showAvatar && (
                                <Avatar
                                  name={counterpartName}
                                  color={counterpartColor}
                                  url={counterpartAvatarUrl}
                                  size={34}
                                />
                              )}
                            </div>
                          )}

                          {mine && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                marginBottom: 2,
                                color: "var(--text-2)",
                                fontSize: 10.5,
                              }}
                            >
                              {!isRead && (
                                <span
                                  style={{
                                    color: "var(--primary)",
                                    fontWeight: 800,
                                  }}
                                >
                                  1
                                </span>
                              )}
                              <span>
                                {formatMessageTime(message.createdAt)}
                              </span>
                            </div>
                          )}

                          <div
                            style={{ minWidth: 0, maxWidth: "min(72%, 420px)" }}
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
                                background: mine ? "var(--primary)" : "var(--surface)",
                                color: mine ? "#fff" : "var(--text)",
                                padding: message.imageUrl ? 4 : "10px 13px",
                                borderRadius: mine
                                  ? "16px 16px 4px 16px"
                                  : "16px 16px 16px 4px",
                                border: mine
                                  ? "none"
                                  : "1px solid var(--border)",
                                fontSize: 14,
                                lineHeight: 1.45,
                                wordBreak: "break-word",
                              }}
                            >
                              {message.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={message.imageUrl}
                                  alt="전송된 사진"
                                  style={{
                                    maxWidth: 240,
                                    maxHeight: 280,
                                    borderRadius: 12,
                                    display: "block",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                message.body
                              )}
                            </div>
                          </div>

                          {!mine && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, marginBottom: 2 }}>
                              <span style={{ color: "var(--text-2)", fontSize: 10.5 }}>{formatMessageTime(message.createdAt)}</span>
                              <button
                                type="button"
                                aria-label="메시지 신고"
                                title="신고"
                                onClick={() => openReportModal(message.id)}
                                style={{
                                  border: "none",
                                  background: "none",
                                  padding: 0,
                                  color: "var(--text-2)",
                                  fontSize: 10.5,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  textUnderlineOffset: 2,
                                }}
                              >
                                신고
                              </button>
                            </div>
                          )}
                        </div>
                      </Fragment>
                    );
                  })}
                  <div ref={messageBottomRef} />
                </div>
              </div>

              <div style={{ flexShrink: 0, padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                {pendingImage && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 10px" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pendingImage.previewUrl}
                        alt="보낼 사진 미리보기"
                        style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "1px solid var(--border)", display: "block" }}
                      />
                      <button
                        type="button"
                        aria-label="사진 취소"
                        onClick={cancelPendingImage}
                        disabled={uploading}
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          fontSize: 11,
                          lineHeight: "20px",
                          textAlign: "center",
                          border: "none",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                      {uploading ? "전송 중…" : "사진을 확인하고 보내기를 눌러주세요."}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" className="press" aria-label="이미지 전송" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: 38, height: 38, borderRadius: 999, background: "var(--bg-2)" }}>
                    🖼
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => onPickImage(event.target.files)} />
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={pendingImage ? "사진과 함께 보낼 메시지 (선택)" : "메시지를 입력하세요"}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button className="btn btn-primary press" onClick={() => void handleSend()} disabled={(!draft.trim() && !pendingImage) || sending || uploading}>
                    {sending || uploading ? "전송 중…" : "보내기"}
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
      )}

      {portalMounted &&
        reportTargetId &&
        createPortal(
          <ReportMessageModal
            reason={reportReason}
            onReasonChange={setReportReason}
            submitting={reportSubmitting}
            error={reportError}
            done={reportDone}
            onCancel={closeReportModal}
            onSubmit={() => void submitReport()}
          />,
          document.body,
        )}
    </div>
  );
}

// 메시지 신고 팝업. 접수되면 Report(targetType=MESSAGE)로 저장되고,
// 관리자는 /admin/reports 화면에서 그대로 조회·처리한다.
function ReportMessageModal({
  reason,
  onReasonChange,
  submitting,
  error,
  done,
  onCancel,
  onSubmit,
}: {
  reason: string;
  onReasonChange: (value: string) => void;
  submitting: boolean;
  error: string | null;
  done: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--surface, #fff)",
          border: "1px solid var(--border, #ebebeb)",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {done ? (
          <>
            <strong style={{ display: "block", fontSize: 16, marginBottom: 8 }}>신고가 접수됐어요</strong>
            <p style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 20 }}>
              운영팀이 확인 후 처리할게요. 신고해주셔서 감사합니다.
            </p>
            <button className="btn btn-primary press" onClick={onCancel} style={{ width: "100%" }}>
              확인
            </button>
          </>
        ) : (
          <>
            <strong style={{ display: "block", fontSize: 16, marginBottom: 4 }}>메시지 신고</strong>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14 }}>
              신고 사유를 알려주시면 운영팀이 확인 후 조치할게요.
            </p>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="예: 스팸/광고, 욕설·비방, 사기 의심 등"
              rows={4}
              style={{
                width: "100%",
                resize: "vertical",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 14,
                fontFamily: "inherit",
              }}
            />
            {error && <p style={{ fontSize: 12.5, color: "var(--primary)", marginTop: 8 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-ghost press"
                onClick={onCancel}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary press"
                onClick={onSubmit}
                disabled={submitting || !reason.trim()}
                style={{ flex: 1 }}
              >
                {submitting ? "접수 중…" : "신고하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getCounterpart(active: Conversation | null, currentUserId?: string) {
  if (!active)
    return {
      id: "",
      name: "상대방",
      avatarColor: null as string | null,
      avatarUrl: null as string | null,
    };
  if (active.kind === "direct") {
    return {
      id: active.raw.other?.id ?? "",
      name: active.raw.other?.name ?? "친구",
      avatarColor: active.raw.other?.avatarColor ?? null,
      avatarUrl: active.raw.other?.avatarUrl ?? null,
    };
  }
  const other =
    active.raw.hostId === currentUserId ? active.raw.guest : active.raw.host;
  return {
    id:
      other?.id ??
      (active.raw.hostId === currentUserId
        ? active.raw.guestId
        : active.raw.hostId),
    name:
      other?.name ??
      (active.raw.hostId === currentUserId ? "게스트" : "호스트"),
    avatarColor: other?.avatarColor ?? null,
    avatarUrl: other?.avatarUrl ?? null,
  };
}

function getConversationMeta(
  conversation: Conversation,
  currentUserId?: string,
) {
  const counterpart = getCounterpart(conversation, currentUserId);
  const last = conversation.raw.messages?.[0] as
    | ApiMessage
    | ApiDirectMessage
    | undefined;
  return {
    name:
      conversation.kind === "direct"
        ? counterpart.name
        : (conversation.raw.room?.name ?? "숙소"),
    context: conversation.kind === "direct" ? "친구 메시지" : counterpart.name,
    preview: last?.imageUrl
      ? "📷 사진"
      : (last?.body ?? "아직 메시지가 없어요"),
    color: counterpart.avatarColor ?? "var(--primary)",
    avatarUrl: counterpart.avatarUrl,
  };
}

function Avatar({
  name,
  color,
  url,
  size,
}: {
  name: string;
  color: string;
  url: string | null;
  size: number;
}) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${name} 프로필`}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        objectFit: "cover",
      }}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        background: color,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontWeight: 700,
      }}
    >
      {name.charAt(0)}
    </span>
  );
}

function dateKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDateLabel(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}

function formatMessageTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/api/useAuth";
import {
  listChatRooms,
  listMessages,
  sendMessage,
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

type Conversation =
  | { kind: "room"; id: string; title: string; subtitle: string; raw: ApiChatRoom }
  | { kind: "direct"; id: string; title: string; subtitle: string; raw: ApiDirectConversation };

type UnifiedMessage = {
  id: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
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
  const fileRef = useRef<HTMLInputElement>(null);

  const conversations = useMemo<Conversation[]>(() => {
    const rooms: Conversation[] = roomChats.map((room) => ({
      kind: "room",
      id: room.id,
      title: room.room?.name ?? "숙소 문의",
      subtitle: room.messages?.[0]?.body ?? "대화를 시작해보세요.",
      raw: room,
    }));
    const directs: Conversation[] = directChats.map((conversation) => ({
      kind: "direct",
      id: conversation.id,
      title: conversation.other?.name ?? "친구",
      subtitle: conversation.messages?.[0]?.body ?? "대화를 시작해보세요.",
      raw: conversation,
    }));
    return [...directs, ...rooms];
  }, [roomChats, directChats]);

  useEffect(() => {
    let alive = true;
    (async () => {
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
        ...directs.map((conversation) => ({
          kind: "direct" as const,
          id: conversation.id,
          title: conversation.other?.name ?? "친구",
          subtitle: conversation.messages?.[0]?.body ?? "대화를 시작해보세요.",
          raw: conversation,
        })),
        ...rooms.map((room) => ({
          kind: "room" as const,
          id: room.id,
          title: room.room?.name ?? "숙소 문의",
          subtitle: room.messages?.[0]?.body ?? "대화를 시작해보세요.",
          raw: room,
        })),
      ];
      setActive(
        all.find((item) =>
          item.kind === "direct"
            ? item.id === wantedDirect
            : item.id === wantedRoom,
        ) ?? all[0] ?? null,
      );
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!active) {
      setMessages([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const result =
        active.kind === "direct"
          ? await listDirectMessages(active.id)
          : await listMessages(active.id);
      if (!alive) return;
      setMessages(result as UnifiedMessage[]);
      if (active.kind === "direct") {
        await markDirectConversationRead(active.id);
        window.dispatchEvent(new Event("messages:read"));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [active]);

  async function submit(body?: string, imageUrl?: string) {
    if (!active || sending) return;
    if (!body?.trim() && !imageUrl) return;
    setSending(true);
    setError(null);
    try {
      const created =
        active.kind === "direct"
          ? await sendDirectMessage(active.id, body?.trim(), imageUrl)
          : await sendMessage(active.id, body?.trim(), imageUrl);
      setMessages((prev) =>
        prev.some((message) => message.id === created.id)
          ? prev
          : [...prev, created as UnifiedMessage],
      );
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "메시지를 보내지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function onPickImage(files: FileList | null) {
    const file = files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "chat");
      await submit(undefined, url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지를 보내지 못했습니다.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) return <p>메시지를 불러오는 중…</p>;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>메시지</h1>
      {conversations.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          아직 대화가 없습니다.
        </div>
      ) : (
        <div className="inquiry-split">
          <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
            {conversations.map((conversation) => (
              <button
                key={`${conversation.kind}:${conversation.id}`}
                className="card press"
                onClick={() => setActive(conversation)}
                style={{
                  padding: 14,
                  textAlign: "left",
                  border:
                    active?.id === conversation.id && active.kind === conversation.kind
                      ? "2px solid var(--primary)"
                      : "1px solid var(--border)",
                }}
              >
                <strong>{conversation.title}</strong>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
                  {conversation.kind === "direct" ? "친구 메시지" : "숙소 문의"}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conversation.subtitle}
                </div>
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 20, minHeight: 520, display: "flex", flexDirection: "column" }}>
            <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <strong>{active?.title}</strong>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>
                {active?.kind === "direct" ? "친구와의 대화" : "숙소 관련 대화"}
              </div>
            </div>

            <div style={{ flex: 1, display: "grid", gap: 10, alignContent: "start", padding: "16px 0" }}>
              {messages.length === 0 && <p style={{ color: "var(--text-2)" }}>첫 메시지를 보내보세요.</p>}
              {messages.map((message) => {
                const mine = message.senderId === user?.id;
                return (
                  <div
                    key={message.id}
                    style={{
                      justifySelf: mine ? "end" : "start",
                      maxWidth: "80%",
                      background: mine ? "var(--primary)" : "var(--bg-2)",
                      color: mine ? "#fff" : "var(--text)",
                      padding: message.imageUrl ? 4 : "10px 14px",
                      borderRadius: "var(--r-md)",
                    }}
                  >
                    {message.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={message.imageUrl} alt="전송된 이미지" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10, display: "block" }} />
                    ) : (
                      message.body
                    )}
                    <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3, textAlign: mine ? "right" : "left" }}>
                      {timeAgo(message.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="press" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "…" : "🖼️"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void onPickImage(event.target.files)} />
              <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(draft); }} placeholder="메시지를 입력하세요" style={{ flex: 1 }} />
              <button className="btn btn-primary" disabled={!draft.trim() || sending} onClick={() => void submit(draft)}>
                {sending ? "전송 중…" : "보내기"}
              </button>
            </div>
            {error && <p style={{ color: "var(--primary)", fontSize: 13 }}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

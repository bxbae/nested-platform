"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/api/useAuth";
import {
  listChatRooms,
  listMessages,
  sendMessage,
  type ApiChatRoom,
  type ApiMessage,
} from "@/lib/api/messages";
import { uploadImage } from "@/lib/api/storage";

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

  useEffect(() => {
    (async () => {
      const list = await listChatRooms();
      setRooms(list);
      // If we arrived with ?room=<id> (e.g. host just started a chat), open it.
      const wanted =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("room")
          : null;
      const initial = (wanted && list.find((r) => r.id === wanted)) || list[0] || null;
      setActive(initial);
      setLoading(false);
    })();
  }, []);

  const loadThread = useCallback(async (chatRoomId: string) => {
    setMsgs(await listMessages(chatRoomId));
  }, []);

  useEffect(() => {
    if (active) loadThread(active.id);
  }, [active, loadThread]);

  async function send() {
    const body = draft.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await sendMessage(active.id, body);
      setMsgs((prev) => [...prev, created]);
      setDraft("");
    } catch (e) {
      // Surface it — a silently dropped message looks like it sent, then
      // vanishes on reload.
      setError(e instanceof Error ? e.message : "메시지를 보내지 못했어요.");
    } finally {
      setSending(false);
    }
  }

  async function onPickImage(files: FileList | null) {
    const file = files?.[0];
    if (!file || !active || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, "chat");
      const created = await sendMessage(active.id, undefined, url);
      setMsgs((prev) => [...prev, created]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 보내지 못했어요.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>메시지</h1>
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>메시지</h1>
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          아직 대화가 없어요.
          <div style={{ fontSize: 13.5, marginTop: 8 }}>
            숙소 상세 페이지에서 “호스트에게 문의”를 눌러 대화를 시작해보세요.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>메시지</h1>

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
                  padding: 14, textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start",
                  border: active?.id === r.id ? "1.5px solid var(--text)" : "1px solid var(--border)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 40, height: 40, borderRadius: 99, flexShrink: 0,
                    background: "var(--primary)", display: "grid", placeItems: "center",
                    color: "#fff", fontWeight: 700,
                  }}
                >
                  {title[0]}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{title}</strong>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {r.hostId === user?.id ? "게스트와의 대화" : "호스트와의 대화"}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5, color: "var(--text-2)", marginTop: 4,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {last?.imageUrl ? "📷 사진" : last?.body ?? "아직 메시지가 없어요"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* thread */}
        {active && (
          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", minHeight: 420 }}>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
              <strong style={{ fontSize: 16 }}>{active.room?.name ?? "숙소"}</strong>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>
                {active.hostId === user?.id ? "게스트와의 대화" : "호스트와의 대화"}
              </div>
            </div>

            <div style={{ flex: 1, display: "grid", gap: 10, alignContent: "start" }}>
              {msgs.length === 0 && (
                <p style={{ color: "var(--text-2)", fontSize: 14 }}>
                  첫 메시지를 보내보세요.
                </p>
              )}
              {msgs.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      justifySelf: mine ? "end" : "start",
                      maxWidth: "80%",
                      background: mine ? "var(--primary)" : "var(--bg-2)",
                      color: mine ? "#fff" : "var(--text)",
                      padding: m.imageUrl ? 4 : "10px 14px",
                      borderRadius: "var(--r-md)",
                      fontSize: 14,
                    }}
                  >
                    {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.imageUrl}
                        alt="전송된 사진"
                        style={{
                          maxWidth: 220, maxHeight: 220,
                          borderRadius: "calc(var(--r-md) - 4px)",
                          display: "block", objectFit: "cover",
                        }}
                      />
                    ) : (
                      m.body
                    )}
                    <div
                      style={{
                        fontSize: 10.5, opacity: 0.7, marginTop: m.imageUrl ? 2 : 3,
                        textAlign: mine ? "right" : "left",
                        padding: m.imageUrl ? "0 4px 2px" : 0,
                      }}
                    >
                      {timeAgo(m.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
              <button
                type="button"
                className="press"
                aria-label="이미지 전송"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  width: 38, height: 38, borderRadius: 99, fontSize: 17,
                  background: "var(--bg-2)", flexShrink: 0,
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
                onChange={(e) => onPickImage(e.target.files)}
              />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="메시지를 입력하세요"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary press"
                onClick={send}
                disabled={!draft.trim() || sending}
              >
                {sending ? "전송 중…" : "보내기"}
              </button>
            </div>
            {error && (
              <p style={{ fontSize: 13, color: "var(--primary)", marginTop: 8 }}>{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

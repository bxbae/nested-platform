"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/api/useAuth";
import {
  listChatRooms,
  listMessages,
  sendMessage,
  type ApiChatRoom,
  type ApiMessage,
} from "@/lib/api/messages";

// 문의함 — the host side of the same threads that power /me/messages.
// A conversation appears here as soon as a guest taps "호스트에게 문의" on one
// of my listings.
export default function HostInquiries() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ApiChatRoom[]>([]);
  const [active, setActive] = useState<ApiChatRoom | null>(null);
  const [msgs, setMsgs] = useState<ApiMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const all = await listChatRooms();
      // Only threads where I'm the host — the guest side lives in /me/messages.
      const mine = all.filter((t) => t.hostId === user.id);
      setThreads(mine);
      setActive(mine[0] ?? null);
      setLoading(false);
    })();
  }, [user]);

  const loadThread = useCallback(async (chatRoomId: string) => {
    setMsgs(await listMessages(chatRoomId));
  }, []);

  useEffect(() => {
    if (active) loadThread(active.id);
  }, [active, loadThread]);

  async function send() {
    const body = reply.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await sendMessage(active.id, body);
      setMsgs((prev) => [...prev, created]);
      setReply("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "답장을 보내지 못했어요.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>문의함</h1>
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>문의함</h1>
        <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
          게스트 문의에 답장하고 예약으로 이어가세요.
        </p>
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          아직 문의가 없어요.
          <div style={{ fontSize: 13.5, marginTop: 8 }}>
            게스트가 숙소 페이지에서 문의하면 여기에 표시됩니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>문의함</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        게스트 문의에 답장하고 예약으로 이어가세요.
      </p>

      <div className="inquiry-split">
        {/* thread list */}
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          {threads.map((t) => {
            const guest = t.guest?.name ?? "게스트";
            const last = t.messages?.[0];
            return (
              <button
                key={t.id}
                onClick={() => setActive(t)}
                className="card press"
                style={{
                  padding: 14, textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start",
                  border: active?.id === t.id ? "1.5px solid var(--text)" : "1px solid var(--border)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 40, height: 40, borderRadius: 99, flexShrink: 0,
                    background: t.guest?.avatarColor ?? "var(--primary)",
                    display: "grid", placeItems: "center", color: "#fff", fontWeight: 700,
                  }}
                >
                  {guest[0]}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{guest}</strong>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>{t.room?.name ?? "숙소"}</div>
                  <div
                    style={{
                      fontSize: 12.5, color: "var(--text-2)", marginTop: 4,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {last?.body ?? "아직 메시지가 없어요"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* conversation */}
        {active && (
          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", minHeight: 420 }}>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
              <strong style={{ fontSize: 16 }}>{active.guest?.name ?? "게스트"}</strong>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{active.room?.name ?? "숙소"}</div>
            </div>

            <div style={{ flex: 1, display: "grid", gap: 10, alignContent: "start" }}>
              {msgs.length === 0 && (
                <p style={{ color: "var(--text-2)", fontSize: 14 }}>아직 메시지가 없어요.</p>
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
                      padding: "10px 14px",
                      borderRadius: "var(--r-md)",
                      fontSize: 14,
                    }}
                  >
                    {m.body}
                    <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3, textAlign: mine ? "right" : "left" }}>
                      {timeAgo(m.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="답장을 입력하세요"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary press"
                onClick={send}
                disabled={!reply.trim() || sending}
              >
                {sending ? "전송 중…" : "답장"}
              </button>
            </div>
            {error && <p style={{ fontSize: 13, color: "var(--primary)", marginTop: 8 }}>{error}</p>}
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat-types";
import { USE_REAL_API } from "@/lib/api/config";
import { authStore } from "@/lib/api/auth-store";
import { createChatSocket } from "@/lib/api/socket";
import type { Socket } from "socket.io-client";

// Chat room hook with two backends behind one identical API
// (messages, hostTyping, loading, send, signalTyping):
//
//   • USE_REAL_API=false → demo mode: polls the /api/chat Route Handlers
//     every 1.2s (the original mirroring implementation).
//   • USE_REAL_API=true  → realtime mode: Socket.io on the /chat namespace,
//     listening for message:new / message:read / typing and emitting
//     message:send / message:read / typing.
export function useChatRoom(roomId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hostTyping, setHostTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const seen = useRef<string>("");
  const socketRef = useRef<Socket | null>(null);

  // ── demo poll (mock mode) ──
  const poll = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/chat/messages?roomId=${roomId}`);
      const data = await res.json();
      const sig = JSON.stringify(data.messages.map((m: ChatMessage) => m.id + m.readBy.length));
      if (sig !== seen.current) {
        seen.current = sig;
        setMessages(data.messages);
      }
      setHostTyping(!!data.hostTyping);
      setLoading(false);
    } catch {
      /* keep last state */
    }
  }, [roomId]);

  // ── realtime mode: connect socket, load history, wire events ──
  useEffect(() => {
    if (!roomId || !USE_REAL_API) return;
    setLoading(true);
    setMessages([]);

    // initial history via REST (messages module), then live updates
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/messages/${roomId}`,
          {
            headers: authStore.getAccessToken()
              ? { Authorization: `Bearer ${authStore.getAccessToken()}` }
              : {},
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setMessages(data as ChatMessage[]);
          else if (Array.isArray(data.messages)) setMessages(data.messages);
        }
      } catch {
        /* history is best-effort; live socket still works */
      } finally {
        setLoading(false);
      }
    })();

    const socket = createChatSocket(roomId);
    socketRef.current = socket;
    const me = authStore.getUser()?.id ?? "me";

    socket.on("message:new", (msg: ChatMessage) => {
      setMessages((prev) => {
        // reconcile optimistic temp message if present
        const withoutTmp = prev.filter(
          (m) => !(m.id.startsWith("tmp_") && m.body === msg.body && m.senderId === msg.senderId)
        );
        if (withoutTmp.some((m) => m.id === msg.id)) return withoutTmp;
        return [...withoutTmp, msg];
      });
    });

    socket.on("message:read", (data: { roomId: string; userId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.readBy.includes(data.userId) ? m : { ...m, readBy: [...m.readBy, data.userId] }
        )
      );
    });

    socket.on("typing", () => {
      setHostTyping(true);
      window.clearTimeout((socket as unknown as { _typingT?: number })._typingT);
      (socket as unknown as { _typingT?: number })._typingT = window.setTimeout(
        () => setHostTyping(false),
        1500
      );
    });

    // mark existing as read on open
    socket.emit("message:read", { roomId, userId: me });

    return () => {
      socket.emit("message:read", { roomId, userId: me });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  // ── mock mode: initial load + mark read ──
  useEffect(() => {
    if (!roomId || USE_REAL_API) return;
    seen.current = "";
    setLoading(true);
    poll();
    fetch("/api/chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
  }, [roomId, poll]);

  // ── mock mode: realtime poll ──
  useEffect(() => {
    if (!roomId || USE_REAL_API) return;
    const t = setInterval(poll, 1200);
    return () => clearInterval(t);
  }, [roomId, poll]);

  // ── send (both modes) ──
  const send = useCallback(
    async (payload: { body?: string; imageUrl?: string; reservation?: ChatMessage["reservation"] }) => {
      if (!roomId) return;
      const me = authStore.getUser()?.id ?? "me";
      const meName = authStore.getUser()?.name ?? "나";

      // optimistic append
      const optimistic: ChatMessage = {
        id: `tmp_${Date.now()}`,
        roomId,
        senderId: me,
        senderName: meName,
        body: payload.body,
        imageUrl: payload.imageUrl,
        reservation: payload.reservation,
        createdAt: new Date().toISOString(),
        readBy: [me],
      };
      setMessages((m) => [...m, optimistic]);

      if (USE_REAL_API && socketRef.current) {
        socketRef.current.emit("message:send", {
          roomId,
          senderId: me,
          body: payload.body,
          imageUrl: payload.imageUrl,
        });
        return;
      }

      // demo path
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, senderId: "me", ...payload }),
      });
      poll();
    },
    [roomId, poll]
  );

  // ── typing indicator (both modes) ──
  const signalTyping = useCallback(() => {
    if (!roomId) return;
    const me = authStore.getUser()?.id ?? "me";
    if (USE_REAL_API && socketRef.current) {
      socketRef.current.emit("typing", { roomId, userId: me });
      return;
    }
    fetch("/api/chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, typing: true }),
    });
  }, [roomId]);

  return { messages, hostTyping, loading, send, signalTyping };
}

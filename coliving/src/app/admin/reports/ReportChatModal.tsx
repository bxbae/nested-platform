"use client";

// 신고 관리 화면 전용 — 신고된 메시지가 오간 채팅방(숙소 문의) 또는 1:1
// 다이렉트 대화 전체를 관리자가 열람할 수 있는 모달.
// 참고: app/match/MatchDetailModal.tsx 와 동일한 오버레이/패널 스타일을 사용한다.

import { useEffect, useState, type CSSProperties } from "react";
import {
  getRoomChat,
  getDirectChat,
  type AdminChatMessage,
  type ReportAccountRef,
  type ReportChatRef,
} from "@/lib/api/admin";

interface ReportChatModalProps {
  chat: ReportChatRef | null;
  onClose: () => void;
}

export default function ReportChatModal({ chat, onClose }: ReportChatModalProps) {
  const [participants, setParticipants] = useState<[ReportAccountRef, ReportAccountRef] | null>(null);
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chat) {
      setParticipants(null);
      setMessages([]);
      setError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    const load =
      chat.kind === "ROOM"
        ? getRoomChat(chat.id).then((r) => [r.guest, r.host, r.messages] as const)
        : getDirectChat(chat.id).then((r) => [r.participantA, r.participantB, r.messages] as const);

    load
      .then(([a, b, msgs]) => {
        if (!alive) return;
        setParticipants([a, b]);
        setMessages(msgs);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "대화를 불러오지 못했어요.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [chat]);

  useEffect(() => {
    if (!chat) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = original;
    };
  }, [chat, onClose]);

  if (!chat) return null;

  return (
    <div role="presentation" style={overlayStyle} onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="신고된 대화 보기"
        style={modalStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="닫기" onClick={onClose} style={closeButtonStyle}>
          ×
        </button>

        <h2 style={{ fontSize: 18, marginBottom: 4 }}>
          {chat.kind === "ROOM" ? "채팅방 대화" : "1:1 다이렉트 대화"}
        </h2>
        {participants && (
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
            {participants[0].name} ({participants[0].email}) ↔ {participants[1].name} ({participants[1].email})
          </p>
        )}

        {loading && <p style={{ color: "var(--text-2)" }}>대화를 불러오는 중…</p>}
        {error && <p style={{ color: "var(--primary)", fontSize: 13 }}>{error}</p>}

        {!loading && !error && (
          <div style={{ display: "grid", gap: 10, maxHeight: "50vh", overflowY: "auto", padding: 4 }}>
            {messages.length === 0 && (
              <p style={{ color: "var(--text-2)", fontSize: 13 }}>메시지가 없어요.</p>
            )}
            {messages.map((m) => {
              const sender = participants?.find((p) => p.id === m.senderId);
              return (
                <div
                  key={m.id}
                  className="card"
                  style={{ padding: "10px 14px", borderColor: "var(--border)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{sender?.name ?? "알 수 없음"}</span>
                    <span style={{ fontSize: 11, color: "var(--text-2)" }}>
                      {new Date(m.createdAt).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {m.body && <p style={{ fontSize: 14, lineHeight: 1.5 }}>{m.body}</p>}
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageUrl}
                      alt="첨부 이미지"
                      style={{ maxWidth: 220, borderRadius: 10, marginTop: 6 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  padding: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(20, 24, 32, 0.44)",
};

const modalStyle: CSSProperties = {
  position: "relative",
  width: "min(640px, 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  padding: 28,
  borderRadius: 22,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.18)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 14,
  right: 16,
  width: 38,
  height: 38,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 27,
  cursor: "pointer",
};

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChatRoom } from "@/features/chat/useChatRoom";
import type { ChatRoom } from "@/lib/chat-types";
import { won } from "@/lib/format";

interface RoomMeta extends ChatRoom {
  last?: { body?: string; imageUrl?: string; createdAt: string };
  unread: number;
}

export function ChatView() {
  const [rooms, setRooms] = useState<RoomMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  async function loadRooms() {
    const res = await fetch("/api/chat/rooms");
    const data = await res.json();
    setRooms(data.rooms);
    if (!activeId && data.rooms[0]) setActiveId(data.rooms[0].id);
  }

  useEffect(() => {
    loadRooms();
    const t = setInterval(loadRooms, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const active = rooms.find((r) => r.id === activeId) ?? null;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>메시지</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        호스트와 실시간으로 대화하세요.
      </p>

      <div className="chat-split">
        {/* room list */}
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className="card press"
              style={{
                padding: 14,
                textAlign: "left",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                border: activeId === r.id ? "1.5px solid var(--text)" : "1px solid var(--border)",
              }}
            >
              <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 99, flexShrink: 0, background: r.avatarColor, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 }}>
                {r.hostName[0]}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{r.hostName}</strong>
                  {r.unread > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 99, background: "var(--primary)", color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 5px" }}>
                      {r.unread}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>{r.houseName}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.last?.imageUrl ? "📷 사진" : r.last?.body ?? "새 대화"}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* thread */}
        {active ? <Thread room={active} /> : <div className="card" style={{ padding: 40 }}>대화를 선택하세요.</div>}
      </div>
    </div>
  );
}

function Thread({ room }: { room: RoomMeta }) {
  const { messages, hostTyping, loading, send, signalTyping } = useChatRoom(room.id);
  const [draft, setDraft] = useState("");
  const [showRes, setShowRes] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, hostTyping]);

  function onImage(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => send({ imageUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: 560 }}>
      {/* header with 예약 연동 entry */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <strong style={{ fontSize: 15 }}>{room.hostName} 호스트</strong>
          <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{room.houseName}</div>
        </div>
        <Link href={`/homes/${room.houseId}`} className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 12px" }}>
          숙소 보기
        </Link>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && <div style={{ color: "var(--text-2)", fontSize: 13 }}>불러오는 중…</div>}
        {messages.map((m) => {
          const mine = m.senderId === "me";
          const read = m.readBy.some((u) => u !== "me"); // read by the host
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "78%",
                  background: mine ? "var(--primary)" : "var(--bg-2)",
                  color: mine ? "#fff" : "var(--text)",
                  padding: m.imageUrl ? 4 : "10px 14px",
                  borderRadius: "var(--r-md)",
                  fontSize: 14,
                }}
              >
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="전송된 사진" style={{ maxWidth: 220, maxHeight: 220, borderRadius: "calc(var(--r-md) - 4px)", display: "block", objectFit: "cover" }} />
                ) : m.reservation ? (
                  <ReservationCard res={m.reservation} mine={mine} />
                ) : (
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.body}</span>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-2)", marginTop: 3, display: "flex", gap: 5 }}>
                <time>{fmt(m.createdAt)}</time>
                {/* 읽음 표시 */}
                {mine && <span style={{ color: read ? "var(--secondary)" : "var(--text-2)" }}>{read ? "읽음" : "전송됨"}</span>}
              </div>
            </div>
          );
        })}
        {hostTyping && (
          <div style={{ alignSelf: "flex-start", background: "var(--bg-2)", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, color: "var(--text-2)" }}>
            입력 중…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* 예약 연동 quick card */}
      {showRes && (
        <div style={{ padding: "0 16px 8px" }}>
          <button
            className="card press"
            onClick={() => {
              send({
                reservation: {
                  houseId: room.houseId,
                  houseName: room.houseName,
                  checkIn: "2026-09-01",
                  months: 6,
                  dueNow: 3880000,
                  status: "hold",
                },
              });
              setShowRes(false);
            }}
            style={{ width: "100%", padding: 12, textAlign: "left", fontSize: 13 }}
          >
            📋 <strong>{room.houseName}</strong> 예약 요청 카드 보내기 (9/1 · 6개월)
          </button>
        </div>
      )}

      {/* composer */}
      <div style={{ display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--border)", alignItems: "center" }}>
        <button className="press" aria-label="이미지 전송" onClick={() => fileRef.current?.click()} style={iconBtn}>🖼️</button>
        <button className="press" aria-label="예약 연동" onClick={() => setShowRes((s) => !s)} style={iconBtn}>📋</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onImage(e.target.files)} />
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); signalTyping(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              send({ body: draft });
              setDraft("");
            }
          }}
          placeholder="메시지를 입력하세요"
          style={{ flex: 1, padding: "11px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-pill)" }}
        />
        <button className="btn btn-primary press" disabled={!draft.trim()} onClick={() => { send({ body: draft }); setDraft(""); }}>
          전송
        </button>
      </div>
    </div>
  );
}

function ReservationCard({ res, mine }: { res: NonNullable<import("@/lib/chat-types").ChatMessage["reservation"]>; mine: boolean }) {
  return (
    <Link href={`/homes/${res.houseId}`} style={{ display: "block", color: "inherit", minWidth: 200 }}>
      <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>예약 요청</div>
      <strong style={{ fontSize: 14 }}>{res.houseName}</strong>
      <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>
        {res.checkIn} · {res.months}개월
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>
        {won(res.dueNow)}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 11.5,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 99,
          background: mine ? "rgba(255,255,255,0.25)" : "var(--warning)",
          color: mine ? "#fff" : "#fff",
          display: "inline-block",
        }}
      >
        {res.status === "hold" ? "결제 대기" : res.status === "paid" ? "예약 확정" : "취소됨"}
      </div>
    </Link>
  );
}

const iconBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 99,
  fontSize: 17,
  background: "var(--bg-2)",
  flexShrink: 0,
};

function fmt(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const hh = h % 12 || 12;
  return `${ampm} ${hh}:${m}`;
}

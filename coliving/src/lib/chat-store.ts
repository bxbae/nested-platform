import type { ChatMessage, ChatRoom, PushEvent } from "./chat-types";
import { houses } from "./data";

// In-memory chat store. In production this is a Socket.io gateway backed by
// Postgres + a Redis adapter (ARCHITECTURE.md §11). The event names below
// (send/read/typing) map 1:1 to the socket events; here we expose them as
// plain functions polled over HTTP so the demo runs without a socket server.

declare global {
  // eslint-disable-next-line no-var
  var __chatRooms: ChatRoom[] | undefined;
  // eslint-disable-next-line no-var
  var __chatMessages: ChatMessage[] | undefined;
  // eslint-disable-next-line no-var
  var __chatTyping: Record<string, number> | undefined; // roomId -> expiry ts
  // eslint-disable-next-line no-var
  var __chatPush: PushEvent[] | undefined;
}

const HOSTS = [
  { hostId: "host_1", hostName: "이서준", avatarColor: "#00A699" },
  { hostId: "host_2", hostName: "박지우", avatarColor: "#3E9BC4" },
  { hostId: "host_3", hostName: "최민서", avatarColor: "#7C6FE0" },
  { hostId: "host_4", hostName: "정예은", avatarColor: "#FFB400" },
];

function seedRooms(): ChatRoom[] {
  const picks = houses.slice(0, 4);
  return picks.map((h, i) => ({
    id: `room_${i + 1}`,
    hostId: HOSTS[i].hostId,
    hostName: HOSTS[i].hostName,
    avatarColor: HOSTS[i].avatarColor,
    houseId: h.id,
    houseName: h.name.trim(),
  }));
}

function seedMessages(rooms: ChatRoom[]): ChatMessage[] {
  const now = Date.now();
  const out: ChatMessage[] = [];
  rooms.forEach((r, i) => {
    out.push({
      id: `m_${r.id}_1`,
      roomId: r.id,
      senderId: "me",
      senderName: "나",
      body: `${r.houseName} 입주 문의드려요. 다음 주 방문 가능할까요?`,
      createdAt: new Date(now - (i + 1) * 3600_000).toISOString(),
      readBy: ["me", r.hostId],
    });
    out.push({
      id: `m_${r.id}_2`,
      roomId: r.id,
      senderId: r.hostId,
      senderName: r.hostName,
      body: i === 0 ? "네! 금요일 오후 어떠세요?" : "안녕하세요, 문의 감사합니다 :)",
      createdAt: new Date(now - (i + 1) * 3600_000 + 300_000).toISOString(),
      readBy: i === 0 ? [r.hostId] : ["me", r.hostId], // room 0 unread by me
    });
  });
  return out;
}

const rooms: ChatRoom[] = globalThis.__chatRooms ?? seedRooms();
globalThis.__chatRooms = rooms;

const messages: ChatMessage[] = globalThis.__chatMessages ?? seedMessages(rooms);
globalThis.__chatMessages = messages;

const typing: Record<string, number> = globalThis.__chatTyping ?? {};
globalThis.__chatTyping = typing;

const pushQueue: PushEvent[] = globalThis.__chatPush ?? [];
globalThis.__chatPush = pushQueue;

// ── queries ──
export function listRooms(): ChatRoom[] {
  return rooms;
}

export function roomsWithMeta(userId = "me") {
  return rooms.map((r) => {
    const msgs = messages
      .filter((m) => m.roomId === r.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter((m) => m.senderId !== userId && !m.readBy.includes(userId)).length;
    return { ...r, last, unread };
  });
}

export function listMessages(roomId: string): ChatMessage[] {
  return messages
    .filter((m) => m.roomId === roomId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ── mutations (socket events) ──

// message:send
export function sendMessage(input: {
  roomId: string;
  senderId: string;
  body?: string;
  imageUrl?: string;
  reservation?: ChatMessage["reservation"];
}): ChatMessage {
  const room = rooms.find((r) => r.id === input.roomId);
  const senderName =
    input.senderId === "me" ? "나" : room?.hostName ?? "호스트";
  const msg: ChatMessage = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    roomId: input.roomId,
    senderId: input.senderId,
    senderName,
    body: input.body,
    imageUrl: input.imageUrl,
    reservation: input.reservation,
    createdAt: new Date().toISOString(),
    readBy: [input.senderId],
  };
  messages.push(msg);

  // Push Notification: notify the *other* party.
  if (room && input.senderId === "me") {
    // simulate the host auto-replying shortly, which will push to me
    scheduleHostReply(room);
  }
  if (room && input.senderId !== "me") {
    pushQueue.push({
      id: `push_${msg.id}`,
      roomId: room.id,
      title: `${room.hostName} 호스트`,
      body: msg.body ?? (msg.imageUrl ? "사진을 보냈습니다" : "새 메시지"),
      createdAt: msg.createdAt,
    });
  }
  return msg;
}

// message:read — mark all messages in a room read by user
export function markRead(roomId: string, userId = "me"): void {
  messages.forEach((m) => {
    if (m.roomId === roomId && !m.readBy.includes(userId)) m.readBy.push(userId);
  });
}

// typing indicator
export function setTyping(roomId: string, who: string): void {
  typing[`${roomId}:${who}`] = Date.now() + 3000;
}
export function isTyping(roomId: string, who: string): boolean {
  const exp = typing[`${roomId}:${who}`];
  return !!exp && exp > Date.now();
}

// Push queue drain (client polls this)
export function drainPush(): PushEvent[] {
  const out = [...pushQueue];
  pushQueue.length = 0;
  return out;
}

// ── host auto-reply (demo realtime feel) ──
function scheduleHostReply(room: ChatRoom) {
  setTyping(room.id, room.hostId);
  const replies = [
    "네, 확인해볼게요!",
    "좋습니다. 편한 시간 알려주세요.",
    "사진 감사합니다. 방은 지금도 가능해요.",
    "예약 도와드릴게요 :)",
  ];
  const body = replies[Math.floor(Math.random() * replies.length)];
  setTimeout(() => {
    sendMessage({ roomId: room.id, senderId: room.hostId, body });
  }, 1800);
}

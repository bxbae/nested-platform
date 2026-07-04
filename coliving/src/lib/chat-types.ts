// ── Chat domain (realtime messenger) ────────────────────────────────
// Shapes align with ARCHITECTURE.md §7.5 messaging + the Socket.io events
// message:send / message:new / message:read / typing.

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string; // "me" | host id
  senderName: string;
  body?: string;
  imageUrl?: string; // 이미지 전송 (data URL in demo)
  // 예약 연동: a message can carry a reservation reference card
  reservation?: {
    houseId: string;
    houseName: string;
    checkIn: string;
    months: number;
    dueNow: number;
    status: "hold" | "paid" | "cancelled";
  };
  createdAt: string;
  readBy: string[]; // user ids who've read this (읽음 표시)
}

export interface ChatRoom {
  id: string;
  hostId: string;
  hostName: string;
  avatarColor: string;
  houseId: string;
  houseName: string;
}

// Push notification payload (Push Notification)
export interface PushEvent {
  id: string;
  roomId: string;
  title: string;
  body: string;
  createdAt: string;
}

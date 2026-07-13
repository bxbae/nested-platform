// ── Messages (메시지) service ─────────────────────────────────────────
// Wraps the JWT-guarded /messages endpoints. The backend also exposes a
// Socket.io gateway; this REST path is enough for a working inbox and keeps
// the page simple. Demo mode keeps talking to the in-repo /api/chat routes.

import { USE_REAL_API } from "./config";
import { api } from "./client";

export interface ApiMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface ApiChatRoom {
  id: string;
  roomId: string;
  guestId: string;
  hostId: string;
  createdAt: string;
  room: { name: string };
  guest?: { id: string; name: string; avatarColor: string | null };
  messages: ApiMessage[]; // last message only (take: 1)
}

// GET /messages/rooms — my conversations, newest first
export async function listChatRooms(): Promise<ApiChatRoom[]> {
  if (!USE_REAL_API) {
    const res = await fetch("/api/chat/rooms");
    if (!res.ok) return [];
    const data = await res.json();
    return data.rooms ?? [];
  }
  try {
    return await api.get<ApiChatRoom[]>("/messages/rooms");
  } catch {
    return [];
  }
}

// GET /messages/:chatRoomId — full thread, oldest first
export async function listMessages(chatRoomId: string): Promise<ApiMessage[]> {
  if (!USE_REAL_API) return [];
  try {
    return await api.get<ApiMessage[]>(`/messages/${chatRoomId}`);
  } catch {
    return [];
  }
}

// POST /messages/:chatRoomId
export async function sendMessage(chatRoomId: string, body: string): Promise<ApiMessage> {
  return api.post<ApiMessage>(`/messages/${chatRoomId}`, { body });
}

// POST /messages/rooms — get-or-create the thread with a listing's host.
// Used by the "호스트에게 문의" button on a room page.
export async function openChatRoom(roomId: string, hostId: string): Promise<ApiChatRoom> {
  return api.post<ApiChatRoom>("/messages/rooms", { roomId, hostId });
}

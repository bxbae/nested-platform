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

// POST /messages/:chatRoomId — send text, an image, or both.
export async function sendMessage(
  chatRoomId: string,
  body?: string,
  imageUrl?: string,
): Promise<ApiMessage> {
  return api.post<ApiMessage>(`/messages/${chatRoomId}`, { body, imageUrl });
}

// POST /messages/rooms — get-or-create the thread with a listing's host.
// Used by the "호스트에게 문의" button on a room page.
export async function openChatRoom(roomId: string, hostId: string): Promise<ApiChatRoom> {
  return api.post<ApiChatRoom>("/messages/rooms", { roomId, hostId });
}

// POST /messages/rooms/as-host — the host starts a chat with a guest, choosing
// one of their own listings. Used by "채팅 시작" on the 입주 희망자 찾기 page.
export async function openChatRoomAsHost(roomId: string, guestId: string): Promise<ApiChatRoom> {
  return api.post<ApiChatRoom>("/messages/rooms/as-host", { roomId, guestId });
}

export interface ApiDirectConversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  other?: {
    id: string;
    name: string;
    avatarColor: string;
    avatarUrl: string | null;
  };
  messages: ApiDirectMessage[];
}

export interface ApiDirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  readBy: string[];
  createdAt: string;
}

export async function listDirectConversations(): Promise<ApiDirectConversation[]> {
  try { return await api.get<ApiDirectConversation[]>("/messages/direct"); } catch { return []; }
}

export async function openDirectConversation(targetUserId: string): Promise<ApiDirectConversation> {
  return api.post<ApiDirectConversation>("/messages/direct", { targetUserId });
}

export async function listDirectMessages(conversationId: string): Promise<ApiDirectMessage[]> {
  return api.get<ApiDirectMessage[]>(`/messages/direct/${encodeURIComponent(conversationId)}`);
}

export async function sendDirectMessage(conversationId: string, body?: string, imageUrl?: string): Promise<ApiDirectMessage> {
  return api.post<ApiDirectMessage>(`/messages/direct/${encodeURIComponent(conversationId)}`, { body, imageUrl });
}

export async function markDirectConversationRead(conversationId: string): Promise<void> {
  await api.post(`/messages/direct/${encodeURIComponent(conversationId)}/read`);
}

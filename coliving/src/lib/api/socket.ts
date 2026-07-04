// ── Socket.io client (/chat) ────────────────────────────────────────
// One socket per chat room. The backend ChatGateway joins the socket to the
// room named by the `roomId` handshake query, then broadcasts:
//   message:new / message:read / typing
// and receives:
//   message:send / message:read / typing
//
// Auth token is passed in handshake.auth so the gateway can identify the
// sender in production. A per-room instance keeps the API simple for the hook.

import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "./config";
import { authStore } from "./auth-store";

export function createChatSocket(roomId: string): Socket {
  return io(`${SOCKET_URL}/chat`, {
    query: { roomId },
    auth: { token: authStore.getAccessToken() ?? "" },
    transports: ["websocket"],
    autoConnect: true,
  });
}

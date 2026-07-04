import { NextRequest, NextResponse } from "next/server";
import { listMessages, sendMessage, isTyping, listRooms } from "@/lib/chat-store";

export const dynamic = "force-dynamic";

// GET /api/chat/messages?roomId=  → messages + typing state (poll = message:new)
export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
  const room = listRooms().find((r) => r.id === roomId);
  return NextResponse.json({
    messages: listMessages(roomId),
    hostTyping: room ? isTyping(roomId, room.hostId) : false,
  });
}

// POST /api/chat/messages  → message:send
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
  const msg = sendMessage({
    roomId: body.roomId,
    senderId: body.senderId || "me",
    body: body.body,
    imageUrl: body.imageUrl,
    reservation: body.reservation,
  });
  return NextResponse.json({ message: msg });
}

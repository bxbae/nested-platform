import { NextResponse } from "next/server";
import { roomsWithMeta } from "@/lib/chat-store";

export const dynamic = "force-dynamic";

// GET /api/chat/rooms — room list with last message + unread count
export async function GET() {
  return NextResponse.json({ rooms: roomsWithMeta("me") });
}

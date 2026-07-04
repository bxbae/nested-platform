import { NextResponse } from "next/server";
import { drainPush } from "@/lib/chat-store";

export const dynamic = "force-dynamic";

// GET /api/chat/push — client polls for pending push notifications.
// In production this is FCM / Web Push; here we drain a queue.
export async function GET() {
  return NextResponse.json({ events: drainPush() });
}

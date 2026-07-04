import { NextRequest, NextResponse } from "next/server";
import { markRead, setTyping } from "@/lib/chat-store";

export const dynamic = "force-dynamic";

// POST /api/chat/read — message:read (mark room read) or typing signal
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  if (body.typing) {
    setTyping(body.roomId, "me");
    return NextResponse.json({ ok: true });
  }
  markRead(body.roomId, "me");
  return NextResponse.json({ ok: true });
}

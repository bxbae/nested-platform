"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/api/useAuth";
import { openChatRoom } from "@/lib/api/messages";

// Entry point into the messaging inbox. Without this there's no way to start a
// conversation, so the inbox would sit empty forever. Get-or-create semantics
// on the server mean tapping this twice just reopens the same thread.
export function ContactHostButton({ roomId, hostId }: { roomId: string; hostId?: string }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Demo data has no real host account to message.
  if (!hostId) return null;

  async function contact() {
    if (!isAuthenticated) {
      router.push("/?auth=1");
      return;
    }
    if (busy || !hostId) return;
    setBusy(true);
    try {
      await openChatRoom(roomId, hostId);
      router.push("/me/messages");
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      className="btn btn-ghost press"
      onClick={contact}
      disabled={busy}
      style={{ marginTop: 14 }}
    >
      {busy ? "여는 중…" : "호스트에게 문의"}
    </button>
  );
}

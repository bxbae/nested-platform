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
  const [error, setError] = useState<string | null>(null);

  // Demo data has no real host account to message.
  if (!hostId) return null;

  async function contact() {
    if (!isAuthenticated) {
      router.push("/?auth=1");
      return;
    }
    if (busy || !hostId) return;
    setBusy(true);
    setError(null);
    try {
      await openChatRoom(roomId, hostId);
      router.push("/me/messages");
    } catch (e) {
      setError(e instanceof Error ? e.message : "대화를 열지 못했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button className="btn btn-ghost press" onClick={contact} disabled={busy}>
        {busy ? "여는 중…" : "호스트에게 문의"}
      </button>
      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}

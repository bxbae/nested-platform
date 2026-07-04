"use client";

import { useState } from "react";
import { inquiries as loadInquiries, type Inquiry } from "@/lib/host";

export default function HostInquiries() {
  const [items] = useState<Inquiry[]>(() => loadInquiries());
  const [active, setActive] = useState<Inquiry | null>(items[0] ?? null);
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState<string[]>([]);

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>문의 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>게스트 문의에 답변하세요.</p>

      <div className="inquiry-split">
        {/* list */}
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          {items.map((inq) => (
            <button
              key={inq.id}
              onClick={() => setActive(inq)}
              className="card press"
              style={{
                padding: 14,
                textAlign: "left",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                border: active?.id === inq.id ? "1.5px solid var(--text)" : "1px solid var(--border)",
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: 40, height: 40, borderRadius: 99, flexShrink: 0, background: inq.avatarColor, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 }}
              >
                {inq.guest[0]}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{inq.guest}</strong>
                  {inq.unread && !sent.includes(inq.id) && (
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--primary)", flexShrink: 0, marginTop: 5 }} />
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>{inq.houseName}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {inq.message}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* thread */}
        {active && (
          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
              <strong style={{ fontSize: 16 }}>{active.guest}</strong>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{active.houseName} · {active.date}</div>
            </div>

            <div style={{ flex: 1, display: "grid", gap: 12, alignContent: "start" }}>
              <div style={{ background: "var(--bg-2)", padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 14, maxWidth: "80%" }}>
                {active.message}
              </div>
              {sent.includes(active.id) && (
                <div style={{ background: "var(--primary)", color: "#fff", padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 14, maxWidth: "80%", marginLeft: "auto" }}>
                  답변을 보냈습니다. 곧 다시 연락드릴게요!
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="답변을 입력하세요"
                style={{ flex: 1, padding: "11px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-pill)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && reply.trim()) {
                    setSent((s) => [...s, active.id]);
                    setReply("");
                  }
                }}
              />
              <button
                className="btn btn-primary press"
                disabled={!reply.trim()}
                onClick={() => {
                  setSent((s) => [...s, active.id]);
                  setReply("");
                }}
              >
                전송
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

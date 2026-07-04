"use client";

import { useState } from "react";
import { threads as loadThreads, type Thread } from "@/lib/me";

export default function Messages() {
  const [items] = useState<Thread[]>(() => loadThreads());
  const [active, setActive] = useState<Thread | null>(items[0] ?? null);
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<Record<string, { mine: boolean; body: string; time: string }[]>>({});

  const activeMsgs = active ? [...active.messages, ...(extra[active.id] ?? [])] : [];

  function send() {
    if (!active || !draft.trim()) return;
    setExtra((e) => ({
      ...e,
      [active.id]: [...(e[active.id] ?? []), { mine: true, body: draft, time: "지금" }],
    }));
    setDraft("");
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>메시지</h1>

      <div className="inquiry-split">
        {/* thread list */}
        <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
          {items.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t)}
              className="card press"
              style={{
                padding: 14, textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start",
                border: active?.id === t.id ? "1.5px solid var(--text)" : "1px solid var(--border)",
              }}
            >
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 99, flexShrink: 0, background: t.avatarColor, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 }}>
                {t.host[0]}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{t.host}</strong>
                  {t.unread && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--primary)", flexShrink: 0, marginTop: 5 }} />}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>{t.houseName}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.last}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* thread */}
        {active && (
          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", minHeight: 420 }}>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
              <strong style={{ fontSize: 16 }}>{active.host} 호스트</strong>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{active.houseName}</div>
            </div>

            <div style={{ flex: 1, display: "grid", gap: 10, alignContent: "start" }}>
              {activeMsgs.map((m, i) => (
                <div
                  key={i}
                  style={{
                    justifySelf: m.mine ? "end" : "start",
                    maxWidth: "80%",
                    background: m.mine ? "var(--primary)" : "var(--bg-2)",
                    color: m.mine ? "#fff" : "var(--text)",
                    padding: "10px 14px",
                    borderRadius: "var(--r-md)",
                    fontSize: 14,
                  }}
                >
                  {m.body}
                  <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3, textAlign: m.mine ? "right" : "left" }}>{m.time}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="메시지를 입력하세요"
                style={{ flex: 1, padding: "11px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-pill)" }}
              />
              <button className="btn btn-primary press" disabled={!draft.trim()} onClick={send}>전송</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

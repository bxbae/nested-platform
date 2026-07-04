"use client";

import { useState } from "react";
import { notices as loadNotices, type Notice } from "@/lib/admin";

export default function AdminNotices() {
  const [list, setList] = useState<Notice[]>(() => loadNotices());
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function create() {
    if (!title.trim()) return;
    setList((prev) => [
      { id: `no${Date.now()}`, title, body, pinned: false, date: new Date().toISOString().slice(0, 10).replace(/-/g, ".") },
      ...prev,
    ]);
    setTitle(""); setBody(""); setCreating(false);
  }

  function togglePin(id: string) {
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  }
  function remove(id: string) {
    setList((prev) => prev.filter((n) => n.id !== id));
  }

  const sorted = [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>공지사항</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>전체 {list.length}건</p>
        </div>
        <button className="btn btn-primary press" onClick={() => setCreating((c) => !c)}>
          {creating ? "취소" : "+ 새 공지"}
        </button>
      </div>

      {creating && (
        <div className="card" style={{ padding: 20, marginBottom: 18, display: "grid", gap: 12 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목"
            style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="공지 내용" rows={3}
            style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", resize: "vertical" }} />
          <button className="btn btn-primary press" style={{ justifySelf: "start" }} onClick={create}>등록</button>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {sorted.map((n) => (
          <div key={n.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {n.pinned && <span className="chip" style={{ fontSize: 11, background: "var(--primary)", color: "#fff", border: "none" }}>📌 고정</span>}
                  <strong style={{ fontSize: 15.5 }}>{n.title}</strong>
                </div>
                <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 6, lineHeight: 1.6 }}>{n.body}</p>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>{n.date}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn btn-ghost press" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => togglePin(n.id)}>
                  {n.pinned ? "고정 해제" : "고정"}
                </button>
                <button className="btn btn-ghost press" style={{ fontSize: 12, padding: "6px 12px", color: "var(--primary)" }} onClick={() => remove(n.id)}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

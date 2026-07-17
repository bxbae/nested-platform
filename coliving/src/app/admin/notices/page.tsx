"use client";

import { useEffect, useState } from "react";
import {
  listNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  type AdminNotice,
} from "@/lib/api/admin";

export default function AdminNotices() {
  const [list, setList] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const rows = await listNotices();
      setList(rows);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await createNotice({ title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setCreating(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(n: AdminNotice) {
    // optimistic
    setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)));
    try {
      await updateNotice(n.id, { pinned: !n.pinned });
      await refresh();
    } catch {
      await refresh(); // revert to server truth on failure
    }
  }

  async function remove(id: string) {
    if (!confirm("이 공지를 삭제할까요?")) return;
    setList((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNotice(id);
    } catch {
      await refresh();
    }
  }

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

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
          <button className="btn btn-primary press" style={{ justifySelf: "start", opacity: busy ? 0.6 : 1 }} onClick={create} disabled={busy}>
            {busy ? "등록 중…" : "등록"}
          </button>
        </div>
      )}

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && list.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          등록된 공지가 없습니다.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((n) => (
            <div key={n.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {n.pinned && <span className="chip" style={{ fontSize: 11, background: "var(--primary)", color: "#fff", border: "none" }}>고정</span>}
                    <strong style={{ fontSize: 15.5 }}>{n.title}</strong>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.body}</p>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>{fmtDate(n.createdAt)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 12px" }} onClick={() => togglePin(n)}>
                    {n.pinned ? "고정 해제" : "고정"}
                  </button>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 12px", color: "#e5484d" }} onClick={() => remove(n.id)}>
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

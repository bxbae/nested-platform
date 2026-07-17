"use client";

import { useEffect, useState } from "react";
import {
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  type AdminBanner,
} from "@/lib/api/admin";

const POSITIONS = ["메인 상단", "검색 결과", "앱 홈"];
const DEFAULT_COLOR = "#FF5A5F";

export default function AdminBanners() {
  const [list, setList] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [position, setPosition] = useState(POSITIONS[0]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setList(await listBanners());
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
      await createBanner({ title: title.trim(), color, position });
      setTitle("");
      setColor(DEFAULT_COLOR);
      setPosition(POSITIONS[0]);
      setCreating(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: AdminBanner) {
    setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, active: !x.active } : x)));
    try {
      await updateBanner(b.id, { active: !b.active });
      await refresh();
    } catch {
      await refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("이 배너를 삭제할까요?")) return;
    setList((prev) => prev.filter((b) => b.id !== id));
    try {
      await deleteBanner(id);
    } catch {
      await refresh();
    }
  }

  const activeCount = list.filter((b) => b.active).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>배너 관리</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>노출 중 배너 {activeCount}개</p>
        </div>
        <button className="btn btn-primary press" onClick={() => setCreating((c) => !c)}>
          {creating ? "취소" : "+ 새 배너"}
        </button>
      </div>

      {creating && (
        <div className="card" style={{ padding: 20, marginBottom: 18, display: "grid", gap: 12 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="배너 제목"
            style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-2)" }}>
              색상
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                style={{ width: 40, height: 32, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-2)" }}>
              위치
              <select value={position} onChange={(e) => setPosition(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <button className="btn btn-primary press" style={{ justifySelf: "start", opacity: busy ? 0.6 : 1 }} onClick={create} disabled={busy}>
            {busy ? "등록 중…" : "등록"}
          </button>
        </div>
      )}

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && list.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          등록된 배너가 없습니다.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: "grid", gap: 14 }}>
          {list.map((b) => (
            <div key={b.id} className="card" style={{ overflow: "hidden", opacity: b.active ? 1 : 0.6 }}>
              <div style={{ height: 96, background: `linear-gradient(135deg, ${b.color}, ${b.color}bb)`, display: "flex", alignItems: "center", padding: "0 24px" }}>
                <strong style={{ color: "#fff", fontSize: 18 }}>{b.title}</strong>
              </div>
              <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="chip" style={{ fontSize: 11 }}>{b.position}</span>
                  <span className="chip" style={{ fontSize: 11, background: b.active ? "var(--secondary)" : "var(--border)", color: b.active ? "#fff" : "var(--text-2)", border: "none" }}>
                    {b.active ? "노출 중" : "숨김"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px" }} onClick={() => toggle(b)}>
                    {b.active ? "숨기기" : "노출"}
                  </button>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px", color: "#e5484d" }} onClick={() => remove(b.id)}>
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

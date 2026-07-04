"use client";

import { useState } from "react";
import { members as loadMembers } from "@/lib/admin";

export default function AdminMembers() {
  const [list, setList] = useState(() => loadMembers());
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "게스트" | "호스트">("all");

  const shown = list.filter(
    (m) =>
      (role === "all" || m.role === role) &&
      (m.name.includes(q) || m.email.includes(q))
  );

  function toggleStatus(id: string) {
    setList((prev) => prev.map((m) => (m.id === id ? { ...m, status: m.status === "정상" ? "정지" : "정상" } : m)));
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>회원 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>전체 {list.length}명 · 검색 {shown.length}명</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 또는 이메일 검색"
          style={{ flex: "1 1 200px", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-pill)" }}
        />
        {(["all", "게스트", "호스트"] as const).map((r) => (
          <button key={r} className="chip" data-active={role === r} onClick={() => setRole(r)}>
            {r === "all" ? "전체" : r}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="admin-table-head">
          <span>회원</span><span>역할</span><span>가입일</span><span>예약</span><span>상태</span><span></span>
        </div>
        {shown.map((m) => (
          <div key={m.id} className="admin-table-row">
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, background: m.avatarColor, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                {m.name[0]}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, display: "block" }}>{m.name}</span>
                <span style={{ fontSize: 12, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{m.email}</span>
              </span>
            </span>
            <span><span className="chip" style={{ fontSize: 11 }}>{m.role}</span></span>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>{m.joined}</span>
            <span style={{ fontSize: 13 }}>{m.bookings}건</span>
            <span>
              <span className="chip" style={{ fontSize: 11, background: m.status === "정상" ? "var(--secondary)" : "var(--primary)", color: "#fff", border: "none" }}>
                {m.status}
              </span>
            </span>
            <span>
              <button className="btn btn-ghost press" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => toggleStatus(m.id)}>
                {m.status === "정상" ? "정지" : "해제"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { banners as loadBanners, type Banner } from "@/lib/admin";

export default function AdminBanners() {
  const [list, setList] = useState<Banner[]>(() => loadBanners());

  function toggle(id: string) {
    setList((prev) => prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b)));
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>배너 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        노출 중 배너 {list.filter((b) => b.active).length}개
      </p>

      <div style={{ display: "grid", gap: 14 }}>
        {list.map((b) => (
          <div key={b.id} className="card" style={{ overflow: "hidden", opacity: b.active ? 1 : 0.6 }}>
            {/* banner preview */}
            <div
              style={{
                height: 96,
                background: `linear-gradient(135deg, ${b.color}, ${b.color}bb)`,
                display: "flex",
                alignItems: "center",
                padding: "0 24px",
              }}
            >
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
                <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px" }} onClick={() => toggle(b.id)}>
                  {b.active ? "숨기기" : "노출"}
                </button>
                <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px" }}>수정</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

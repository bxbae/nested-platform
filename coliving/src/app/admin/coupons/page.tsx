"use client";

import { useState } from "react";
import { coupons as loadCoupons, type Coupon } from "@/lib/admin";

export default function AdminCoupons() {
  const [list, setList] = useState<Coupon[]>(() => loadCoupons());

  function toggle(id: string) {
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>쿠폰 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        활성 쿠폰 {list.filter((c) => c.active).length}개
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((c) => (
          <div key={c.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", opacity: c.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: "var(--bg-2)", display: "grid", placeItems: "center", fontSize: 22 }}
              >
                🎟️
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong className="mono" style={{ fontSize: 15 }}>{c.code}</strong>
                  <span className="chip" style={{ fontSize: 11 }}>
                    {c.type === "정률" ? `${c.value}%` : `₩${c.value.toLocaleString()}`}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
                  {c.used}/{c.limit} 사용 · {c.validTo}까지
                </div>
                <div style={{ height: 5, borderRadius: 99, background: "var(--bg-2)", marginTop: 8, width: 180, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (c.used / c.limit) * 100)}%`, height: "100%", background: "var(--secondary)" }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="chip" style={{ fontSize: 11, background: c.active ? "var(--secondary)" : "var(--border)", color: c.active ? "#fff" : "var(--text-2)", border: "none" }}>
                {c.active ? "활성" : "비활성"}
              </span>
              <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px" }} onClick={() => toggle(c.id)}>
                {c.active ? "비활성화" : "활성화"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

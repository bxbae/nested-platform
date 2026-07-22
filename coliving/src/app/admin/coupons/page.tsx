"use client";

import { useEffect, useState } from "react";
import {
  listCoupons,
  createCoupon,
  deleteCoupon,
  type AdminCoupon,
} from "@/lib/api/admin";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// today / +30d as yyyy-mm-dd for the default validity window.
function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function AdminCoupons() {
  const [list, setList] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  // form
  const [code, setCode] = useState("");
  const [type, setType] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [value, setValue] = useState("");
  const [validFrom, setValidFrom] = useState(todayStr());
  const [validTo, setValidTo] = useState(todayStr(30));
  const [usageLimit, setUsageLimit] = useState("");

  async function refresh() {
    try {
      setList(await listCoupons());
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
    const v = Number(value);
    if (!code.trim() || !v || busy) return;
    setBusy(true);
    try {
      await createCoupon({
        code: code.trim().toUpperCase(),
        type,
        value: v,
        validFrom,
        validTo,
        usageLimit: usageLimit ? Number(usageLimit) : null,
      });
      setCode("");
      setValue("");
      setUsageLimit("");
      setCreating(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 쿠폰을 삭제할까요?")) return;
    setList((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteCoupon(id);
    } catch {
      await refresh();
    }
  }

  const activeCount = list.filter((c) => c.active).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>쿠폰 관리</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>활성 쿠폰 {activeCount}개 · 전체 {list.length}개</p>
        </div>
        <button className="btn btn-primary press" onClick={() => setCreating((c) => !c)}>
          {creating ? "취소" : "+ 새 쿠폰"}
        </button>
      </div>

      {creating && (
        <div className="card" style={{ padding: 20, marginBottom: 18, display: "grid", gap: 12 }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="쿠폰 코드 (예: WELCOME10)"
            style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", textTransform: "uppercase" }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select value={type} onChange={(e) => setType(e.target.value as "FIXED" | "PERCENT")}
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
              <option value="PERCENT">정률(%)</option>
              <option value="FIXED">정액(₩)</option>
            </select>
            <input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder={type === "PERCENT" ? "할인율 (예: 10)" : "할인액 (예: 50000)"}
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 160 }} />
            <input value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} type="number" placeholder="사용 한도 (선택)"
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 150 }} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 13.5, color: "var(--text-2)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              시작 <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              종료 <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)}
                style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }} />
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
          등록된 쿠폰이 없습니다.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((c) => {
            const pct = c.usageLimit ? Math.min(100, (c.usedCount / c.usageLimit) * 100) : 0;
            return (
              <div key={c.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", opacity: c.active ? 1 : 0.55 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: "var(--bg-2)", display: "grid", placeItems: "center", fontSize: 22 }}>🎟</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong className="mono" style={{ fontSize: 15 }}>{c.code}</strong>
                      <span className="chip" style={{ fontSize: 11 }}>
                        {c.type === "PERCENT" ? `${c.value}%` : `₩${c.value.toLocaleString()}`}
                      </span>
                      <span className="chip" style={{ fontSize: 11, background: c.active ? "var(--secondary)" : "var(--border)", color: c.active ? "#fff" : "var(--text-2)", border: "none" }}>
                        {c.active ? "활성" : "만료/소진"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
                      {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""} 사용 · {fmtDate(c.validTo)}까지
                    </div>
                    {c.usageLimit != null && (
                      <div style={{ height: 5, borderRadius: 99, background: "var(--bg-2)", marginTop: 8, width: 180, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--secondary)" }} />
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px", color: "#e5484d" }} onClick={() => remove(c.id)}>
                  삭제
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

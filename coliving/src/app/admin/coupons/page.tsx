"use client";

import { useEffect, useState } from "react";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
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
  const [minSpend, setMinSpend] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");

  // 인라인 수정 — 목록의 카드 하나가 그대로 폼으로 바뀐다. code는 발급 후
  // 고정이라 수정 대상에서 뺐다 (백엔드도 couponUpdateSchema에서 code를
  // 아예 안 받는다). 생성 폼과 같은 필드 세트(minSpend/maxDiscount 포함)를
  // 유지 — 안 그러면 생성할 땐 되는데 수정할 땐 못 바꾸는 항목이 생긴다.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [editValue, setEditValue] = useState("");
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editValidTo, setEditValidTo] = useState("");
  const [editUsageLimit, setEditUsageLimit] = useState("");
  const [editMinSpend, setEditMinSpend] = useState("");
  const [editMaxDiscount, setEditMaxDiscount] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
        minSpend: minSpend ? Number(minSpend) : 0,
        maxDiscount:
          type === "PERCENT" && maxDiscount ? Number(maxDiscount) : null,
      });
      setCode("");
      setValue("");
      setUsageLimit("");
      setMinSpend("");
      setMaxDiscount("");
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

  function openEdit(c: AdminCoupon) {
    setEditingId(c.id);
    setEditType(c.type);
    setEditValue(String(c.value));
    setEditValidFrom(c.validFrom.slice(0, 10));
    setEditValidTo(c.validTo.slice(0, 10));
    setEditUsageLimit(c.usageLimit != null ? String(c.usageLimit) : "");
    setEditMinSpend(c.minSpend > 0 ? String(c.minSpend) : "");
    setEditMaxDiscount(c.maxDiscount != null ? String(c.maxDiscount) : "");
    setEditError(null);
  }

  function cancelEdit() {
    if (editBusy) return;
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (editBusy) return;
    const v = Number(editValue);
    if (!v) {
      setEditError("할인값을 입력해주세요.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await updateCoupon(id, {
        type: editType,
        value: v,
        validFrom: editValidFrom,
        validTo: editValidTo,
        usageLimit: editUsageLimit ? Number(editUsageLimit) : null,
        minSpend: editMinSpend ? Number(editMinSpend) : 0,
        maxDiscount:
          editType === "PERCENT" && editMaxDiscount ? Number(editMaxDiscount) : null,
      });
      setList((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "수정하지 못했어요.");
    } finally {
      setEditBusy(false);
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
          <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
            쿠폰은 첫 달 월세에만 적용됩니다. 보증금·청소비·관리비·서비스 수수료는 할인 대상이 아닙니다.
          </p>
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
            <input value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} type="number" placeholder="사용 가능 인원수 (선택)"
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 170 }} />
            <input value={minSpend} onChange={(e) => setMinSpend(e.target.value)} type="number" placeholder="최소 첫 달 월세"
              style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 170 }} />
            {type === "PERCENT" && (
              <input value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} type="number" placeholder="최대 할인액 (선택)"
                style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 170 }} />
            )}
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

            if (editingId === c.id) {
              return (
                <div key={c.id} className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong className="mono" style={{ fontSize: 15 }}>{c.code}</strong>
                    <span style={{ fontSize: 12, color: "var(--text-2)" }}>(코드는 수정할 수 없어요)</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={editType} onChange={(e) => setEditType(e.target.value as "FIXED" | "PERCENT")}
                      style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                      <option value="PERCENT">정률(%)</option>
                      <option value="FIXED">정액(₩)</option>
                    </select>
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)} type="number"
                      placeholder={editType === "PERCENT" ? "할인율 (예: 10)" : "할인액 (예: 50000)"}
                      style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 160 }} />
                    <input value={editUsageLimit} onChange={(e) => setEditUsageLimit(e.target.value)} type="number"
                      placeholder="사용 가능 인원수 (선택)"
                      style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 170 }} />
                    <input value={editMinSpend} onChange={(e) => setEditMinSpend(e.target.value)} type="number"
                      placeholder="최소 첫 달 월세"
                      style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 170 }} />
                    {editType === "PERCENT" && (
                      <input value={editMaxDiscount} onChange={(e) => setEditMaxDiscount(e.target.value)} type="number"
                        placeholder="최대 할인액 (선택)"
                        style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", width: 170 }} />
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 13.5, color: "var(--text-2)" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      시작 <input type="date" value={editValidFrom} onChange={(e) => setEditValidFrom(e.target.value)}
                        style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      종료 <input type="date" value={editValidTo} onChange={(e) => setEditValidTo(e.target.value)}
                        style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }} />
                    </label>
                  </div>
                  {editError && <p style={{ fontSize: 12.5, color: "var(--primary)" }}>{editError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary press" style={{ opacity: editBusy ? 0.6 : 1 }}
                      onClick={() => saveEdit(c.id)} disabled={editBusy}>
                      {editBusy ? "저장 중…" : "저장"}
                    </button>
                    <button className="btn btn-ghost press" onClick={cancelEdit} disabled={editBusy}>
                      취소
                    </button>
                  </div>
                </div>
              );
            }

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
                      {c.minSpend > 0 ? ` · 첫 달 월세 ₩${c.minSpend.toLocaleString()} 이상` : ""}
                      {c.maxDiscount ? ` · 최대 ₩${c.maxDiscount.toLocaleString()} 할인` : ""}
                    </div>
                    {c.usageLimit != null && (
                      <div style={{ height: 5, borderRadius: 99, background: "var(--bg-2)", marginTop: 8, width: 180, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "var(--secondary)" }} />
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px" }} onClick={() => openEdit(c)}>
                    수정
                  </button>
                <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px", color: "#e5484d" }} onClick={() => remove(c.id)}>
                  삭제
                </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

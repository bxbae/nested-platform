"use client";

import { useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { pendingListings } from "@/lib/admin";

export default function AdminApprovals() {
  const [list, setList] = useState(() => pendingListings());
  const [done, setDone] = useState<Record<string, "승인" | "반려">>({});

  const pending = list.filter((p) => !done[p.id]);

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>숙소 승인</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>승인 대기 {pending.length}건</p>

      {pending.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          모든 숙소를 검토했습니다.
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((p) => {
          const status = done[p.id];
          return (
            <div key={p.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", opacity: status ? 0.6 : 1 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
                <span style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg, ${p.color}44, ${p.color}88)` }} />
                <div style={{ minWidth: 0 }}>
                  <Link href={`/homes/${p.id}`}><strong style={{ fontSize: 15 }}>{p.name}</strong></Link>
                  <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>
                    {p.host} · {p.region} · {won(p.monthlyRent)}/월
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>제출일 {p.submitted}</div>
                </div>
              </div>
              {status ? (
                <span className="chip" style={{ fontSize: 12, background: status === "승인" ? "var(--secondary)" : "var(--border)", color: status === "승인" ? "#fff" : "var(--text-2)", border: "none" }}>
                  {status}됨
                </span>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary press" style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => setDone((d) => ({ ...d, [p.id]: "승인" }))}>
                    승인
                  </button>
                  <button className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 16px" }} onClick={() => setDone((d) => ({ ...d, [p.id]: "반려" }))}>
                    반려
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

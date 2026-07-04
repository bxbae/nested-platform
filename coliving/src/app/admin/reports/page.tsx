"use client";

import { useState } from "react";
import { reports as loadReports } from "@/lib/admin";

const STATUS_COLOR: Record<string, string> = {
  접수: "var(--warning)",
  검토중: "var(--secondary)",
  처리완료: "var(--text-2)",
};

export default function AdminReports() {
  const [list, setList] = useState(() => loadReports());

  function advance(id: string) {
    setList((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: r.status === "접수" ? "검토중" : r.status === "검토중" ? "처리완료" : "처리완료" }
          : r
      )
    );
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>신고 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        미처리 {list.filter((r) => r.status !== "처리완료").length}건
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((r) => (
          <div key={r.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="chip" style={{ fontSize: 11 }}>{r.targetType}</span>
                  <strong style={{ fontSize: 15 }}>{r.target}</strong>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 6 }}>
                  사유: {r.reason}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>
                  신고자 {r.reporter} · {r.date}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <span className="chip" style={{ fontSize: 11, background: STATUS_COLOR[r.status], color: r.status === "처리완료" ? "var(--text-2)" : "#fff", border: "none" }}>
                  {r.status}
                </span>
                {r.status !== "처리완료" && (
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px" }} onClick={() => advance(r.id)}>
                    {r.status === "접수" ? "검토 시작" : "처리 완료"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

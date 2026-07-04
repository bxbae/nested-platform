import { won } from "@/lib/format";
import { payments } from "@/lib/me";

export const metadata = { title: "결제 내역 · Nested" };

export default function Payments() {
  const list = payments();
  const total = list.filter((p) => p.status === "완료").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>결제 내역</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        총 결제 금액 {won(total)}
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((p) => (
          <div key={p.id} className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span
                aria-hidden="true"
                style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-2)", display: "grid", placeItems: "center", fontSize: 20 }}
              >
                💳
              </span>
              <div>
                <strong style={{ fontSize: 15 }}>{p.houseName}</strong>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>
                  {p.method} · {p.date}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{won(p.amount)}</div>
              <span
                className="chip"
                style={{
                  fontSize: 11, marginTop: 4,
                  background: p.status === "완료" ? "var(--secondary)" : "var(--warning)",
                  color: "#fff", border: "none",
                }}
              >
                {p.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

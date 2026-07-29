"use client";

import { useEffect, useState } from "react";
import { getMyBadges, type TenantBadges } from "@/lib/api/badges";

// Shows the signed-in user's 6 achievement badges. The server always returns
// all 6 with `earned: true/false` — unearned ones render greyed out so the
// grid also works as a "what's next" hint, not just a trophy case.
export function MyBadges() {
  const [data, setData] = useState<TenantBadges | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyBadges()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || data.badges.length === 0) return null;

  return (
    <div className="card" style={{ padding: 22, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>내 배지</strong>
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
          {data.ratingAverage !== null && (
            <>★ {data.ratingAverage} · 받은 평가 {data.ratingCount}건 · </>
          )}
          작성 후기 {data.reviewsWritten}개
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        {data.badges.map((b) => (
          <div
            key={b.key}
            title={b.description}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)",
              background: b.earned ? "var(--secondary-soft)" : "var(--bg-2)",
              opacity: b.earned ? 1 : 0.55,
            }}
          >
            <span
              style={{
                fontSize: 18,
                filter: b.earned ? "none" : "grayscale(1)",
              }}
            >
              {b.icon}
            </span>
            <div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: b.earned ? "var(--text)" : "var(--text-2)",
                }}
              >
                {b.label}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{b.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

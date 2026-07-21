"use client";

import { useEffect, useState } from "react";
import { getMyBadges, type TenantBadges } from "@/lib/api/badges";

// Shows the signed-in user's badges: rating badges (from reviews hosts left
// about them as a tenant) and activity badges (from reviews they've written).
export function MyBadges() {
  const [data, setData] = useState<TenantBadges | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyBadges()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data) return null;

  const hasNothing = data.badges.length === 0 && data.ratingCount === 0 && data.reviewsWritten === 0;
  if (hasNothing) return null;

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

      {data.badges.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
          아직 획득한 배지가 없어요. 후기를 남기고 좋은 평가를 받으면 배지가 생깁니다.
        </p>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {data.badges.map((b) => (
            <div
              key={b.key}
              title={b.description}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "var(--secondary-soft, #f2fbfa)",
              }}
            >
              <span style={{ fontSize: 18 }}>{b.icon}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{b.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

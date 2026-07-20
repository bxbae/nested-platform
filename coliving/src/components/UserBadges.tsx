// 배치 위치: src/components/UserBadges.tsx
"use client";

// Trust badges shown next to a person's name across the app: 내 프로필, 매칭
// 카드, 리뷰 작성자. One component so the styling stays consistent — the API
// returns the same `{ verified, tier, tierLabel }` block everywhere.

export type ActivityTier = "SEED" | "REGULAR" | "TRUSTED";

const TIER_STYLE: Record<ActivityTier, { bg: string; fg: string; border: string }> = {
  // Newcomers get a quiet outline rather than a colour, so the badge reads as
  // "no history yet" instead of a demerit.
  SEED: { bg: "transparent", fg: "var(--text-2)", border: "1px solid var(--border)" },
  REGULAR: { bg: "var(--bg-2)", fg: "var(--text)", border: "1px solid var(--border)" },
  TRUSTED: { bg: "var(--secondary)", fg: "#fff", border: "none" },
};

export function UserBadges({
  verified,
  tier,
  tierLabel,
  size = "sm",
}: {
  verified?: boolean;
  tier?: ActivityTier;
  tierLabel?: string;
  size?: "sm" | "md";
}) {
  if (!verified && !tier) return null;

  const fs = size === "md" ? 11.5 : 10;
  const pad = size === "md" ? "2px 8px" : "1px 6px";
  const style = tier ? TIER_STYLE[tier] : null;

  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", verticalAlign: "middle" }}>
      {verified && (
        <span
          title="신원이 확인된 사용자입니다"
          style={{
            fontSize: fs, fontWeight: 700, padding: pad, borderRadius: 999,
            background: "var(--secondary)", color: "#fff", whiteSpace: "nowrap",
          }}
        >
          ✓ 인증
        </span>
      )}
      {tier && tierLabel && style && (
        <span
          title="이용 이력을 바탕으로 한 활동 등급입니다"
          style={{
            fontSize: fs, fontWeight: 700, padding: pad, borderRadius: 999,
            background: style.bg, color: style.fg, border: style.border, whiteSpace: "nowrap",
          }}
        >
          {tierLabel}
        </span>
      )}
    </span>
  );
}

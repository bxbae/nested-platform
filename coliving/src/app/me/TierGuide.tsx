// 배치 위치: src/app/me/TierGuide.tsx
"use client";

import { useAuth } from "@/lib/api/useAuth";
import { UserBadges } from "@/components/UserBadges";

// 활동 등급 안내.
//
// 프로필에 뱃지만 띄우면 "왜 내가 새싹인지" 알 수가 없다. 기준을 함께 보여주고,
// 다음 등급까지 무엇이 얼마나 남았는지 짚어 준다. 수치는 서버가 계산해 내려준
// completedStays / reviewsWritten 을 그대로 쓴다 — 클라이언트가 등급을 다시
// 계산하면 서버와 어긋날 수 있다.

const TIERS = [
  { key: "SEED", label: "새싹", desc: "이용 이력이 아직 없어요" },
  { key: "REGULAR", label: "일반", desc: "완료한 숙박 1회 이상" },
  { key: "TRUSTED", label: "우수", desc: "완료한 숙박 3회 또는 리뷰 3개 이상" },
] as const;

export function TierGuide() {
  const { user } = useAuth();
  if (!user) return null;

  const stays = user.completedStays ?? 0;
  const reviews = user.reviewsWritten ?? 0;
  const tier = user.tier ?? "SEED";

  // 다음 등급까지 남은 조건. 우수면 더 올라갈 곳이 없다.
  let nextHint: string | null = null;
  if (tier === "SEED") {
    nextHint = "숙박을 한 번 완료하면 ‘일반’ 등급이 돼요.";
  } else if (tier === "REGULAR") {
    const byStay = Math.max(0, 3 - stays);
    const byReview = Math.max(0, 3 - reviews);
    nextHint =
      byStay <= byReview
        ? `숙박 ${byStay}회를 더 완료하면 ‘우수’ 등급이 돼요.`
        : `리뷰 ${byReview}개를 더 쓰면 ‘우수’ 등급이 돼요.`;
  }

  return (
    <section className="card" style={{ padding: 22, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 16 }}>활동 등급</strong>
        <UserBadges
          verified={user.verified}
          tier={user.tier}
          tierLabel={user.tierLabel}
        />
      </div>

      <p style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.6 }}>
        완료한 숙박 <strong style={{ color: "var(--text)" }}>{stays}회</strong> · 작성한 리뷰{" "}
        <strong style={{ color: "var(--text)" }}>{reviews}개</strong>
        {nextHint && <> — {nextHint}</>}
      </p>

      {/* 기준표 — 현재 등급을 강조해 어디쯤인지 한눈에 보이게 한다 */}
      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {TIERS.map((t) => {
          const current = t.key === tier;
          return (
            <div
              key={t.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                background: current ? "var(--bg-2)" : "transparent",
                border: current ? "1px solid var(--secondary)" : "1px solid var(--border)",
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: current ? "var(--secondary)" : "transparent",
                  color: current ? "#fff" : "var(--text-2)",
                  border: current ? "none" : "1px solid var(--border)",
                  flexShrink: 0,
                }}
              >
                {t.label}
              </span>
              <span style={{ fontSize: 13, color: current ? "var(--text)" : "var(--text-2)" }}>
                {t.desc}
              </span>
              {current && (
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--secondary)", fontWeight: 600 }}>
                  현재
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 14, lineHeight: 1.6 }}>
        ✓ 인증 뱃지는 운영팀이 신원을 확인한 계정에 부여됩니다. 등급과는 별개예요.
      </p>
    </section>
  );
}

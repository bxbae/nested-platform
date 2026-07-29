// 배치 위치: src/common/activity-tier.ts
//
// 활동 등급 (Activity tier).
//
// 완료된 예약 수와 작성한 리뷰 수로 매 조회 시 계산한다 — 저장 컬럼이 없어
// 배지가 실제 활동과 어긋날 일이 없다. 플랫폼이 아직 작아서 상위 등급도
// 닿을 수 있도록 문턱을 낮게 잡았다.
//
// common/ 에 두는 이유: auth(내 프로필), match(상대 카드),
// reviews(작성자 배지), admin(회원 관리) 이 모두 같은 값을 렌더링한다.

export type ActivityTier =
  | "SEED"      // 새싹 — 활동 시작 전
  | "SPROUT"    // 새 이웃 — 첫 활동
  | "REGULAR"   // 이웃 — 꾸준한 활동
  | "TRUSTED"   // 신뢰 이웃 — 활발한 활동
  | "ELITE";    // 베스트 이웃 — 최상위

// 예약과 리뷰 중 하나만 기준을 넘어도 해당 등급으로 인정한다.
// (예약은 많지만 리뷰를 안 쓰는 사람, 반대인 사람 모두 배지를 받게.)
export function activityTier(
  completedStays: number,
  reviewsWritten: number,
): ActivityTier {
  if (completedStays >= 12 || reviewsWritten >= 10) return "ELITE";
  if (completedStays >= 6 || reviewsWritten >= 5) return "TRUSTED";
  if (completedStays >= 3 || reviewsWritten >= 3) return "REGULAR";
  if (completedStays >= 1 || reviewsWritten >= 1) return "SPROUT";
  return "SEED";
}

export const TIER_LABEL: Record<ActivityTier, string> = {
  SEED: "새싹",
  SPROUT: "새 이웃",
  REGULAR: "이웃",
  TRUSTED: "신뢰 이웃",
  ELITE: "베스트 이웃",
};

// 등급 비교·정렬용 순위 (admin 회원 관리에서 사용).
export const TIER_RANK: Record<ActivityTier, number> = {
  SEED: 0,
  SPROUT: 1,
  REGULAR: 2,
  TRUSTED: 3,
  ELITE: 4,
};

/**
 * Shape shared by every endpoint that returns a user's badges.
 * `verified` reflects an admin identity check; `tier` is computed above.
 */
export interface UserBadges {
  verified: boolean;
  tier: ActivityTier;
  tierLabel: string;
}

/** Build the badge block from the counts a Prisma query already fetched. */
export function toBadges(
  verifiedAt: Date | null,
  completedStays: number,
  reviewsWritten: number,
): UserBadges {
  const tier = activityTier(completedStays, reviewsWritten);
  return { verified: verifiedAt != null, tier, tierLabel: TIER_LABEL[tier] };
}

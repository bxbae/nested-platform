// 배치 위치: src/common/activity-tier.ts
//
// 활동 등급 (Activity tier).
//
// Derived on read from completed stays and reviews written — there is no stored
// column, so the badge can never drift from the underlying data. Thresholds are
// deliberately low: the platform is young and "우수" should stay reachable.
//
// Lives in common/ rather than inside a feature module because auth (내 프로필),
// match (상대 카드), reviews (작성자 뱃지), and admin (회원 관리) all render it.

export type ActivityTier = "SEED" | "REGULAR" | "TRUSTED";

export function activityTier(completedStays: number, reviewsWritten: number): ActivityTier {
  if (completedStays >= 3 || reviewsWritten >= 3) return "TRUSTED";
  if (completedStays >= 1) return "REGULAR";
  return "SEED";
}

export const TIER_LABEL: Record<ActivityTier, string> = {
  SEED: "새싹",
  REGULAR: "일반",
  TRUSTED: "우수",
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

// 배치 위치: src/common/__tests__/activity-tier.spec.ts
//
// 활동 등급 산출 규칙 검증. 완료된 숙박 수와 작성한 리뷰 수만으로 결정되며,
// 저장된 컬럼이 아니라 조회 시 계산하므로 데이터와 어긋날 일이 없다.

import { activityTier, TIER_LABEL, toBadges } from "../activity-tier";

describe("activityTier — 활동 등급", () => {
  it("이용 이력이 없으면 새싹", () => {
    expect(activityTier(0, 0)).toBe("SEED");
  });

  it("첫 활동이 있으면 새 이웃", () => {
    expect(activityTier(1, 0)).toBe("SPROUT");
    expect(activityTier(0, 1)).toBe("SPROUT");
    expect(activityTier(2, 2)).toBe("SPROUT");
  });

  it("숙박 또는 리뷰가 3건 이상이면 이웃", () => {
    expect(activityTier(3, 0)).toBe("REGULAR");
    expect(activityTier(0, 3)).toBe("REGULAR");
    expect(activityTier(5, 4)).toBe("REGULAR");
  });

  it("숙박 6건 또는 리뷰 5건 이상이면 신뢰 이웃", () => {
    expect(activityTier(6, 0)).toBe("TRUSTED");
    expect(activityTier(0, 5)).toBe("TRUSTED");
    expect(activityTier(11, 9)).toBe("TRUSTED");
  });

  it("숙박 12건 또는 리뷰 10건 이상이면 베스트 이웃", () => {
    expect(activityTier(12, 0)).toBe("ELITE");
    expect(activityTier(0, 10)).toBe("ELITE");
  });

  it("모든 등급에 한글 라벨이 있다", () => {
    expect(TIER_LABEL.SEED).toBe("새싹");
    expect(TIER_LABEL.SPROUT).toBe("새 이웃");
    expect(TIER_LABEL.REGULAR).toBe("이웃");
    expect(TIER_LABEL.TRUSTED).toBe("신뢰 이웃");
    expect(TIER_LABEL.ELITE).toBe("베스트 이웃");
  });
});

describe("toBadges — 응답용 뱃지 블록", () => {
  it("verifiedAt 이 있으면 verified=true", () => {
    const b = toBadges(new Date(), 0, 0);

    expect(b.verified).toBe(true);
    expect(b.tier).toBe("SEED");
    expect(b.tierLabel).toBe("새싹");
  });

  it("verifiedAt 이 null 이면 verified=false", () => {
    expect(toBadges(null, 0, 0).verified).toBe(false);
  });

  it("활동 수치가 등급과 라벨에 반영된다", () => {
    const b = toBadges(null, 6, 0);

    expect(b.tier).toBe("TRUSTED");
    expect(b.tierLabel).toBe("신뢰 이웃");
  });
});

// 배치 위치: src/common/__tests__/activity-tier.spec.ts
//
// 활동 등급 산출 규칙 검증. 완료된 숙박 수와 작성한 리뷰 수만으로 결정되며,
// 저장된 컬럼이 아니라 조회 시 계산하므로 데이터와 어긋날 일이 없다.
//
// 등급 함수는 admin 전용이 아니라 auth(내 프로필) · match(상대 카드) ·
// reviews(작성자)에서도 쓰이므로 common/ 으로 옮겼다.

import { activityTier, TIER_LABEL, toBadges } from "../activity-tier";

describe("activityTier — 활동 등급", () => {
  it("이용 이력이 없으면 새싹", () => {
    expect(activityTier(0, 0)).toBe("SEED");
  });

  it("완료된 숙박이 1건이면 일반", () => {
    expect(activityTier(1, 0)).toBe("REGULAR");
  });

  it("완료된 숙박이 3건 이상이면 우수", () => {
    expect(activityTier(3, 0)).toBe("TRUSTED");
    expect(activityTier(10, 0)).toBe("TRUSTED");
  });

  it("리뷰를 3건 이상 쓰면 숙박이 적어도 우수", () => {
    expect(activityTier(0, 3)).toBe("TRUSTED");
  });

  it("리뷰만 2건이면 아직 우수가 아니다", () => {
    expect(activityTier(0, 2)).toBe("SEED");
  });

  it("숙박 1건 + 리뷰 2건은 일반", () => {
    expect(activityTier(1, 2)).toBe("REGULAR");
  });

  it("모든 등급에 한글 라벨이 있다", () => {
    expect(TIER_LABEL.SEED).toBe("새싹");
    expect(TIER_LABEL.REGULAR).toBe("일반");
    expect(TIER_LABEL.TRUSTED).toBe("우수");
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

  it("활동 수치가 등급에 반영된다", () => {
    const b = toBadges(null, 5, 0);
    expect(b.tier).toBe("TRUSTED");
    expect(b.tierLabel).toBe("우수");
  });
});

import { scoreMatch, type PreferenceAnswers } from "../match.module";

// A baseline set of answers; individual tests override single axes.
const base: PreferenceAnswers = {
  noise: "QUIET",
  cleanliness: "VERY_TIDY",
  smoking: "NON_SMOKING_ONLY",
  pets: "NO_PETS",
  visitors: "PRIOR_AGREEMENT",
  sleep: "EARLY_BIRD",
  sociability: "PRIVATE",
  sharedSpace: "MINIMAL",
  drinking: "NON_DRINKER",
};

describe("scoreMatch", () => {
  it("identical preferences score 100 and are compatible", () => {
    const r = scoreMatch(base, base);
    expect(r.compatible).toBe(true);
    expect(r.score).toBe(100);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("hard-filters opposite smoking (NON_SMOKING_ONLY vs SMOKING_OK)", () => {
    const smoker: PreferenceAnswers = { ...base, smoking: "SMOKING_OK" };
    const r = scoreMatch(base, smoker);
    expect(r.compatible).toBe(false);
  });

  it("hard-filters opposite pets (NO_PETS vs PETS_OK)", () => {
    const petOwner: PreferenceAnswers = { ...base, pets: "PETS_OK" };
    expect(scoreMatch(base, petOwner).compatible).toBe(false);
  });

  it("hard-filters opposite visitors (PRIOR_AGREEMENT vs FREQUENT_OK)", () => {
    const social: PreferenceAnswers = { ...base, visitors: "FREQUENT_OK" };
    expect(scoreMatch(base, social).compatible).toBe(false);
  });

  it("does NOT hard-filter a one-step difference on a hard axis", () => {
    const midSmoker: PreferenceAnswers = { ...base, smoking: "OUTDOOR_OK" };
    const r = scoreMatch(base, midSmoker);
    expect(r.compatible).toBe(true);
    // one axis at gap 1 → lose 0.5 of 9 → ~94
    expect(r.score).toBe(Math.round((8.5 / 9) * 100));
  });

  it("scores a single one-step difference on a soft axis correctly", () => {
    const other: PreferenceAnswers = { ...base, noise: "MODERATE" };
    const r = scoreMatch(base, other);
    expect(r.compatible).toBe(true);
    expect(r.score).toBe(Math.round((8.5 / 9) * 100)); // 94
  });

  it("scores a two-step difference on a soft axis as zero for that axis", () => {
    const other: PreferenceAnswers = { ...base, noise: "LIVELY" };
    const r = scoreMatch(base, other);
    expect(r.compatible).toBe(true);
    // one axis at gap 2 → lose 1.0 of 9 → ~89
    expect(r.score).toBe(Math.round((8 / 9) * 100));
  });

  it("caps reasons at three", () => {
    const r = scoreMatch(base, base);
    expect(r.reasons.length).toBeLessThanOrEqual(3);
  });
});

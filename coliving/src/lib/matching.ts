import type { Resident, MatchPreferences, MatchResult } from "./types";

// Weighted compatibility scoring. Each factor contributes to a 0..100 score
// with human-readable reasons, so the result never feels like a black box.
export function scoreResident(
  pref: MatchPreferences,
  r: Resident
): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  // Sleep schedule — 25 pts
  if (pref.sleepSchedule === r.sleepSchedule) {
    score += 25;
    reasons.push(`Same rhythm — you're both ${labelSleep(r.sleepSchedule)}`);
  } else if (pref.sleepSchedule === "flexible" || r.sleepSchedule === "flexible") {
    score += 15;
    reasons.push("Flexible schedules that can meet in the middle");
  } else {
    reasons.push(`Different hours — you're ${labelSleep(pref.sleepSchedule)}, they're ${labelSleep(r.sleepSchedule)}`);
  }

  // Cleanliness — 25 pts, penalised by distance
  const cleanGap = Math.abs(pref.cleanliness - r.cleanliness);
  const cleanPts = Math.max(0, 25 - cleanGap * 8);
  score += cleanPts;
  if (cleanGap <= 1) reasons.push("Close on tidiness expectations");
  else if (cleanGap >= 3) reasons.push("Fairly different tidiness habits");

  // Social energy — 25 pts
  const socialGap = Math.abs(pref.social - r.social);
  const socialPts = Math.max(0, 25 - socialGap * 8);
  score += socialPts;
  if (socialGap <= 1) reasons.push("Matched social energy");
  else if (socialGap >= 3) reasons.push("One of you is far more social");

  // Shared interests — up to 15 pts
  const shared = pref.interests.filter((i) => r.interests.includes(i));
  const interestPts = Math.min(15, shared.length * 5);
  score += interestPts;
  if (shared.length > 0) {
    reasons.push(`Shared interests: ${shared.join(", ")}`);
  }

  // Lifestyle dealbreakers — 10 pts
  let lifestyle = 10;
  if (pref.smoker !== r.smoker) {
    lifestyle -= 5;
    reasons.push(r.smoker ? "They smoke, you don't" : "You smoke, they don't");
  }
  if (pref.pets !== r.pets) {
    lifestyle -= 5;
    if (r.pets) reasons.push("They have a pet");
  } else if (pref.pets && r.pets) {
    reasons.push("Both pet people");
  }
  score += Math.max(0, lifestyle);

  return {
    resident: r,
    score: Math.round(Math.min(100, score)),
    reasons,
  };
}

function labelSleep(s: Resident["sleepSchedule"]): string {
  if (s === "early") return "early risers";
  if (s === "night") return "night owls";
  return "flexible";
}

export function matchAll(
  pref: MatchPreferences,
  residents: Resident[]
): MatchResult[] {
  return residents
    .map((r) => scoreResident(pref, r))
    .sort((a, b) => b.score - a.score);
}

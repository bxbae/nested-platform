// ── Roommate match (성향 기반 매칭) ──────────────────────────────────
// Talks to GET /match on the NestJS API. In demo mode there's no cross-user
// data to match against, so it returns an empty list (the page then shows the
// "no candidates yet" state rather than fabricated matches).

import { USE_REAL_API } from "./config";
import { api } from "./client";

export interface MatchCandidate {
  userId: string;
  name: string;
  age: number | null;
  job: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  keywords: string[];
  score: number;
  reasons: string[];
  // Trust signals shown on the card.
  verified: boolean;
  tier: "SEED" | "REGULAR" | "TRUSTED";
  tierLabel: string;
}

export async function getMatches(): Promise<MatchCandidate[]> {
  if (!USE_REAL_API) return [];
  return api.get<MatchCandidate[]>("/match");
}

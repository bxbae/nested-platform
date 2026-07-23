// ── Roommate match (성향 기반 매칭) ──────────────────────────────────
// GET /match         → 기존 매칭 목록
// GET /match/:userId → 선택한 상대의 상세 정보

import { USE_REAL_API } from "./config";
import { api } from "./client";

export interface MatchCandidate {
  userId: string;
  name: string;
  // 서버가 생년월일에서 계산한 연령대(20/30/40). 정확한 생일은 내려오지 않는다.
  ageGroup: number | null;
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

export interface MatchDetail extends MatchCandidate {
  bio: string | null;
  intro: string | null;
  joinedYear: number;

  exactMatchCount: number;
  totalAxisCount: number;

  importantMatchCount: number;
  totalImportantCount: number;

  adjustmentPoints: string[];
}

// 기존 목록 함수 유지
export async function getMatches(): Promise<MatchCandidate[]> {
  if (!USE_REAL_API) {
    return [];
  }

  return api.get<MatchCandidate[]>("/match");
}

// 새 상세 함수
export async function getMatchDetail(userId: string): Promise<MatchDetail> {
  if (!USE_REAL_API) {
    throw new Error(
      "매칭 상세 정보는 실제 API 연결 상태에서만 조회할 수 있습니다.",
    );
  }

  return api.get<MatchDetail>(`/match/${encodeURIComponent(userId)}`);
}

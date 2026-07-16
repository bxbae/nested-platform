// ── Roommate preference (성향 설문) service ──────────────────────────
// Wraps GET/PUT /me/preference. In demo mode (no backend) the survey is kept
// in-memory so the portfolio deployment stays fully clickable.

import { USE_REAL_API } from "./config";
import { api } from "./client";

// The nine survey axes. Keys match the API's RoommatePreference fields;
// each value is one of three enum options (index 0 → 2, extreme → extreme),
// which the matching algorithm later scores by option distance.
export interface Preference {
  noise: "QUIET" | "MODERATE" | "LIVELY";
  cleanliness: "VERY_TIDY" | "MODERATE" | "RELAXED";
  smoking: "NON_SMOKING_ONLY" | "OUTDOOR_OK" | "SMOKING_OK";
  pets: "NO_PETS" | "CONDITIONAL" | "PETS_OK";
  visitors: "PRIOR_AGREEMENT" | "OCCASIONAL_OK" | "FREQUENT_OK";
  sleep: "EARLY_BIRD" | "FLEXIBLE" | "NIGHT_OWL";
  sociability: "PRIVATE" | "BALANCED" | "SOCIAL";
  sharedSpace: "MINIMAL" | "MODERATE" | "COMMUNAL";
  drinking: "NON_DRINKER" | "SOCIAL_DRINKER" | "FREQUENT";
}

export interface PreferenceView extends Preference {
  intro: string | null;
  keywords: string[];
  isCompleted: boolean;
}

export type PreferenceAxis = keyof Preference;

// UI metadata: question text + the three option labels, in enum order.
// Kept next to the type so the survey screen and any future editor share one
// source of truth for wording.
export const SURVEY: {
  axis: PreferenceAxis;
  question: string;
  options: { value: string; label: string }[];
}[] = [
  {
    axis: "noise",
    question: "선호하는 생활 소음 수준은?",
    options: [
      { value: "QUIET", label: "조용한 환경 선호" },
      { value: "MODERATE", label: "보통" },
      { value: "LIVELY", label: "활기찬 분위기도 좋아요" },
    ],
  },
  {
    axis: "cleanliness",
    question: "청결·정리 기준은?",
    options: [
      { value: "VERY_TIDY", label: "매우 깔끔하게 유지" },
      { value: "MODERATE", label: "적당히" },
      { value: "RELAXED", label: "느슨한 편" },
    ],
  },
  {
    axis: "smoking",
    question: "흡연 환경에 대한 생각은?",
    options: [
      { value: "NON_SMOKING_ONLY", label: "비흡연 환경만 가능" },
      { value: "OUTDOOR_OK", label: "실외 흡연은 괜찮아요" },
      { value: "SMOKING_OK", label: "흡연 무관" },
    ],
  },
  {
    axis: "pets",
    question: "반려동물에 대한 생각은?",
    options: [
      { value: "NO_PETS", label: "반려동물 불가" },
      { value: "CONDITIONAL", label: "조건부 가능" },
      { value: "PETS_OK", label: "반려동물 환영" },
    ],
  },
  {
    axis: "visitors",
    question: "방문객 허용 범위는?",
    options: [
      { value: "PRIOR_AGREEMENT", label: "사전 협의 필요" },
      { value: "OCCASIONAL_OK", label: "가끔은 괜찮아요" },
      { value: "FREQUENT_OK", label: "자유롭게 허용" },
    ],
  },
  {
    axis: "sleep",
    question: "생활 리듬은?",
    options: [
      { value: "EARLY_BIRD", label: "아침형" },
      { value: "FLEXIBLE", label: "유동적" },
      { value: "NIGHT_OWL", label: "저녁형" },
    ],
  },
  {
    axis: "sociability",
    question: "룸메이트와의 교류 정도는?",
    options: [
      { value: "PRIVATE", label: "각자 생활 선호" },
      { value: "BALANCED", label: "적당히" },
      { value: "SOCIAL", label: "자주 어울림" },
    ],
  },
  {
    axis: "sharedSpace",
    question: "공용 공간 사용 스타일은?",
    options: [
      { value: "MINIMAL", label: "최소한만 사용" },
      { value: "MODERATE", label: "보통" },
      { value: "COMMUNAL", label: "함께 자주 사용" },
    ],
  },
  {
    axis: "drinking",
    question: "음주 습관은?",
    options: [
      { value: "NON_DRINKER", label: "거의 안 함" },
      { value: "SOCIAL_DRINKER", label: "가끔" },
      { value: "FREQUENT", label: "자주" },
    ],
  },
];

// In-memory store for demo mode (module-scoped; resets on reload).
let demoPref: PreferenceView | null = null;

export async function getPreference(): Promise<PreferenceView | null> {
  if (!USE_REAL_API) return demoPref;
  return api.get<PreferenceView | null>("/me/preference");
}

export async function savePreference(
  input: Preference & { intro?: string },
): Promise<PreferenceView> {
  if (!USE_REAL_API) {
    demoPref = {
      ...input,
      intro: input.intro ?? null,
      keywords: extractKeywordsClient(input.intro),
      isCompleted: true,
    };
    return demoPref;
  }
  return api.put<PreferenceView>("/me/preference", input);
}

// Demo-mode keyword extraction mirrors the server's rule-based dictionary so
// the offline experience matches. The real API recomputes keywords server-side.
function extractKeywordsClient(intro?: string): string[] {
  if (!intro) return [];
  const rules: { m: string[]; k: string }[] = [
    { m: ["조용", "고요", "정숙"], k: "조용한환경" },
    { m: ["깔끔", "청결", "정리", "치우"], k: "청결중시" },
    { m: ["비흡연", "금연", "담배"], k: "비흡연환경" },
    { m: ["반려", "강아지", "고양이", "펫"], k: "반려동물" },
    { m: ["방문", "손님", "친구"], k: "방문객사전협의" },
    { m: ["아침", "일찍"], k: "아침형" },
    { m: ["밤", "야행", "늦"], k: "저녁형" },
    { m: ["운동", "헬스"], k: "운동" },
    { m: ["요리", "음식"], k: "요리" },
    { m: ["술", "음주", "와인", "맥주"], k: "음주" },
  ];
  const text = intro.toLowerCase();
  return rules
    .filter((r) => r.m.some((w) => text.includes(w.toLowerCase())))
    .map((r) => "#" + r.k);
}

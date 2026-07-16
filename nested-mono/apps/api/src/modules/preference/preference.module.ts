import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  Injectable,
  Module,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type {
  NoiseSensitivity,
  CleanlinessLevel,
  SmokingPreference,
  PetPreference,
  VisitorPolicy,
  SleepPattern,
  Sociability,
  SharedSpaceStyle,
  DrinkingHabit,
} from "@prisma/client";

// ── Input validation ────────────────────────────────────────────────
// The nine answers are required; the survey is submitted as a whole
// (스토리보드 1-2: 완료 후 isCompleted=true). `intro` is optional (1-3).
const surveySchema = z.object({
  noise: z.enum(["QUIET", "MODERATE", "LIVELY"]),
  cleanliness: z.enum(["VERY_TIDY", "MODERATE", "RELAXED"]),
  smoking: z.enum(["NON_SMOKING_ONLY", "OUTDOOR_OK", "SMOKING_OK"]),
  pets: z.enum(["NO_PETS", "CONDITIONAL", "PETS_OK"]),
  visitors: z.enum(["PRIOR_AGREEMENT", "OCCASIONAL_OK", "FREQUENT_OK"]),
  sleep: z.enum(["EARLY_BIRD", "FLEXIBLE", "NIGHT_OWL"]),
  sociability: z.enum(["PRIVATE", "BALANCED", "SOCIAL"]),
  sharedSpace: z.enum(["MINIMAL", "MODERATE", "COMMUNAL"]),
  drinking: z.enum(["NON_DRINKER", "SOCIAL_DRINKER", "FREQUENT"]),
  intro: z.string().max(1000).optional(),
});

type SurveyInput = z.infer<typeof surveySchema>;

// ── Rule-based keyword extraction (스토리보드 1-3) ────────────────────
// MVP has no API cost: a small dictionary maps substrings in the free-text
// answer to display keywords. Swappable for an LLM later without changing
// the stored shape (String[]). Order of KEYWORD_RULES = output order.
const KEYWORD_RULES: { match: string[]; keyword: string }[] = [
  { match: ["조용", "고요", "정숙"], keyword: "조용한환경" },
  { match: ["깔끔", "청결", "정리", "치우"], keyword: "청결중시" },
  { match: ["비흡연", "금연", "담배"], keyword: "비흡연환경" },
  { match: ["반려", "강아지", "고양이", "펫"], keyword: "반려동물" },
  { match: ["방문", "손님", "친구"], keyword: "방문객사전협의" },
  { match: ["아침", "일찍"], keyword: "아침형" },
  { match: ["밤", "야행", "늦"], keyword: "저녁형" },
  { match: ["운동", "헬스"], keyword: "운동" },
  { match: ["요리", "음식"], keyword: "요리" },
  { match: ["술", "음주", "와인", "맥주"], keyword: "음주" },
];

export function extractKeywords(intro?: string): string[] {
  if (!intro) return [];
  const text = intro.toLowerCase();
  const found: string[] = [];
  for (const rule of KEYWORD_RULES) {
    if (rule.match.some((m) => text.includes(m.toLowerCase()))) {
      found.push("#" + rule.keyword);
    }
  }
  return found;
}

export interface PreferenceView {
  noise: NoiseSensitivity;
  cleanliness: CleanlinessLevel;
  smoking: SmokingPreference;
  pets: PetPreference;
  visitors: VisitorPolicy;
  sleep: SleepPattern;
  sociability: Sociability;
  sharedSpace: SharedSpaceStyle;
  drinking: DrinkingHabit;
  intro: string | null;
  keywords: string[];
  isCompleted: boolean;
}

@Injectable()
export class PreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  // GET — returns the user's survey, or null if they haven't done it yet.
  // The frontend uses null to show the "성향 등록 CTA" (스토리보드 08).
  async get(userId: string): Promise<PreferenceView | null> {
    const p = await this.prisma.roommatePreference.findUnique({
      where: { userId },
    });
    if (!p) return null;
    return {
      noise: p.noise,
      cleanliness: p.cleanliness,
      smoking: p.smoking,
      pets: p.pets,
      visitors: p.visitors,
      sleep: p.sleep,
      sociability: p.sociability,
      sharedSpace: p.sharedSpace,
      drinking: p.drinking,
      intro: p.intro,
      keywords: p.keywords,
      isCompleted: p.isCompleted,
    };
  }

  // PUT — upsert. Used both for first-time onboarding submit and later edits
  // (스토리보드 08 수정 화면 reuses the same survey). Keywords are recomputed
  // from `intro` server-side so the client can't desync them. Submitting the
  // full survey marks it complete, which unlocks /match.
  async save(userId: string, input: SurveyInput): Promise<PreferenceView> {
    const keywords = extractKeywords(input.intro);
    const data = {
      noise: input.noise,
      cleanliness: input.cleanliness,
      smoking: input.smoking,
      pets: input.pets,
      visitors: input.visitors,
      sleep: input.sleep,
      sociability: input.sociability,
      sharedSpace: input.sharedSpace,
      drinking: input.drinking,
      intro: input.intro ?? null,
      keywords,
      isCompleted: true,
    };
    const p = await this.prisma.roommatePreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return {
      noise: p.noise,
      cleanliness: p.cleanliness,
      smoking: p.smoking,
      pets: p.pets,
      visitors: p.visitors,
      sleep: p.sleep,
      sociability: p.sociability,
      sharedSpace: p.sharedSpace,
      drinking: p.drinking,
      intro: p.intro,
      keywords: p.keywords,
      isCompleted: p.isCompleted,
    };
  }
}

// 룸메이트 성향 설문 (온보딩 · 마이페이지 수정 공용)
@Controller("me/preference")
@UseGuards(JwtAuthGuard)
export class PreferenceController {
  constructor(private readonly svc: PreferenceService) {}

  // GET /me/preference — current user's survey, or null if not completed.
  @Get()
  get(@Req() req: any) {
    return this.svc.get(req.user.id);
  }

  // PUT /me/preference — submit or update the survey; unlocks /match.
  @Put()
  save(
    @Req() req: any,
    @Body(new ZodValidationPipe(surveySchema)) dto: SurveyInput,
  ) {
    return this.svc.save(req.user.id, dto);
  }
}

@Module({
  controllers: [PreferenceController],
  providers: [PreferenceService],
})
export class PreferenceModule {}

import {
  Controller,
  Get,
  UseGuards,
  Req,
  Injectable,
  Module,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { toBadges, type ActivityTier } from "../../common/activity-tier";
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

// ── Matching algorithm (룸메이트 매칭) ────────────────────────────────
// Compares two RoommatePreference rows across the nine axes. Each enum is
// ordered extreme→middle→extreme, so an axis maps to index 0/1/2 and the gap
// between two people's choices measures compatibility.
//
// Design (confirmed with the team):
//   • Hard filter: smoking / pets / visitors — if the gap is 2 (opposite
//     extremes) the pair is incompatible and excluded entirely.
//   • Distance score: all nine axes, gap 0 → 1.0, gap 1 → 0.5, gap 2 → 0.
//   • Equal weight across the nine axes; final = average × 100.

// Enum option order (index = position). MUST match schema.prisma enum order.
const ORDER = {
  noise: ["QUIET", "MODERATE", "LIVELY"],
  cleanliness: ["VERY_TIDY", "MODERATE", "RELAXED"],
  smoking: ["NON_SMOKING_ONLY", "OUTDOOR_OK", "SMOKING_OK"],
  pets: ["NO_PETS", "CONDITIONAL", "PETS_OK"],
  visitors: ["PRIOR_AGREEMENT", "OCCASIONAL_OK", "FREQUENT_OK"],
  sleep: ["EARLY_BIRD", "FLEXIBLE", "NIGHT_OWL"],
  sociability: ["PRIVATE", "BALANCED", "SOCIAL"],
  sharedSpace: ["MINIMAL", "MODERATE", "COMMUNAL"],
  drinking: ["NON_DRINKER", "SOCIAL_DRINKER", "FREQUENT"],
} as const;

type Axis = keyof typeof ORDER;

// Axes that can make two people outright incompatible.
const HARD_FILTER_AXES: Axis[] = ["smoking", "pets", "visitors"];

// Human-readable "why you match" phrases, shown when an axis is a close match.
const MATCH_REASONS: Record<Axis, string> = {
  noise: "생활 소음 성향이 잘 맞아요",
  cleanliness: "청결 기준이 비슷해요",
  smoking: "흡연 환경이 잘 맞아요",
  pets: "반려동물 성향이 맞아요",
  visitors: "방문객 성향이 비슷해요",
  sleep: "생활 리듬이 잘 맞아요",
  sociability: "교류 성향이 비슷해요",
  sharedSpace: "공용공간 사용 방식이 맞아요",
  drinking: "음주 습관이 비슷해요",
};

export interface PreferenceAnswers {
  noise: NoiseSensitivity;
  cleanliness: CleanlinessLevel;
  smoking: SmokingPreference;
  pets: PetPreference;
  visitors: VisitorPolicy;
  sleep: SleepPattern;
  sociability: Sociability;
  sharedSpace: SharedSpaceStyle;
  drinking: DrinkingHabit;
}

export interface MatchScore {
  compatible: boolean; // false when a hard filter excludes the pair
  score: number; // 0–100 (only meaningful when compatible)
  reasons: string[]; // top matching axes, human-readable
}

// Pure scoring function — no DB, easy to unit test.
export function scoreMatch(a: PreferenceAnswers, b: PreferenceAnswers): MatchScore {
  const axes = Object.keys(ORDER) as Axis[];

  // 1) Hard filter: opposite extremes on a decisive axis → incompatible.
  for (const axis of HARD_FILTER_AXES) {
    const gap = Math.abs(idx(axis, a[axis]) - idx(axis, b[axis]));
    if (gap === 2) {
      return { compatible: false, score: 0, reasons: [] };
    }
  }

  // 2) Distance score across all nine axes.
  let total = 0;
  const perfectAxes: Axis[] = [];
  for (const axis of axes) {
    const gap = Math.abs(idx(axis, a[axis]) - idx(axis, b[axis]));
    const points = gap === 0 ? 1 : gap === 1 ? 0.5 : 0;
    total += points;
    if (gap === 0) perfectAxes.push(axis);
  }
  const score = Math.round((total / axes.length) * 100);

  // 3) Reasons: up to three perfectly-matched axes.
  const reasons = perfectAxes.slice(0, 3).map((axis) => MATCH_REASONS[axis]);

  return { compatible: true, score, reasons };
}

function idx(axis: Axis, value: string): number {
  const i = (ORDER[axis] as readonly string[]).indexOf(value);
  return i === -1 ? 1 : i; // unknown → treat as middle, defensive
}

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
  // Trust signals — an admin identity check and an activity tier derived from
  // completed stays / reviews. Helps judge a stranger before reaching out.
  verified: boolean;
  tier: ActivityTier;
  tierLabel: string;
}

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns compatible candidates for the current user, best score first.
  // Privacy: we never return other users' raw preference answers — only the
  // computed score, reasons, and minimal public profile fields.
  async matchesFor(userId: string): Promise<MatchCandidate[]> {
    const me = await this.prisma.roommatePreference.findUnique({ where: { userId } });
    if (!me || !me.isCompleted) {
      // Caller should have completed the survey; empty list is a safe default.
      return [];
    }

    // Everyone else who finished the survey. In a larger system this would be
    // paginated / pre-filtered by region; fine for the current scale.
    const others = await this.prisma.roommatePreference.findMany({
      where: { isCompleted: true, userId: { not: userId } },
      include: {
        user: {
          select: {
            id: true, name: true, age: true, job: true,
            avatarColor: true, avatarUrl: true, suspended: true, deletedAt: true,
            verifiedAt: true,
            _count: { select: { reviews: true } },
            reservations: { where: { status: "COMPLETED" }, select: { id: true } },
          },
        },
      },
    });

    const candidates: MatchCandidate[] = [];
    for (const other of others) {
      // Skip suspended/deleted accounts.
      if (other.user.suspended || other.user.deletedAt) continue;

      const result = scoreMatch(me, other);
      if (!result.compatible) continue; // hard-filtered out

      const badges = toBadges(
        other.user.verifiedAt,
        other.user.reservations.length,
        other.user._count.reviews,
      );

      candidates.push({
        userId: other.user.id,
        name: other.user.name,
        age: other.user.age,
        job: other.user.job,
        avatarColor: other.user.avatarColor,
        avatarUrl: other.user.avatarUrl,
        keywords: other.keywords,
        score: result.score,
        reasons: result.reasons,
        ...badges,
      });
    }

    // Best match first; tie-break by name for stable ordering.
    candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return candidates;
  }
}

// 룸메이트 매칭 (성향 기반)
@Controller("match")
@UseGuards(JwtAuthGuard)
export class MatchController {
  constructor(private readonly svc: MatchService) {}

  // GET /match — ranked compatible candidates for the current user.
  @Get()
  matches(@Req() req: any) {
    return this.svc.matchesFor(req.user.id);
  }
}

@Module({
  controllers: [MatchController],
  providers: [MatchService],
})
export class MatchModule {}

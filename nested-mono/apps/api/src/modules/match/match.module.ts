import {
  Controller,
  Get,
  UseGuards,
  Req,
  Injectable,
  Module,
  Param,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
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
// 기존 알고리즘 유지:
// • smoking / pets / visitors의 gap이 2면 매칭 제외
// • 9개 축의 gap 0 → 1점, gap 1 → 0.5점, gap 2 → 0점
// • 9개 축 동일 가중치
// • 점수 = 평균 × 100

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

const AXES = Object.keys(ORDER) as Axis[];

// 기존 하드 필터 유지
const HARD_FILTER_AXES: Axis[] = ["smoking", "pets", "visitors"];

// 기존 추천 문구 유지
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

// 상세 화면의 차이 안내에만 사용
const ADJUSTMENT_REASONS: Record<Axis, string> = {
  noise: "생활 소음 선호에 차이가 있어 대화가 필요해요",
  cleanliness: "청결 기준에 차이가 있어 조율이 필요해요",
  smoking: "흡연 환경에 대한 기준을 확인해보세요",
  pets: "반려동물에 대한 조건을 확인해보세요",
  visitors: "방문객 허용 범위를 확인해보세요",
  sleep: "생활 리듬에 차이가 있어 조율이 필요해요",
  sociability: "룸메이트와의 교류 정도를 확인해보세요",
  sharedSpace: "공용공간 사용 방식에 차이가 있어요",
  drinking: "음주 습관에 차이가 있어요",
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
  compatible: boolean;
  score: number;
  reasons: string[];
}

// 기존 순수 점수 함수 유지
export function scoreMatch(
  a: PreferenceAnswers,
  b: PreferenceAnswers,
): MatchScore {
  // 1. 기존 하드 필터
  for (const axis of HARD_FILTER_AXES) {
    const gap = Math.abs(idx(axis, a[axis]) - idx(axis, b[axis]));

    if (gap === 2) {
      return {
        compatible: false,
        score: 0,
        reasons: [],
      };
    }
  }

  // 2. 기존 9개 축 거리 점수
  let total = 0;
  const perfectAxes: Axis[] = [];

  for (const axis of AXES) {
    const gap = Math.abs(idx(axis, a[axis]) - idx(axis, b[axis]));

    const points = gap === 0 ? 1 : gap === 1 ? 0.5 : 0;

    total += points;

    if (gap === 0) {
      perfectAxes.push(axis);
    }
  }

  const score = Math.round((total / AXES.length) * 100);

  // 3. 기존 추천 이유: 완전히 일치한 축 중 최대 3개
  const reasons = perfectAxes.slice(0, 3).map((axis) => MATCH_REASONS[axis]);

  return {
    compatible: true,
    score,
    reasons,
  };
}

function idx(axis: Axis, value: string): number {
  const index = (ORDER[axis] as readonly string[]).indexOf(value);

  // 기존 방어 로직 유지
  return index === -1 ? 1 : index;
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
}

// 상세 모달 전용 응답 타입
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

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  // 기존 GET /match 기능 유지
  async matchesFor(userId: string): Promise<MatchCandidate[]> {
    const me = await this.prisma.roommatePreference.findUnique({
      where: { userId },
    });

    if (!me || !me.isCompleted) {
      return [];
    }

    const others = await this.prisma.roommatePreference.findMany({
      where: {
        isCompleted: true,
        userId: {
          not: userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            age: true,
            job: true,
            avatarColor: true,
            avatarUrl: true,
            suspended: true,
            deletedAt: true,
          },
        },
      },
    });

    const candidates: MatchCandidate[] = [];

    for (const other of others) {
      if (other.user.suspended || other.user.deletedAt) {
        continue;
      }

      const result = scoreMatch(me, other);

      if (!result.compatible) {
        continue;
      }

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
      });
    }

    // 기존 정렬 방식 유지
    candidates.sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    );

    return candidates;
  }

  // 새 기능:
  // GET /match/:userId
  async matchDetail(
    currentUserId: string,
    targetUserId: string,
  ): Promise<MatchDetail> {
    if (currentUserId === targetUserId) {
      throw new NotFoundException(
        "자신의 프로필은 매칭 상세에서 조회할 수 없습니다.",
      );
    }

    const [me, target] = await Promise.all([
      this.prisma.roommatePreference.findUnique({
        where: {
          userId: currentUserId,
        },
      }),

      this.prisma.roommatePreference.findUnique({
        where: {
          userId: targetUserId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              age: true,
              job: true,
              bio: true,
              avatarColor: true,
              avatarUrl: true,
              createdAt: true,
              suspended: true,
              deletedAt: true,
            },
          },
        },
      }),
    ]);

    if (!me || !me.isCompleted) {
      throw new NotFoundException("생활 성향 설문을 먼저 완료해주세요.");
    }

    if (
      !target ||
      !target.isCompleted ||
      target.user.suspended ||
      target.user.deletedAt
    ) {
      throw new NotFoundException("매칭 사용자를 찾을 수 없습니다.");
    }

    const result = scoreMatch(me, target);

    // 기존 목록에서 제외되는 사용자는
    // 상세 URL로 직접 접근해도 볼 수 없도록 처리
    if (!result.compatible) {
      throw new NotFoundException("매칭 가능한 사용자가 아닙니다.");
    }

    const analysis = analyzeAxes(me, target);

    return {
      userId: target.user.id,
      name: target.user.name,
      age: target.user.age,
      job: target.user.job,
      avatarColor: target.user.avatarColor,
      avatarUrl: target.user.avatarUrl,

      bio: target.user.bio,
      intro: target.intro,
      joinedYear: target.user.createdAt.getFullYear(),

      keywords: target.keywords,

      // 기존 scoreMatch 결과 그대로 사용
      score: result.score,
      reasons: result.reasons,

      exactMatchCount: analysis.exactMatchCount,
      totalAxisCount: AXES.length,

      importantMatchCount: analysis.importantMatchCount,
      totalImportantCount: HARD_FILTER_AXES.length,

      adjustmentPoints: analysis.adjustmentPoints,
    };
  }
}

// 상세 표시용 부가 정보 계산
// 기존 scoreMatch 점수에는 영향을 주지 않습니다.
function analyzeAxes(a: PreferenceAnswers, b: PreferenceAnswers) {
  let exactMatchCount = 0;
  let importantMatchCount = 0;

  const differences: {
    axis: Axis;
    gap: number;
  }[] = [];

  for (const axis of AXES) {
    const gap = Math.abs(idx(axis, a[axis]) - idx(axis, b[axis]));

    if (gap === 0) {
      exactMatchCount += 1;

      if (HARD_FILTER_AXES.includes(axis)) {
        importantMatchCount += 1;
      }
    } else {
      differences.push({
        axis,
        gap,
      });
    }
  }

  // 차이가 큰 항목부터 최대 2개 표시
  const adjustmentPoints = differences
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 2)
    .map(({ axis }) => ADJUSTMENT_REASONS[axis]);

  return {
    exactMatchCount,
    importantMatchCount,
    adjustmentPoints,
  };
}

// 룸메이트 매칭
@Controller("match")
@UseGuards(JwtAuthGuard)
export class MatchController {
  constructor(private readonly svc: MatchService) {}

  // 기존 API 유지
  // GET /match
  @Get()
  matches(@Req() req: any) {
    return this.svc.matchesFor(req.user.id);
  }

  // 새 API 추가
  // GET /match/:userId
  @Get(":userId")
  detail(@Req() req: any, @Param("userId") userId: string) {
    return this.svc.matchDetail(req.user.id, userId);
  }
}

@Module({
  controllers: [MatchController],
  providers: [MatchService],
})
export class MatchModule {}

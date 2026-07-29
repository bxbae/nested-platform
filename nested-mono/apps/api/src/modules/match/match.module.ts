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
import { ageGroup } from "../../common/age-group";

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

const HARD_FILTER_AXES: Axis[] = ["smoking", "pets", "visitors"];

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

type UserGender = "MALE" | "FEMALE" | "OTHER";

type GenderVisibilityValue = "PUBLIC" | "MATCHED_ONLY" | "PRIVATE";

type VisibleGender = "MALE" | "FEMALE" | null;

type RoommateGenderPreferenceValue = "ANY" | "MALE" | "FEMALE";

interface GenderMatchProfile {
  gender: UserGender;
  roommateGenderPreference: RoommateGenderPreferenceValue;
}

export function acceptsGender(
  preference: RoommateGenderPreferenceValue,
  targetGender: UserGender,
): boolean {
  if (preference === "ANY") {
    return true;
  }

  // 기존 OTHER 사용자는 성별을 다시 선택하기 전까지
  // 남성 또는 여성 지정 선호와 일치시키지 않는다.
  if (targetGender === "OTHER") {
    return false;
  }

  return preference === targetGender;
}

export function isMutuallyGenderCompatible(
  first: GenderMatchProfile,
  second: GenderMatchProfile,
): boolean {
  return (
    acceptsGender(first.roommateGenderPreference, second.gender) &&
    acceptsGender(second.roommateGenderPreference, first.gender)
  );
}

export function resolveVisibleGender(
  gender: UserGender,
  visibility: GenderVisibilityValue,
  isMatched: boolean,
): VisibleGender {
  // 기존 OTHER 사용자는 남성 또는 여성을 다시 선택할 때까지
  // 다른 사용자에게 성별을 공개하지 않는다.
  if (gender === "OTHER") {
    return null;
  }

  if (visibility === "PUBLIC") {
    return gender;
  }

  if (visibility === "MATCHED_ONLY" && isMatched) {
    return gender;
  }

  return null;
}

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
  // perfectAxes 전체 목록. reasons는 사람이 읽는 문장 3개로 잘리지만,
  // 프론트의 "겹치는 항목으로 좁혀보기" 필터는 9개 축 전부가 필요하다.
  matchedAxes: Axis[];
}

export function scoreMatch(
  a: PreferenceAnswers,
  b: PreferenceAnswers,
): MatchScore {
  for (const axis of HARD_FILTER_AXES) {
    const gap = Math.abs(idx(axis, a[axis]) - idx(axis, b[axis]));

    if (gap === 2) {
      return {
        compatible: false,
        score: 0,
        reasons: [],
        matchedAxes: [],
      };
    }
  }

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

  const reasons = perfectAxes.slice(0, 3).map((axis) => MATCH_REASONS[axis]);

  return {
    compatible: true,
    score,
    reasons,
    matchedAxes: perfectAxes,
  };
}

function idx(axis: Axis, value: string): number {
  const index = (ORDER[axis] as readonly string[]).indexOf(value);
  return index === -1 ? 1 : index;
}

export interface MatchCandidate {
  userId: string;
  name: string;
  // 정확한 나이 대신 연령대(20/30/40)만 노출한다.
  ageGroup: number | null;
  gender: VisibleGender;
  job: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  keywords: string[];
  score: number;
  reasons: string[];
  // 나와 정확히 일치하는 성향 축 전체 목록(9개 중 일부). "겹치는 룸메이트만
  // 보기" 필터가 이 배열로 후보를 좁힌다.
  matchedAxes: Axis[];
  verified: boolean;
  tier: ActivityTier;
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

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  async matchesFor(userId: string): Promise<MatchCandidate[]> {
    const me = await this.prisma.roommatePreference.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            gender: true,
            roommateGenderPreference: true,
          },
        },
      },
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
            birthDate: true,
            gender: true,
            genderVisibility: true,
            roommateGenderPreference: true,
            job: true,
            avatarColor: true,
            avatarUrl: true,
            suspended: true,
            deletedAt: true,
            verifiedAt: true,
            _count: {
              select: {
                reviews: true,
              },
            },
            reservations: {
              where: {
                status: "COMPLETED",
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    const candidates: MatchCandidate[] = [];

    for (const other of others) {
      if (other.user.suspended || other.user.deletedAt) {
        continue;
      }

      const genderCompatible = isMutuallyGenderCompatible(
        {
          gender: me.user.gender,
          roommateGenderPreference: me.user.roommateGenderPreference,
        },
        {
          gender: other.user.gender,
          roommateGenderPreference: other.user.roommateGenderPreference,
        },
      );

      if (!genderCompatible) {
        continue;
      }

      const result = scoreMatch(me, other);

      if (!result.compatible) {
        continue;
      }

      const badges = toBadges(
        other.user.verifiedAt,
        other.user.reservations.length,
        other.user._count.reviews,
      );

      candidates.push({
        userId: other.user.id,
        name: other.user.name,
        ageGroup: ageGroup(other.user.birthDate),
        gender: resolveVisibleGender(
          other.user.gender,
          other.user.genderVisibility,
          true,
        ),
        job: other.user.job,
        avatarColor: other.user.avatarColor,
        avatarUrl: other.user.avatarUrl,
        keywords: other.keywords,
        score: result.score,
        reasons: result.reasons,
        matchedAxes: result.matchedAxes,
        ...badges,
      });
    }

    candidates.sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    );

    return candidates;
  }

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
        include: {
          user: {
            select: {
              gender: true,
              roommateGenderPreference: true,
            },
          },
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
              birthDate: true,
              gender: true,
              genderVisibility: true,
              roommateGenderPreference: true,
              job: true,
              bio: true,
              avatarColor: true,
              avatarUrl: true,
              createdAt: true,
              suspended: true,
              deletedAt: true,
              verifiedAt: true,
              _count: {
                select: {
                  reviews: true,
                },
              },
              reservations: {
                where: {
                  status: "COMPLETED",
                },
                select: {
                  id: true,
                },
              },
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

    const genderCompatible = isMutuallyGenderCompatible(
      {
        gender: me.user.gender,
        roommateGenderPreference: me.user.roommateGenderPreference,
      },
      {
        gender: target.user.gender,
        roommateGenderPreference: target.user.roommateGenderPreference,
      },
    );

    if (!genderCompatible) {
      throw new NotFoundException(
        "서로의 룸메이트 성별 선호 조건에 맞지 않습니다.",
      );
    }

    const result = scoreMatch(me, target);

    if (!result.compatible) {
      throw new NotFoundException("매칭 가능한 사용자가 아닙니다.");
    }

    const analysis = analyzeAxes(me, target);

    const badges = toBadges(
      target.user.verifiedAt,
      target.user.reservations.length,
      target.user._count.reviews,
    );

    return {
      userId: target.user.id,
      name: target.user.name,
      ageGroup: ageGroup(target.user.birthDate),
      gender: resolveVisibleGender(
        target.user.gender,
        target.user.genderVisibility,
        true,
      ),
      job: target.user.job,
      avatarColor: target.user.avatarColor,
      avatarUrl: target.user.avatarUrl,

      bio: target.user.bio,
      intro: target.intro,
      joinedYear: target.user.createdAt.getFullYear(),

      keywords: target.keywords,
      score: result.score,
      reasons: result.reasons,
      matchedAxes: result.matchedAxes,

      exactMatchCount: analysis.exactMatchCount,
      totalAxisCount: AXES.length,

      importantMatchCount: analysis.importantMatchCount,
      totalImportantCount: HARD_FILTER_AXES.length,

      adjustmentPoints: analysis.adjustmentPoints,

      ...badges,
    };
  }
}

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

@Controller("match")
@UseGuards(JwtAuthGuard)
export class MatchController {
  constructor(private readonly svc: MatchService) {}

  @Get()
  matches(@Req() req: any) {
    return this.svc.matchesFor(req.user.id);
  }

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

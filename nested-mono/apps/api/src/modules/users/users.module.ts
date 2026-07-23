// 배치 위치: src/modules/users/users.module.ts
import { Controller, Get, Param, NotFoundException, Injectable, Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { toBadges } from "../../common/activity-tier";
import { ageGroup } from "../../common/age-group";

// 공개 프로필 (커뮤니티·리뷰에서 이름을 눌렀을 때 뜨는 정보).
//
// /auth/me 는 본인 것이고, /match/:userId 는 성향 설문을 마친 사람끼리만
// 볼 수 있다. 커뮤니티에서는 아무 글쓴이나 눌러 볼 수 있어야 하므로 별도
// 엔드포인트를 둔다.
//
// 무엇을 내보내고 무엇을 감추는지가 이 모듈의 핵심이다:
//   내보냄 — 이름, 사진, 가입 시기, 인증·활동 뱃지, 자기소개, 성향 키워드
//   감춤   — 이메일, 나이, 직업, 성향 설문의 개별 답변, 예약 이력
// 목적은 "이 사람과 이야기해도 될까"를 판단하는 것이지 신상을 파악하는 게
// 아니다. 성향은 원본 답변 대신 키워드만 보여준다.

export interface PublicProfile {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  // 생년월일 원본은 타인에게 노출하지 않고 연령대만 내보낸다.
  ageGroup: number | null;
  joinedYear: number;
  verified: boolean;
  tier: string;
  tierLabel: string;
  /** 생활 성향 설문에서 뽑은 키워드 (설문 미완료면 빈 배열) */
  keywords: string[];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async publicProfile(userId: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarColor: true,
        avatarUrl: true,
        bio: true,
        gender: true,
        birthDate: true,
        createdAt: true,
        deletedAt: true,
        suspended: true,
        verifiedAt: true,
        _count: { select: { reviews: true } },
        reservations: { where: { status: "COMPLETED" }, select: { id: true } },
        preference: { select: { keywords: true, isCompleted: true } },
      },
    });

    // 탈퇴·정지 계정은 없는 것으로 취급한다. 익명화된 이름을 굳이 노출할
    // 이유가 없고, 메시지를 보내도 닿지 않는다.
    if (!user || user.deletedAt || user.suspended) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "사용자를 찾을 수 없어요.",
      });
    }

    const badges = toBadges(
      user.verifiedAt,
      user.reservations.length,
      user._count.reviews,
    );

    return {
      id: user.id,
      name: user.name,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      gender: user.gender,
      ageGroup: ageGroup(user.birthDate),
      joinedYear: user.createdAt.getFullYear(),
      ...badges,
      keywords: user.preference?.isCompleted ? user.preference.keywords : [],
    };
  }
}

// 로그인 없이도 볼 수 있다 — 커뮤니티 글 자체가 공개이므로 글쓴이 프로필만
// 막을 이유가 없다. 메시지 보내기는 프론트에서 로그인 상태를 확인한다.
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // GET /users/:id — 공개 프로필
  @Get(":id")
  profile(@Param("id") id: string) {
    return this.users.publicProfile(id);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

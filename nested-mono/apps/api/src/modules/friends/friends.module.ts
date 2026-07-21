import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { toBadges } from "../../common/activity-tier";

function orderedPair(firstId: string, secondId: string): [string, string] {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

const publicUserSelect = {
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
  verifiedAt: true,
  preference: {
    select: {
      intro: true,
      keywords: true,
      isCompleted: true,
    },
  },
  _count: {
    select: {
      reviews: true,
    },
  },
  reservations: {
    where: {
      status: "COMPLETED" as const,
    },
    select: {
      id: true,
    },
  },
};

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async status(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      return { isFriend: false };
    }

    const [userAId, userBId] = orderedPair(currentUserId, targetUserId);
    const friendship = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true, createdAt: true },
    });

    return {
      isFriend: Boolean(friendship),
      friendshipId: friendship?.id ?? null,
      createdAt: friendship?.createdAt ?? null,
    };
  }

  async add(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new ForbiddenException("자기 자신을 친구로 추가할 수 없습니다.");
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, suspended: true, deletedAt: true },
    });

    if (!target || target.suspended || target.deletedAt) {
      throw new NotFoundException("친구로 추가할 사용자를 찾을 수 없습니다.");
    }

    const [userAId, userBId] = orderedPair(currentUserId, targetUserId);
    const friendship = await this.prisma.friendship.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
    });

    return { isFriend: true, friendship };
  }

  async remove(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      return { removed: false };
    }

    const [userAId, userBId] = orderedPair(currentUserId, targetUserId);
    const result = await this.prisma.friendship.deleteMany({
      where: { userAId, userBId },
    });

    return { removed: result.count > 0 };
  }

  async list(currentUserId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: currentUserId }, { userBId: currentUserId }],
      },
      include: {
        userA: { select: publicUserSelect },
        userB: { select: publicUserSelect },
      },
      orderBy: { createdAt: "desc" },
    });

    return friendships
      .map((friendship) => {
        const user =
          friendship.userAId === currentUserId
            ? friendship.userB
            : friendship.userA;

        if (user.suspended || user.deletedAt) return null;

        const badges = toBadges(
          user.verifiedAt,
          user.reservations.length,
          user._count.reviews,
        );

        return {
          friendshipId: friendship.id,
          friendsSince: friendship.createdAt,
          userId: user.id,
          name: user.name,
          age: user.age,
          job: user.job,
          bio: user.bio,
          intro: user.preference?.intro ?? null,
          keywords:
            user.preference?.isCompleted === true
              ? user.preference.keywords
              : [],
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
          joinedYear: user.createdAt.getFullYear(),
          ...badges,
        };
      })
      .filter(Boolean);
  }

  async publicProfile(currentUserId: string, targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: publicUserSelect,
    });

    if (!user || user.suspended || user.deletedAt) {
      throw new NotFoundException("사용자 프로필을 찾을 수 없습니다.");
    }

    const badges = toBadges(
      user.verifiedAt,
      user.reservations.length,
      user._count.reviews,
    );

    const { isFriend } = await this.status(currentUserId, targetUserId);

    return {
      userId: user.id,
      name: user.name,
      age: user.age,
      job: user.job,
      bio: user.bio,
      intro: user.preference?.intro ?? null,
      keywords:
        user.preference?.isCompleted === true ? user.preference.keywords : [],
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      joinedYear: user.createdAt.getFullYear(),
      isFriend,
      isMe: user.id === currentUserId,
      ...badges,
    };
  }
}

@Controller("friends")
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@Req() req: any) {
    return this.friends.list(req.user.id);
  }

  @Get("status/:targetUserId")
  status(@Req() req: any, @Param("targetUserId") targetUserId: string) {
    return this.friends.status(req.user.id, targetUserId);
  }

  @Get("users/:targetUserId")
  profile(@Req() req: any, @Param("targetUserId") targetUserId: string) {
    return this.friends.publicProfile(req.user.id, targetUserId);
  }

  @Post(":targetUserId")
  add(@Req() req: any, @Param("targetUserId") targetUserId: string) {
    return this.friends.add(req.user.id, targetUserId);
  }

  @Delete(":targetUserId")
  remove(@Req() req: any, @Param("targetUserId") targetUserId: string) {
    return this.friends.remove(req.user.id, targetUserId);
  }
}

@Module({
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}

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
import type { RoommatePreference } from "@prisma/client";

import { ageGroup } from "../../common/age-group";
import { toBadges } from "../../common/activity-tier";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { NotificationsModule } from "../notifications/notifications.module";

function orderedPair(firstId: string, secondId: string): [string, string] {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

function friendPairKey(firstId: string, secondId: string): string {
  const [userAId, userBId] = orderedPair(firstId, secondId);

  return `${userAId}:${userBId}`;
}

type FriendRequestState = "NONE" | "SENT" | "RECEIVED";

type PublicLifestyle = Pick<
  RoommatePreference,
  | "noise"
  | "cleanliness"
  | "smoking"
  | "pets"
  | "visitors"
  | "sleep"
  | "sociability"
  | "sharedSpace"
  | "drinking"
>;

function toPublicLifestyle(
  preference:
    | (PublicLifestyle & {
        isCompleted: boolean;
      })
    | null,
): PublicLifestyle | null {
  if (!preference?.isCompleted) {
    return null;
  }

  return {
    noise: preference.noise,
    cleanliness: preference.cleanliness,
    smoking: preference.smoking,
    pets: preference.pets,
    visitors: preference.visitors,
    sleep: preference.sleep,
    sociability: preference.sociability,
    sharedSpace: preference.sharedSpace,
    drinking: preference.drinking,
  };
}

const publicUserSelect = {
  id: true,
  name: true,
  role: true,
  birthDate: true,
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
      noise: true,
      cleanliness: true,
      smoking: true,
      pets: true,
      visitors: true,
      sleep: true,
      sociability: true,
      sharedSpace: true,
      drinking: true,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async status(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      return {
        isFriend: false,
        friendshipId: null,
        createdAt: null,
        requestState: "NONE" as FriendRequestState,
        requestId: null,
      };
    }

    const [userAId, userBId] = orderedPair(currentUserId, targetUserId);

    const pairKey = friendPairKey(currentUserId, targetUserId);

    const [friendship, request] = await Promise.all([
      this.prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
      }),

      this.prisma.friendRequest.findUnique({
        where: {
          pairKey,
        },
        select: {
          id: true,
          requesterId: true,
          receiverId: true,
          status: true,
        },
      }),
    ]);

    if (friendship) {
      return {
        isFriend: true,
        friendshipId: friendship.id,
        createdAt: friendship.createdAt,
        requestState: "NONE" as FriendRequestState,
        requestId: null,
      };
    }

    if (!request || request.status !== "PENDING") {
      return {
        isFriend: false,
        friendshipId: null,
        createdAt: null,
        requestState: "NONE" as FriendRequestState,
        requestId: null,
      };
    }

    const requestState: FriendRequestState =
      request.requesterId === currentUserId ? "SENT" : "RECEIVED";

    return {
      isFriend: false,
      friendshipId: null,
      createdAt: null,
      requestState,
      requestId: request.id,
    };
  }

  /**
   * 친구 추가 버튼은 친구 관계를 즉시 생성하지 않고,
   * 상대방에게 승인 또는 거절할 수 있는 요청을 보낸다.
   */
  async add(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new ForbiddenException(
        "자기 자신에게 친구 요청을 보낼 수 없습니다.",
      );
    }

    const [currentUser, targetUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: {
          id: currentUserId,
        },
        select: {
          id: true,
          name: true,
          suspended: true,
          deletedAt: true,
        },
      }),

      this.prisma.user.findUnique({
        where: {
          id: targetUserId,
        },
        select: {
          id: true,
          suspended: true,
          deletedAt: true,
        },
      }),
    ]);

    if (!currentUser || currentUser.suspended || currentUser.deletedAt) {
      throw new NotFoundException("현재 사용자 정보를 찾을 수 없습니다.");
    }

    if (!targetUser || targetUser.suspended || targetUser.deletedAt) {
      throw new NotFoundException(
        "친구 요청을 보낼 사용자를 찾을 수 없습니다.",
      );
    }

    const [userAId, userBId] = orderedPair(currentUserId, targetUserId);

    const pairKey = friendPairKey(currentUserId, targetUserId);

    const result = await this.prisma.$transaction(async (tx) => {
      const friendship = await tx.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      if (friendship) {
        return {
          isFriend: true,
          request: null,
          requestState: "NONE" as FriendRequestState,
          notification: null,
        };
      }

      const existingRequest = await tx.friendRequest.findUnique({
        where: {
          pairKey,
        },
      });

      if (existingRequest?.status === "PENDING") {
        const requestState: FriendRequestState =
          existingRequest.requesterId === currentUserId ? "SENT" : "RECEIVED";

        return {
          isFriend: false,
          request: existingRequest,
          requestState,
          notification: null,
        };
      }

      let request;
      let requestCreated = false;

      if (existingRequest) {
        const reopened = await tx.friendRequest.updateMany({
          where: {
            id: existingRequest.id,
            status: {
              in: ["ACCEPTED", "REJECTED"],
            },
          },
          data: {
            requesterId: currentUserId,
            receiverId: targetUserId,
            status: "PENDING",
            respondedAt: null,
            createdAt: new Date(),
          },
        });

        request = await tx.friendRequest.findUniqueOrThrow({
          where: {
            id: existingRequest.id,
          },
        });

        requestCreated = reopened.count === 1;
      } else {
        const created = await tx.friendRequest.createMany({
          data: [
            {
              pairKey,
              requesterId: currentUserId,
              receiverId: targetUserId,
            },
          ],
          skipDuplicates: true,
        });

        request = await tx.friendRequest.findUniqueOrThrow({
          where: {
            pairKey,
          },
        });

        requestCreated = created.count === 1;
      }

      /*
       * 동시에 요청이 들어와 다른 요청이 먼저 저장된 경우
       * 기존 요청의 방향에 맞는 상태만 반환하고 알림을 중복 생성하지 않는다.
       */
      if (!requestCreated) {
        const requestState: FriendRequestState =
          request.requesterId === currentUserId ? "SENT" : "RECEIVED";

        return {
          isFriend: false,
          request,
          requestState,
          notification: null,
        };
      }

      const notification = await tx.notification.create({
        data: {
          userId: targetUserId,
          type: "FRIEND_REQUESTED",
          title: "새로운 친구 요청이 도착했어요",
          body: `${currentUser.name}님이 ` + "친구 요청을 보냈습니다.",
          targetUrl: `/me/friends?tab=requests&requestId=${request.id}`,
        },
      });

      return {
        isFriend: false,
        request,
        requestState: "SENT" as FriendRequestState,
        notification,
      };
    });

    if (result.notification) {
      this.notificationsGateway.emitToUser(targetUserId, result.notification);
    }

    return {
      isFriend: result.isFriend,
      requestState: result.requestState,
      requestId: result.request?.id ?? null,
    };
  }

  async incomingRequests(currentUserId: string) {
    const requests = await this.prisma.friendRequest.findMany({
      where: {
        receiverId: currentUserId,
        status: "PENDING",
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            role: true,
            birthDate: true,
            job: true,
            avatarColor: true,
            avatarUrl: true,
            suspended: true,
            deletedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return requests
      .filter(
        (request) =>
          !request.requester.suspended && !request.requester.deletedAt,
      )
      .map((request) => ({
        requestId: request.id,
        createdAt: request.createdAt,
        userId: request.requester.id,
        name: request.requester.name,
        role: request.requester.role,
        ageGroup: ageGroup(request.requester.birthDate),
        job: request.requester.job,
        avatarColor: request.requester.avatarColor,
        avatarUrl: request.requester.avatarUrl,
      }));
  }

  async acceptRequest(currentUserId: string, requestId: string) {
    const [request, currentUser] = await Promise.all([
      this.prisma.friendRequest.findUnique({
        where: {
          id: requestId,
        },
        include: {
          requester: {
            select: {
              id: true,
              suspended: true,
              deletedAt: true,
            },
          },
        },
      }),

      this.prisma.user.findUnique({
        where: {
          id: currentUserId,
        },
        select: {
          id: true,
          name: true,
          suspended: true,
          deletedAt: true,
        },
      }),
    ]);

    if (!request) {
      throw new NotFoundException("친구 요청을 찾을 수 없습니다.");
    }

    if (request.receiverId !== currentUserId) {
      throw new ForbiddenException("이 친구 요청을 수락할 권한이 없습니다.");
    }

    if (!currentUser || currentUser.suspended || currentUser.deletedAt) {
      throw new NotFoundException("현재 사용자 정보를 찾을 수 없습니다.");
    }

    if (request.requester.suspended || request.requester.deletedAt) {
      throw new NotFoundException(
        "친구 요청을 보낸 사용자를 찾을 수 없습니다.",
      );
    }

    const [userAId, userBId] = orderedPair(
      request.requesterId,
      request.receiverId,
    );

    if (request.status === "ACCEPTED") {
      const friendship = await this.prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });

      return {
        accepted: false,
        isFriend: Boolean(friendship),
        friendship,
      };
    }

    if (request.status === "REJECTED") {
      throw new ForbiddenException("이미 거절된 친구 요청입니다.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.friendRequest.updateMany({
        where: {
          id: requestId,
          receiverId: currentUserId,
          status: "PENDING",
        },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        const friendship = await tx.friendship.findUnique({
          where: {
            userAId_userBId: {
              userAId,
              userBId,
            },
          },
        });

        return {
          accepted: false,
          friendship,
          notification: null,
        };
      }

      const friendship = await tx.friendship.upsert({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
        update: {},
        create: {
          userAId,
          userBId,
        },
      });

      const notification = await tx.notification.create({
        data: {
          userId: request.requesterId,
          type: "FRIEND_ADDED",
          title: "친구 요청이 수락되었어요",
          body: `${currentUser.name}님과 ` + "친구가 되었습니다.",
          targetUrl: `/users/${currentUserId}`,
        },
      });

      return {
        accepted: true,
        friendship,
        notification,
      };
    });

    if (result.notification) {
      this.notificationsGateway.emitToUser(
        request.requesterId,
        result.notification,
      );
    }

    return {
      accepted: result.accepted,
      isFriend: Boolean(result.friendship),
      friendship: result.friendship,
    };
  }

  async rejectRequest(currentUserId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        receiverId: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundException("친구 요청을 찾을 수 없습니다.");
    }

    if (request.receiverId !== currentUserId) {
      throw new ForbiddenException("이 친구 요청을 거절할 권한이 없습니다.");
    }

    const rejected = await this.prisma.friendRequest.updateMany({
      where: {
        id: requestId,
        receiverId: currentUserId,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
        respondedAt: new Date(),
      },
    });

    if (rejected.count === 1) {
      return {
        rejected: true,
        status: "REJECTED" as const,
      };
    }

    const latest = await this.prisma.friendRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        status: true,
      },
    });

    return {
      rejected: false,
      status: latest?.status ?? null,
    };
  }

  async remove(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      return {
        removed: false,
      };
    }

    const [userAId, userBId] = orderedPair(currentUserId, targetUserId);

    const result = await this.prisma.friendship.deleteMany({
      where: {
        userAId,
        userBId,
      },
    });

    return {
      removed: result.count > 0,
    };
  }

  async list(currentUserId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          {
            userAId: currentUserId,
          },
          {
            userBId: currentUserId,
          },
        ],
      },
      include: {
        userA: {
          select: publicUserSelect,
        },
        userB: {
          select: publicUserSelect,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return friendships
      .map((friendship) => {
        const user =
          friendship.userAId === currentUserId
            ? friendship.userB
            : friendship.userA;

        if (user.suspended || user.deletedAt) {
          return null;
        }

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
          role: user.role,
          ageGroup: ageGroup(user.birthDate),
          job: user.job,
          bio: user.bio,
          intro: user.preference?.intro ?? null,
          keywords:
            user.preference?.isCompleted === true
              ? user.preference.keywords
              : [],
          lifestyle: toPublicLifestyle(user.preference),
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
      where: {
        id: targetUserId,
      },
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

    const relationship = await this.status(currentUserId, targetUserId);

    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      ageGroup: ageGroup(user.birthDate),
      job: user.job,
      bio: user.bio,
      intro: user.preference?.intro ?? null,
      keywords:
        user.preference?.isCompleted === true ? user.preference.keywords : [],
      lifestyle: toPublicLifestyle(user.preference),
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      joinedYear: user.createdAt.getFullYear(),
      isFriend: relationship.isFriend,
      friendRequestState: relationship.requestState,
      friendRequestId: relationship.requestId,
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

  @Get("requests/incoming")
  incomingRequests(@Req() req: any) {
    return this.friends.incomingRequests(req.user.id);
  }

  @Post("requests/:requestId/accept")
  acceptRequest(
    @Req() req: any,
    @Param("requestId")
    requestId: string,
  ) {
    return this.friends.acceptRequest(req.user.id, requestId);
  }

  @Post("requests/:requestId/reject")
  rejectRequest(
    @Req() req: any,
    @Param("requestId")
    requestId: string,
  ) {
    return this.friends.rejectRequest(req.user.id, requestId);
  }

  @Get("status/:targetUserId")
  status(
    @Req() req: any,
    @Param("targetUserId")
    targetUserId: string,
  ) {
    return this.friends.status(req.user.id, targetUserId);
  }

  @Get("users/:targetUserId")
  profile(
    @Req() req: any,
    @Param("targetUserId")
    targetUserId: string,
  ) {
    return this.friends.publicProfile(req.user.id, targetUserId);
  }

  @Post(":targetUserId")
  add(
    @Req() req: any,
    @Param("targetUserId")
    targetUserId: string,
  ) {
    return this.friends.add(req.user.id, targetUserId);
  }

  @Delete(":targetUserId")
  remove(
    @Req() req: any,
    @Param("targetUserId")
    targetUserId: string,
  ) {
    return this.friends.remove(req.user.id, targetUserId);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}

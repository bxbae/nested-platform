import {
  Body,
  Controller,
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
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import { JwtModule } from "@nestjs/jwt";
import { MessageEventsGateway } from "./message-events.gateway";

function orderedPair(firstId: string, secondId: string): [string, string] {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messageEvents: MessageEventsGateway,
  ) {}

  listRooms(userId: string) {
    return this.prisma.chatRoom.findMany({
      where: { OR: [{ guestId: userId }, { hostId: userId }] },
      include: {
        room: { select: { name: true } },
        guest: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
            avatarUrl: true,
          },
        },
        host: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
            avatarUrl: true,
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listMessages(chatRoomId: string, userId: string) {
    await this.assertRoomMember(chatRoomId, userId);
    return this.prisma.message.findMany({
      where: { chatRoomId },
      orderBy: { createdAt: "asc" },
    });
  }

  async send(
    chatRoomId: string,
    senderId: string,
    data: { body?: string; imageUrl?: string },
  ) {
    const chatRoom = await this.assertRoomMember(chatRoomId, senderId);

    const recipientId =
      chatRoom.guestId === senderId ? chatRoom.hostId : chatRoom.guestId;

    const message = await this.createRoomMessage(chatRoomId, senderId, data);

    this.messageEvents.emitChanged(senderId);
    this.messageEvents.emitChanged(recipientId);

    return message;
  }

  async openRoom(guestId: string, roomId: string, hostId: string) {
    return this.prisma.chatRoom.upsert({
      where: { roomId_guestId: { roomId, guestId } },
      update: {},
      create: { roomId, guestId, hostId },
    });
  }

  async openRoomAsHost(hostId: string, roomId: string, guestId: string) {
    if (hostId === guestId) {
      throw new ForbiddenException({
        code: "SELF_CHAT",
        message: "자신과는 채팅할 수 없습니다.",
      });
    }

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { hostId: true },
    });

    if (!room) {
      throw new NotFoundException({
        code: "ROOM_NOT_FOUND",
        message: "숙소를 찾을 수 없습니다.",
      });
    }

    if (room.hostId !== hostId) {
      throw new ForbiddenException({
        code: "NOT_HOST",
        message: "본인 숙소로만 채팅을 시작할 수 있습니다.",
      });
    }

    const guest = await this.prisma.user.findUnique({
      where: { id: guestId },
      select: { id: true, suspended: true, deletedAt: true },
    });

    if (!guest || guest.suspended || guest.deletedAt) {
      throw new NotFoundException({
        code: "GUEST_NOT_FOUND",
        message: "상대방을 찾을 수 없습니다.",
      });
    }

    return this.prisma.chatRoom.upsert({
      where: { roomId_guestId: { roomId, guestId } },
      update: {},
      create: { roomId, guestId, hostId },
    });
  }

  async listDirectConversations(userId: string) {
    const rows = await this.prisma.directConversation.findMany({
      where: {
        OR: [{ participantAId: userId }, { participantBId: userId }],
      },
      include: {
        participantA: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
            avatarUrl: true,
          },
        },
        participantB: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
            avatarUrl: true,
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      other:
        row.participantAId === userId ? row.participantB : row.participantA,
      messages: row.messages,
    }));
  }

  async openDirect(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new ForbiddenException("자신과는 대화할 수 없습니다.");
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, suspended: true, deletedAt: true },
    });

    if (!target || target.suspended || target.deletedAt) {
      throw new NotFoundException("상대방을 찾을 수 없습니다.");
    }

    const [participantAId, participantBId] = orderedPair(userId, targetUserId);

    return this.prisma.directConversation.upsert({
      where: {
        participantAId_participantBId: { participantAId, participantBId },
      },
      update: {},
      create: { participantAId, participantBId },
    });
  }

  async listDirectMessages(conversationId: string, userId: string) {
    await this.assertDirectMember(conversationId, userId);
    return this.prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async sendDirect(
    conversationId: string,
    senderId: string,
    data: { body?: string; imageUrl?: string },
  ) {
    const conversation = await this.assertDirectMember(
      conversationId,
      senderId,
    );

    const recipientId =
      conversation.participantAId === senderId
        ? conversation.participantBId
        : conversation.participantAId;

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: {
          conversationId,
          senderId,
          body: data.body,
          imageUrl: data.imageUrl,
          readBy: [senderId],
        },
      });

      await tx.directConversation.update({
        where: {
          id: conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return created;
    });

    this.messageEvents.emitChanged(senderId);
    this.messageEvents.emitChanged(recipientId);

    return message;
  }

  async markDirectRead(conversationId: string, userId: string) {
    await this.assertDirectMember(conversationId, userId);

    const unread = await this.prisma.directMessage.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        NOT: { readBy: { has: userId } },
      },
      select: { id: true, readBy: true },
    });

    await this.prisma.$transaction(
      unread.map((message) =>
        this.prisma.directMessage.update({
          where: { id: message.id },
          data: { readBy: [...message.readBy, userId] },
        }),
      ),
    );

    this.messageEvents.emitChanged(userId);

    return { updated: unread.length };
  }

  async unreadCount(userId: string) {
    const [roomUnread, directUnread] = await Promise.all([
      this.prisma.message.count({
        where: {
          senderId: {
            not: userId,
          },
          NOT: {
            readBy: {
              has: userId,
            },
          },
          chatRoom: {
            OR: [
              {
                guestId: userId,
              },
              {
                hostId: userId,
              },
            ],
          },
        },
      }),

      this.prisma.directMessage.count({
        where: {
          senderId: {
            not: userId,
          },
          NOT: {
            readBy: {
              has: userId,
            },
          },
          conversation: {
            OR: [
              {
                participantAId: userId,
              },
              {
                participantBId: userId,
              },
            ],
          },
        },
      }),
    ]);

    return {
      roomUnread,
      directUnread,
      total: roomUnread + directUnread,
    };
  }

  private createRoomMessage(
    chatRoomId: string,
    senderId: string,
    data: { body?: string; imageUrl?: string },
  ) {
    return this.prisma.message.create({
      data: {
        chatRoomId,
        senderId,
        body: data.body,
        imageUrl: data.imageUrl,
        readBy: [senderId],
      },
    });
  }

  private async assertRoomMember(chatRoomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      select: { guestId: true, hostId: true },
    });

    if (!room) {
      throw new NotFoundException({
        code: "CHAT_ROOM_NOT_FOUND",
        message: "대화방을 찾을 수 없습니다.",
      });
    }

    if (room.guestId !== userId && room.hostId !== userId) {
      throw new ForbiddenException({
        code: "NOT_CHAT_MEMBER",
        message: "대화방 참여자만 접근할 수 있습니다.",
      });
    }

    return room;
  }

  private async assertDirectMember(conversationId: string, userId: string) {
    const conversation = await this.prisma.directConversation.findUnique({
      where: { id: conversationId },
      select: { participantAId: true, participantBId: true },
    });

    if (!conversation) {
      throw new NotFoundException("대화방을 찾을 수 없습니다.");
    }

    if (
      conversation.participantAId !== userId &&
      conversation.participantBId !== userId
    ) {
      throw new ForbiddenException("대화방 참여자만 접근할 수 있습니다.");
    }

    return conversation;
  }
}

const sendSchema = z
  .object({
    body: z.string().optional(),
    imageUrl: z.string().optional(),
  })
  .refine((value) => Boolean(value.body?.trim() || value.imageUrl), {
    message: "메시지 내용이 필요합니다.",
  });
const openSchema = z.object({ roomId: z.string(), hostId: z.string() });
const openAsHostSchema = z.object({ roomId: z.string(), guestId: z.string() });
const openDirectSchema = z.object({ targetUserId: z.string() });

@Controller("messages")
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("rooms")
  rooms(@Req() req: any) {
    return this.messages.listRooms(req.user.id);
  }

  @Post("rooms")
  open(@Req() req: any, @Body(new ZodValidationPipe(openSchema)) dto: any) {
    return this.messages.openRoom(req.user.id, dto.roomId, dto.hostId);
  }

  @Post("rooms/as-host")
  openAsHost(
    @Req() req: any,
    @Body(new ZodValidationPipe(openAsHostSchema)) dto: any,
  ) {
    return this.messages.openRoomAsHost(req.user.id, dto.roomId, dto.guestId);
  }

  @Get("direct")
  directRooms(@Req() req: any) {
    return this.messages.listDirectConversations(req.user.id);
  }

  @Post("direct")
  openDirect(
    @Req() req: any,
    @Body(new ZodValidationPipe(openDirectSchema)) dto: any,
  ) {
    return this.messages.openDirect(req.user.id, dto.targetUserId);
  }

  @Get("direct/:conversationId")
  directMessages(
    @Req() req: any,
    @Param("conversationId") conversationId: string,
  ) {
    return this.messages.listDirectMessages(conversationId, req.user.id);
  }

  @Post("direct/:conversationId")
  sendDirect(
    @Req() req: any,
    @Param("conversationId") conversationId: string,
    @Body(new ZodValidationPipe(sendSchema)) dto: any,
  ) {
    return this.messages.sendDirect(conversationId, req.user.id, dto);
  }

  @Post("direct/:conversationId/read")
  readDirect(@Req() req: any, @Param("conversationId") conversationId: string) {
    return this.messages.markDirectRead(conversationId, req.user.id);
  }

  @Get("unread-count")
  unreadCount(@Req() req: any) {
    return this.messages.unreadCount(req.user.id);
  }

  @Get(":chatRoomId")
  list(@Req() req: any, @Param("chatRoomId") chatRoomId: string) {
    return this.messages.listMessages(chatRoomId, req.user.id);
  }

  @Post(":chatRoomId")
  send(
    @Req() req: any,
    @Param("chatRoomId") chatRoomId: string,
    @Body(new ZodValidationPipe(sendSchema)) dto: any,
  ) {
    return this.messages.send(chatRoomId, req.user.id, dto);
  }
}

@Module({
  imports: [JwtModule.register({})],
  controllers: [MessagesController],
  providers: [MessagesService, MessageEventsGateway],
  exports: [MessageEventsGateway],
})
export class MessagesModule {}

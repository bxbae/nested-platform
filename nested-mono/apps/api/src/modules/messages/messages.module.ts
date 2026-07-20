import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Injectable,
  Module,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  // list chat rooms for a user (guest or host) with last message
  async listRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { OR: [{ guestId: userId }, { hostId: userId }] },
      include: {
        room: { select: { name: true } },
        // Host-side views (문의함) need to show who's asking, not just an id.
        guest: { select: { id: true, name: true, avatarColor: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    return rooms;
  }

  listMessages(chatRoomId: string) {
    return this.prisma.message.findMany({
      where: { chatRoomId },
      orderBy: { createdAt: "asc" },
    });
  }

  // REST send (mirrors the Socket.io message:send for non-realtime clients)
  async send(
    chatRoomId: string,
    senderId: string,
    data: { body?: string; imageUrl?: string },
  ) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      select: {
        guestId: true,
        hostId: true,
      },
    });

    if (!chatRoom) {
      throw new NotFoundException({
        code: "CHAT_ROOM_NOT_FOUND",
        message: "대화방을 찾을 수 없습니다.",
      });
    }

    const isGuest = chatRoom.guestId === senderId;
    const isHost = chatRoom.hostId === senderId;

    if (!isGuest && !isHost) {
      throw new ForbiddenException({
        code: "NOT_CHAT_MEMBER",
        message: "대화방 참여자만 메시지를 보낼 수 있습니다.",
      });
    }

    const recipientId = isGuest ? chatRoom.hostId : chatRoom.guestId;

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          chatRoomId,
          senderId,
          body: data.body,
          imageUrl: data.imageUrl,
          readBy: [senderId],
        },
      });

      const preview =
        data.body?.trim().slice(0, 80) ||
        (data.imageUrl ? "사진을 보냈습니다." : "새 메시지가 도착했습니다.");

      await tx.notification.create({
        data: {
          userId: recipientId,
          type: "MESSAGE",
          title: "새 메시지가 도착했어요",
          body: preview,

          targetUrl: `/me/messages?room=${chatRoomId}`,
        },
      });

      return message;
    });
  }

  // get-or-create a chat room between a guest and a room's host
  async openRoom(guestId: string, roomId: string, hostId: string) {
    return this.prisma.chatRoom.upsert({
      where: { roomId_guestId: { roomId, guestId } },
      update: {},
      create: { roomId, guestId, hostId },
    });
  }

  // Host initiates a chat with a guest (e.g. a 방 구함 poster). The logged-in
  // user is the host here — the inverse of openRoom. We verify the host owns
  // the room so nobody can start a chat "from" a listing that isn't theirs,
  // and block self-chat. Reuses the same room if one already exists
  // (unique on [roomId, guestId]).
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
      select: { id: true },
    });
    if (!guest) {
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
}

const sendSchema = z.object({
  body: z.string().optional(),
  imageUrl: z.string().optional(),
});
const openSchema = z.object({ roomId: z.string(), hostId: z.string() });
const openAsHostSchema = z.object({ roomId: z.string(), guestId: z.string() });

// 메시지 API (REST alongside the Socket.io gateway)
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

  // POST /messages/rooms/as-host — the host starts a chat with a guest.
  @Post("rooms/as-host")
  openAsHost(
    @Req() req: any,
    @Body(new ZodValidationPipe(openAsHostSchema)) dto: any,
  ) {
    return this.messages.openRoomAsHost(req.user.id, dto.roomId, dto.guestId);
  }

  @Get(":chatRoomId")
  list(@Param("chatRoomId") chatRoomId: string) {
    return this.messages.listMessages(chatRoomId);
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
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}

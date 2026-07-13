import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Injectable, Module } from "@nestjs/common";
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
  send(chatRoomId: string, senderId: string, data: { body?: string; imageUrl?: string }) {
    return this.prisma.message.create({
      data: { chatRoomId, senderId, body: data.body, imageUrl: data.imageUrl, readBy: [senderId] },
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
}

const sendSchema = z.object({ body: z.string().optional(), imageUrl: z.string().optional() });
const openSchema = z.object({ roomId: z.string(), hostId: z.string() });

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

  @Get(":chatRoomId")
  list(@Param("chatRoomId") chatRoomId: string) {
    return this.messages.listMessages(chatRoomId);
  }

  @Post(":chatRoomId")
  send(@Req() req: any, @Param("chatRoomId") chatRoomId: string, @Body(new ZodValidationPipe(sendSchema)) dto: any) {
    return this.messages.send(chatRoomId, req.user.id, dto);
  }
}

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}

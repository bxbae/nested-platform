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
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationsGateway } from "../notifications/notifications.gateway";

function orderedPair(firstId: string, secondId: string): [string, string] {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  listRooms(userId: string) {
    return this.prisma.chatRoom.findMany({
      where: { OR: [{ guestId: userId }, { hostId: userId }] },
      include: {
        room: { select: { name: true } },
        guest: { select: { id: true, name: true, avatarColor: true } },
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
    return this.createRoomMessage(chatRoomId, senderId, recipientId, data);
  }

  async openRoom(guestId: string, roomId: string, hostId: string) {
    return this.prisma.chatRoom.upsert({
      where: { roomId_guestId: { roomId, guestId } },
      update: {},
      create: { roomId, guestId, hostId },
    });
  }

  async openRoomAsHost(hostId: string, roomId: string, guestId: string) {
    if (hostId === guestId) throw new ForbiddenException("자신과는 채팅할 수 없습니다.");
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { hostId: true } });
    if (!room) throw new NotFoundException("숙소를 찾을 수 없습니다.");
    if (room.hostId !== hostId) throw new ForbiddenException("본인 숙소로만 채팅을 시작할 수 있습니다.");
    return this.prisma.chatRoom.upsert({
      where: { roomId_guestId: { roomId, guestId } },
      update: {},
      create: { roomId, guestId, hostId },
    });
  }

  async listDirectConversations(userId: string) {
    const rows = await this.prisma.directConversation.findMany({
      where: { OR: [{ participantAId: userId }, { participantBId: userId }] },
      include: {
        participantA: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } },
        participantB: { select: { id: true, name: true, avatarColor: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      other: row.participantAId === userId ? row.participantB : row.participantA,
      messages: row.messages,
    }));
  }

  async openDirect(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new ForbiddenException("자신과는 대화할 수 없습니다.");
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, suspended: true, deletedAt: true } });
    if (!target || target.suspended || target.deletedAt) throw new NotFoundException("상대방을 찾을 수 없습니다.");
    const [participantAId, participantBId] = orderedPair(userId, targetUserId);
    return this.prisma.directConversation.upsert({
      where: { participantAId_participantBId: { participantAId, participantBId } },
      update: {},
      create: { participantAId, participantBId },
    });
  }

  async listDirectMessages(conversationId: string, userId: string) {
    await this.assertDirectMember(conversationId, userId);
    return this.prisma.directMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  }

  async sendDirect(conversationId: string, senderId: string, data: { body?: string; imageUrl?: string }) {
    const conversation = await this.assertDirectMember(conversationId, senderId);
    const recipientId = conversation.participantAId === senderId ? conversation.participantBId : conversation.participantAId;
    const preview = data.body?.trim().slice(0, 80) || (data.imageUrl ? "사진을 보냈습니다." : "새 메시지가 도착했습니다.");
    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.directMessage.create({
        data: { conversationId, senderId, body: data.body, imageUrl: data.imageUrl, readBy: [senderId] },
      });
      await tx.directConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      const notification = await tx.notification.create({
        data: { userId: recipientId, type: "MESSAGE", title: "새 메시지가 도착했어요", body: preview, targetUrl: `/me/messages?direct=${conversationId}` },
      });
      return { message, notification };
    });
    this.notificationsGateway.emitToUser(recipientId, result.notification);
    return result.message;
  }

  async markDirectRead(conversationId: string, userId: string) {
    await this.assertDirectMember(conversationId, userId);
    const unread = await this.prisma.directMessage.findMany({
      where: { conversationId, NOT: { readBy: { has: userId } } },
      select: { id: true, readBy: true },
    });
    await this.prisma.$transaction(unread.map((m) => this.prisma.directMessage.update({ where: { id: m.id }, data: { readBy: [...m.readBy, userId] } })));
    await this.prisma.notification.updateMany({
      where: { userId, type: "MESSAGE", read: false, targetUrl: `/me/messages?direct=${conversationId}` },
      data: { read: true },
    });
    return { updated: unread.length };
  }

  private async createRoomMessage(chatRoomId: string, senderId: string, recipientId: string, data: { body?: string; imageUrl?: string }) {
    const preview = data.body?.trim().slice(0, 80) || (data.imageUrl ? "사진을 보냈습니다." : "새 메시지가 도착했습니다.");
    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({ data: { chatRoomId, senderId, body: data.body, imageUrl: data.imageUrl, readBy: [senderId] } });
      const notification = await tx.notification.create({ data: { userId: recipientId, type: "MESSAGE", title: "새 메시지가 도착했어요", body: preview, targetUrl: `/me/messages?room=${chatRoomId}` } });
      return { message, notification };
    });
    this.notificationsGateway.emitToUser(recipientId, result.notification);
    return result.message;
  }

  private async assertRoomMember(chatRoomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: chatRoomId }, select: { guestId: true, hostId: true } });
    if (!room) throw new NotFoundException("대화방을 찾을 수 없습니다.");
    if (room.guestId !== userId && room.hostId !== userId) throw new ForbiddenException("대화방 참여자만 접근할 수 있습니다.");
    return room;
  }

  private async assertDirectMember(conversationId: string, userId: string) {
    const conversation = await this.prisma.directConversation.findUnique({ where: { id: conversationId }, select: { participantAId: true, participantBId: true } });
    if (!conversation) throw new NotFoundException("대화방을 찾을 수 없습니다.");
    if (conversation.participantAId !== userId && conversation.participantBId !== userId) throw new ForbiddenException("대화방 참여자만 접근할 수 있습니다.");
    return conversation;
  }
}

const sendSchema = z.object({ body: z.string().optional(), imageUrl: z.string().optional() }).refine((v) => Boolean(v.body?.trim() || v.imageUrl), "메시지 내용이 필요합니다.");
const openSchema = z.object({ roomId: z.string(), hostId: z.string() });
const openAsHostSchema = z.object({ roomId: z.string(), guestId: z.string() });
const openDirectSchema = z.object({ targetUserId: z.string() });

@Controller("messages")
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("rooms") rooms(@Req() req: any) { return this.messages.listRooms(req.user.id); }
  @Post("rooms") open(@Req() req: any, @Body(new ZodValidationPipe(openSchema)) dto: any) { return this.messages.openRoom(req.user.id, dto.roomId, dto.hostId); }
  @Post("rooms/as-host") openAsHost(@Req() req: any, @Body(new ZodValidationPipe(openAsHostSchema)) dto: any) { return this.messages.openRoomAsHost(req.user.id, dto.roomId, dto.guestId); }

  @Get("direct") directRooms(@Req() req: any) { return this.messages.listDirectConversations(req.user.id); }
  @Post("direct") openDirect(@Req() req: any, @Body(new ZodValidationPipe(openDirectSchema)) dto: any) { return this.messages.openDirect(req.user.id, dto.targetUserId); }
  @Get("direct/:conversationId") directMessages(@Req() req: any, @Param("conversationId") id: string) { return this.messages.listDirectMessages(id, req.user.id); }
  @Post("direct/:conversationId") sendDirect(@Req() req: any, @Param("conversationId") id: string, @Body(new ZodValidationPipe(sendSchema)) dto: any) { return this.messages.sendDirect(id, req.user.id, dto); }
  @Post("direct/:conversationId/read") readDirect(@Req() req: any, @Param("conversationId") id: string) { return this.messages.markDirectRead(id, req.user.id); }

  @Get(":chatRoomId") list(@Req() req: any, @Param("chatRoomId") id: string) { return this.messages.listMessages(id, req.user.id); }
  @Post(":chatRoomId") send(@Req() req: any, @Param("chatRoomId") id: string, @Body(new ZodValidationPipe(sendSchema)) dto: any) { return this.messages.send(id, req.user.id, dto); }
}

@Module({ imports: [NotificationsModule], controllers: [MessagesController], providers: [MessagesService] })
export class MessagesModule {}

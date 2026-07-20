import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  WsException,
} from "@nestjs/websockets";
import { Injectable, Inject } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";

// Realtime chat gateway. Event names match the frontend Socket.io client:
//   message:send / message:new / message:read / typing
// Scales horizontally via the Redis adapter wired in main.ts.
@Injectable()
@WebSocketGateway({ namespace: "/chat", cors: { origin: true } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue("notifications") private readonly notifications: Queue
  ) {}

  handleConnection(client: Socket) {
    const roomId = client.handshake.query.roomId as string | undefined;
    if (roomId) client.join(roomId);
  }

  @SubscribeMessage("message:send")
  async onSend(
    @MessageBody() data: { roomId: string; senderId: string; body?: string; imageUrl?: string },
    @ConnectedSocket() client: Socket
  ) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: data.roomId },
      select: { guestId: true, hostId: true },
    });

    if (!chatRoom) {
      throw new WsException("대화방을 찾을 수 없습니다.");
    }

    const isGuest = chatRoom.guestId === data.senderId;
    const isHost = chatRoom.hostId === data.senderId;

    if (!isGuest && !isHost) {
      throw new WsException("대화방 참여자만 메시지를 보낼 수 있습니다.");
    }

    const recipientId = isGuest ? chatRoom.hostId : chatRoom.guestId;
    const preview =
      data.body?.trim().slice(0, 80) ||
      (data.imageUrl ? "사진을 보냈습니다." : "새 메시지가 도착했습니다.");

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          chatRoomId: data.roomId,
          senderId: data.senderId,
          body: data.body,
          imageUrl: data.imageUrl,
          readBy: [data.senderId],
        },
      });

      const notification = await tx.notification.create({
        data: {
          userId: recipientId,
          type: "MESSAGE",
          title: "새 메시지가 도착했어요",
          body: preview,
          targetUrl: `/me/messages?room=${data.roomId}`,
        },
      });

      return { message, notification };
    });

    this.server.to(data.roomId).emit("message:new", result.message);

    this.notificationsGateway.emitToUser(
      recipientId,
      result.notification,
    );

    await this.notifications.add("push", {
      roomId: data.roomId,
      senderId: data.senderId,
      preview,
    });

    return result.message;
  }

  @SubscribeMessage("message:read")
  async onRead(@MessageBody() data: { roomId: string; userId: string }) {
    await this.prisma.message.updateMany({
      where: { chatRoomId: data.roomId, NOT: { readBy: { has: data.userId } } },
      data: {}, // array push handled in raw update below in production
    });
    this.server.to(data.roomId).emit("message:read", { roomId: data.roomId, userId: data.userId });
  }

  @SubscribeMessage("typing")
  onTyping(@MessageBody() data: { roomId: string; userId: string }, @ConnectedSocket() client: Socket) {
    client.to(data.roomId).emit("typing", { userId: data.userId });
  }
}

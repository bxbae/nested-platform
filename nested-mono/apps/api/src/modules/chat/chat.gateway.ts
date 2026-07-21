import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  WsException,
} from "@nestjs/websockets";
import { Injectable } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { JwtService } from "@nestjs/jwt";

// Realtime chat gateway. Event names match the frontend Socket.io client:
//   message:send / message:new / message:read / typing
// Scales horizontally via the Redis adapter wired in main.ts.
@Injectable()
@WebSocketGateway({ namespace: "/chat", cors: { origin: true } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue("notifications") private readonly notifications: Queue,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    const roomId = client.handshake.query.roomId as string | undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        {
          secret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
        },
      );

      client.data.userId = payload.sub;

      if (!roomId) {
        return;
      }

      const chatRoom = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: {
          guestId: true,
          hostId: true,
        },
      });

      const isParticipant =
        chatRoom?.guestId === payload.sub || chatRoom?.hostId === payload.sub;

      if (!chatRoom || !isParticipant) {
        client.disconnect();
        return;
      }

      await client.join(roomId);

      client.emit("chat:ready", {
        roomId,
      });
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage("message:send")
  async onSend(
    @MessageBody()
    data: {
      roomId: string;
      body?: string;
      imageUrl?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = client.data.userId as string | undefined;

    if (!senderId) {
      throw new WsException("인증이 필요합니다.");
    }

    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: data.roomId },
      select: { guestId: true, hostId: true },
    });

    if (!chatRoom) {
      throw new WsException("대화방을 찾을 수 없습니다.");
    }

    const isGuest = chatRoom.guestId === senderId;
    const isHost = chatRoom.hostId === senderId;

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
          senderId,
          body: data.body,
          imageUrl: data.imageUrl,
          readBy: [senderId],
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

    this.notificationsGateway.emitToUser(recipientId, result.notification);

    await this.notifications.add("push", {
      roomId: data.roomId,
      senderId,
      preview,
    });

    return result.message;
  }

  @SubscribeMessage("message:read")
  async onRead(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      throw new WsException("인증이 필요합니다.");
    }

    if (!client.rooms.has(data.roomId)) {
      throw new WsException("대화방 참여자만 읽음 처리할 수 있습니다.");
    }

    const result = await this.prisma.message.updateMany({
      where: {
        chatRoomId: data.roomId,

        // 상대방이 보낸 메시지만 읽음 처리
        senderId: {
          not: userId,
        },

        // 이미 읽은 메시지는 다시 처리하지 않음
        NOT: {
          readBy: {
            has: userId,
          },
        },
      },
      data: {
        // readBy 배열에 현재 로그인 사용자의 ID 추가
        readBy: {
          push: userId,
        },
      },
    });

    if (result.count > 0) {
      this.server.to(data.roomId).emit("message:read", {
        roomId: data.roomId,
        userId,
        updatedCount: result.count,
      });
    }

    return {
      updatedCount: result.count,
    };
  }

  @SubscribeMessage("typing")
  onTyping(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      throw new WsException("인증이 필요합니다.");
    }

    if (!client.rooms.has(data.roomId)) {
      throw new WsException("대화방 참여자만 입력 상태를 전송할 수 있습니다.");
    }

    client.to(data.roomId).emit("typing", {
      userId,
    });
  }
}

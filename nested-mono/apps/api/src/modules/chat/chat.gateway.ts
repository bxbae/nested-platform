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
import { PrismaService } from "../../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { MessageEventsGateway } from "../messages/message-events.gateway";

@Injectable()
@WebSocketGateway({ namespace: "/chat", cors: { origin: true } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly messageEvents: MessageEventsGateway,
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
      client.emit("chat:ready", { roomId });
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
      where: {
        id: data.roomId,
      },
      select: {
        guestId: true,
        hostId: true,
      },
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

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          chatRoomId: data.roomId,
          senderId,
          body: data.body,
          imageUrl: data.imageUrl,
          readBy: [senderId],
        },
      });

      await tx.chatRoom.update({
        where: {
          id: data.roomId,
        },
        data: {
          hiddenBy: {
            set: [],
          },
        },
      });

      return created;
    });

    this.server.to(data.roomId).emit("message:new", message);

    this.messageEvents.emitChanged(senderId);
    this.messageEvents.emitChanged(recipientId);

    return message;
  }

  @SubscribeMessage("message:read")
  async onRead(
    @MessageBody()
    data: {
      roomId: string;
    },
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
        senderId: {
          not: userId,
        },
        NOT: {
          readBy: {
            has: userId,
          },
        },
      },
      data: {
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

    this.messageEvents.emitChanged(userId);

    return {
      updatedCount: result.count,
    };
  }

  @SubscribeMessage("typing")
  onTyping(
    @MessageBody()
    data: {
      roomId: string;
    },
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

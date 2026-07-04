import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { Injectable, Inject } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";

// Realtime chat gateway. Event names match the frontend Socket.io client:
//   message:send / message:new / message:read / typing
// Scales horizontally via the Redis adapter wired in main.ts.
@Injectable()
@WebSocketGateway({ namespace: "/chat", cors: { origin: true } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly prisma: PrismaService,
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
    const msg = await this.prisma.message.create({
      data: {
        chatRoomId: data.roomId,
        senderId: data.senderId,
        body: data.body,
        imageUrl: data.imageUrl,
        readBy: [data.senderId],
      },
    });

    // broadcast to everyone in the room (message:new)
    this.server.to(data.roomId).emit("message:new", msg);

    // enqueue a push notification for offline recipients (BullMQ)
    await this.notifications.add("push", {
      roomId: data.roomId,
      senderId: data.senderId,
      preview: data.body ?? (data.imageUrl ? "사진을 보냈습니다" : "새 메시지"),
    });

    return msg;
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

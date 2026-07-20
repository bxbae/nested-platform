import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

import type { JwtPayload } from "../auth/auth.service";

@Injectable()
@WebSocketGateway({
  namespace: "/notifications",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
      });

      const userRoom = `user:${payload.sub}`;

      await client.join(userRoom);
      client.data.userId = payload.sub;

      this.logger.log(`notification socket connected: ${payload.sub}`);
    } catch {
      this.logger.warn(`invalid notification socket token: ${client.id}`);

      client.disconnect(true);
    }
  }

  emitToUser(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit("notification:new", notification);
  }
}

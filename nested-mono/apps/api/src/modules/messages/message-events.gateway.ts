import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";

@Injectable()
@WebSocketGateway({
  namespace: "/messages",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class MessageEventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect(true);
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
      await client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitChanged(userId: string) {
    this.server.to(`user:${userId}`).emit("messages:changed");
  }
}

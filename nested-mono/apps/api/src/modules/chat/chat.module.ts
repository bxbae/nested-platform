import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ChatGateway } from "./chat.gateway";
import { MessagesModule } from "../messages/messages.module";

@Module({
  imports: [JwtModule.register({}), MessagesModule],
  providers: [ChatGateway],
})
export class ChatModule {}

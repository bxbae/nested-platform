import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ChatGateway } from "./chat.gateway";
import { NotificationsModule } from "../notifications/notifications.module";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    BullModule.registerQueue({ name: "notifications" }),
    NotificationsModule,
    JwtModule.register({}),
  ],
  providers: [ChatGateway],
})
export class ChatModule {}

import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ChatGateway } from "./chat.gateway";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    BullModule.registerQueue({ name: "notifications" }),
    NotificationsModule,
  ],
  providers: [ChatGateway],
})
export class ChatModule {}

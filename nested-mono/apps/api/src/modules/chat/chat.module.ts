import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ChatGateway } from "./chat.gateway";

@Module({
  imports: [BullModule.registerQueue({ name: "notifications" })],
  providers: [ChatGateway],
})
export class ChatModule {}

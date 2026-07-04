import { Module, Injectable } from "@nestjs/common";
import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { NotificationsProcessor } from "./notifications.processor";

// Producer service for enqueuing background jobs.
@Injectable()
export class NotificationsService {
  constructor(@InjectQueue("notifications") private readonly queue: Queue) {}

  async enqueuePush(roomId: string, senderId: string, preview: string) {
    await this.queue.add("push", { roomId, senderId, preview });
  }

  async enqueueEmail(to: string, template: string) {
    await this.queue.add("email", { to, template });
  }

  // recurring settlement reminders (BullMQ repeatable job)
  async scheduleSettlementReminders() {
    await this.queue.add(
      "settlement-reminder",
      {},
      { repeat: { pattern: "0 9 25 * *" } } // 25th of each month, 09:00
    );
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: "notifications" })],
  providers: [NotificationsProcessor, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

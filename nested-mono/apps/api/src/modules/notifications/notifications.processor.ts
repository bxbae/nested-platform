import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";

// BullMQ worker that processes background jobs off the "notifications" queue.
// Handles push delivery, email, and settlement reminders without blocking
// the request/response cycle.
@Processor("notifications")
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case "push":
        await this.sendPush(job.data);
        break;
      case "email":
        await this.sendEmail(job.data);
        break;
      case "settlement-reminder":
        await this.settlementReminder(job.data);
        break;
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  private async sendPush(data: { roomId: string; senderId: string; preview: string }) {
    // In production: FCM / Web Push. Here we log the delivery.
    this.logger.log(`push → room ${data.roomId}: ${data.preview}`);
  }

  private async sendEmail(data: { to: string; template: string }) {
    this.logger.log(`email → ${data.to} (${data.template})`);
  }

  private async settlementReminder(data: { hostId: string; amount: number }) {
    this.logger.log(`settlement reminder → host ${data.hostId}: ${data.amount}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, err: Error) {
    this.logger.error(`job ${job.id} failed: ${err.message}`);
  }
}

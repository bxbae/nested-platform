import { Module, Injectable, Logger } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { NotificationsGateway } from "./notifications.gateway";

// Producer service for notifications.
// NOTE: BullMQ/Redis queueing was removed (2026-07-27) — it was polling
// Upstash Redis continuously even with zero jobs, exhausting the free-tier
// request quota (500k/mo) within days. push/email delivery isn't wired to
// a real provider yet (FCM/SES etc.), and settlement-reminder was never
// invoked anywhere, so there's no functional loss. Re-introduce a queue
// (with a Redis plan that isn't request-metered) once real delivery is
// implemented.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async enqueuePush(roomId: string, senderId: string, preview: string) {
    this.logger.log(`push → room ${roomId}: ${preview}`);
  }

  async enqueueEmail(to: string, template: string) {
    this.logger.log(`email → ${to} (${template})`);
  }

  // Kept as a no-op stub so callers (if any get added later) don't break.
  // Not currently invoked anywhere in the codebase.
  async scheduleSettlementReminders() {
    this.logger.warn(
      "scheduleSettlementReminders() called but BullMQ queue is disabled — no-op",
    );
  }
}

@Module({
  imports: [JwtModule.register({})],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}

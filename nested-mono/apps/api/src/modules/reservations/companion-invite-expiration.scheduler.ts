import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PrismaService } from "../../prisma/prisma.service";
import { expireCompanionInvites } from "./companion-invite-expiration";

@Injectable()
export class CompanionInviteExpirationScheduler {
  private readonly logger = new Logger(CompanionInviteExpirationScheduler.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  // 5분마다 실행. 이전 실행이 아직 끝나지 않았으면 겹치지 않도록 스킵한다.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    if (this.running) {
      this.logger.warn("previous expireCompanionInvites run still in progress — skipping");
      return;
    }
    this.running = true;
    try {
      const count = await expireCompanionInvites(this.prisma);
      if (count > 0) {
        this.logger.log(`expired ${count} companion invite(s)`);
      }
    } catch (error) {
      this.logger.error(`expireCompanionInvites failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}

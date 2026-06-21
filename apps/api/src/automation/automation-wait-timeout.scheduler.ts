import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AutomationService } from "./automation.service";

@Injectable()
export class AutomationWaitTimeoutScheduler {
  private readonly logger = new Logger(AutomationWaitTimeoutScheduler.name);
  private isProcessing = false;

  constructor(private readonly automationService: AutomationService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleStaleWaitingRuns(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn(
        "Previous stale waiting-for-reply check is still running. Skipping this iteration."
      );
      return;
    }

    this.isProcessing = true;

    try {
      const count = await this.automationService.failStaleWaitingForReplyRuns();
      if (count > 0) {
        this.logger.log(
          `Marked ${count} stale WAITING_FOR_REPLY automation run(s) as FAILED.`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to fail stale WAITING_FOR_REPLY automation runs: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      this.isProcessing = false;
    }
  }
}

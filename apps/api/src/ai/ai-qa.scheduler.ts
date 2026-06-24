import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AiQaService } from "./ai-qa.service";

@Injectable()
export class AiQaScheduler {
  private readonly logger = new Logger(AiQaScheduler.name);
  private isProcessing = false;

  constructor(private readonly aiQaService: AiQaService) {}

  @Cron("0 2 * * *")
  async runDailyQaSampling(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn("Previous AI QA sampling run still in progress. Skipping.");
      return;
    }

    this.isProcessing = true;

    try {
      await this.aiQaService.runDailySampling();
      this.logger.log("AI QA daily sampling completed");
    } catch (error) {
      this.logger.error(
        "AI QA daily sampling failed",
        error instanceof Error ? error.stack : error
      );
    } finally {
      this.isProcessing = false;
    }
  }
}

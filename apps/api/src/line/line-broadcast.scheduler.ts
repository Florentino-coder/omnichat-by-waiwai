import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BroadcastStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LineBroadcastService } from "./line-broadcast.service";

@Injectable()
export class LineBroadcastScheduler {
  private readonly logger = new Logger(LineBroadcastScheduler.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastService: LineBroadcastService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledBroadcasts() {
    if (this.isProcessing) {
      this.logger.warn("Previous schedule run is still processing. Skipping this iteration.");
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();

      // Find PENDING broadcast jobs where scheduledAt <= now
      const pendingJobs = await this.prisma.broadcastJob.findMany({
        where: {
          status: BroadcastStatus.PENDING,
          scheduledAt: {
            not: null,
            lte: now
          },
          deletedAt: null
        },
        select: {
          id: true
        }
      });

      if (pendingJobs.length > 0) {
        this.logger.log(`Found ${pendingJobs.length} scheduled broadcasts to process.`);

        for (const job of pendingJobs) {
          try {
            await this.broadcastService.executeBroadcastJob(job.id);
          } catch (jobErr) {
            this.logger.error(
              `Error processing scheduled broadcast job ${job.id}: ${
                jobErr instanceof Error ? jobErr.message : String(jobErr)
              }`
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to run scheduled broadcast check: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      this.isProcessing = false;
    }
  }
}

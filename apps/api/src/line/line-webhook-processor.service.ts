import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Worker } from "bullmq";
import {
  LINE_WEBHOOK_QUEUE_NAME,
  type LineWebhookJobData
} from "./line-webhook-queue.service";
import { LineWebhookService } from "./line-webhook.service";

type LineWebhookJob = Pick<Job<LineWebhookJobData>, "data">;

@Injectable()
export class LineWebhookProcessorService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<LineWebhookJobData>;

  constructor(
    private readonly lineWebhookService: LineWebhookService,
    private readonly configService?: ConfigService
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const redisUrl = this.configService?.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.worker = new Worker<LineWebhookJobData>(
      LINE_WEBHOOK_QUEUE_NAME,
      (job) => this.processJob(job),
      {
        connection: { url: redisUrl },
        concurrency: 5
      }
    );
  }

  async processJob(job: LineWebhookJob): Promise<void> {
    await this.lineWebhookService.process(
      job.data.lineChannelId,
      job.data.payload as { events?: [] }
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

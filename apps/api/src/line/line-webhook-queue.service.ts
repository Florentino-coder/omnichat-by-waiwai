import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

export const LINE_WEBHOOK_QUEUE = "LINE_WEBHOOK_QUEUE";
export const LINE_WEBHOOK_QUEUE_NAME = "line-webhooks";
export const LINE_WEBHOOK_JOB_NAME = "process-line-webhook";

export interface LineWebhookJobData {
  lineChannelId: string;
  payload: unknown;
}

export interface WebhookQueuePort {
  add(name: string, data: LineWebhookJobData, options: WebhookQueueOptions): Promise<unknown>;
  close?(): Promise<unknown>;
}

export interface WebhookQueueOptions {
  attempts: number;
  backoff: {
    type: "exponential";
    delay: number;
  };
  removeOnComplete: number;
  removeOnFail: number;
}

export const createLineWebhookQueue = (redisUrl: string): WebhookQueuePort =>
  new Queue<LineWebhookJobData>(LINE_WEBHOOK_QUEUE_NAME, {
    connection: { url: redisUrl }
  });

export const createNoopLineWebhookQueue = (): WebhookQueuePort => ({
  async add(): Promise<unknown> {
    return { id: "noop-line-webhook-job" };
  }
});

@Injectable()
export class LineWebhookQueueService implements OnModuleDestroy {
  constructor(@Inject(LINE_WEBHOOK_QUEUE) private readonly queue: WebhookQueuePort) {}

  async enqueue(lineChannelId: string, payload: unknown): Promise<void> {
    await this.queue.add(
      LINE_WEBHOOK_JOB_NAME,
      { lineChannelId, payload },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
      }
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close?.();
  }
}

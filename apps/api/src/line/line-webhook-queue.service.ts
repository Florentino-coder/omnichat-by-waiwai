import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

export const LINE_WEBHOOK_QUEUE = "LINE_WEBHOOK_QUEUE";
export const LINE_WEBHOOK_QUEUE_NAME = "line-webhooks";
export const LINE_WEBHOOK_JOB_NAME = "process-line-webhook";

export interface LineWebhookJobData {
  lineChannelId: string;
  payload: unknown;
  flowId?: string;
}

export interface WebhookQueuePort {
  add(name: string, data: LineWebhookJobData, options: WebhookQueueOptions): Promise<unknown>;
  close?(): Promise<unknown>;
}

export interface InlineWebhookProcessor {
  process(lineChannelId: string, payload: unknown, flowId?: string): Promise<void>;
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

export const createInlineLineWebhookQueue = (processor: InlineWebhookProcessor): WebhookQueuePort => ({
  async add(
    _name: string,
    data: LineWebhookJobData,
    _options: WebhookQueueOptions
  ): Promise<unknown> {
    await processor.process(data.lineChannelId, data.payload, data.flowId);
    return { id: "inline-line-webhook-job" };
  }
});

export const createNoopLineWebhookQueue = (): WebhookQueuePort => ({
  async add(): Promise<unknown> {
    return { id: "noop-line-webhook-job" };
  }
});

export const isBullmqLineWebhookQueueEnabled = (mode: string | undefined): boolean =>
  mode?.trim().toLowerCase() === "bullmq";

@Injectable()
export class LineWebhookQueueService implements OnModuleDestroy {
  constructor(@Inject(LINE_WEBHOOK_QUEUE) private readonly queue: WebhookQueuePort) {}

  async enqueue(lineChannelId: string, payload: unknown, flowId?: string): Promise<void> {
    await this.queue.add(
      LINE_WEBHOOK_JOB_NAME,
      { lineChannelId, payload, flowId },
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

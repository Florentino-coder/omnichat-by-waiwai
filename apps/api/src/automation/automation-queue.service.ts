import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

export const AUTOMATION_QUEUE = "AUTOMATION_QUEUE";
export const AUTOMATION_QUEUE_NAME = "automation-runs";
export const AUTOMATION_JOB_NAME = "execute-automation-step";

export interface AutomationJobData {
  runId: string;
  tenantId: string;
  conversationId: string;
  ruleId: string;
  stepIndex: number;
}

export interface AutomationQueuePort {
  add(
    name: string,
    data: AutomationJobData,
    options: AutomationQueueOptions
  ): Promise<unknown>;
  close?(): Promise<void>;
}

export interface AutomationQueueOptions {
  attempts: number;
  backoff: {
    type: "exponential";
    delay: number;
  };
  removeOnComplete: number;
  removeOnFail: number;
  delay?: number;
}

export interface InlineAutomationProcessor {
  processStep(data: AutomationJobData): Promise<void>;
}

export const createAutomationQueue = (redisUrl: string): AutomationQueuePort =>
  new Queue<AutomationJobData>(AUTOMATION_QUEUE_NAME, {
    connection: { url: redisUrl }
  });

export const createInlineAutomationQueue = (
  processor: InlineAutomationProcessor
): AutomationQueuePort => ({
  async add(
    _name: string,
    data: AutomationJobData,
    _options: AutomationQueueOptions
  ): Promise<unknown> {
    await processor.processStep(data);
    return { id: "inline-automation-job" };
  }
});

export const createNoopAutomationQueue = (): AutomationQueuePort => ({
  async add(): Promise<unknown> {
    return { id: "noop-automation-job" };
  }
});

export const isBullmqAutomationQueueEnabled = (mode: string | undefined): boolean =>
  mode?.trim().toLowerCase() === "bullmq";

@Injectable()
export class AutomationQueueService implements OnModuleDestroy {
  constructor(@Inject(AUTOMATION_QUEUE) private readonly queue: AutomationQueuePort) {}

  async enqueueStep(data: AutomationJobData, delayMs = 0): Promise<void> {
    await this.queue.add(AUTOMATION_JOB_NAME, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
      ...(delayMs > 0 ? { delay: delayMs } : {})
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close?.();
  }
}

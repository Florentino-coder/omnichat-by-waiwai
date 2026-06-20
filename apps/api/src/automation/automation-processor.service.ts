import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import {
  AUTOMATION_QUEUE_NAME,
  AutomationJobData,
  isBullmqAutomationQueueEnabled
} from "./automation-queue.service";
import { AutomationEngineService } from "./automation-engine.service";

@Injectable()
export class AutomationProcessorService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<AutomationJobData>;

  constructor(
    private readonly automationEngineService: AutomationEngineService,
    private readonly configService?: ConfigService
  ) {}

  async processStep(data: AutomationJobData): Promise<void> {
    await this.automationEngineService.processRunStep(data.runId, data.stepIndex);
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const queueMode =
      process.env.AUTOMATION_QUEUE_MODE ??
      this.configService?.get<string>("AUTOMATION_QUEUE_MODE");

    if (!isBullmqAutomationQueueEnabled(queueMode)) {
      return;
    }

    const redisUrl = this.configService?.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.worker = new Worker<AutomationJobData>(
      AUTOMATION_QUEUE_NAME,
      (job) => this.processStep(job.data),
      {
        connection: { url: redisUrl },
        concurrency: 5
      }
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

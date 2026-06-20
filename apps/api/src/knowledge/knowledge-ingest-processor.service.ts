import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import {
  KNOWLEDGE_INGEST_QUEUE_NAME,
  KnowledgeIngestJobData,
  isBullmqKnowledgeIngestQueueEnabled
} from "./knowledge-ingest-queue.service";
import { KnowledgeDocumentService } from "./knowledge-document.service";

@Injectable()
export class KnowledgeIngestProcessorService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<KnowledgeIngestJobData>;

  constructor(
    @Inject(forwardRef(() => KnowledgeDocumentService))
    private readonly knowledgeDocumentService: KnowledgeDocumentService,
    private readonly configService?: ConfigService
  ) {}

  async ingestDocument(data: KnowledgeIngestJobData): Promise<void> {
    await this.knowledgeDocumentService.runIngestJob(
      data.tenantId,
      data.userId,
      data.documentId
    );
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const queueMode =
      process.env.KNOWLEDGE_INGEST_QUEUE_MODE ??
      this.configService?.get<string>("KNOWLEDGE_INGEST_QUEUE_MODE");

    if (!isBullmqKnowledgeIngestQueueEnabled(queueMode)) {
      return;
    }

    const redisUrl = this.configService?.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.worker = new Worker<KnowledgeIngestJobData>(
      KNOWLEDGE_INGEST_QUEUE_NAME,
      (job) => this.ingestDocument(job.data),
      {
        connection: { url: redisUrl },
        concurrency: 2
      }
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

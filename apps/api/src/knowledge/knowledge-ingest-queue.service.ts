import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

export const KNOWLEDGE_INGEST_QUEUE = "KNOWLEDGE_INGEST_QUEUE";
export const KNOWLEDGE_INGEST_QUEUE_NAME = "knowledge-ingest";
export const KNOWLEDGE_INGEST_JOB_NAME = "ingest-document";

export interface KnowledgeIngestJobData {
  tenantId: string;
  userId: string;
  documentId: string;
}

export interface KnowledgeIngestQueuePort {
  add(
    name: string,
    data: KnowledgeIngestJobData,
    options: KnowledgeIngestQueueOptions
  ): Promise<unknown>;
  close?(): Promise<void>;
}

export interface KnowledgeIngestQueueOptions {
  attempts: number;
  backoff: {
    type: "exponential";
    delay: number;
  };
  removeOnComplete: number;
  removeOnFail: number;
}

export interface InlineKnowledgeIngestProcessor {
  ingestDocument(data: KnowledgeIngestJobData): Promise<void>;
}

export const createKnowledgeIngestQueue = (redisUrl: string): KnowledgeIngestQueuePort =>
  new Queue<KnowledgeIngestJobData>(KNOWLEDGE_INGEST_QUEUE_NAME, {
    connection: { url: redisUrl }
  });

export const createInlineKnowledgeIngestQueue = (
  processor: InlineKnowledgeIngestProcessor
): KnowledgeIngestQueuePort => ({
  async add(
    _name: string,
    data: KnowledgeIngestJobData,
    _options: KnowledgeIngestQueueOptions
  ): Promise<unknown> {
    await processor.ingestDocument(data);
    return { id: "inline-knowledge-ingest-job" };
  }
});

export const isBullmqKnowledgeIngestQueueEnabled = (mode: string | undefined): boolean =>
  mode?.trim().toLowerCase() === "bullmq";

@Injectable()
export class KnowledgeIngestQueueService implements OnModuleDestroy {
  constructor(@Inject(KNOWLEDGE_INGEST_QUEUE) private readonly queue: KnowledgeIngestQueuePort) {}

  async enqueueIngest(data: KnowledgeIngestJobData): Promise<void> {
    await this.queue.add(KNOWLEDGE_INGEST_JOB_NAME, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close?.();
  }
}

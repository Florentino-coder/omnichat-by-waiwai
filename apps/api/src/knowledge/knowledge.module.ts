import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeDocumentController } from "./knowledge-document.controller";
import { KnowledgeDocumentService } from "./knowledge-document.service";
import { EmbeddingService } from "./embedding.service";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeTextExtractionService } from "./knowledge-text-extraction.service";
import {
  KNOWLEDGE_INGEST_QUEUE,
  KnowledgeIngestQueueService,
  createInlineKnowledgeIngestQueue,
  createKnowledgeIngestQueue,
  isBullmqKnowledgeIngestQueueEnabled
} from "./knowledge-ingest-queue.service";
import { KnowledgeIngestProcessorService } from "./knowledge-ingest-processor.service";

@Module({
  imports: [AuthModule, PrismaModule, StorageModule],
  controllers: [KnowledgeController, KnowledgeDocumentController],
  providers: [
    KnowledgeService,
    KnowledgeDocumentService,
    EmbeddingService,
    KnowledgeTextExtractionService,
    KnowledgeIngestProcessorService,
    {
      provide: KNOWLEDGE_INGEST_QUEUE,
      inject: [ConfigService, KnowledgeDocumentService, KnowledgeIngestProcessorService],
      useFactory: (
        configService: ConfigService,
        knowledgeDocumentService: KnowledgeDocumentService,
        _knowledgeIngestProcessorService: KnowledgeIngestProcessorService
      ) => {
        void _knowledgeIngestProcessorService;
        if (process.env.NODE_ENV === "test") {
          return createInlineKnowledgeIngestQueue({
            ingestDocument: (data) =>
              knowledgeDocumentService.runIngestJob(
                data.tenantId,
                data.userId,
                data.documentId,
                true
              )
          });
        }

        if (
          isBullmqKnowledgeIngestQueueEnabled(
            configService.get<string>("KNOWLEDGE_INGEST_QUEUE_MODE")
          )
        ) {
          return createKnowledgeIngestQueue(
            configService.get<string>("REDIS_URL") ?? "redis://localhost:6379"
          );
        }

        return createInlineKnowledgeIngestQueue({
          ingestDocument: (data) =>
            knowledgeDocumentService.runIngestJob(
              data.tenantId,
              data.userId,
              data.documentId,
              true
            )
        });
      }
    },
    KnowledgeIngestQueueService
  ],
  exports: [KnowledgeService, KnowledgeDocumentService]
})
export class KnowledgeModule {}

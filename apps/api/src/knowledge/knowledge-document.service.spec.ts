import { BadRequestException } from "@nestjs/common";
import {
  AuditAction,
  KnowledgeDocumentSource,
  KnowledgeDocumentStatus
} from "@prisma/client";
import { KnowledgeDocumentService } from "./knowledge-document.service";

describe("KnowledgeDocumentService", () => {
  const tenantId = "tenant-1";
  const userId = "user-1";

  const prisma = {
    knowledgeDocument: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    knowledgeChunk: {
      deleteMany: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  };

  const embeddingService = {
    embedTexts: jest.fn()
  };

  const storageService = {
    getObjectBuffer: jest.fn()
  };

  const textExtractionService = {
    extractFromBuffer: jest.fn(),
    extractFromHtml: jest.fn()
  };

  const knowledgeIngestQueueService = {
    enqueueIngest: jest.fn().mockResolvedValue(undefined)
  };

  let service: KnowledgeDocumentService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.knowledgeChunk.deleteMany.mockResolvedValue({ count: 0 });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    service = new KnowledgeDocumentService(
      prisma as never,
      embeddingService as never,
      storageService as never,
      textExtractionService as never,
      knowledgeIngestQueueService as never
    );
  });

  describe("requestReindex", () => {
    it("queues all documents and writes bulk audit log", async () => {
      const documents = [
        {
          id: "doc-1",
          tenantId,
          title: "Policy A",
          status: KnowledgeDocumentStatus.READY
        },
        {
          id: "doc-2",
          tenantId,
          title: "Policy B",
          status: KnowledgeDocumentStatus.FAILED
        }
      ];

      prisma.knowledgeDocument.findMany.mockResolvedValue(documents);
      prisma.knowledgeDocument.update.mockResolvedValue({});
      prisma.knowledgeDocument.findFirst.mockImplementation(async ({ where }) =>
        documents.find((document) => document.id === where.id) ?? null
      );

      const result = await service.requestReindex(tenantId, userId, { all: true });

      expect(result).toEqual({ queuedCount: 2 });
      expect(knowledgeIngestQueueService.enqueueIngest).toHaveBeenCalledTimes(2);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.KNOWLEDGE_DOCUMENT_REINDEX_REQUESTED,
          metadata: expect.objectContaining({
            scope: "all",
            queuedCount: 2
          })
        })
      });
    });

    it("queues selected document ids", async () => {
      const documents = [
        {
          id: "doc-1",
          tenantId,
          title: "Policy A",
          status: KnowledgeDocumentStatus.READY
        }
      ];

      prisma.knowledgeDocument.findMany.mockResolvedValue(documents);
      prisma.knowledgeDocument.update.mockResolvedValue({});
      prisma.knowledgeDocument.findFirst.mockResolvedValue(documents[0]);

      const result = await service.requestReindex(tenantId, userId, {
        documentIds: ["doc-1"]
      });

      expect(result).toEqual({ queuedCount: 1 });
      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          deletedAt: null,
          id: { in: ["doc-1"] }
        }
      });
    });

    it("throws when no re-index scope is provided", async () => {
      await expect(service.requestReindex(tenantId, userId, {})).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("runIngestJob", () => {
    it("marks document FAILED when embedding provider returns quota error", async () => {
      const document = {
        id: "doc-1",
        tenantId,
        title: "Shipping policy",
        rawText:
          "Free shipping for orders over 500 baht nationwide. Returns accepted within 7 days.",
        sourceType: KnowledgeDocumentSource.TEXT,
        status: KnowledgeDocumentStatus.PENDING,
        storageKey: null,
        sourceUrl: null,
        mimeType: null
      };

      prisma.knowledgeDocument.findFirst.mockResolvedValue(document);
      embeddingService.embedTexts.mockRejectedValue(
        new Error("Gemini embedding API status 429: quota exceeded")
      );
      prisma.knowledgeDocument.update.mockResolvedValue({
        ...document,
        status: KnowledgeDocumentStatus.FAILED,
        errorMessage: "Embedding provider daily quota exceeded. Re-index later or upgrade your API plan."
      });

      await service.runIngestJob(tenantId, userId, document.id, false);

      expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith({
        where: { id: document.id },
        data: {
          status: KnowledgeDocumentStatus.FAILED,
          errorMessage: expect.stringContaining("quota")
        }
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.KNOWLEDGE_DOCUMENT_INGEST_FAILED,
          targetId: document.id
        })
      });
    });
  });
});

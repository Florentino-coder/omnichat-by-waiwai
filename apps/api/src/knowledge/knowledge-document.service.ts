import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef
} from "@nestjs/common";
import { PlanLimitExceededException } from "../common/exceptions/plan-limit-exceeded.exception";
import {
  AuditAction,
  FileType,
  KnowledgeDocument,
  KnowledgeDocumentSource,
  KnowledgeDocumentStatus,
  RetentionType,
  Role
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { CreateKnowledgeDocumentDto } from "./dto/create-knowledge-document.dto";
import { CreateKnowledgeDocumentFromUrlDto } from "./dto/create-knowledge-document-from-url.dto";
import { ReindexKnowledgeDocumentsDto } from "./dto/reindex-knowledge-documents.dto";
import { EmbeddingService } from "./embedding.service";
import { KnowledgeIngestQueueService } from "./knowledge-ingest-queue.service";
import { splitTextIntoChunks } from "./knowledge-chunk.util";
import {
  formatRagContext,
  mergeKnowledgeContext,
  rankChunksByEmbedding,
  type HybridKnowledgeResult,
  type KnowledgeCitation
} from "./knowledge-rag.util";
import {
  formatKnowledgeContext,
  rankKnowledgeArticles,
  scoreKnowledgeArticle,
  tokenizeSearchQuery
} from "./knowledge-search.util";
import { KnowledgeTextExtractionService } from "./knowledge-text-extraction.service";
import { fetchPublicUrlText } from "./knowledge-url.util";
import { UploadedKnowledgeFile } from "./knowledge-upload.types";

type ChunkRow = {
  content: string;
  documentTitle: string;
  embedding: number[] | null;
};

@Injectable()
export class KnowledgeDocumentService {
  private readonly logger = new Logger(KnowledgeDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly storageService: StorageService,
    private readonly textExtractionService: KnowledgeTextExtractionService,
    @Inject(forwardRef(() => KnowledgeIngestQueueService))
    private readonly knowledgeIngestQueueService: KnowledgeIngestQueueService
  ) {}

  listDocuments(
    tenantId: string,
    lineChannelId?: string
  ): Promise<KnowledgeDocument[]> {
    const where: {
      tenantId: string;
      deletedAt: null;
      OR?: Array<{ lineChannelId: string | null }>;
    } = {
      tenantId,
      deletedAt: null
    };

    if (lineChannelId) {
      where.OR = [{ lineChannelId: null }, { lineChannelId }];
    }

    return this.prisma.knowledgeDocument.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }]
    });
  }

  async findOne(tenantId: string, id: string): Promise<KnowledgeDocument> {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!document) {
      throw new NotFoundException("Knowledge document not found");
    }

    return document;
  }

  async createDocument(
    tenantId: string,
    userId: string,
    dto: CreateKnowledgeDocumentDto
  ): Promise<KnowledgeDocument> {
    await this.assertPlanAllowsAi(tenantId);
    if (dto.lineChannelId) {
      await this.assertLineChannelBelongsToTenant(tenantId, dto.lineChannelId);
    }

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        lineChannelId: dto.lineChannelId ?? null,
        title: dto.title.trim(),
        rawText: dto.rawText.trim(),
        sourceType: KnowledgeDocumentSource.TEXT,
        status: KnowledgeDocumentStatus.PENDING
      }
    });

    await this.auditDocumentCreated(tenantId, userId, document);
    return this.scheduleIngest(tenantId, userId, document.id);
  }

  async createFromUpload(
    tenantId: string,
    userId: string,
    file: UploadedKnowledgeFile,
    title: string,
    lineChannelId?: string
  ): Promise<KnowledgeDocument> {
    await this.assertPlanAllowsAi(tenantId);
    if (!file?.buffer?.length) {
      throw new BadRequestException("File is required");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException("File exceeds 10 MB limit");
    }

    if (lineChannelId) {
      await this.assertLineChannelBelongsToTenant(tenantId, lineChannelId);
    }

    const mimeType = file.mimetype || "application/octet-stream";
    const extractedText = await this.textExtractionService.extractFromBuffer(
      file.buffer,
      mimeType
    );

    const upload = await this.storageService.uploadFile(
      tenantId,
      null,
      FileType.DOCUMENT,
      RetentionType.PERMANENT,
      file.buffer,
      file.originalname || "document",
      mimeType
    );

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        lineChannelId: lineChannelId ?? null,
        title: title.trim(),
        rawText: extractedText,
        sourceType: KnowledgeDocumentSource.FILE,
        mimeType,
        storageKey: upload.r2Key,
        status: KnowledgeDocumentStatus.PENDING
      }
    });

    await this.auditDocumentCreated(tenantId, userId, document, {
      sourceType: "FILE",
      mimeType
    });

    return this.scheduleIngest(tenantId, userId, document.id);
  }

  async createFromUrl(
    tenantId: string,
    userId: string,
    dto: CreateKnowledgeDocumentFromUrlDto
  ): Promise<KnowledgeDocument> {
    await this.assertPlanAllowsAi(tenantId);
    if (dto.lineChannelId) {
      await this.assertLineChannelBelongsToTenant(tenantId, dto.lineChannelId);
    }

    const fetchedBody = await fetchPublicUrlText(dto.sourceUrl);
    const extractedText = this.textExtractionService.extractFromHtml(fetchedBody);

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        lineChannelId: dto.lineChannelId ?? null,
        title: dto.title.trim(),
        rawText: extractedText,
        sourceType: KnowledgeDocumentSource.URL,
        sourceUrl: dto.sourceUrl.trim(),
        status: KnowledgeDocumentStatus.PENDING
      }
    });

    await this.auditDocumentCreated(tenantId, userId, document, {
      sourceType: "URL",
      sourceUrl: dto.sourceUrl.trim()
    });

    return this.scheduleIngest(tenantId, userId, document.id);
  }

  async reindexDocument(
    tenantId: string,
    userId: string,
    id: string
  ): Promise<KnowledgeDocument> {
    const document = await this.findOne(tenantId, id);
    await this.queueDocumentForReindex(tenantId, userId, document, {
      scope: "single",
      documentId: document.id
    });
    return this.findOne(tenantId, document.id);
  }

  async requestReindex(
    tenantId: string,
    userId: string,
    dto: ReindexKnowledgeDocumentsDto
  ): Promise<{ queuedCount: number }> {
    const hasDocumentIds = Boolean(dto.documentIds?.length);
    if (!dto.all && !dto.lineChannelId && !hasDocumentIds) {
      throw new BadRequestException(
        "Specify documentIds, lineChannelId, or all=true for re-index"
      );
    }

    if (dto.lineChannelId) {
      await this.assertLineChannelBelongsToTenant(tenantId, dto.lineChannelId);
    }

    const documents = await this.findDocumentsForReindex(tenantId, dto);
    if (documents.length === 0) {
      return { queuedCount: 0 };
    }

    for (const document of documents) {
      await this.queueDocumentForReindex(tenantId, userId, document);
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.KNOWLEDGE_DOCUMENT_REINDEX_REQUESTED,
        targetType: "KnowledgeDocument",
        metadata: {
          scope: dto.all ? "all" : dto.lineChannelId ? "lineChannel" : "documentIds",
          lineChannelId: dto.lineChannelId ?? null,
          documentIds: dto.documentIds ?? null,
          queuedCount: documents.length
        }
      }
    });

    return { queuedCount: documents.length };
  }

  async deleteDocument(
    tenantId: string,
    userId: string,
    role: Role,
    id: string
  ): Promise<KnowledgeDocument> {
    if (role !== Role.OWNER && role !== Role.ADMIN) {
      throw new ForbiddenException("Only owners and admins can delete knowledge documents");
    }

    const document = await this.findOne(tenantId, id);

    const deleted = await this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        deletedAt: new Date(),
        status: KnowledgeDocumentStatus.FAILED
      }
    });

    await this.prisma.knowledgeChunk.deleteMany({
      where: {
        tenantId,
        documentId: document.id
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.KNOWLEDGE_DOCUMENT_DELETED,
        targetType: "KnowledgeDocument",
        targetId: deleted.id,
        metadata: {
          title: deleted.title
        }
      }
    });

    return deleted;
  }

  async buildHybridKnowledgeContext(
    tenantId: string,
    queryText: string,
    lineChannelId?: string | null,
    articleLimit = 5,
    chunkLimit = 3
  ): Promise<HybridKnowledgeResult> {
    const articles = await this.prisma.knowledgeArticle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...(lineChannelId
          ? {
              OR: [{ lineChannelId: null }, { lineChannelId }]
            }
          : {})
      },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      take: 100
    });

    const tokens = tokenizeSearchQuery(queryText);
    const rankedArticles =
      tokens.length > 0
        ? articles
            .map((article) => ({
              article,
              score: scoreKnowledgeArticle(article, tokens)
            }))
            .filter((entry) => entry.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, articleLimit)
            .map((entry) => entry.article)
        : rankKnowledgeArticles(articles, queryText, articleLimit);

    const articleCitations: KnowledgeCitation[] = rankedArticles.map((article) => ({
      type: "article",
      title: article.title,
      excerpt: article.content.slice(0, 160)
    }));

    const articleContext = formatKnowledgeContext(rankedArticles);
    const trimmedQuery = queryText.trim();

    if (!trimmedQuery) {
      return { context: articleContext, citations: articleCitations };
    }

    try {
      const queryEmbedding = await this.embeddingService.embedQuery(trimmedQuery);
      if (queryEmbedding.length === 0) {
        return { context: articleContext, citations: articleCitations };
      }

      const chunks = await this.loadReadyChunks(tenantId, lineChannelId);
      const rankedChunks = rankChunksByEmbedding(chunks, queryEmbedding, chunkLimit, 0.5);
      const ragContext = formatRagContext(rankedChunks);
      const documentCitations: KnowledgeCitation[] = rankedChunks.map((chunk) => ({
        type: "document",
        title: chunk.documentTitle,
        score: chunk.score,
        excerpt: chunk.content.slice(0, 160)
      }));

      return {
        context: mergeKnowledgeContext(articleContext, ragContext),
        citations: [...articleCitations, ...documentCitations]
      };
    } catch (error) {
      this.logger.warn(
        `RAG retrieval skipped: ${error instanceof Error ? error.message : "unknown error"}`
      );
      return { context: articleContext, citations: articleCitations };
    }
  }

  async runIngestJob(
    tenantId: string,
    userId: string,
    documentId: string,
    throwOnFailure = false
  ): Promise<void> {
    if (throwOnFailure) {
      await this.ingestDocument(tenantId, userId, documentId, true);
      return;
    }

    try {
      await this.ingestDocument(tenantId, userId, documentId, false);
    } catch (error) {
      this.logger.error(
        `Knowledge ingest job failed for ${documentId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  private async queueDocumentForReindex(
    tenantId: string,
    userId: string,
    document: KnowledgeDocument,
    auditMetadata?: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        status: KnowledgeDocumentStatus.PENDING,
        errorMessage: null
      }
    });

    await this.prisma.knowledgeChunk.deleteMany({
      where: {
        tenantId,
        documentId: document.id
      }
    });

    await this.scheduleIngest(tenantId, userId, document.id);

    if (auditMetadata) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.KNOWLEDGE_DOCUMENT_REINDEX_REQUESTED,
          targetType: "KnowledgeDocument",
          targetId: document.id,
          metadata: {
            title: document.title,
            ...auditMetadata
          }
        }
      });
    }
  }

  private async findDocumentsForReindex(
    tenantId: string,
    dto: ReindexKnowledgeDocumentsDto
  ): Promise<KnowledgeDocument[]> {
    if (dto.all) {
      return this.prisma.knowledgeDocument.findMany({
        where: {
          tenantId,
          deletedAt: null
        }
      });
    }

    if (dto.lineChannelId) {
      return this.prisma.knowledgeDocument.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [{ lineChannelId: null }, { lineChannelId: dto.lineChannelId }]
        }
      });
    }

    const documentIds = dto.documentIds ?? [];
    return this.prisma.knowledgeDocument.findMany({
      where: {
        tenantId,
        deletedAt: null,
        id: { in: documentIds }
      }
    });
  }

  private formatIngestError(error: unknown): string {
    const message = error instanceof Error ? error.message : "Ingest failed";
    if (/status 429|rate limit|quota/i.test(message)) {
      return "Embedding provider daily quota exceeded. Re-index later or upgrade your API plan.";
    }
    return message;
  }

  private async scheduleIngest(
    tenantId: string,
    userId: string,
    documentId: string
  ): Promise<KnowledgeDocument> {
    await this.knowledgeIngestQueueService.enqueueIngest({
      tenantId,
      userId,
      documentId
    });

    return this.findOne(tenantId, documentId);
  }

  private async ingestDocument(
    tenantId: string,
    userId: string,
    documentId: string,
    throwOnFailure: boolean
  ): Promise<KnowledgeDocument> {
    const document = await this.findOne(tenantId, documentId);
    const sourceText = await this.resolveDocumentText(document);
    const chunks = splitTextIntoChunks(sourceText);

    if (chunks.length === 0) {
      const message = "Document text is too short to index";
      await this.markIngestFailed(tenantId, userId, document.id, message);
      if (throwOnFailure) {
        throw new BadRequestException(message);
      }
      return this.findOne(tenantId, documentId);
    }

    try {
      const embeddings = await this.embeddingService.embedTexts(chunks);

      await this.prisma.$transaction(async (tx) => {
        await tx.knowledgeChunk.deleteMany({
          where: {
            tenantId,
            documentId: document.id
          }
        });

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
          await tx.knowledgeChunk.create({
            data: {
              tenantId,
              documentId: document.id,
              chunkIndex,
              content: chunks[chunkIndex],
              embedding: embeddings[chunkIndex] ?? []
            }
          });
        }
      });

      const updated = await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          rawText: sourceText,
          status: KnowledgeDocumentStatus.READY,
          chunkCount: chunks.length,
          errorMessage: null
        }
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.KNOWLEDGE_DOCUMENT_INGESTED,
          targetType: "KnowledgeDocument",
          targetId: updated.id,
          metadata: {
            title: updated.title,
            chunkCount: updated.chunkCount
          }
        }
      });

      return updated;
    } catch (error) {
      const message = this.formatIngestError(error);
      await this.markIngestFailed(tenantId, userId, document.id, message);
      if (throwOnFailure) {
        throw new BadRequestException(message);
      }
      return this.findOne(tenantId, documentId);
    }
  }

  private async resolveDocumentText(document: KnowledgeDocument): Promise<string> {
    if (document.sourceType === KnowledgeDocumentSource.FILE && document.storageKey) {
      const buffer = await this.storageService.getObjectBuffer(document.storageKey);
      const mimeType = document.mimeType || "application/octet-stream";
      return this.textExtractionService.extractFromBuffer(buffer, mimeType);
    }

    if (document.sourceType === KnowledgeDocumentSource.URL && document.sourceUrl) {
      const fetchedBody = await fetchPublicUrlText(document.sourceUrl);
      return this.textExtractionService.extractFromHtml(fetchedBody);
    }

    return document.rawText.trim();
  }

  private async markIngestFailed(
    tenantId: string,
    userId: string,
    documentId: string,
    message: string
  ): Promise<void> {
    const failed = await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: KnowledgeDocumentStatus.FAILED,
        errorMessage: message
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.KNOWLEDGE_DOCUMENT_INGEST_FAILED,
        targetType: "KnowledgeDocument",
        targetId: failed.id,
        metadata: {
          title: failed.title,
          error: message
        }
      }
    });
  }

  private async auditDocumentCreated(
    tenantId: string,
    userId: string,
    document: KnowledgeDocument,
    metadata: Record<string, string> = {}
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.KNOWLEDGE_DOCUMENT_CREATED,
        targetType: "KnowledgeDocument",
        targetId: document.id,
        metadata: {
          title: document.title,
          ...metadata
        }
      }
    });
  }

  private async loadReadyChunks(
    tenantId: string,
    lineChannelId?: string | null
  ): Promise<ChunkRow[]> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: KnowledgeDocumentStatus.READY,
        ...(lineChannelId
          ? {
              OR: [{ lineChannelId: null }, { lineChannelId }]
            }
          : {})
      },
      select: {
        id: true,
        title: true,
        chunks: {
          select: {
            content: true,
            embedding: true
          },
          orderBy: { chunkIndex: "asc" }
        }
      }
    });

    const rows: ChunkRow[] = [];

    for (const document of documents) {
      for (const chunk of document.chunks) {
        rows.push({
          content: chunk.content,
          documentTitle: document.title,
          embedding: this.parseEmbedding(chunk.embedding)
        });
      }
    }

    return rows;
  }

  private parseEmbedding(value: unknown): number[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const numbers = value.filter((entry): entry is number => typeof entry === "number");
    return numbers.length > 0 ? numbers : null;
  }

  private async assertLineChannelBelongsToTenant(
    tenantId: string,
    lineChannelId: string
  ): Promise<void> {
    const lineChannel = await this.prisma.lineChannel.findFirst({
      where: {
        id: lineChannelId,
        tenantId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!lineChannel) {
      throw new NotFoundException("LINE channel not found");
    }
  }

  private async assertPlanAllowsAi(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true }
    });
    const limits = tenant
      ? await this.prisma.planLimit.findUnique({
          where: { planId: tenant.planId }
        })
      : null;
    if (!limits || limits.maxAiCreditsPerMonth <= 0) {
      throw new PlanLimitExceededException("AI Knowledge Base features are not available on your plan.", {
        planId: tenant?.planId ?? "unknown",
        limit: limits?.maxAiCreditsPerMonth ?? 0,
        metric: "max_ai_credits_per_month"
      });
    }
  }
}

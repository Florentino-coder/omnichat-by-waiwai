import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  Role
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateKnowledgeDocumentDto } from "./dto/create-knowledge-document.dto";
import { EmbeddingService } from "./embedding.service";
import { splitTextIntoChunks } from "./knowledge-chunk.util";
import {
  formatRagContext,
  mergeKnowledgeContext,
  rankChunksByEmbedding
} from "./knowledge-rag.util";
import { formatKnowledgeContext, rankKnowledgeArticles } from "./knowledge-search.util";

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
    private readonly embeddingService: EmbeddingService
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
    if (dto.lineChannelId) {
      await this.assertLineChannelBelongsToTenant(tenantId, dto.lineChannelId);
    }

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        lineChannelId: dto.lineChannelId ?? null,
        title: dto.title.trim(),
        rawText: dto.rawText.trim(),
        status: KnowledgeDocumentStatus.PENDING
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.KNOWLEDGE_DOCUMENT_CREATED,
        targetType: "KnowledgeDocument",
        targetId: document.id,
        metadata: {
          title: document.title
        }
      }
    });

    return this.ingestDocument(tenantId, userId, document.id);
  }

  async reindexDocument(
    tenantId: string,
    userId: string,
    id: string
  ): Promise<KnowledgeDocument> {
    const document = await this.findOne(tenantId, id);

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

    return this.ingestDocument(tenantId, userId, document.id);
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
  ): Promise<string> {
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

    const rankedArticles = rankKnowledgeArticles(articles, queryText, articleLimit);
    const articleContext = formatKnowledgeContext(rankedArticles);

    const trimmedQuery = queryText.trim();
    if (!trimmedQuery) {
      return articleContext;
    }

    try {
      const queryEmbedding = await this.embeddingService.embedQuery(trimmedQuery);
      if (queryEmbedding.length === 0) {
        return articleContext;
      }

      const chunks = await this.loadReadyChunks(tenantId, lineChannelId);
      const rankedChunks = rankChunksByEmbedding(chunks, queryEmbedding, chunkLimit);
      const ragContext = formatRagContext(rankedChunks);
      return mergeKnowledgeContext(articleContext, ragContext);
    } catch (error) {
      this.logger.warn(
        `RAG retrieval skipped: ${error instanceof Error ? error.message : "unknown error"}`
      );
      return articleContext;
    }
  }

  private async ingestDocument(
    tenantId: string,
    userId: string,
    documentId: string
  ): Promise<KnowledgeDocument> {
    const document = await this.findOne(tenantId, documentId);
    const chunks = splitTextIntoChunks(document.rawText);

    if (chunks.length === 0) {
      throw new BadRequestException("Document text is too short to index");
    }

    try {
      const embeddings = await this.embeddingService.embedTexts(chunks);

      await this.prisma.$transaction(async (tx) => {
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
      const message = error instanceof Error ? error.message : "Ingest failed";
      const failed = await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
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

      throw new BadRequestException(message);
    }
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
}

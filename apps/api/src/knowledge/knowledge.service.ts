import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditAction, KnowledgeArticle, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateKnowledgeArticleDto } from "./dto/create-knowledge-article.dto";
import { UpdateKnowledgeArticleDto } from "./dto/update-knowledge-article.dto";
import { KnowledgeDocumentService } from "./knowledge-document.service";

export type ListKnowledgeArticlesOptions = {
  lineChannelId?: string;
  search?: string;
  limit?: number;
  activeOnly?: boolean;
};

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeDocumentService: KnowledgeDocumentService
  ) {}

  listArticles(
    tenantId: string,
    options: ListKnowledgeArticlesOptions = {}
  ): Promise<KnowledgeArticle[]> {
    const where: {
      tenantId: string;
      deletedAt: null;
      isActive?: boolean;
      OR?: Array<{ lineChannelId: string | null }>;
      AND?: Array<{
        OR: Array<
          | { title: { contains: string; mode: "insensitive" } }
          | { content: { contains: string; mode: "insensitive" } }
        >;
      }>;
    } = {
      tenantId,
      deletedAt: null
    };

    if (options.activeOnly !== false) {
      where.isActive = true;
    }

    if (options.lineChannelId) {
      where.OR = [
        { lineChannelId: null },
        { lineChannelId: options.lineChannelId }
      ];
    }

    if (options.search?.trim()) {
      const search = options.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } }
          ]
        }
      ];
    }

    return this.prisma.knowledgeArticle.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      take: options.limit ?? 100
    });
  }

  async findOne(tenantId: string, id: string): Promise<KnowledgeArticle> {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!article) {
      throw new NotFoundException("Knowledge article not found");
    }

    return article;
  }

  async createArticle(
    tenantId: string,
    userId: string,
    input: CreateKnowledgeArticleDto
  ): Promise<KnowledgeArticle> {
    if (input.lineChannelId) {
      await this.assertLineChannelBelongsToTenant(tenantId, input.lineChannelId);
    }

    const article = await this.prisma.knowledgeArticle.create({
      data: {
        tenantId,
        lineChannelId: input.lineChannelId ?? null,
        title: input.title.trim(),
        content: input.content.trim(),
        keywords: this.normalizeKeywords(input.keywords),
        category: input.category?.trim() || null,
        isActive: input.isActive ?? true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.KNOWLEDGE_ARTICLE_CREATED,
        targetType: "KnowledgeArticle",
        targetId: article.id,
        metadata: {
          title: article.title,
          lineChannelId: article.lineChannelId
        }
      }
    });

    return article;
  }

  async updateArticle(
    tenantId: string,
    userId: string,
    role: Role,
    id: string,
    input: UpdateKnowledgeArticleDto
  ): Promise<KnowledgeArticle> {
    if (role === Role.QC || role === Role.VIEWER) {
      throw new ForbiddenException("You do not have permission to edit knowledge articles");
    }

    const article = await this.findOne(tenantId, id);

    if (input.lineChannelId) {
      await this.assertLineChannelBelongsToTenant(tenantId, input.lineChannelId);
    }

    const updated = await this.prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: {
        lineChannelId:
          input.lineChannelId === undefined
            ? undefined
            : input.lineChannelId,
        title: input.title?.trim(),
        content: input.content?.trim(),
        keywords:
          input.keywords === undefined
            ? undefined
            : this.normalizeKeywords(input.keywords),
        category:
          input.category === undefined
            ? undefined
            : input.category?.trim() || null,
        isActive: input.isActive
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.KNOWLEDGE_ARTICLE_UPDATED,
        targetType: "KnowledgeArticle",
        targetId: updated.id,
        metadata: {
          title: updated.title,
          lineChannelId: updated.lineChannelId
        }
      }
    });

    return updated;
  }

  async deleteArticle(
    tenantId: string,
    userId: string,
    role: Role,
    id: string
  ): Promise<KnowledgeArticle> {
    if (role !== Role.OWNER && role !== Role.ADMIN) {
      throw new ForbiddenException("Only owners and admins can delete knowledge articles");
    }

    const article = await this.findOne(tenantId, id);

    const deleted = await this.prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.KNOWLEDGE_ARTICLE_DELETED,
        targetType: "KnowledgeArticle",
        targetId: deleted.id,
        metadata: {
          title: deleted.title
        }
      }
    });

    return deleted;
  }

  async buildKnowledgeContext(
    tenantId: string,
    queryText: string,
    lineChannelId?: string | null,
    limit = 5
  ): Promise<string> {
    return this.knowledgeDocumentService.buildHybridKnowledgeContext(
      tenantId,
      queryText,
      lineChannelId,
      limit
    );
  }

  private normalizeKeywords(keywords: string[] | undefined): string[] {
    if (!keywords) {
      return [];
    }

    return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))].slice(
      0,
      20
    );
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

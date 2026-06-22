import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, KnowledgeArticle } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApproveAiTrainingPairDto, ListAiCurationDto, UpdateAiTrainingPairDto } from "./dto/ai-curation.dto";

@Injectable()
export class AiCurationService {
  constructor(private readonly prisma: PrismaService) {}

  async listPairs(tenantId: string, query: ListAiCurationDto) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { customerMessage: { contains: search, mode: "insensitive" } },
        { assistantReply: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.aiTrainingPair.count({ where }),
      this.prisma.aiTrainingPair.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
      }),
    ]);

    return {
      items,
      total,
    };
  }

  async updatePair(tenantId: string, id: string, dto: UpdateAiTrainingPairDto) {
    const pair = await this.prisma.aiTrainingPair.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!pair) {
      throw new NotFoundException("AI training pair not found");
    }

    const data: any = {};
    let isEdited = false;

    if (dto.customerMessage !== undefined && dto.customerMessage !== pair.customerMessage) {
      data.customerMessage = dto.customerMessage;
      isEdited = true;
    }

    if (dto.assistantReply !== undefined && dto.assistantReply !== pair.assistantReply) {
      data.assistantReply = dto.assistantReply;
      isEdited = true;
    }

    if (dto.status !== undefined) {
      if (dto.status === "approved") {
        throw new BadRequestException("Approvals must go through the /approve endpoint");
      }
      data.status = dto.status;
    }

    if (isEdited) {
      data.isEdited = true;
    }

    return this.prisma.aiTrainingPair.update({
      where: { id },
      data,
    });
  }

  async approvePair(tenantId: string, userId: string, id: string, dto: ApproveAiTrainingPairDto): Promise<KnowledgeArticle> {
    // 1. Transaction-safe check and status update to approved
    const result = await this.prisma.$transaction(async (tx: any) => {
      const pair = await tx.aiTrainingPair.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { conversation: true },
      });

      if (!pair) {
        throw new NotFoundException("AI training pair not found");
      }

      if (pair.status === "approved") {
        throw new ConflictException("Training pair is already approved");
      }

      // Update status to approved
      await tx.aiTrainingPair.update({
        where: { id },
        data: { status: "approved" },
      });

      // 2. Inherit channel context or make it global
      const lineChannelId = dto.global ? null : pair.conversation.lineChannelId;

      // Truncate title to fit KnowledgeArticle bounds (max 200 chars)
      const title = pair.customerMessage.length > 200
        ? pair.customerMessage.substring(0, 197) + "..."
        : pair.customerMessage;

      // 3. Create KnowledgeArticle
      const article = await tx.knowledgeArticle.create({
        data: {
          tenantId,
          lineChannelId,
          title,
          content: pair.assistantReply,
          keywords: [pair.customerMessage.trim()],
          category: "AI Curation",
          isActive: true,
        },
      });

      // 4. Create Audit Log
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.KNOWLEDGE_ARTICLE_CREATED,
          targetType: "KnowledgeArticle",
          targetId: article.id,
          metadata: {
            source: "AI_CURATION",
            trainingPairId: id,
          },
        },
      });

      return article;
    });

    return result;
  }

  async softDeletePair(tenantId: string, id: string) {
    const pair = await this.prisma.aiTrainingPair.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!pair) {
      throw new NotFoundException("AI training pair not found");
    }

    return this.prisma.aiTrainingPair.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async exportPairs(tenantId: string, status?: string, from?: string, to?: string) {
    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(`${from}T00:00:00.000Z`);
      }
      if (to) {
        where.createdAt.lte = new Date(`${to}T23:59:59.999Z`);
      }
    }

    // Hard limit of 5000 records to prevent memory/timeout issues
    const totalCount = await this.prisma.aiTrainingPair.count({ where });
    const pairs = await this.prisma.aiTrainingPair.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 5000,
    });

    // Format to standard OpenAI Chat fine-tuning JSON Lines / JSON format
    const formatted = pairs.map((pair) => ({
      messages: [
        {
          role: "system",
          content: "You are a helpful customer service assistant replying to LINE customer inquiries.",
        },
        {
          role: "user",
          content: pair.customerMessage,
        },
        {
          role: "assistant",
          content: pair.assistantReply,
        },
      ],
    }));

    return {
      total: totalCount,
      limit: 5000,
      items: formatted,
    };
  }
}

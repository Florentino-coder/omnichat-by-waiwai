import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListQaScoresQueryDto, QaComplianceQueryDto } from "./dto/qa-query.dto";

type DateRange = { fromDate: Date; toDate: Date };

export type QaScoreListItem = {
  id: string;
  conversationId: string;
  messageId: string;
  relevanceScore: number;
  toneScore: number;
  hallucinationScore: number;
  overallScore: number;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  conversation: {
    id: string;
    customerDisplayName: string | null;
  };
};

function conversationLabel(conversation: {
  displayName: string | null;
  nickname: string | null;
}): string | null {
  return conversation.nickname ?? conversation.displayName ?? null;
}

@Injectable()
export class QaService {
  constructor(private readonly prisma: PrismaService) {}

  async listScores(tenantId: string, query: ListQaScoresQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { fromDate, toDate } = this.parseDateRange(query.from, query.to);

    const scores = await this.prisma.aiQaScore.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate }
      },
      include: {
        conversation: {
          select: {
            id: true,
            displayName: true,
            nickname: true
          }
        }
      }
    });

    let items = scores.map((score) => this.toListItem(score));

    if (query.minScore !== undefined) {
      items = items.filter((item) => item.overallScore >= query.minScore!);
    }

    items.sort((a, b) => a.overallScore - b.overallScore || b.createdAt.localeCompare(a.createdAt));

    const total = items.length;
    const offset = (page - 1) * limit;
    const paged = items.slice(offset, offset + limit);

    return { items: paged, page, limit, total };
  }

  async getScoreDetail(tenantId: string, scoreId: string) {
    const score = await this.prisma.aiQaScore.findFirst({
      where: { id: scoreId, tenantId },
      include: {
        conversation: {
          select: {
            id: true,
            displayName: true,
            nickname: true
          }
        },
        message: {
          select: {
            id: true,
            text: true,
            createdAt: true
          }
        }
      }
    });

    if (!score) {
      throw new NotFoundException("QA score not found");
    }

    const inboundMessage = await this.prisma.message.findFirst({
      where: {
        tenantId,
        conversationId: score.conversationId,
        direction: "INBOUND",
        deletedAt: null,
        createdAt: { lt: score.message.createdAt }
      },
      orderBy: { createdAt: "desc" },
      select: { text: true }
    });

    return {
      ...this.toListItem(score),
      messageText: score.message.text,
      customerMessageText: inboundMessage?.text ?? null,
      messageCreatedAt: score.message.createdAt.toISOString()
    };
  }

  async reviewScore(
    tenantId: string,
    userId: string,
    scoreId: string,
    reviewNote?: string | null
  ) {
    const score = await this.prisma.aiQaScore.findFirst({
      where: { id: scoreId, tenantId }
    });

    if (!score) {
      throw new NotFoundException("QA score not found");
    }

    const updated = await this.prisma.aiQaScore.update({
      where: { id: score.id },
      data: {
        reviewNote: reviewNote ?? null,
        reviewedBy: userId,
        reviewedAt: new Date()
      },
      include: {
        conversation: {
          select: {
            id: true,
            displayName: true,
            nickname: true
          }
        }
      }
    });

    return this.toListItem(updated);
  }

  async getComplianceSummary(tenantId: string, query: QaComplianceQueryDto) {
    const { fromDate, toDate } = this.parseDateRange(query.from, query.to);

    const [
      policyBlocks,
      escalations,
      guardrailEvents,
      lowQaScores,
      qaSampleCount
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          tenantId,
          action: AuditAction.AI_POLICY_BLOCKED,
          createdAt: { gte: fromDate, lte: toDate }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          tenantId,
          action: AuditAction.AI_AUTO_REPLY_ESCALATED,
          createdAt: { gte: fromDate, lte: toDate }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          tenantId,
          action: AuditAction.AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL,
          createdAt: { gte: fromDate, lte: toDate }
        }
      }),
      this.countLowQaScores(tenantId, fromDate, toDate),
      this.prisma.aiQaScore.count({
        where: {
          tenantId,
          createdAt: { gte: fromDate, lte: toDate }
        }
      })
    ]);

    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { aiGuardrailNoticeAt: true, enableAiAutoReply: true }
    });

    return {
      policyBlocks,
      escalations,
      guardrailEvents,
      lowQaScores,
      qaSampleCount,
      aiAutoReplyEnabled: settings?.enableAiAutoReply ?? false,
      guardrailNoticeAt: settings?.aiGuardrailNoticeAt?.toISOString() ?? null,
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10)
    };
  }

  async exportComplianceCsv(tenantId: string, query: QaComplianceQueryDto): Promise<string> {
    const { fromDate, toDate } = this.parseDateRange(query.from, query.to);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: {
          in: [
            AuditAction.AI_POLICY_BLOCKED,
            AuditAction.AI_AUTO_REPLY_ESCALATED,
            AuditAction.AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL
          ]
        },
        createdAt: { gte: fromDate, lte: toDate }
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
      select: {
        createdAt: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true
      }
    });

    const header = "date,action,target_type,target_id,metadata\n";
    const rows = logs.map((log) => {
      const metadata = JSON.stringify(log.metadata ?? {}).replace(/"/g, '""');
      return [
        log.createdAt.toISOString(),
        log.action,
        log.targetType ?? "",
        log.targetId ?? "",
        `"${metadata}"`
      ].join(",");
    });

    return header + rows.join("\n");
  }

  private async countLowQaScores(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<number> {
    const scores = await this.prisma.aiQaScore.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate }
      },
      select: {
        relevanceScore: true,
        toneScore: true,
        hallucinationScore: true
      }
    });

    return scores.filter((score) => {
      const overall =
        (score.relevanceScore + score.toneScore + score.hallucinationScore) / 3;
      return overall < 3;
    }).length;
  }

  private toListItem(score: {
    id: string;
    conversationId: string;
    messageId: string;
    relevanceScore: number;
    toneScore: number;
    hallucinationScore: number;
    reviewNote: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    conversation: { id: string; displayName: string | null; nickname: string | null };
  }): QaScoreListItem {
    const overallScore =
      (score.relevanceScore + score.toneScore + score.hallucinationScore) / 3;

    return {
      id: score.id,
      conversationId: score.conversationId,
      messageId: score.messageId,
      relevanceScore: score.relevanceScore,
      toneScore: score.toneScore,
      hallucinationScore: score.hallucinationScore,
      overallScore: Math.round(overallScore * 100) / 100,
      reviewNote: score.reviewNote,
      reviewedAt: score.reviewedAt?.toISOString() ?? null,
      createdAt: score.createdAt.toISOString(),
      conversation: {
        id: score.conversation.id,
        customerDisplayName: conversationLabel(score.conversation)
      }
    };
  }

  private parseDateRange(fromStr?: string, toStr?: string): DateRange {
    let toDate: Date;
    let fromDate: Date;

    if (toStr) {
      toDate = new Date(`${toStr}T23:59:59.999Z`);
    } else {
      toDate = new Date();
      toDate.setUTCHours(23, 59, 59, 999);
    }

    if (fromStr) {
      fromDate = new Date(`${fromStr}T00:00:00.000Z`);
    } else {
      fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromDate.setUTCHours(0, 0, 0, 0);
    }

    if (fromDate > toDate) {
      throw new BadRequestException("from must be before to");
    }

    return { fromDate, toDate };
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { AuditAction, MessageDirection } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiGuardrailService } from "./ai-guardrail.service";
import { AiQaScorerService } from "./ai-qa-scorer.service";

const QA_SAMPLE_RATE = 0.1;
const QA_ALERT_THRESHOLD = 3;

const QA_SAMPLE_ACTIONS: AuditAction[] = [
  AuditAction.AI_AUTO_REPLY_SENT,
  AuditAction.AUTOMATION_AI_REPLY_SENT,
  AuditAction.AI_SUGGEST_SENT
];

@Injectable()
export class AiQaService {
  private readonly logger = new Logger(AiQaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qaScorer: AiQaScorerService,
    private readonly guardrailService: AiGuardrailService
  ) {}

  async runDailySampling(): Promise<void> {
    const { fromDate, toDate } = this.getPreviousUtcDayRange();

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        action: { in: QA_SAMPLE_ACTIONS },
        createdAt: { gte: fromDate, lt: toDate }
      },
      select: {
        id: true,
        tenantId: true,
        targetId: true,
        metadata: true
      }
    });

    if (auditLogs.length === 0) {
      return;
    }

    const sampleSize = Math.max(1, Math.ceil(auditLogs.length * QA_SAMPLE_RATE));
    const sample = this.shuffle(auditLogs).slice(0, sampleSize);

    const tenantScores = new Map<string, number[]>();

    for (const log of sample) {
      const conversationId = log.targetId;
      if (!conversationId) {
        continue;
      }

      const outboundMessage = await this.prisma.message.findFirst({
        where: {
          tenantId: log.tenantId,
          conversationId,
          direction: MessageDirection.OUTBOUND,
          deletedAt: null,
          createdAt: { gte: fromDate, lt: toDate }
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, text: true, createdAt: true }
      });

      if (!outboundMessage?.text) {
        continue;
      }

      const inboundMessage = await this.prisma.message.findFirst({
        where: {
          tenantId: log.tenantId,
          conversationId,
          direction: MessageDirection.INBOUND,
          deletedAt: null,
          createdAt: { lt: outboundMessage.createdAt }
        },
        orderBy: { createdAt: "desc" },
        select: { text: true }
      });

      const contextMessages = await this.prisma.message.findMany({
        where: {
          tenantId: log.tenantId,
          conversationId,
          deletedAt: null,
          createdAt: { lt: outboundMessage.createdAt }
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { direction: true, text: true }
      });

      const conversationContext = [...contextMessages]
        .reverse()
        .map((message) => {
          const role = message.direction === MessageDirection.INBOUND ? "Customer" : "Agent";
          return `${role}: ${message.text ?? ""}`;
        })
        .join("\n");

      const scores = await this.qaScorer.scoreReply({
        customerMessage: inboundMessage?.text ?? "",
        aiReply: outboundMessage.text,
        conversationContext
      });

      if (!scores) {
        continue;
      }

      await this.prisma.aiQaScore.create({
        data: {
          tenantId: log.tenantId,
          conversationId,
          messageId: outboundMessage.id,
          relevanceScore: scores.relevanceScore,
          toneScore: scores.toneScore,
          hallucinationScore: scores.hallucinationScore
        }
      });

      const avg =
        (scores.relevanceScore + scores.toneScore + scores.hallucinationScore) / 3;
      const existing = tenantScores.get(log.tenantId) ?? [];
      existing.push(avg);
      tenantScores.set(log.tenantId, existing);
    }

    for (const [tenantId, averages] of tenantScores.entries()) {
      const tenantAvg = averages.reduce((sum, value) => sum + value, 0) / averages.length;
      if (tenantAvg < QA_ALERT_THRESHOLD) {
        this.logger.warn(
          `AI QA daily average below threshold for tenant ${tenantId}: ${tenantAvg.toFixed(2)}`
        );
      }
    }

    await this.guardrailService.evaluateTenantsAfterSampling(toDate);
  }

  async getTenantQaSummary(
    tenantId: string,
    from?: string,
    to?: string
  ): Promise<{
    sampleCount: number;
    avgRelevance: number | null;
    avgTone: number | null;
    avgHallucination: number | null;
    avgOverall: number | null;
  }> {
    const { fromDate, toDate } = this.parseDateRange(from, to);

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

    if (scores.length === 0) {
      return {
        sampleCount: 0,
        avgRelevance: null,
        avgTone: null,
        avgHallucination: null,
        avgOverall: null
      };
    }

    const avgRelevance = this.average(scores.map((score) => score.relevanceScore));
    const avgTone = this.average(scores.map((score) => score.toneScore));
    const avgHallucination = this.average(scores.map((score) => score.hallucinationScore));

    return {
      sampleCount: scores.length,
      avgRelevance,
      avgTone,
      avgHallucination,
      avgOverall: this.average([avgRelevance, avgTone, avgHallucination])
    };
  }

  async getPlatformQaSummary(
    from?: string,
    to?: string
  ): Promise<{
    sampleCount: number;
    avgRelevance: number | null;
    avgTone: number | null;
    avgHallucination: number | null;
    avgOverall: number | null;
    tenantsBelowThreshold: number;
  }> {
    const { fromDate, toDate } = this.parseDateRange(from, to);

    const scores = await this.prisma.aiQaScore.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate }
      },
      select: {
        tenantId: true,
        relevanceScore: true,
        toneScore: true,
        hallucinationScore: true
      }
    });

    if (scores.length === 0) {
      return {
        sampleCount: 0,
        avgRelevance: null,
        avgTone: null,
        avgHallucination: null,
        avgOverall: null,
        tenantsBelowThreshold: 0
      };
    }

    const avgRelevance = this.average(scores.map((score) => score.relevanceScore));
    const avgTone = this.average(scores.map((score) => score.toneScore));
    const avgHallucination = this.average(scores.map((score) => score.hallucinationScore));

    const tenantAverages = new Map<string, number[]>();
    for (const score of scores) {
      const overall =
        (score.relevanceScore + score.toneScore + score.hallucinationScore) / 3;
      const list = tenantAverages.get(score.tenantId) ?? [];
      list.push(overall);
      tenantAverages.set(score.tenantId, list);
    }

    let tenantsBelowThreshold = 0;
    for (const averages of tenantAverages.values()) {
      const tenantAvg = this.average(averages);
      if (tenantAvg < QA_ALERT_THRESHOLD) {
        tenantsBelowThreshold += 1;
      }
    }

    return {
      sampleCount: scores.length,
      avgRelevance,
      avgTone,
      avgHallucination,
      avgOverall: this.average([avgRelevance, avgTone, avgHallucination]),
      tenantsBelowThreshold
    };
  }

  private getPreviousUtcDayRange(): { fromDate: Date; toDate: Date } {
    const toDate = new Date();
    toDate.setUTCHours(0, 0, 0, 0);

    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - 1);

    return { fromDate, toDate };
  }

  private parseDateRange(fromStr?: string, toStr?: string): { fromDate: Date; toDate: Date } {
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

    return { fromDate, toDate };
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }
}

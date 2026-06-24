import { Injectable, Logger } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const GUARDRAIL_THRESHOLD = 3;
const CONSECUTIVE_DAYS_REQUIRED = 3;
const ROLLING_WINDOW_DAYS = 3;

export type DailyRollingAverage = {
  dayEnd: Date;
  rollingAverage: number | null;
  sampleCount: number;
};

@Injectable()
export class AiGuardrailService {
  private readonly logger = new Logger(AiGuardrailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluateTenantsAfterSampling(asOfDate = new Date()): Promise<number> {
    const tenantIds = await this.prisma.aiQaScore.findMany({
      distinct: ["tenantId"],
      select: { tenantId: true }
    });

    let disabledCount = 0;

    for (const { tenantId } of tenantIds) {
      const shouldDisable = await this.shouldDisableAutoReply(tenantId, asOfDate);
      if (!shouldDisable) {
        continue;
      }

      const settings = await this.prisma.tenantSettings.findUnique({
        where: { tenantId },
        select: { enableAiAutoReply: true }
      });

      if (!settings?.enableAiAutoReply) {
        continue;
      }

      await this.prisma.tenantSettings.update({
        where: { tenantId },
        data: {
          enableAiAutoReply: false,
          aiGuardrailNoticeAt: asOfDate
        }
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: AuditAction.AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL,
          targetType: "TenantSettings",
          targetId: tenantId,
          metadata: {
            threshold: GUARDRAIL_THRESHOLD,
            consecutiveDays: CONSECUTIVE_DAYS_REQUIRED,
            rollingWindowDays: ROLLING_WINDOW_DAYS
          }
        }
      });

      disabledCount += 1;
      this.logger.warn(`AI auto-reply disabled by guardrail for tenant ${tenantId}`);
    }

    return disabledCount;
  }

  async shouldDisableAutoReply(tenantId: string, asOfDate = new Date()): Promise<boolean> {
    const rollingAverages = await this.getRecentRollingAverages(
      tenantId,
      asOfDate,
      CONSECUTIVE_DAYS_REQUIRED
    );

    if (rollingAverages.length < CONSECUTIVE_DAYS_REQUIRED) {
      return false;
    }

    return rollingAverages.every(
      (entry) =>
        entry.rollingAverage !== null &&
        entry.sampleCount > 0 &&
        entry.rollingAverage < GUARDRAIL_THRESHOLD
    );
  }

  async getRecentRollingAverages(
    tenantId: string,
    asOfDate: Date,
    dayCount: number
  ): Promise<DailyRollingAverage[]> {
    const results: DailyRollingAverage[] = [];

    for (let offset = 1; offset <= dayCount; offset += 1) {
      const dayEnd = this.startOfUtcDay(asOfDate);
      dayEnd.setUTCDate(dayEnd.getUTCDate() - offset + 1);

      const windowStart = new Date(dayEnd);
      windowStart.setUTCDate(windowStart.getUTCDate() - (ROLLING_WINDOW_DAYS - 1));

      const scores = await this.prisma.aiQaScore.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: windowStart,
            lt: dayEnd
          }
        },
        select: {
          relevanceScore: true,
          toneScore: true,
          hallucinationScore: true
        }
      });

      if (scores.length === 0) {
        results.push({
          dayEnd,
          rollingAverage: null,
          sampleCount: 0
        });
        continue;
      }

      const overallScores = scores.map(
        (score) => (score.relevanceScore + score.toneScore + score.hallucinationScore) / 3
      );
      const rollingAverage =
        overallScores.reduce((sum, value) => sum + value, 0) / overallScores.length;

      results.push({
        dayEnd,
        rollingAverage,
        sampleCount: scores.length
      });
    }

    return results.reverse();
  }

  private startOfUtcDay(date: Date): Date {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
  }
}

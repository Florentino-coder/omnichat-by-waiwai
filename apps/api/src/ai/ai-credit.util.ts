import { Logger } from "@nestjs/common";
import {
  AI_SUGGEST_USAGE_METRIC,
  getCurrentMonthUsagePeriod
} from "../inbox/thai-speech.util";
import { PrismaService } from "../prisma/prisma.service";

const logger = new Logger("AiCreditUtil");

export type AiCreditReservation = {
  /** Keeps the reserved credit. Without this call the credit is returned when `run` ends. */
  consume(): void;
};

/**
 * Background AI flows run concurrently per inbound message, so a separate
 * check and charge lets several messages spend the same last credit. The credit
 * is taken atomically before the LLM call and returned unless `run` consumes it.
 */
export async function runWithAiCredit<T>(
  prisma: PrismaService,
  tenantId: string,
  planId: string,
  run: (credit: AiCreditReservation) => Promise<T>,
  onUnavailable: () => Promise<T>
): Promise<T> {
  const limits = await prisma.planLimit.findUnique({ where: { planId } });
  if (!limits || limits.maxAiCreditsPerMonth <= 0) {
    return onUnavailable();
  }

  const { periodStart, periodEnd } = getCurrentMonthUsagePeriod();
  const counterWhere = { tenantId, metric: AI_SUGGEST_USAGE_METRIC, periodStart };

  await prisma.usageCounter.upsert({
    where: { tenantId_metric_periodStart: counterWhere },
    create: { ...counterWhere, periodEnd, value: 0 },
    update: {}
  });

  const reserved = await prisma.usageCounter.updateMany({
    where: { ...counterWhere, value: { lt: limits.maxAiCreditsPerMonth } },
    data: { value: { increment: 1 } }
  });
  if (reserved.count !== 1) {
    return onUnavailable();
  }

  let consumed = false;
  try {
    return await run({
      consume: () => {
        consumed = true;
      }
    });
  } finally {
    if (!consumed) {
      await prisma.usageCounter
        .updateMany({
          where: { ...counterWhere, value: { gt: 0 } },
          data: { value: { decrement: 1 } }
        })
        .catch((error: unknown) => {
          logger.error(
            `Failed to return AI credit for tenant ${tenantId}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        });
    }
  }
}

import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { AiAgentGender, AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RealtimeService } from "../realtime/realtime.service";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";
import { getCurrentMonthUsagePeriod, AI_SUGGEST_USAGE_METRIC } from "../inbox/thai-speech.util";

@Injectable()
export class AiHybridDraftService implements OnModuleDestroy {
  private readonly logger = new Logger(AiHybridDraftService.name);
  private activeTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly aiReplyGenerator: AiReplyGeneratorService,
    private readonly realtimeService: RealtimeService
  ) {}

  onModuleDestroy() {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }

  async tryHybridDraft(
    tenantId: string,
    conversationId: string,
    _inboundMessageId: string,
    _messageText: string
  ): Promise<void> {
    // 1. Trailing Debounce (last-message-wins)
    const existingTimer = this.activeTimers.get(conversationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.activeTimers.delete(conversationId);
      try {
        await this.generateBackgroundSuggestion(
          tenantId,
          conversationId
        );
      } catch (err) {
        this.logger.error(
          `Failed to generate background suggestion for conversation ${conversationId}`,
          err instanceof Error ? err.stack : err
        );
      }
    }, 10000); // 10s quiet period

    this.activeTimers.set(conversationId, timer);
  }

  private async generateBackgroundSuggestion(
    tenantId: string,
    conversationId: string
  ): Promise<void> {
    // 1. Fetch tenant settings and verify toggle
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (settings?.enableAiSuggest === false || settings?.enableHybridAutoDraft === false) {
      return;
    }

    // 2. Verify AI credit availability (reusing plan limits validation)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true }
    });
    if (!tenant) return;

    const creditAvailable = await this.hasAiCreditAvailable(tenantId, tenant.planId);
    if (!creditAvailable) return;

    // 3. Shared suggestion rate limit (10/min conv, 60/min tenant)
    const conversationLimitKey = `ai-suggest-limit:conversation:${conversationId}`;
    const tenantLimitKey = `ai-suggest-limit:tenant:${tenantId}`;

    const [convCount, tenantCount] = await Promise.all([
      this.redisService.client.incr(conversationLimitKey),
      this.redisService.client.incr(tenantLimitKey)
    ]);

    if (convCount === 1) {
      await this.redisService.client.expire(conversationLimitKey, 60);
    }
    if (tenantCount === 1) {
      await this.redisService.client.expire(tenantLimitKey, 60);
    }

    if (convCount > 10 || tenantCount > 60) {
      return; // Rate limited, skip auto-draft silently
    }

    const aiAgentGender = settings?.aiAgentGender ?? AiAgentGender.FEMALE;
    const provider = (settings?.aiProvider || process.env.LLM_PROVIDER || "gemini").toLowerCase();

    // 4. Generate suggestion in the background
    const generateResult = await this.aiReplyGenerator.generate({
      tenantId,
      conversationId,
      userId: "system",
      actionType: "generate",
      aiAgentGender,
      provider,
      applyScenarioActions: true, // Allow tags/routing for human review
      extraInstructions: settings?.aiAutoReplyInstructions || undefined
    });

    // 5. Check outcome
    if (generateResult.outcome === "llm_failed") {
      return; // LLM failed, skip saving row or charging credits
    }

    // If successful (success or knowledge_only)
    let suggestionText: string | null = null;
    let compiledPrompt: string | null = null;
    let latencyMs = 0;

    if (generateResult.outcome === "success") {
      suggestionText = generateResult.suggestionText;
      compiledPrompt = generateResult.compiledPrompt;
      latencyMs = generateResult.latencyMs;
    }

    const knowledgeCitations = generateResult.knowledgeCitations || [];
    const providerUsed = generateResult.provider || provider;

    // Update old suggestions for this conversation to superseded
    await this.prisma.aiSuggestion.updateMany({
      where: {
        conversationId,
        tenantId,
        status: "shown"
      },
      data: {
        status: "superseded"
      }
    });

    // Save the new suggestion row
    const suggestion = await this.prisma.aiSuggestion.create({
      data: {
        tenantId,
        conversationId,
        actionType: "generate",
        promptUsed: compiledPrompt,
        suggestionText,
        status: "shown",
        provider: providerUsed,
        latencyMs,
        citations: knowledgeCitations as any
      }
    });

    // Only charge credit if it successfully generated LLM suggestionText
    if (generateResult.outcome === "success") {
      await this.incrementAiCreditUsage(tenantId);
    }

    // Log the programmatic suggest audit trail
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: null,
        action: AuditAction.AI_SUGGEST_GENERATED,
        targetType: "AiSuggestion",
        targetId: suggestion.id,
        metadata: {
          conversationId,
          actionType: "generate",
          provider: providerUsed,
          aiAgentGender,
          latencyMs,
          programmatic: true,
          outcome: generateResult.outcome,
          triggeredBy: "system"
        }
      }
    });

    // Emit Server-Sent Realtime Event
    await this.realtimeService.publishTenantEvent(tenantId, "ai-suggestion.created", {
      conversationId,
      suggestionId: suggestion.id
    });
  }

  private async hasAiCreditAvailable(tenantId: string, planId: string): Promise<boolean> {
    const limits = await this.prisma.planLimit.findUnique({
      where: { planId }
    });

    if (!limits || limits.maxAiCreditsPerMonth <= 0) {
      return false;
    }

    const { periodStart } = getCurrentMonthUsagePeriod();
    const counter = await this.prisma.usageCounter.findUnique({
      where: {
        tenantId_metric_periodStart: {
          tenantId,
          metric: AI_SUGGEST_USAGE_METRIC,
          periodStart
        }
      }
    });

    const currentUsage = Number(counter?.value ?? 0n);
    return currentUsage < limits.maxAiCreditsPerMonth;
  }

  private async incrementAiCreditUsage(tenantId: string): Promise<void> {
    const { periodStart, periodEnd } = getCurrentMonthUsagePeriod();

    await this.prisma.usageCounter.upsert({
      where: {
        tenantId_metric_periodStart: {
          tenantId,
          metric: AI_SUGGEST_USAGE_METRIC,
          periodStart
        }
      },
      create: {
        tenantId,
        metric: AI_SUGGEST_USAGE_METRIC,
        periodStart,
        periodEnd,
        value: 1
      },
      update: {
        value: { increment: 1 },
        periodEnd
      }
    });
  }
}

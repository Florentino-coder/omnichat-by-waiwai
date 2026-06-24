import { Injectable, Logger } from "@nestjs/common";
import { RealtimeService } from "../realtime/realtime.service";
import {
  AiAgentGender,
  AiAutoReplyMode,
  AuditAction,
  ConversationPriority,
  MessageDirection,
  MessageType
} from "@prisma/client";
import { LineReplyService } from "../line/line-reply.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import {
  AI_AUTO_REPLY_CONV_RATE_LIMIT,
  AI_AUTO_REPLY_CONV_RATE_TTL_SECONDS,
  AI_AUTO_REPLY_DEBOUNCE_MS,
  AI_AUTO_REPLY_TENANT_RATE_LIMIT,
  AI_AUTO_REPLY_TENANT_RATE_TTL_SECONDS,
  AI_ESCALATED_TAG_COLOR,
  AI_ESCALATED_TAG_NAME,
  AiAutoReplySkipReason,
  getMatchedEscalationKeywords,
  DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_END,
  DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_START,
  getEscalationKeywordsForMatching,
  getTenantLocalHour,
  matchesEscalationKeyword,
  passesAutoReplyModeGuard,
  sanitizeAutoReplyText
} from "./ai-auto-reply.constants";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";
import { AiPolicyService } from "./ai-policy.service";
import {
  AI_SUGGEST_USAGE_METRIC,
  getCurrentMonthUsagePeriod
} from "../inbox/thai-speech.util";

export type AiAutoReplyInput = {
  tenantId: string;
  conversationId: string;
  inboundMessageId: string;
  messageText: string;
};

@Injectable()
export class AiAutoReplyService {
  private readonly logger = new Logger(AiAutoReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly aiReplyGenerator: AiReplyGeneratorService,
    private readonly aiPolicyService: AiPolicyService,
    private readonly lineReplyService: LineReplyService,
    private readonly realtimeService: RealtimeService
  ) {}

  async tryAutoReply(
    input: AiAutoReplyInput
  ): Promise<{ outcome: "sent" | "skipped" | "failed"; reason?: string }> {
    const trimmedText = input.messageText.trim();
    if (!trimmedText) {
      await this.logSkipped(input, "non_text");
      return { outcome: "skipped", reason: "non_text" };
    }

    const [settings, conversation, tenant] = await Promise.all([
      this.prisma.tenantSettings.findUnique({
        where: { tenantId: input.tenantId },
        select: {
          enableAiAutoReply: true,
          aiAutoReplyMode: true,
          aiAutoReplyBusinessHourStart: true,
          aiAutoReplyBusinessHourEnd: true,
          aiAutoReplyInstructions: true,
          aiEscalationKeywords: true,
          aiPolicyBlockedTopics: true,
          enableAiSuggest: true,
          aiProvider: true,
          aiAgentGender: true,
          timezone: true,
          aiAutoReplyConfidenceThreshold: true
        }
      }),
      this.prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        select: {
          id: true,
          assignedToMemberId: true
        }
      }),
      this.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { planId: true }
      })
    ]);

    if (!conversation || !tenant) {
      return { outcome: "skipped", reason: "not_found" };
    }

    if (!settings?.enableAiAutoReply || settings.aiAutoReplyMode === AiAutoReplyMode.OFF) {
      await this.logSkipped(input, "disabled");
      return { outcome: "skipped", reason: "disabled" };
    }

    const currentHour = getTenantLocalHour(settings?.timezone ?? "Asia/Bangkok");
    const modeAllowed = passesAutoReplyModeGuard({
      mode: settings.aiAutoReplyMode,
      assignedToMemberId: conversation.assignedToMemberId,
      currentHour,
      businessHourStart:
        settings.aiAutoReplyBusinessHourStart ?? DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_START,
      businessHourEnd:
        settings.aiAutoReplyBusinessHourEnd ?? DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_END
    });

    if (!modeAllowed) {
      await this.logSkipped(input, "mode_blocked", {
        mode: settings.aiAutoReplyMode,
        currentHour,
        assignedToMemberId: conversation.assignedToMemberId
      });
      return { outcome: "skipped", reason: "mode_blocked" };
    }

    const escalationKeywords = getEscalationKeywordsForMatching(settings.aiEscalationKeywords);
    if (matchesEscalationKeyword(trimmedText, escalationKeywords)) {
      const matchedKeywords = getMatchedEscalationKeywords(trimmedText, escalationKeywords);
      await this.escalateConversationForHumanReview({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        inboundMessageId: input.inboundMessageId,
        matchedKeywords,
        reason: "keyword",
        messageText: trimmedText
      });
      return { outcome: "skipped", reason: "escalated" };
    }

    if (await this.isDebounced(input.conversationId, input.tenantId)) {
      await this.logSkipped(input, "debounce");
      return { outcome: "skipped", reason: "debounce" };
    }

    const creditAvailable = await this.hasAiCreditAvailable(input.tenantId, tenant.planId);
    if (!creditAvailable) {
      await this.logSkipped(input, "no_credits");
      return { outcome: "skipped", reason: "no_credits" };
    }

    if (await this.isRateLimited(input.tenantId, input.conversationId)) {
      await this.logSkipped(input, "rate_limited");
      return { outcome: "skipped", reason: "rate_limited" };
    }

    const aiAgentGender = settings.aiAgentGender ?? AiAgentGender.FEMALE;
    const provider = (settings.aiProvider || process.env.LLM_PROVIDER || "gemini").toLowerCase();

    const generateResult = await this.aiReplyGenerator.generate({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      userId: "system",
      actionType: "generate",
      aiAgentGender,
      provider,
      applyScenarioActions: false,
      extraInstructions: settings.aiAutoReplyInstructions,
      includeConfidence: true
    });

    if (generateResult.outcome === "knowledge_only") {
      await this.escalateConversationForHumanReview({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        inboundMessageId: input.inboundMessageId,
        matchedKeywords: [],
        reason: "knowledge_only",
        suggestion: {
          suggestionText: null,
          compiledPrompt: null,
          provider: generateResult.provider,
          latencyMs: 0,
          citations: generateResult.knowledgeCitations,
          confidence: null
        }
      });
      return { outcome: "skipped", reason: "low_confidence" };
    }

    if (generateResult.outcome === "llm_failed") {
      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          action: AuditAction.AI_AUTO_REPLY_FAILED,
          targetType: "Conversation",
          targetId: input.conversationId,
          metadata: {
            inboundMessageId: input.inboundMessageId,
            provider: generateResult.provider,
            errorCode: generateResult.errorCode
          }
        }
      });
      return { outcome: "failed", reason: "llm_failed" };
    }

    const replyText = sanitizeAutoReplyText(generateResult.suggestionText);
    if (!replyText) {
      await this.logSkipped(input, "provider_unavailable", { reason: "empty_reply" });
      return { outcome: "skipped", reason: "provider_unavailable" };
    }

    const confidence = generateResult.confidence ?? 0.0;
    const threshold = settings.aiAutoReplyConfidenceThreshold ?? 0.80;

    if (confidence < threshold) {
      await this.escalateConversationForHumanReview({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        inboundMessageId: input.inboundMessageId,
        matchedKeywords: [],
        reason: "low_confidence",
        suggestion: {
          suggestionText: replyText,
          compiledPrompt: generateResult.compiledPrompt,
          provider: generateResult.provider,
          latencyMs: generateResult.latencyMs,
          citations: generateResult.knowledgeCitations,
          confidence
        }
      });
      await this.incrementAiCreditUsage(input.tenantId);
      return { outcome: "skipped", reason: "low_confidence" };
    }

    const policyCheck = this.aiPolicyService.checkReply(
      replyText,
      settings.aiPolicyBlockedTopics
    );
    if (!policyCheck.allowed) {
      await this.escalateConversationForHumanReview({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        inboundMessageId: input.inboundMessageId,
        matchedKeywords: policyCheck.matchedTopics,
        reason: "policy_blocked",
        suggestion: {
          suggestionText: replyText,
          compiledPrompt: generateResult.compiledPrompt,
          provider: generateResult.provider,
          latencyMs: generateResult.latencyMs,
          citations: generateResult.knowledgeCitations,
          confidence
        }
      });
      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          action: AuditAction.AI_POLICY_BLOCKED,
          targetType: "Conversation",
          targetId: input.conversationId,
          metadata: {
            inboundMessageId: input.inboundMessageId,
            matchedTopics: policyCheck.matchedTopics,
            triggeredBy: "system"
          }
        }
      });
      await this.incrementAiCreditUsage(input.tenantId);
      return { outcome: "skipped", reason: "policy_blocked" };
    }

    try {
      await this.lineReplyService.replyText(
        input.tenantId,
        "system",
        input.conversationId,
        { text: replyText }
      );
    } catch (error) {
      this.logger.error(
        "Failed to send AI auto-reply via LINE",
        error instanceof Error ? error.stack : error
      );
      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          action: AuditAction.AI_AUTO_REPLY_FAILED,
          targetType: "Conversation",
          targetId: input.conversationId,
          metadata: {
            inboundMessageId: input.inboundMessageId,
            provider: generateResult.provider,
            error: error instanceof Error ? error.message : "LINE send failed"
          }
        }
      });
      return { outcome: "failed", reason: "send_failed" };
    }

    await this.incrementAiCreditUsage(input.tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        action: AuditAction.AI_AUTO_REPLY_SENT,
        targetType: "Conversation",
        targetId: input.conversationId,
        metadata: {
          inboundMessageId: input.inboundMessageId,
          provider: generateResult.provider,
          latencyMs: generateResult.latencyMs,
          triggeredBy: "system"
        }
      }
    });

    return { outcome: "sent" };
  }

  private async logSkipped(
    input: AiAutoReplyInput,
    reason: AiAutoReplySkipReason,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        action: AuditAction.AI_AUTO_REPLY_SKIPPED,
        targetType: "Conversation",
        targetId: input.conversationId,
        metadata: {
          inboundMessageId: input.inboundMessageId,
          reason,
          ...details
        }
      }
    });
  }

  private async escalateConversationForHumanReview(params: {
    tenantId: string;
    conversationId: string;
    inboundMessageId: string;
    matchedKeywords: string[];
    reason: "keyword" | "low_confidence" | "knowledge_only" | "policy_blocked";
    messageText?: string;
    suggestion?: {
      suggestionText: string | null;
      compiledPrompt: string | null;
      provider: string;
      latencyMs: number;
      citations: any[];
      confidence: number | null;
    };
  }): Promise<void> {
    await this.addTagByName(params.tenantId, params.conversationId, AI_ESCALATED_TAG_NAME);
    await this.markInboundMessageEscalated(
      params.tenantId,
      params.inboundMessageId,
      params.matchedKeywords,
      params.reason,
      params.suggestion?.suggestionText ?? undefined
    );

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: params.conversationId,
        tenantId: params.tenantId,
        deletedAt: null
      },
      select: { priority: true, assignedToMemberId: true, status: true }
    });

    if (conversation) {
      const updates: any = {};
      if (conversation.priority !== ConversationPriority.HIGH) {
        updates.priority = ConversationPriority.HIGH;
      }
      if (conversation.assignedToMemberId === null && conversation.status !== "OPEN") {
        updates.status = "OPEN";
      }
      if (Object.keys(updates).length > 0) {
        await this.prisma.conversation.update({
          where: { id: params.conversationId },
          data: updates
        });
      }
    }

    let dbSuggestionId: string | undefined;
    if (params.suggestion) {
      await this.prisma.aiSuggestion.updateMany({
        where: {
          conversationId: params.conversationId,
          tenantId: params.tenantId,
          status: "shown"
        },
        data: {
          status: "superseded"
        }
      });

      const newSuggest = await this.prisma.aiSuggestion.create({
        data: {
          tenantId: params.tenantId,
          conversationId: params.conversationId,
          actionType: "generate",
          promptUsed: params.suggestion.compiledPrompt,
          suggestionText: params.suggestion.suggestionText,
          status: "shown",
          provider: params.suggestion.provider,
          latencyMs: params.suggestion.latencyMs,
          citations: params.suggestion.citations as any,
          confidence: params.suggestion.confidence,
          isProgrammatic: true
        }
      });
      dbSuggestionId = newSuggest.id;
    }

    if (params.reason === "keyword") {
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          action: AuditAction.AI_AUTO_REPLY_ESCALATED,
          targetType: "Conversation",
          targetId: params.conversationId,
          metadata: {
            inboundMessageId: params.inboundMessageId,
            messageText: params.messageText,
            matchedKeywords: params.matchedKeywords
          }
        }
      });
    } else {
      if (dbSuggestionId) {
        await this.prisma.auditLog.create({
          data: {
            tenantId: params.tenantId,
            userId: null,
            action: AuditAction.AI_SUGGEST_GENERATED,
            targetType: "AiSuggestion",
            targetId: dbSuggestionId,
            metadata: {
              conversationId: params.conversationId,
              actionType: "generate",
              provider: params.suggestion?.provider,
              latencyMs: params.suggestion?.latencyMs,
              programmatic: true,
              outcome: params.reason,
              triggeredBy: "system"
            }
          }
        });
      }

      await this.logSkipped(
        {
          tenantId: params.tenantId,
          conversationId: params.conversationId,
          inboundMessageId: params.inboundMessageId,
          messageText: ""
        },
        params.reason === "policy_blocked" ? "policy_blocked" : "low_confidence",
        {
          mode: params.reason,
          confidence: params.suggestion?.confidence,
          suggestionId: dbSuggestionId,
          matchedTopics: params.matchedKeywords
        }
      );
    }

    if (dbSuggestionId) {
      await this.realtimeService.publishTenantEvent(params.tenantId, "ai-suggestion.created", {
        conversationId: params.conversationId,
        suggestionId: dbSuggestionId
      });
    }
  }

  private async addTagByName(
    tenantId: string,
    conversationId: string,
    tagName: string
  ): Promise<void> {
    let tag = await this.prisma.conversationTag.findFirst({
      where: { tenantId, name: tagName, deletedAt: null }
    });

    if (!tag) {
      tag = await this.prisma.conversationTag.create({
        data: {
          tenantId,
          name: tagName,
          ...(tagName === AI_ESCALATED_TAG_NAME ? { color: AI_ESCALATED_TAG_COLOR } : {})
        }
      });
    }

    const existingLink = await this.prisma.conversationTagLink.findFirst({
      where: { tenantId, conversationId, tagId: tag.id }
    });

    if (existingLink?.deletedAt === null) {
      return;
    }

    if (existingLink) {
      await this.prisma.conversationTagLink.update({
        where: { id: existingLink.id },
        data: { deletedAt: null }
      });
      return;
    }

    await this.prisma.conversationTagLink.create({
      data: { tenantId, conversationId, tagId: tag.id }
    });
  }

  private async markInboundMessageEscalated(
    tenantId: string,
    inboundMessageId: string,
    matchedKeywords: string[],
    reason?: string,
    aiDraftText?: string
  ): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: { id: inboundMessageId, tenantId, deletedAt: null },
      select: { id: true, rawPayload: true }
    });

    if (!message) {
      return;
    }

    const existing =
      message.rawPayload &&
      typeof message.rawPayload === "object" &&
      !Array.isArray(message.rawPayload)
        ? (message.rawPayload as Record<string, unknown>)
        : {};
    const existingMeta =
      existing.omnichatMeta &&
      typeof existing.omnichatMeta === "object" &&
      !Array.isArray(existing.omnichatMeta)
        ? (existing.omnichatMeta as Record<string, unknown>)
        : {};

    await this.prisma.message.update({
      where: { id: message.id },
      data: {
        rawPayload: {
          ...existing,
          omnichatMeta: {
            ...existingMeta,
            escalation: true,
            matchedKeywords,
            escalationReason: reason || "keyword",
            ...(aiDraftText ? { aiDraftText } : {})
          }
        }
      }
    });
  }

  private async isDebounced(conversationId: string, tenantId: string): Promise<boolean> {
    const recentOutbound = await this.prisma.message.findFirst({
      where: {
        tenantId,
        conversationId,
        direction: MessageDirection.OUTBOUND,
        deletedAt: null,
        type: MessageType.TEXT
      },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true }
    });

    if (!recentOutbound?.sentAt) {
      return false;
    }

    return Date.now() - recentOutbound.sentAt.getTime() < AI_AUTO_REPLY_DEBOUNCE_MS;
  }

  private async isRateLimited(tenantId: string, conversationId: string): Promise<boolean> {
    const conversationKey = `ai-auto-reply:conv:${conversationId}`;
    const tenantKey = `ai-auto-reply:tenant:${tenantId}`;

    const [convCount, tenantCount] = await Promise.all([
      this.redisService.client.incr(conversationKey),
      this.redisService.client.incr(tenantKey)
    ]);

    if (convCount === 1) {
      await this.redisService.client.expire(conversationKey, AI_AUTO_REPLY_CONV_RATE_TTL_SECONDS);
    }
    if (tenantCount === 1) {
      await this.redisService.client.expire(tenantKey, AI_AUTO_REPLY_TENANT_RATE_TTL_SECONDS);
    }

    return (
      convCount > AI_AUTO_REPLY_CONV_RATE_LIMIT ||
      tenantCount > AI_AUTO_REPLY_TENANT_RATE_LIMIT
    );
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

import { Injectable, Logger } from "@nestjs/common";
import {
  AiAgentGender,
  AuditAction,
  MessageDirection,
  MessageType
} from "@prisma/client";
import { LineReplyService } from "../line/line-reply.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AI_SUGGEST_USAGE_METRIC,
  getCurrentMonthUsagePeriod
} from "../inbox/thai-speech.util";
import {
  AI_AUTO_REPLY_DEBOUNCE_MS,
  AI_ESCALATED_TAG_COLOR,
  AI_ESCALATED_TAG_NAME,
  sanitizeAutoReplyText
} from "./ai-auto-reply.constants";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";
import { AiPolicyService } from "./ai-policy.service";

@Injectable()
export class AiAutomationReplyService {
  private readonly logger = new Logger(AiAutomationReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiReplyGenerator: AiReplyGeneratorService,
    private readonly aiPolicyService: AiPolicyService,
    private readonly lineReplyService: LineReplyService
  ) {}

  async execute(tenantId: string, conversationId: string): Promise<void> {
    const [settings, tenant] = await Promise.all([
      this.prisma.tenantSettings.findUnique({ where: { tenantId } }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { planId: true }
      })
    ]);

    if (!settings || !tenant) {
      return;
    }

    if (await this.isDebounced(conversationId, tenantId)) {
      return;
    }

    if (!(await this.hasAiCreditAvailable(tenantId, tenant.planId))) {
      return;
    }

    const provider = (settings.aiProvider || process.env.LLM_PROVIDER || "gemini").toLowerCase();
    const aiAgentGender = settings.aiAgentGender ?? AiAgentGender.FEMALE;

    const generateResult = await this.aiReplyGenerator.generate({
      tenantId,
      conversationId,
      userId: "automation",
      actionType: "generate",
      aiAgentGender,
      provider,
      applyScenarioActions: false,
      extraInstructions: settings.aiAutoReplyInstructions,
      includeConfidence: true
    });

    if (generateResult.outcome !== "success") {
      return;
    }

    const replyText = sanitizeAutoReplyText(generateResult.suggestionText);
    if (!replyText) {
      return;
    }

    const confidence = generateResult.confidence ?? 0;
    const threshold = settings.aiAutoReplyConfidenceThreshold ?? 0.8;
    if (confidence < threshold) {
      return;
    }

    const policyCheck = this.aiPolicyService.checkReply(
      replyText,
      settings.aiPolicyBlockedTopics
    );
    if (!policyCheck.allowed) {
      await this.addTagByName(tenantId, conversationId, AI_ESCALATED_TAG_NAME);
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: AuditAction.AI_POLICY_BLOCKED,
          targetType: "Conversation",
          targetId: conversationId,
          metadata: {
            matchedTopics: policyCheck.matchedTopics,
            triggeredBy: "automation"
          }
        }
      });
      return;
    }

    try {
      await this.lineReplyService.replyText(tenantId, "automation", conversationId, {
        text: replyText
      });
    } catch (error) {
      this.logger.error(
        "Automation AI reply LINE send failed",
        error instanceof Error ? error.stack : error
      );
      return;
    }

    await this.incrementAiCreditUsage(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: AuditAction.AUTOMATION_AI_REPLY_SENT,
        targetType: "Conversation",
        targetId: conversationId,
        metadata: {
          provider: generateResult.provider,
          latencyMs: generateResult.latencyMs,
          confidence,
          triggeredBy: "automation"
        }
      }
    });
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

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import {
  AuditAction,
  AutomationRule,
  AutomationRunStatus,
  AutomationTriggerType,
  Role
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto
} from "./dto/automation-rule.dto";
import { parseAutomationSteps } from "./automation-step.parser";
import { AutomationDispatchContext } from "./automation-step.types";
import {
  getBangkokHour,
  pickMatchingAutomationRules
} from "./automation-match.util";
import { AutomationQueueService } from "./automation-queue.service";
import { AutomationEngineService } from "./automation-engine.service";

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly automationQueueService: AutomationQueueService,
    private readonly automationEngineService: AutomationEngineService
  ) {}

  listRules(tenantId: string, lineChannelId?: string): Promise<AutomationRule[]> {
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

    return this.prisma.automationRule.findMany({
      where,
      orderBy: [{ priority: "asc" }, { name: "asc" }]
    });
  }

  async findOne(tenantId: string, id: string): Promise<AutomationRule> {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, tenantId, deletedAt: null }
    });

    if (!rule) {
      throw new NotFoundException("Automation rule not found");
    }

    return rule;
  }

  async createRule(
    tenantId: string,
    userId: string,
    dto: CreateAutomationRuleDto
  ): Promise<AutomationRule> {
    await this.assertLineChannelBelongsToTenant(tenantId, dto.lineChannelId);
    this.assertTriggerConfig(dto.triggerType, dto);
    const steps = parseAutomationSteps(dto.steps);

    const rule = await this.prisma.automationRule.create({
      data: {
        tenantId,
        lineChannelId: dto.lineChannelId ?? null,
        name: dto.name.trim(),
        priority: dto.priority ?? 100,
        isEnabled: dto.isEnabled ?? true,
        triggerType: dto.triggerType,
        triggerKeywords: this.normalizeStringList(dto.triggerKeywords),
        triggerTagNames: this.normalizeStringList(dto.triggerTagNames),
        triggerStatus: dto.triggerStatus?.trim() || null,
        offHourStart: dto.offHourStart ?? null,
        offHourEnd: dto.offHourEnd ?? null,
        steps
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AUTOMATION_RULE_CREATED,
        targetType: "AutomationRule",
        targetId: rule.id,
        metadata: { name: rule.name, triggerType: rule.triggerType }
      }
    });

    return rule;
  }

  async updateRule(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateAutomationRuleDto,
    role: Role
  ): Promise<AutomationRule> {
    if (role !== Role.OWNER && role !== Role.ADMIN) {
      throw new ForbiddenException("Only owners and admins can update automation rules");
    }

    const existing = await this.findOne(tenantId, id);

    if (dto.lineChannelId !== undefined) {
      await this.assertLineChannelBelongsToTenant(tenantId, dto.lineChannelId ?? undefined);
    }

    const triggerType = dto.triggerType ?? existing.triggerType;
    this.assertTriggerConfig(triggerType, {
      triggerType,
      triggerKeywords: dto.triggerKeywords ?? existing.triggerKeywords,
      triggerTagNames: dto.triggerTagNames ?? existing.triggerTagNames,
      triggerStatus: dto.triggerStatus ?? existing.triggerStatus ?? undefined,
      offHourStart: dto.offHourStart ?? existing.offHourStart ?? undefined,
      offHourEnd: dto.offHourEnd ?? existing.offHourEnd ?? undefined,
      steps: dto.steps ?? existing.steps
    });

    const steps = dto.steps ? parseAutomationSteps(dto.steps) : undefined;

    const rule = await this.prisma.automationRule.update({
      where: { id: existing.id },
      data: {
        ...(dto.lineChannelId !== undefined
          ? { lineChannelId: dto.lineChannelId }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.triggerType !== undefined ? { triggerType: dto.triggerType } : {}),
        ...(dto.triggerKeywords !== undefined
          ? { triggerKeywords: this.normalizeStringList(dto.triggerKeywords) }
          : {}),
        ...(dto.triggerTagNames !== undefined
          ? { triggerTagNames: this.normalizeStringList(dto.triggerTagNames) }
          : {}),
        ...(dto.triggerStatus !== undefined
          ? { triggerStatus: dto.triggerStatus?.trim() || null }
          : {}),
        ...(dto.offHourStart !== undefined ? { offHourStart: dto.offHourStart } : {}),
        ...(dto.offHourEnd !== undefined ? { offHourEnd: dto.offHourEnd } : {}),
        ...(steps !== undefined ? { steps } : {})
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AUTOMATION_RULE_UPDATED,
        targetType: "AutomationRule",
        targetId: rule.id,
        metadata: { name: rule.name }
      }
    });

    return rule;
  }

  async deleteRule(
    tenantId: string,
    userId: string,
    id: string,
    role: Role
  ): Promise<AutomationRule> {
    if (role !== Role.OWNER && role !== Role.ADMIN) {
      throw new ForbiddenException("Only owners and admins can delete automation rules");
    }

    const existing = await this.findOne(tenantId, id);

    const rule = await this.prisma.automationRule.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isEnabled: false }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AUTOMATION_RULE_DELETED,
        targetType: "AutomationRule",
        targetId: rule.id,
        metadata: { name: rule.name }
      }
    });

    return rule;
  }

  async dispatchEvent(
    tenantId: string,
    conversationId: string,
    triggerType: AutomationTriggerType,
    context: Omit<AutomationDispatchContext, "currentHour">
  ): Promise<void> {
    if (context.skipAutomation) {
      return;
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, deletedAt: null }
    });

    if (!conversation) {
      return;
    }

    const tagNames =
      context.tagNames ??
      (await this.loadConversationTagNames(tenantId, conversationId));

    const dispatchContext: AutomationDispatchContext = {
      ...context,
      tagNames,
      lineChannelId: context.lineChannelId ?? conversation.lineChannelId,
      currentHour: getBangkokHour()
    };

    const rules = await this.listEnabledRules(tenantId, conversation.lineChannelId);
    const matching = pickMatchingAutomationRules(
      rules.filter((rule) => rule.triggerType === triggerType),
      dispatchContext
    );

    for (const rule of matching) {
      if (context.skipRuleIds?.includes(rule.id)) {
        continue;
      }
      await this.startRun(tenantId, conversationId, rule.id).catch((error: unknown) => {
        this.logger.error(
          `Failed to start automation run for rule ${rule.id}`,
          error instanceof Error ? error.stack : error
        );
      });
    }
  }

  async startRun(
    tenantId: string,
    conversationId: string,
    ruleId: string
  ): Promise<void> {
    const rule = await this.findOne(tenantId, ruleId);
    if (!rule.isEnabled) {
      return;
    }

    parseAutomationSteps(rule.steps);

    const run = await this.prisma.automationRun.create({
      data: {
        tenantId,
        ruleId: rule.id,
        conversationId,
        status: AutomationRunStatus.PENDING,
        currentStepIndex: 0
      }
    });

    await this.automationQueueService.enqueueStep({
      runId: run.id,
      tenantId,
      conversationId,
      ruleId: rule.id,
      stepIndex: 0
    });
  }

  async resumeWaitingRuns(
    tenantId: string,
    conversationId: string,
    _inboundMessageId?: string
  ): Promise<string[]> {
    const runs = await this.prisma.automationRun.findMany({
      where: {
        tenantId,
        conversationId,
        status: AutomationRunStatus.WAITING_FOR_REPLY,
        rule: {
          isEnabled: true,
          deletedAt: null
        }
      },
      include: {
        rule: true
      },
      orderBy: [{ rule: { priority: "asc" } }, { createdAt: "asc" }]
    });

    if (runs.length === 0) {
      return [];
    }

    const run = runs[0];
    await this.automationEngineService.processRunStep(run.id, run.currentStepIndex);
    return [run.ruleId];
  }

  private async listEnabledRules(
    tenantId: string,
    lineChannelId: string
  ): Promise<AutomationRule[]> {
    const rules = await this.listRules(tenantId, lineChannelId);
    return rules.filter((rule) => rule.isEnabled);
  }

  private async loadConversationTagNames(
    tenantId: string,
    conversationId: string
  ): Promise<string[]> {
    const links = await this.prisma.conversationTagLink.findMany({
      where: { tenantId, conversationId, deletedAt: null },
      include: { tag: true }
    });

    return links
      .filter((link) => link.tag && !link.tag.deletedAt)
      .map((link) => link.tag.name);
  }

  private normalizeStringList(values?: string[]): string[] {
    if (!values) {
      return [];
    }

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push(trimmed);
    }

    return normalized;
  }

  private assertTriggerConfig(
    triggerType: AutomationTriggerType,
    dto: {
      triggerType: AutomationTriggerType;
      triggerKeywords?: string[];
      triggerTagNames?: string[];
      triggerStatus?: string;
      offHourStart?: number;
      offHourEnd?: number;
      steps: unknown;
    }
  ): void {
    parseAutomationSteps(dto.steps);

    if (triggerType === AutomationTriggerType.OFF_HOURS) {
      if (dto.offHourStart === undefined || dto.offHourEnd === undefined) {
        throw new BadRequestException(
          "OFF_HOURS rules require offHourStart and offHourEnd (business hours)"
        );
      }
    }

    if (triggerType === AutomationTriggerType.STATUS_CHANGED && !dto.triggerStatus?.trim()) {
      throw new BadRequestException("STATUS_CHANGED rules require triggerStatus");
    }
  }

  private async assertLineChannelBelongsToTenant(
    tenantId: string,
    lineChannelId?: string
  ): Promise<void> {
    if (!lineChannelId) {
      return;
    }

    const channel = await this.prisma.lineChannel.findFirst({
      where: { id: lineChannelId, tenantId, deletedAt: null }
    });

    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }
  }
}

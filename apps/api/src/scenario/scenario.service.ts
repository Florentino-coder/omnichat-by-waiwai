import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AiScenario,
  AuditAction,
  ConversationPriority,
  Role
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAiScenarioDto } from "./dto/create-ai-scenario.dto";
import { UpdateAiScenarioDto } from "./dto/update-ai-scenario.dto";
import {
  formatScenarioInstructions,
  getBangkokHour,
  pickBestMatchingScenario,
  ScenarioMatchContext
} from "./scenario-match.util";

export type ScenarioMatchResult = {
  scenario: AiScenario | null;
  instructions: string;
};

export type ApplyScenarioActionsInput = {
  tenantId: string;
  conversationId: string;
  scenario: AiScenario;
  userId?: string;
  source: "inbound_message" | "ai_suggest";
};

@Injectable()
export class ScenarioService {
  constructor(private readonly prisma: PrismaService) {}

  listScenarios(tenantId: string, lineChannelId?: string): Promise<AiScenario[]> {
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

    return this.prisma.aiScenario.findMany({
      where,
      orderBy: [{ priority: "asc" }, { name: "asc" }]
    });
  }

  async findOne(tenantId: string, id: string): Promise<AiScenario> {
    const scenario = await this.prisma.aiScenario.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!scenario) {
      throw new NotFoundException("AI scenario not found");
    }

    return scenario;
  }

  async createScenario(
    tenantId: string,
    userId: string,
    dto: CreateAiScenarioDto
  ): Promise<AiScenario> {
    await this.assertLineChannelBelongsToTenant(tenantId, dto.lineChannelId);
    this.assertHasTrigger(
      this.normalizeStringList(dto.triggerKeywords),
      this.normalizeStringList(dto.triggerTagNames)
    );
    await this.assertAssignMemberBelongsToTenant(tenantId, dto.actionAssignMemberId);

    const scenario = await this.prisma.aiScenario.create({
      data: {
        tenantId,
        lineChannelId: dto.lineChannelId ?? null,
        name: dto.name.trim(),
        priority: dto.priority ?? 100,
        isEnabled: dto.isEnabled ?? true,
        triggerKeywords: this.normalizeStringList(dto.triggerKeywords),
        triggerTagNames: this.normalizeStringList(dto.triggerTagNames),
        activeHourStart: dto.activeHourStart ?? null,
        activeHourEnd: dto.activeHourEnd ?? null,
        instructions: dto.instructions.trim(),
        actionAddTagName: dto.actionAddTagName?.trim() || null,
        actionAssignMemberId: dto.actionAssignMemberId ?? null,
        actionSetPriority: dto.actionSetPriority ?? null,
        actionEscalate: dto.actionEscalate ?? false
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AI_SCENARIO_CREATED,
        targetType: "AiScenario",
        targetId: scenario.id,
        metadata: {
          name: scenario.name,
          priority: scenario.priority
        }
      }
    });

    return scenario;
  }

  async updateScenario(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateAiScenarioDto,
    actorRole: Role
  ): Promise<AiScenario> {
    if (actorRole === Role.AGENT) {
      throw new ForbiddenException("Agents cannot update AI scenarios");
    }

    const existing = await this.findOne(tenantId, id);

    if (dto.lineChannelId !== undefined) {
      await this.assertLineChannelBelongsToTenant(tenantId, dto.lineChannelId ?? undefined);
    }

    const nextKeywords =
      dto.triggerKeywords !== undefined
        ? this.normalizeStringList(dto.triggerKeywords)
        : existing.triggerKeywords;
    const nextTagNames =
      dto.triggerTagNames !== undefined
        ? this.normalizeStringList(dto.triggerTagNames)
        : existing.triggerTagNames;

    this.assertHasTrigger(nextKeywords, nextTagNames);

    if (dto.actionAssignMemberId !== undefined) {
      await this.assertAssignMemberBelongsToTenant(tenantId, dto.actionAssignMemberId ?? undefined);
    }

    const scenario = await this.prisma.aiScenario.update({
      where: { id: existing.id },
      data: {
        lineChannelId:
          dto.lineChannelId !== undefined ? dto.lineChannelId : undefined,
        name: dto.name?.trim(),
        priority: dto.priority,
        isEnabled: dto.isEnabled,
        triggerKeywords: dto.triggerKeywords !== undefined ? nextKeywords : undefined,
        triggerTagNames: dto.triggerTagNames !== undefined ? nextTagNames : undefined,
        activeHourStart:
          dto.activeHourStart !== undefined ? dto.activeHourStart : undefined,
        activeHourEnd: dto.activeHourEnd !== undefined ? dto.activeHourEnd : undefined,
        instructions: dto.instructions?.trim(),
        actionAddTagName:
          dto.actionAddTagName !== undefined
            ? dto.actionAddTagName?.trim() || null
            : undefined,
        actionAssignMemberId:
          dto.actionAssignMemberId !== undefined ? dto.actionAssignMemberId : undefined,
        actionSetPriority:
          dto.actionSetPriority !== undefined ? dto.actionSetPriority : undefined,
        actionEscalate: dto.actionEscalate
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AI_SCENARIO_UPDATED,
        targetType: "AiScenario",
        targetId: scenario.id,
        metadata: {
          name: scenario.name
        }
      }
    });

    return scenario;
  }

  async deleteScenario(
    tenantId: string,
    userId: string,
    id: string,
    actorRole: Role
  ): Promise<AiScenario> {
    if (actorRole !== Role.OWNER && actorRole !== Role.ADMIN) {
      throw new ForbiddenException("Only owners and admins can delete AI scenarios");
    }

    const scenario = await this.findOne(tenantId, id);
    const deleted = await this.prisma.aiScenario.update({
      where: { id: scenario.id },
      data: { deletedAt: new Date() }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AI_SCENARIO_DELETED,
        targetType: "AiScenario",
        targetId: scenario.id,
        metadata: {
          name: scenario.name
        }
      }
    });

    return deleted;
  }

  async matchScenarioForContext(
    tenantId: string,
    context: ScenarioMatchContext
  ): Promise<ScenarioMatchResult> {
    const scenarios = await this.listEnabledScenarios(tenantId, context.lineChannelId);
    const scenario = pickBestMatchingScenario(scenarios, context);

    return {
      scenario,
      instructions: formatScenarioInstructions(scenario)
    };
  }

  async buildScenarioInstructions(
    tenantId: string,
    messageText: string,
    tagNames: string[],
    lineChannelId?: string
  ): Promise<ScenarioMatchResult> {
    return this.matchScenarioForContext(tenantId, {
      messageText,
      tagNames,
      lineChannelId,
      currentHour: getBangkokHour()
    });
  }

  async processInboundMessage(
    tenantId: string,
    conversationId: string,
    messageText: string,
    lineChannelId: string
  ): Promise<ScenarioMatchResult> {
    const tagNames = await this.loadConversationTagNames(tenantId, conversationId);
    const match = await this.matchScenarioForContext(tenantId, {
      messageText,
      tagNames,
      lineChannelId,
      currentHour: getBangkokHour()
    });

    if (!match.scenario) {
      return match;
    }

    await this.applyScenarioActions({
      tenantId,
      conversationId,
      scenario: match.scenario,
      source: "inbound_message"
    });

    return match;
  }

  async applyScenarioActions(input: ApplyScenarioActionsInput): Promise<void> {
    const { tenantId, conversationId, scenario, userId, source } = input;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        deletedAt: null
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const appliedActions: string[] = [];

    if (scenario.actionAddTagName?.trim()) {
      await this.addTagToConversationByName(
        tenantId,
        conversationId,
        scenario.actionAddTagName.trim(),
        userId
      );
      appliedActions.push(`add_tag:${scenario.actionAddTagName.trim()}`);
    }

    if (scenario.actionAssignMemberId) {
      await this.assignConversationMember(
        tenantId,
        conversationId,
        scenario.actionAssignMemberId,
        userId
      );
      appliedActions.push(`assign:${scenario.actionAssignMemberId}`);
    }

    const priority = this.resolvePriority(scenario);
    if (priority) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { priority }
      });
      appliedActions.push(`priority:${priority}`);
    }

    if (appliedActions.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId ?? null,
          action: AuditAction.AI_SCENARIO_MATCHED,
          targetType: "Conversation",
          targetId: conversation.id,
          metadata: {
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            source,
            appliedActions
          }
        }
      });
    }
  }

  private async listEnabledScenarios(
    tenantId: string,
    lineChannelId?: string
  ): Promise<AiScenario[]> {
    const scenarios = await this.listScenarios(tenantId, lineChannelId);
    return scenarios.filter((scenario) => scenario.isEnabled);
  }

  private resolvePriority(scenario: AiScenario): ConversationPriority | null {
    if (scenario.actionSetPriority) {
      return scenario.actionSetPriority;
    }

    if (scenario.actionEscalate) {
      return ConversationPriority.HIGH;
    }

    return null;
  }

  private async loadConversationTagNames(
    tenantId: string,
    conversationId: string
  ): Promise<string[]> {
    const links = await this.prisma.conversationTagLink.findMany({
      where: {
        tenantId,
        conversationId,
        deletedAt: null
      },
      include: {
        tag: true
      }
    });

    return links
      .filter((link) => link.tag && !link.tag.deletedAt)
      .map((link) => link.tag.name);
  }

  private async addTagToConversationByName(
    tenantId: string,
    conversationId: string,
    tagName: string,
    userId?: string
  ): Promise<void> {
    let tag = await this.prisma.conversationTag.findFirst({
      where: {
        tenantId,
        name: tagName,
        deletedAt: null
      }
    });

    if (!tag) {
      tag = await this.prisma.conversationTag.create({
        data: {
          tenantId,
          name: tagName
        }
      });
    }

    const existingLink = await this.prisma.conversationTagLink.findFirst({
      where: {
        tenantId,
        conversationId,
        tagId: tag.id
      }
    });

    if (existingLink?.deletedAt === null) {
      return;
    }

    if (existingLink) {
      await this.prisma.conversationTagLink.update({
        where: { id: existingLink.id },
        data: { deletedAt: null }
      });
    } else {
      await this.prisma.conversationTagLink.create({
        data: {
          tenantId,
          conversationId,
          tagId: tag.id
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId ?? null,
        action: AuditAction.CONVERSATION_TAG_ADDED,
        targetType: "Conversation",
        targetId: conversationId,
        metadata: {
          tagId: tag.id,
          tagName: tag.name,
          source: "ai_scenario"
        }
      }
    });
  }

  private async assignConversationMember(
    tenantId: string,
    conversationId: string,
    memberId: string,
    userId?: string
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        id: memberId,
        tenantId,
        isActive: true
      }
    });

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        deletedAt: null
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.assignedToMemberId === memberId) {
      return;
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedToMemberId: memberId }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: userId ?? null,
        action: AuditAction.CONVERSATION_ASSIGNED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          assignedToMemberId: memberId,
          source: "ai_scenario"
        }
      }
    });
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

  private assertHasTrigger(keywords: string[], tagNames: string[]): void {
    if (keywords.length === 0 && tagNames.length === 0) {
      throw new BadRequestException(
        "At least one trigger keyword or tag name is required"
      );
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
      where: {
        id: lineChannelId,
        tenantId,
        deletedAt: null
      }
    });

    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }
  }

  private async assertAssignMemberBelongsToTenant(
    tenantId: string,
    memberId?: string
  ): Promise<void> {
    if (!memberId) {
      return;
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        id: memberId,
        tenantId,
        isActive: true
      }
    });

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }
  }
}

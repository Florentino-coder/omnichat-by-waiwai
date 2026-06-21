import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef
} from "@nestjs/common";
import {
  AuditAction,
  AutomationRunStatus,
  ConversationPriority
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LineReplyService } from "../line/line-reply.service";
import { parseAutomationSteps } from "./automation-step.parser";
import { AutomationStep, shouldWaitForCustomerReply } from "./automation-step.types";
import { AutomationQueueService } from "./automation-queue.service";
import { buildAutomationAuditLog } from "./automation-audit.util";

@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineReplyService: LineReplyService,
    @Inject(forwardRef(() => AutomationQueueService))
    private readonly automationQueueService: AutomationQueueService
  ) {}

  async processRunStep(runId: string, stepIndex: number): Promise<void> {
    const run = await this.prisma.automationRun.findFirst({
      where: { id: runId },
      include: {
        rule: true,
        conversation: true
      }
    });

    if (!run || run.rule.deletedAt) {
      return;
    }

    if (run.status === AutomationRunStatus.COMPLETED || run.status === AutomationRunStatus.FAILED) {
      return;
    }

    const steps = parseAutomationSteps(run.rule.steps);
    if (stepIndex >= steps.length) {
      await this.markRunCompleted(run.id, run.tenantId, run.conversationId, run.ruleId);
      return;
    }

    await this.prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: AutomationRunStatus.RUNNING,
        currentStepIndex: stepIndex,
        startedAt: run.startedAt ?? new Date()
      }
    });

    if (stepIndex === 0) {
      await this.prisma.auditLog.create({
        data: buildAutomationAuditLog(
          run.tenantId,
          AuditAction.AUTOMATION_RUN_STARTED,
          { targetType: "AutomationRun", targetId: run.id },
          {
            ruleId: run.ruleId,
            ruleName: run.rule.name,
            conversationId: run.conversationId
          }
        )
      });
    }

    const step = steps[stepIndex];

    try {
      if (step.type === "WAIT") {
        await this.prisma.automationRun.update({
          where: { id: run.id },
          data: { status: AutomationRunStatus.WAITING }
        });

        await this.automationQueueService.enqueueStep(
          {
            runId: run.id,
            tenantId: run.tenantId,
            conversationId: run.conversationId,
            ruleId: run.ruleId,
            stepIndex: stepIndex + 1
          },
          process.env.NODE_ENV === "test" ? 0 : step.delaySeconds * 1000
        );
        return;
      }

      await this.executeStep(run.tenantId, run.conversationId, step);

      await this.prisma.auditLog.create({
        data: buildAutomationAuditLog(
          run.tenantId,
          AuditAction.AUTOMATION_STEP_EXECUTED,
          { targetType: "AutomationRun", targetId: run.id },
          {
            ruleId: run.ruleId,
            stepIndex,
            stepType: step.type
          }
        )
      });

      const nextIndex = stepIndex + 1;
      if (nextIndex >= steps.length) {
        await this.markRunCompleted(run.id, run.tenantId, run.conversationId, run.ruleId);
        return;
      }

      const nextStep = steps[nextIndex];
      if (shouldWaitForCustomerReply(nextStep, nextIndex)) {
        await this.pauseForCustomerReply(run.id, nextIndex);
        return;
      }

      await this.automationQueueService.enqueueStep({
        runId: run.id,
        tenantId: run.tenantId,
        conversationId: run.conversationId,
        ruleId: run.ruleId,
        stepIndex: nextIndex
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Automation run ${run.id} failed at step ${stepIndex}: ${message}`);

      await this.prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: AutomationRunStatus.FAILED,
          errorMessage: message,
          completedAt: new Date()
        }
      });

      await this.prisma.auditLog.create({
        data: buildAutomationAuditLog(
          run.tenantId,
          AuditAction.AUTOMATION_RUN_FAILED,
          { targetType: "AutomationRun", targetId: run.id },
          {
            ruleId: run.ruleId,
            stepIndex,
            error: message
          }
        )
      });
    }
  }

  private async pauseForCustomerReply(runId: string, nextStepIndex: number): Promise<void> {
    await this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: AutomationRunStatus.WAITING_FOR_REPLY,
        currentStepIndex: nextStepIndex
      }
    });
  }

  private async markRunCompleted(
    runId: string,
    tenantId: string,
    conversationId: string,
    ruleId: string
  ): Promise<void> {
    await this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: AutomationRunStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: buildAutomationAuditLog(
        tenantId,
        AuditAction.AUTOMATION_RUN_COMPLETED,
        { targetType: "AutomationRun", targetId: runId },
        {
          ruleId,
          conversationId
        }
      )
    });
  }

  private async executeStep(
    tenantId: string,
    conversationId: string,
    step: AutomationStep
  ): Promise<void> {
    switch (step.type) {
      case "ADD_TAG":
        await this.addTagByName(tenantId, conversationId, step.tagName);
        return;
      case "ASSIGN_AGENT":
        await this.assignMember(tenantId, conversationId, step.memberId);
        return;
      case "SET_PRIORITY":
        await this.setPriority(tenantId, conversationId, step.priority);
        return;
      case "SEND_TEXT_REPLY":
        await this.lineReplyService.replyText(tenantId, "automation", conversationId, {
          text: step.text
        });
        return;
      case "SEND_IMAGE_REPLY":
        await this.lineReplyService.replyText(tenantId, "automation", conversationId, {
          imageUrl: step.imageUrl
        });
        return;
      case "SEND_SAVED_REPLY":
        await this.sendSavedReply(tenantId, conversationId, step.savedReplyId);
        return;
      case "CLOSE_CONVERSATION":
        await this.closeConversation(tenantId, conversationId);
        return;
      case "ESCALATE":
        await this.setPriority(tenantId, conversationId, ConversationPriority.HIGH);
        return;
      default:
        return;
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
        data: { tenantId, name: tagName }
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
    } else {
      await this.prisma.conversationTagLink.create({
        data: { tenantId, conversationId, tagId: tag.id }
      });
    }

    await this.prisma.auditLog.create({
      data: buildAutomationAuditLog(
        tenantId,
        AuditAction.CONVERSATION_TAG_ADDED,
        { targetType: "Conversation", targetId: conversationId },
        {
          tagId: tag.id,
          tagName: tag.name,
          source: "automation"
        }
      )
    });
  }

  private async assignMember(
    tenantId: string,
    conversationId: string,
    memberId: string
  ): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, tenantId, isActive: true }
    });

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, deletedAt: null }
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
      data: buildAutomationAuditLog(
        tenantId,
        AuditAction.CONVERSATION_ASSIGNED,
        { targetType: "Conversation", targetId: conversation.id },
        {
          assignedToMemberId: memberId,
          source: "automation"
        }
      )
    });
  }

  private async setPriority(
    tenantId: string,
    conversationId: string,
    priority: ConversationPriority
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, deletedAt: null }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.priority === priority) {
      return;
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { priority }
    });

    await this.prisma.auditLog.create({
      data: buildAutomationAuditLog(
        tenantId,
        AuditAction.CONVERSATION_PRIORITY_CHANGED,
        { targetType: "Conversation", targetId: conversation.id },
        {
          previousPriority: conversation.priority,
          priority,
          source: "automation"
        }
      )
    });
  }

  private async closeConversation(tenantId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, deletedAt: null }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.status === "RESOLVED") {
      return;
    }

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "RESOLVED",
        inProgressStartedAt: null
      }
    });

    await this.prisma.auditLog.create({
      data: buildAutomationAuditLog(
        tenantId,
        AuditAction.CONVERSATION_STATUS_CHANGED,
        { targetType: "Conversation", targetId: conversation.id },
        {
          previousStatus: conversation.status,
          status: "RESOLVED",
          source: "automation"
        }
      )
    });
  }

  private async sendSavedReply(
    tenantId: string,
    conversationId: string,
    savedReplyId: string
  ): Promise<void> {
    const savedReply = await this.prisma.savedReply.findFirst({
      where: {
        id: savedReplyId,
        tenantId,
        deletedAt: null,
        isActive: true
      }
    });

    if (!savedReply) {
      throw new NotFoundException("Saved reply not found");
    }

    await this.lineReplyService.replyText(tenantId, "automation", conversationId, {
      text: savedReply.body,
      imageUrl: savedReply.imageUrl ?? undefined
    });
  }
}

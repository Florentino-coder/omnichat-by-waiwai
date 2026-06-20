import { AuditAction, AutomationTriggerType, Role } from "@prisma/client";
import { AutomationService } from "./automation.service";
import { AutomationQueueService } from "./automation-queue.service";

describe("AutomationService", () => {
  const prisma = {
    automationRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    lineChannel: {
      findFirst: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    conversation: {
      findFirst: jest.fn()
    },
    conversationTagLink: {
      findMany: jest.fn()
    },
    automationRun: {
      create: jest.fn()
    }
  };

  const automationQueueService = {
    enqueueStep: jest.fn()
  };

  const service = new AutomationService(
    prisma as any,
    automationQueueService as unknown as AutomationQueueService
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.lineChannel.findFirst.mockResolvedValue({ id: "channel-1" });
    prisma.auditLog.create.mockResolvedValue({});
    prisma.automationRun.create.mockResolvedValue({ id: "run-1" });
    automationQueueService.enqueueStep.mockResolvedValue(undefined);
  });

  it("creates rule with audit log", async () => {
    prisma.automationRule.create.mockResolvedValue({
      id: "rule-1",
      name: "Off hours",
      triggerType: AutomationTriggerType.OFF_HOURS
    });

    await service.createRule("tenant-1", "user-1", {
      name: "Off hours",
      triggerType: AutomationTriggerType.OFF_HOURS,
      offHourStart: 9,
      offHourEnd: 18,
      steps: [{ type: "SEND_TEXT_REPLY", text: "ปิดแล้วค่ะ" }]
    });

    expect(prisma.automationRule.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AuditAction.AUTOMATION_RULE_CREATED
        })
      })
    );
  });

  it("rejects update from agent role", async () => {
    prisma.automationRule.findFirst.mockResolvedValue({
      id: "rule-1",
      tenantId: "tenant-1",
      deletedAt: null,
      triggerType: AutomationTriggerType.MESSAGE_RECEIVED,
      triggerKeywords: [],
      triggerTagNames: [],
      triggerStatus: null,
      offHourStart: null,
      offHourEnd: null,
      steps: [{ type: "ADD_TAG", tagName: "x" }]
    });

    await expect(
      service.updateRule(
        "tenant-1",
        "user-1",
        "rule-1",
        { name: "Updated" },
        Role.AGENT
      )
    ).rejects.toThrow("Only owners and admins");
  });

  it("starts run and enqueues first step", async () => {
    prisma.automationRule.findFirst.mockResolvedValue({
      id: "rule-1",
      tenantId: "tenant-1",
      deletedAt: null,
      isEnabled: true,
      steps: [{ type: "ADD_TAG", tagName: "auto" }]
    });

    await service.startRun("tenant-1", "conv-1", "rule-1");

    expect(prisma.automationRun.create).toHaveBeenCalled();
    expect(automationQueueService.enqueueStep).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        stepIndex: 0
      })
    );
  });
});

import { AuditAction, AutomationTriggerType, Role } from "@prisma/client";
import { AutomationService } from "./automation.service";
import { AutomationQueueService } from "./automation-queue.service";
import { AutomationEngineService } from "./automation-engine.service";

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
      create: jest.fn(),
      findMany: jest.fn()
    }
  };

  const automationQueueService = {
    enqueueStep: jest.fn()
  };

  const automationEngineService = {
    processRunStep: jest.fn()
  };

  const service = new AutomationService(
    prisma as any,
    automationQueueService as unknown as AutomationQueueService,
    automationEngineService as unknown as AutomationEngineService
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.lineChannel.findFirst.mockResolvedValue({ id: "channel-1" });
    prisma.auditLog.create.mockResolvedValue({});
    prisma.automationRun.create.mockResolvedValue({ id: "run-1" });
    prisma.automationRun.findMany.mockResolvedValue([]);
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

  it("resumes multiple waiting runs", async () => {
    const runs = [
      { id: "run-10", currentStepIndex: 1, ruleId: "rule-10" },
      { id: "run-20", currentStepIndex: 2, ruleId: "rule-20" }
    ];
    prisma.automationRun.findMany.mockResolvedValue(runs);
    automationEngineService.processRunStep.mockResolvedValue(undefined);

    const result = await service.resumeWaitingRuns("tenant-1", "conv-1", "msg-1");

    expect(prisma.automationRun.findMany).toHaveBeenCalled();
    expect(automationEngineService.processRunStep).toHaveBeenCalledTimes(2);
    expect(automationEngineService.processRunStep).toHaveBeenNthCalledWith(1, "run-10", 1);
    expect(automationEngineService.processRunStep).toHaveBeenNthCalledWith(2, "run-20", 2);
    expect(result).toEqual(["rule-10", "rule-20"]);
  });
});

import { AutomationRunStatus } from "@prisma/client";
import { AutomationEngineService } from "./automation-engine.service";
import { AutomationJobData } from "./automation-queue.service";
import { LineReplyService } from "../line/line-reply.service";
import { AutomationQueueService } from "./automation-queue.service";

describe("AutomationEngineService", () => {
  const tenantId = "tenant-1";
  const conversationId = "conv-1";
  const runId = "run-1";
  const ruleId = "rule-1";

  const prisma = {
    automationRun: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    }
  };

  const lineReplyService = {
    replyText: jest.fn()
  };

  const aiAutomationReplyService = {
    execute: jest.fn()
  };

  let engine: AutomationEngineService;
  let inlineQueue: AutomationQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.automationRun.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    lineReplyService.replyText.mockResolvedValue(undefined);

    const processor = {
      processStep: jest.fn(async (data: AutomationJobData) => {
        await engine.processRunStep(data.runId, data.stepIndex);
      })
    };

    inlineQueue = new AutomationQueueService({
      add: async (_name, data, options) => {
        const delayMs = options.delay ?? 0;
        if (delayMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, delayMs);
          });
        }
        await processor.processStep(data);
        return { id: "inline-automation-job" };
      }
    });

    engine = new AutomationEngineService(
      prisma as never,
      lineReplyService as unknown as LineReplyService,
      aiAutomationReplyService as never,
      inlineQueue
    );
  });

  function mockRun(steps: unknown[], status: AutomationRunStatus = AutomationRunStatus.PENDING) {
    prisma.automationRun.findFirst.mockResolvedValue({
      id: runId,
      tenantId,
      conversationId,
      ruleId,
      status,
      startedAt: null,
      rule: {
        id: ruleId,
        deletedAt: null,
        name: "Test rule",
        steps
      },
      conversation: { id: conversationId }
    });
  }

  it("runs consecutive SEND_TEXT_REPLY steps immediately after trigger", async () => {
    mockRun([
      { type: "SEND_TEXT_REPLY", text: "สวัสดีจ้า ต้องทำรายการด้านไหน" },
      { type: "SEND_TEXT_REPLY", text: "แจ้งเบอร์" }
    ]);

    await engine.processRunStep(runId, 0);

    expect(lineReplyService.replyText).toHaveBeenCalledTimes(2);
    expect(lineReplyService.replyText).toHaveBeenNthCalledWith(
      1,
      tenantId,
      "automation",
      conversationId,
      { text: "สวัสดีจ้า ต้องทำรายการด้านไหน" }
    );
    expect(lineReplyService.replyText).toHaveBeenNthCalledWith(
      2,
      tenantId,
      "automation",
      conversationId,
      { text: "แจ้งเบอร์" }
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: runId },
        data: expect.objectContaining({
          status: AutomationRunStatus.COMPLETED
        })
      })
    );
  });

  it("pauses before a customer_reply step and resumes on the next processRunStep call", async () => {
    mockRun(
      [
        { type: "SEND_TEXT_REPLY", text: "สวัสดีจ้า" },
        { type: "SEND_TEXT_REPLY", text: "แจ้งเบอร์", runAfter: "customer_reply" }
      ],
      AutomationRunStatus.PENDING
    );

    await engine.processRunStep(runId, 0);

    expect(lineReplyService.replyText).toHaveBeenCalledTimes(1);
    expect(lineReplyService.replyText).toHaveBeenCalledWith(
      tenantId,
      "automation",
      conversationId,
      { text: "สวัสดีจ้า" }
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: runId },
        data: expect.objectContaining({
          status: AutomationRunStatus.WAITING_FOR_REPLY,
          currentStepIndex: 1
        })
      })
    );

    mockRun(
      [
        { type: "SEND_TEXT_REPLY", text: "สวัสดีจ้า" },
        { type: "SEND_TEXT_REPLY", text: "แจ้งเบอร์", runAfter: "customer_reply" }
      ],
      AutomationRunStatus.WAITING_FOR_REPLY
    );
    prisma.automationRun.findFirst.mockResolvedValue({
      id: runId,
      tenantId,
      conversationId,
      ruleId,
      status: AutomationRunStatus.WAITING_FOR_REPLY,
      currentStepIndex: 1,
      startedAt: new Date(),
      rule: {
        id: ruleId,
        deletedAt: null,
        name: "Test rule",
        steps: [
          { type: "SEND_TEXT_REPLY", text: "สวัสดีจ้า" },
          { type: "SEND_TEXT_REPLY", text: "แจ้งเบอร์", runAfter: "customer_reply" }
        ]
      },
      conversation: { id: conversationId }
    });

    await engine.processRunStep(runId, 1);

    expect(lineReplyService.replyText).toHaveBeenCalledTimes(2);
    expect(lineReplyService.replyText).toHaveBeenLastCalledWith(
      tenantId,
      "automation",
      conversationId,
      { text: "แจ้งเบอร์" }
    );
  });

  it("sends image replies from imageUrl", async () => {
    mockRun([{ type: "SEND_IMAGE_REPLY", imageUrl: "https://cdn.example.com/promo.jpg" }]);

    await engine.processRunStep(runId, 0);

    expect(lineReplyService.replyText).toHaveBeenCalledWith(
      tenantId,
      "automation",
      conversationId,
      { imageUrl: "https://cdn.example.com/promo.jpg" }
    );
  });

  it("executes AI_AUTO_REPLY step via automation reply service", async () => {
    mockRun([{ type: "AI_AUTO_REPLY" }]);
    aiAutomationReplyService.execute.mockResolvedValue(undefined);

    await engine.processRunStep(runId, 0);

    expect(aiAutomationReplyService.execute).toHaveBeenCalledWith(tenantId, conversationId);
  });
});

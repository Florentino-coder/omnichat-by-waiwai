import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { LineReplyService } from "../line/line-reply.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";
import { AiAutomationReplyService } from "./ai-automation-reply.service";
import { AiPolicyService } from "./ai-policy.service";

describe("AiAutomationReplyService", () => {
  let service: AiAutomationReplyService;

  const prisma = {
    tenantSettings: { findUnique: jest.fn() },
    tenant: { findUnique: jest.fn() },
    message: { findFirst: jest.fn() },
    planLimit: { findUnique: jest.fn() },
    usageCounter: { findUnique: jest.fn(), upsert: jest.fn() },
    auditLog: { create: jest.fn() }
  };

  const aiReplyGenerator = {
    generate: jest.fn()
  };

  const lineReplyService = {
    replyText: jest.fn()
  };

  const aiPolicyService = {
    checkReply: jest.fn().mockReturnValue({ allowed: true, matchedTopics: [] })
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma.tenantSettings.findUnique.mockResolvedValue({
      aiProvider: "gemini",
      aiAgentGender: "FEMALE",
      aiAutoReplyInstructions: null,
      aiAutoReplyConfidenceThreshold: 0.8,
      aiPolicyBlockedTopics: []
    });
    prisma.tenant.findUnique.mockResolvedValue({ planId: "pro" });
    prisma.message.findFirst.mockResolvedValue(null);
    prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 100 });
    prisma.usageCounter.findUnique.mockResolvedValue({ value: 0n });
    prisma.usageCounter.upsert.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAutomationReplyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiReplyGeneratorService, useValue: aiReplyGenerator },
        { provide: AiPolicyService, useValue: aiPolicyService },
        { provide: LineReplyService, useValue: lineReplyService }
      ]
    }).compile();

    service = module.get(AiAutomationReplyService);
  });

  it("skips when debounced by recent outbound message", async () => {
    prisma.message.findFirst.mockResolvedValue({
      sentAt: new Date()
    });

    await service.execute("tenant-1", "conv-1");

    expect(aiReplyGenerator.generate).not.toHaveBeenCalled();
  });

  it("sends reply and writes audit when confidence passes threshold", async () => {
    aiReplyGenerator.generate.mockResolvedValue({
      outcome: "success",
      suggestionText: "สวัสดีค่ะ",
      compiledPrompt: "prompt",
      knowledgeCitations: [],
      latencyMs: 120,
      provider: "gemini",
      confidence: 0.9
    });

    await service.execute("tenant-1", "conv-1");

    expect(lineReplyService.replyText).toHaveBeenCalledWith(
      "tenant-1",
      "automation",
      "conv-1",
      { text: "สวัสดีค่ะ" }
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AUTOMATION_AI_REPLY_SENT,
        targetId: "conv-1"
      })
    });
  });

  it("skips send when confidence is below threshold", async () => {
    aiReplyGenerator.generate.mockResolvedValue({
      outcome: "success",
      suggestionText: "สวัสดีค่ะ",
      compiledPrompt: "prompt",
      knowledgeCitations: [],
      latencyMs: 120,
      provider: "gemini",
      confidence: 0.5
    });

    await service.execute("tenant-1", "conv-1");

    expect(lineReplyService.replyText).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

import {
  AiAutoReplyMode,
  AiAgentGender,
  AuditAction,
  ConversationPriority
} from "@prisma/client";
import { LineReplyService } from "../line/line-reply.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { AiAutoReplyService } from "./ai-auto-reply.service";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";

const baseInput = {
  tenantId: "tenant-1",
  conversationId: "conversation-1",
  inboundMessageId: "message-1",
  messageText: "สวัสดีครับ"
};

const defaultSettings = {
  enableAiAutoReply: true,
  aiAutoReplyMode: AiAutoReplyMode.ALWAYS,
  aiAutoReplyBusinessHourStart: 8,
  aiAutoReplyBusinessHourEnd: 23,
  aiAutoReplyInstructions: null,
  aiEscalationKeywords: ["แอดมิน"],
  enableAiSuggest: true,
  aiProvider: "gemini",
  aiAgentGender: AiAgentGender.FEMALE,
  timezone: "Asia/Bangkok"
};

function createMocks() {
  const prisma = {
    tenantSettings: { findUnique: jest.fn() },
    conversation: { findFirst: jest.fn(), update: jest.fn() },
    tenant: { findUnique: jest.fn() },
    message: { findFirst: jest.fn() },
    planLimit: { findUnique: jest.fn() },
    usageCounter: { findUnique: jest.fn(), upsert: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    conversationTag: { findFirst: jest.fn(), create: jest.fn() },
    conversationTagLink: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }
  };

  const redisService = {
    client: {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1)
    }
  };

  const aiReplyGenerator = {
    generate: jest.fn()
  };

  const lineReplyService = {
    replyText: jest.fn().mockResolvedValue(undefined)
  };

  return { prisma, redisService, aiReplyGenerator, lineReplyService };
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new AiAutoReplyService(
    mocks.prisma as unknown as PrismaService,
    mocks.redisService as unknown as RedisService,
    mocks.aiReplyGenerator as unknown as AiReplyGeneratorService,
    mocks.lineReplyService as unknown as LineReplyService
  );
}

function mockHappyPath(mocks: ReturnType<typeof createMocks>) {
  mocks.prisma.tenantSettings.findUnique.mockResolvedValue(defaultSettings);
  mocks.prisma.conversation.findFirst
    .mockResolvedValueOnce({ id: "conversation-1", assignedToMemberId: null })
    .mockResolvedValue({ priority: ConversationPriority.NORMAL });
  mocks.prisma.tenant.findUnique.mockResolvedValue({
    timezone: "Asia/Bangkok",
    planId: "plan-1"
  });
  mocks.prisma.message.findFirst.mockResolvedValue(null);
  mocks.prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 100 });
  mocks.prisma.usageCounter.findUnique.mockResolvedValue({ value: 0n });
  mocks.aiReplyGenerator.generate.mockResolvedValue({
    outcome: "success",
    suggestionText: "สวัสดีค่ะ ยินดีให้บริการค่ะ",
    compiledPrompt: "prompt",
    knowledgeCitations: [],
    latencyMs: 120,
    provider: "gemini"
  });
}

describe("AiAutoReplyService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-22T10:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips non-text inbound messages", async () => {
    const mocks = createMocks();
    const service = createService(mocks);

    await service.tryAutoReply({ ...baseInput, messageText: "   " });

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_AUTO_REPLY_SKIPPED,
        metadata: expect.objectContaining({ reason: "non_text" })
      })
    });
    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();
  });

  it("skips when auto-reply disabled", async () => {
    const mocks = createMocks();
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue({
      ...defaultSettings,
      enableAiAutoReply: false
    });
    mocks.prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      assignedToMemberId: null
    });
    mocks.prisma.tenant.findUnique.mockResolvedValue({ planId: "plan-1" });
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ reason: "disabled" })
      })
    });
  });

  it("skips assigned conversations in WHEN_UNASSIGNED mode", async () => {
    const mocks = createMocks();
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue({
      ...defaultSettings,
      aiAutoReplyMode: AiAutoReplyMode.WHEN_UNASSIGNED
    });
    mocks.prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      assignedToMemberId: "member-1"
    });
    mocks.prisma.tenant.findUnique.mockResolvedValue({ planId: "plan-1" });
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ reason: "mode_blocked" })
      })
    });
  });

  it("skips inside business hours for OFF_HOURS_ONLY mode", async () => {
    const mocks = createMocks();
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue({
      ...defaultSettings,
      aiAutoReplyMode: AiAutoReplyMode.OFF_HOURS_ONLY
    });
    mocks.prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      assignedToMemberId: null
    });
    mocks.prisma.tenant.findUnique.mockResolvedValue({ planId: "plan-1" });
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ reason: "mode_blocked" })
      })
    });
  });

  it("escalates when keyword matches and does not call LLM", async () => {
    const mocks = createMocks();
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue(defaultSettings);
    mocks.prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      assignedToMemberId: null,
      priority: ConversationPriority.NORMAL
    });
    mocks.prisma.tenant.findUnique.mockResolvedValue({ planId: "plan-1" });
    mocks.prisma.conversationTag.findFirst.mockResolvedValue(null);
    mocks.prisma.conversationTag.create.mockResolvedValue({ id: "tag-1", name: "ai-escalated" });
    mocks.prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    const service = createService(mocks);

    await service.tryAutoReply({ ...baseInput, messageText: "ขอคุยกับแอดมินครับ" });

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_AUTO_REPLY_ESCALATED
      })
    });
    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();
    expect(mocks.lineReplyService.replyText).not.toHaveBeenCalled();
  });

  it("skips when recent outbound message debounces auto-reply", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.prisma.message.findFirst.mockResolvedValue({
      sentAt: new Date(Date.now() - 1000)
    });
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ reason: "debounce" })
      })
    });
  });

  it("skips when AI credits exhausted", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 10 });
    mocks.prisma.usageCounter.findUnique.mockResolvedValue({ value: 10n });
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ reason: "no_credits" })
      })
    });
  });

  it("skips when redis rate limit exceeded", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.redisService.client.incr.mockResolvedValueOnce(6).mockResolvedValueOnce(1);
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ reason: "rate_limited" })
      })
    });
  });

  it("sends LINE reply and audits success", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.lineReplyService.replyText).toHaveBeenCalledWith(
      "tenant-1",
      "system",
      "conversation-1",
      { text: "สวัสดีค่ะ ยินดีให้บริการค่ะ" }
    );
    expect(mocks.prisma.usageCounter.upsert).toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_AUTO_REPLY_SENT,
        metadata: expect.objectContaining({ triggeredBy: "system" })
      })
    });
  });

  it("audits provider_unavailable for knowledge-only fallback", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.aiReplyGenerator.generate.mockResolvedValue({
      outcome: "knowledge_only",
      errorCode: "AI_PROVIDER_RATE_LIMITED",
      knowledgeCitations: [{ documentId: "doc-1", title: "FAQ", snippet: "..." }],
      provider: "gemini"
    });
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_AUTO_REPLY_SKIPPED,
        metadata: expect.objectContaining({ reason: "provider_unavailable" })
      })
    });
    expect(mocks.lineReplyService.replyText).not.toHaveBeenCalled();
  });

  it("audits failure when LLM generation fails", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.aiReplyGenerator.generate.mockResolvedValue({
      outcome: "llm_failed",
      errorCode: "AI_GENERATION_FAILED",
      llmError: new Error("boom"),
      provider: "gemini"
    });
    const service = createService(mocks);

    await service.tryAutoReply(baseInput);

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_AUTO_REPLY_FAILED
      })
    });
  });
});

describe("ai-auto-reply constants", () => {
  it("matches escalation keywords case-insensitively", async () => {
    const { matchesEscalationKeyword } = await import("./ai-auto-reply.constants");
    expect(matchesEscalationKeyword("ขอคุยกับแอดมินหน่อย", ["แอดมิน"])).toBe(true);
    expect(matchesEscalationKeyword("hello", ["แอดมิน"])).toBe(false);
  });
});

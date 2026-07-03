import {
  AiAutoReplyMode,
  AiAgentGender,
  AuditAction,
  ConversationPriority
} from "@prisma/client";
import { LineReplyService } from "../line/line-reply.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RealtimeService } from "../realtime/realtime.service";
import { AiAutoReplyService } from "./ai-auto-reply.service";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";
import { AiPolicyService } from "./ai-policy.service";

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
  aiPolicyBlockedTopics: [],
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
    message: { findFirst: jest.fn(), update: jest.fn() },
    planLimit: { findUnique: jest.fn() },
    usageCounter: { findUnique: jest.fn(), upsert: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    conversationTag: { findFirst: jest.fn(), create: jest.fn() },
    conversationTagLink: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    aiSuggestion: { create: jest.fn().mockResolvedValue({ id: "suggest-1" }), updateMany: jest.fn() }
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

  const aiPolicyService = {
    checkReply: jest.fn().mockReturnValue({ allowed: true, matchedTopics: [] })
  };

  const lineReplyService = {
    replyText: jest.fn().mockResolvedValue(undefined)
  };

  const realtimeService = {
    publishTenantEvent: jest.fn().mockResolvedValue(undefined)
  };

  return { prisma, redisService, aiReplyGenerator, aiPolicyService, lineReplyService, realtimeService };
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new AiAutoReplyService(
    mocks.prisma as unknown as PrismaService,
    mocks.redisService as unknown as RedisService,
    mocks.aiReplyGenerator as unknown as AiReplyGeneratorService,
    mocks.aiPolicyService as unknown as AiPolicyService,
    mocks.lineReplyService as unknown as LineReplyService,
    mocks.realtimeService as unknown as RealtimeService
  );
}

function mockHappyPath(mocks: ReturnType<typeof createMocks>) {
  mocks.prisma.tenantSettings.findUnique.mockResolvedValue({
    ...defaultSettings,
    aiAutoReplyConfidenceThreshold: 0.80
  });
  mocks.prisma.conversation.findFirst
    .mockResolvedValueOnce({ id: "conversation-1", assignedToMemberId: null })
    .mockResolvedValue({ priority: ConversationPriority.NORMAL, assignedToMemberId: null, status: "IN_PROGRESS" });
  mocks.prisma.tenant.findUnique.mockResolvedValue({
    timezone: "Asia/Bangkok",
    planId: "plan-1"
  });
  mocks.prisma.message.findFirst.mockResolvedValue(null);
  mocks.prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 100 });
  mocks.prisma.usageCounter.findUnique.mockResolvedValue({ value: 0n });
  mocks.prisma.conversationTag.findFirst.mockResolvedValue({ id: "tag-1", name: "ai-escalated" });
  mocks.prisma.conversationTag.create.mockResolvedValue({ id: "tag-1", name: "ai-escalated" });
  mocks.prisma.conversationTagLink.findFirst.mockResolvedValue(null);
  mocks.aiReplyGenerator.generate.mockResolvedValue({
    outcome: "success",
    suggestionText: "สวัสดีค่ะ ยินดีให้บริการค่ะ",
    compiledPrompt: "prompt",
    knowledgeCitations: [],
    latencyMs: 120,
    provider: "gemini",
    confidence: 0.90
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
    mocks.prisma.message.findFirst.mockResolvedValue({
      id: "message-1",
      rawPayload: { message: { text: "ขอคุยกับแอดมินครับ" } }
    });
    mocks.prisma.message.update.mockResolvedValue({ id: "message-1" });
    const service = createService(mocks);

    await service.tryAutoReply({ ...baseInput, messageText: "ขอคุยกับแอดมินครับ" });

    expect(mocks.prisma.conversationTag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "ai-escalated",
        color: "#F59E0B"
      })
    });
    expect(mocks.prisma.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: {
        rawPayload: expect.objectContaining({
          omnichatMeta: expect.objectContaining({
            escalation: true,
            matchedKeywords: ["แอดมิน"]
          })
        })
      }
    });
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
    mocks.prisma.conversationTag.findFirst.mockResolvedValue(null);
    mocks.prisma.conversationTag.create.mockResolvedValue({ id: "tag-1", name: "ai-escalated" });
    mocks.prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    mocks.prisma.message.findFirst.mockResolvedValue({ id: "message-1", rawPayload: {} });
    
    const service = createService(mocks);

    const result = await service.tryAutoReply(baseInput);

    expect(result).toEqual({ outcome: "skipped", reason: "knowledge_only" });
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_AUTO_REPLY_SKIPPED,
        metadata: expect.objectContaining({ reason: "knowledge_only", mode: "knowledge_only" })
      })
    });
    expect(mocks.lineReplyService.replyText).not.toHaveBeenCalled();
  });

  it("audits failure when LLM generation fails and returns failed", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.aiReplyGenerator.generate.mockResolvedValue({
      outcome: "llm_failed",
      errorCode: "AI_GENERATION_FAILED",
      llmError: new Error("boom"),
      provider: "gemini"
    });
    const service = createService(mocks);

    const result = await service.tryAutoReply(baseInput);

    expect(result).toEqual({ outcome: "failed", reason: "llm_failed" });
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.AI_AUTO_REPLY_FAILED
      })
    });
  });

  it("returns sent on successful reply", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    const service = createService(mocks);

    const result = await service.tryAutoReply(baseInput);

    expect(result).toEqual({ outcome: "sent" });
  });

  it("returns skipped with reasons correctly", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue({
      ...defaultSettings,
      enableAiAutoReply: false
    });
    const service = createService(mocks);

    const result = await service.tryAutoReply(baseInput);

    expect(result).toEqual({ outcome: "skipped", reason: "disabled" });
  });

  it("escalates conversation on low confidence, saves draft, charges 1 credit", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.aiReplyGenerator.generate.mockResolvedValue({
      outcome: "success",
      suggestionText: "สวัสดีค่ะ นี่คือคำตอบความน่าเชื่อถือต่ำ",
      compiledPrompt: "compiled-prompt",
      knowledgeCitations: [{ documentId: "doc-1", title: "Doc Title", snippet: "Doc Snippet" }],
      latencyMs: 150,
      provider: "gemini",
      confidence: 0.50
    });

    mocks.prisma.conversationTag.findFirst.mockResolvedValue(null);
    mocks.prisma.conversationTag.create.mockResolvedValue({ id: "tag-1", name: "ai-escalated" });
    mocks.prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    mocks.prisma.message.findFirst.mockResolvedValue({
      id: "message-1",
      rawPayload: {}
    });

    const service = createService(mocks);
    const result = await service.tryAutoReply(baseInput);

    expect(result).toEqual({ outcome: "skipped", reason: "low_confidence" });

    // Assert priority high, status open (since unassigned) updates
    expect(mocks.prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-1" },
      data: {
        priority: ConversationPriority.HIGH,
        status: "OPEN"
      }
    });

    // Assert suggestion draft created
    expect(mocks.prisma.aiSuggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        suggestionText: "สวัสดีค่ะ นี่คือคำตอบความน่าเชื่อถือต่ำ",
        confidence: 0.50,
        status: "shown"
      })
    });

    // Assert credit is charged for low-confidence text reply
    expect(mocks.prisma.usageCounter.upsert).toHaveBeenCalled();

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: AuditAction.AI_SUGGEST_GENERATED,
        metadata: expect.objectContaining({
          triggeredBy: "system",
          outcome: "low_confidence"
        })
      })
    });

    // Assert SSE emitted
    expect(mocks.realtimeService.publishTenantEvent).toHaveBeenCalledWith(
      "tenant-1",
      "ai-suggestion.created",
      expect.objectContaining({ conversationId: "conversation-1", suggestionId: "suggest-1" })
    );

    // Assert message marked escalated with escalationReason: low_confidence
    expect(mocks.prisma.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: expect.objectContaining({
        rawPayload: expect.objectContaining({
          omnichatMeta: expect.objectContaining({
            escalation: true,
            escalationReason: "low_confidence"
          })
        })
      })
    });
  });

  it("escalates conversation on knowledge_only, saves citations draft, does NOT charge credit", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.aiReplyGenerator.generate.mockResolvedValue({
      outcome: "knowledge_only",
      errorCode: "KNOWLEDGE_ONLY",
      knowledgeCitations: [{ documentId: "doc-1", title: "Doc Title", snippet: "Doc Snippet" }],
      provider: "gemini"
    });

    mocks.prisma.conversationTag.findFirst.mockResolvedValue(null);
    mocks.prisma.conversationTag.create.mockResolvedValue({ id: "tag-1", name: "ai-escalated" });
    mocks.prisma.conversationTagLink.findFirst.mockResolvedValue(null);
    mocks.prisma.message.findFirst.mockResolvedValue({
      id: "message-1",
      rawPayload: {}
    });

    const service = createService(mocks);
    const result = await service.tryAutoReply(baseInput);

    expect(result).toEqual({ outcome: "skipped", reason: "knowledge_only" });

    // Assert suggestion draft created with null text, citations populated, confidence null
    expect(mocks.prisma.aiSuggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        suggestionText: null,
        confidence: null,
        status: "shown",
        citations: expect.any(Array)
      })
    });

    // Assert credit is NOT charged
    expect(mocks.prisma.usageCounter.upsert).not.toHaveBeenCalled();

    // Assert message marked escalated with escalationReason: knowledge_only
    expect(mocks.prisma.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: expect.objectContaining({
        rawPayload: expect.objectContaining({
          omnichatMeta: expect.objectContaining({
            escalation: true,
            escalationReason: "knowledge_only"
          })
        })
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

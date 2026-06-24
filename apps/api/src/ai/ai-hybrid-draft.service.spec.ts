import { AiAgentGender, AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RealtimeService } from "../realtime/realtime.service";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";
import { AiHybridDraftService } from "./ai-hybrid-draft.service";

function createMocks() {
  const prisma = {
    tenantSettings: { findUnique: jest.fn() },
    tenant: { findUnique: jest.fn() },
    planLimit: { findUnique: jest.fn() },
    usageCounter: { findUnique: jest.fn(), upsert: jest.fn() },
    message: { findFirst: jest.fn() },
    aiSuggestion: { updateMany: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
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

  const realtimeService = {
    publishTenantEvent: jest.fn().mockResolvedValue(undefined)
  };

  return { prisma, redisService, aiReplyGenerator, realtimeService };
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new AiHybridDraftService(
    mocks.prisma as unknown as PrismaService,
    mocks.redisService as unknown as RedisService,
    mocks.aiReplyGenerator as unknown as AiReplyGeneratorService,
    mocks.realtimeService as unknown as RealtimeService
  );
}

function mockHappyPath(mocks: ReturnType<typeof createMocks>) {
  mocks.prisma.tenantSettings.findUnique.mockResolvedValue({
    enableAiSuggest: true,
    enableHybridAutoDraft: true,
    aiProvider: "gemini",
    aiAgentGender: AiAgentGender.FEMALE,
    aiAutoReplyInstructions: "instructions"
  });
  mocks.prisma.tenant.findUnique.mockResolvedValue({
    planId: "plan-1"
  });
  mocks.prisma.planLimit.findUnique.mockResolvedValue({
    maxAiCreditsPerMonth: 100
  });
  mocks.prisma.usageCounter.findUnique.mockResolvedValue({
    value: 0n
  });
  mocks.aiReplyGenerator.generate.mockResolvedValue({
    outcome: "success",
    suggestionText: "สวัสดีค่ะ ยินดีให้บริการค่ะ",
    compiledPrompt: "compiled prompt",
    knowledgeCitations: [{ documentId: "doc-1", title: "FAQ", snippet: "..." }],
    latencyMs: 150,
    provider: "gemini"
  });
  mocks.prisma.aiSuggestion.create.mockResolvedValue({
    id: "suggestion-1"
  });
  mocks.prisma.message.findFirst.mockResolvedValue({
    direction: "INBOUND"
  });
}

describe("AiHybridDraftService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("implements a 10s trailing debounce: multiple rapid triggers collapse to a single LLM call", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.advanceTimersByTimeAsync(5000);
    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();

    // Reset timer on second call
    void service.tryHybridDraft("tenant-1", "conv-1", "msg-2", "hello again");
    await jest.advanceTimersByTimeAsync(5000);
    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();

    // Trigger after final 10s quiet period
    await jest.advanceTimersByTimeAsync(5000);
    expect(mocks.aiReplyGenerator.generate).toHaveBeenCalledTimes(1);
  });

  it("skips generation when enableAiSuggest is false", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue({
      enableAiSuggest: false
    });
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.runAllTimersAsync();

    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();
  });

  it("skips generation when enableHybridAutoDraft is false", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue({
      enableAiSuggest: true,
      enableHybridAutoDraft: false
    });
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.runAllTimersAsync();

    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();
  });

  it("skips generation when credits are unavailable", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.prisma.planLimit.findUnique.mockResolvedValue({
      maxAiCreditsPerMonth: 0
    });
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.runAllTimersAsync();

    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();
  });

  it("skips generation when rate limits are exceeded", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.redisService.client.incr.mockResolvedValueOnce(11).mockResolvedValueOnce(1); // conv 11, tenant 1
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.runAllTimersAsync();

    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();
  });

  it("skips generation when the latest message is already an agent reply", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.prisma.message.findFirst.mockResolvedValue({
      direction: "OUTBOUND"
    });
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.runAllTimersAsync();

    expect(mocks.aiReplyGenerator.generate).not.toHaveBeenCalled();
  });

  it("charges 1 credit, saves suggestion with citations and emits SSE on outcome: success", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.runAllTimersAsync();

    expect(mocks.prisma.aiSuggestion.updateMany).toHaveBeenCalledWith({
      where: { conversationId: "conv-1", tenantId: "tenant-1", status: "shown" },
      data: { status: "superseded" }
    });
    expect(mocks.prisma.aiSuggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        suggestionText: "สวัสดีค่ะ ยินดีให้บริการค่ะ",
        citations: [{ documentId: "doc-1", title: "FAQ", snippet: "..." }],
        status: "shown",
        isProgrammatic: true
      })
    });
    expect(mocks.prisma.usageCounter.upsert).toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: AuditAction.AI_SUGGEST_GENERATED,
        metadata: expect.objectContaining({
          programmatic: true,
          outcome: "success",
          triggeredBy: "system"
        })
      })
    });
    expect(mocks.realtimeService.publishTenantEvent).toHaveBeenCalledWith(
      "tenant-1",
      "ai-suggestion.created",
      { conversationId: "conv-1", suggestionId: "suggestion-1" }
    );
  });

  it("saves suggestion and emits SSE but does NOT charge credit on outcome: knowledge_only", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.aiReplyGenerator.generate.mockResolvedValue({
      outcome: "knowledge_only",
      suggestionText: null,
      compiledPrompt: "compiled prompt",
      knowledgeCitations: [{ documentId: "doc-1", title: "FAQ", snippet: "..." }],
      latencyMs: 150,
      provider: "gemini"
    });
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.runAllTimersAsync();

    expect(mocks.prisma.aiSuggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        suggestionText: null,
        citations: [{ documentId: "doc-1", title: "FAQ", snippet: "..." }],
        status: "shown",
        isProgrammatic: true
      })
    });
    expect(mocks.prisma.usageCounter.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        metadata: expect.objectContaining({
          programmatic: true,
          outcome: "knowledge_only",
          triggeredBy: "system"
        })
      })
    });
    expect(mocks.realtimeService.publishTenantEvent).toHaveBeenCalled();
  });

  it("emits ai-suggestion.failed SSE on outcome: llm_failed", async () => {
    const mocks = createMocks();
    mockHappyPath(mocks);
    mocks.aiReplyGenerator.generate.mockResolvedValue({
      outcome: "llm_failed",
      provider: "gemini",
      errorCode: "AI_GENERATION_FAILED",
      llmError: new Error("Gemini API failed")
    });
    const service = createService(mocks);

    void service.tryHybridDraft("tenant-1", "conv-1", "msg-1", "hello");
    await jest.runAllTimersAsync();

    expect(mocks.prisma.aiSuggestion.create).not.toHaveBeenCalled();
    expect(mocks.realtimeService.publishTenantEvent).toHaveBeenCalledWith(
      "tenant-1",
      "ai-suggestion.failed",
      { conversationId: "conv-1", reason: "llm_failed" }
    );
  });
});

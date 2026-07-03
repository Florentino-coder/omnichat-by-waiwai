import { AiAgentGender } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GeminiClient } from "../common/llm/gemini.client";
import { OpenAIClient } from "../common/llm/openai.client";
import { ClaudeClient } from "../common/llm/claude.client";
import { GroqClient } from "../common/llm/groq.client";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { ScenarioService } from "../scenario/scenario.service";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";

function createMocks() {
  const prisma = {
    conversation: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    tenantSettings: { findUnique: jest.fn() },
    promptTemplate: { findFirst: jest.fn() },
    message: { findMany: jest.fn().mockResolvedValue([]) }
  };

  const geminiClient = {
    generateReply: jest.fn()
  };

  const openaiClient = {
    generateReply: jest.fn()
  };

  const claudeClient = {
    generateReply: jest.fn()
  };

  const knowledgeService = {
    buildKnowledgeContextWithCitations: jest.fn()
  };

  const scenarioService = {
    buildScenarioInstructions: jest.fn(),
    applyScenarioActions: jest.fn()
  };

  return { prisma, geminiClient, openaiClient, claudeClient, knowledgeService, scenarioService };
}

function createService(mocks: ReturnType<typeof createMocks>) {
  return new AiReplyGeneratorService(
    mocks.prisma as unknown as PrismaService,
    mocks.geminiClient as unknown as GeminiClient,
    mocks.openaiClient as unknown as OpenAIClient,
    mocks.claudeClient as unknown as ClaudeClient,
    {} as unknown as GroqClient,
    mocks.knowledgeService as unknown as KnowledgeService,
    mocks.scenarioService as unknown as ScenarioService
  );
}

describe("AiReplyGeneratorService", () => {
  const mockBaseInput = {
    tenantId: "tenant-1",
    conversationId: "conv-1",
    userId: "user-1",
    actionType: "generate",
    aiAgentGender: AiAgentGender.FEMALE,
    provider: "gemini",
    applyScenarioActions: true
  };

  const mockConversation = {
    id: "conv-1",
    tenantId: "tenant-1",
    customerId: "cust-1",
    customer: {
      id: "cust-1",
      displayName: "Somchai",
      deletedAt: null
    }
  };

  const mockSettings = {
    aiProvider: "gemini",
    aiAgentGender: AiAgentGender.FEMALE
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("extracts and strips the confidence tag correctly", async () => {
    const mocks = createMocks();
    mocks.prisma.conversation.findFirst.mockResolvedValue(mockConversation);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue(mockSettings);
    mocks.prisma.promptTemplate.findFirst.mockResolvedValue({
      systemPrompt: "Default Prompt template"
    });
    mocks.knowledgeService.buildKnowledgeContextWithCitations.mockResolvedValue({
      context: "context",
      citations: []
    });
    mocks.scenarioService.buildScenarioInstructions.mockResolvedValue("scenarios");

    mocks.geminiClient.generateReply.mockResolvedValue(
      "[CONFIDENCE: 0.95]\nสวัสดีค่ะ มีอะไรให้ช่วยไหมคะ"
    );

    const service = createService(mocks);
    const result = await service.generate({
      ...mockBaseInput,
      includeConfidence: true
    });

    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.confidence).toBe(0.95);
      expect(result.suggestionText).toBe("สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ");
      expect(result.compiledPrompt).toContain("[CRITICAL REQUIREMENT]");
    }
  });

  it("clamps confidence score between 0.0 and 1.0", async () => {
    const mocks = createMocks();
    mocks.prisma.conversation.findFirst.mockResolvedValue(mockConversation);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue(mockSettings);
    mocks.prisma.promptTemplate.findFirst.mockResolvedValue({
      systemPrompt: "Default Prompt template"
    });
    mocks.knowledgeService.buildKnowledgeContextWithCitations.mockResolvedValue({
      context: "context",
      citations: []
    });
    mocks.scenarioService.buildScenarioInstructions.mockResolvedValue("scenarios");

    const service = createService(mocks);

    // Test upper clamp
    mocks.geminiClient.generateReply.mockResolvedValueOnce(
      "[CONFIDENCE: 1.2]\nสวัสดีค่ะ"
    );
    const resultUpper = await service.generate({
      ...mockBaseInput,
      includeConfidence: true
    });
    expect(resultUpper.outcome).toBe("success");
    if (resultUpper.outcome === "success") {
      expect(resultUpper.confidence).toBe(1.0);
    }

    // Test lower clamp
    mocks.geminiClient.generateReply.mockResolvedValueOnce(
      "[CONFIDENCE: -0.5]\nสวัสดีค่ะ"
    );
    const resultLower = await service.generate({
      ...mockBaseInput,
      includeConfidence: true
    });
    expect(resultLower.outcome).toBe("success");
    if (resultLower.outcome === "success") {
      expect(resultLower.confidence).toBe(0.0);
    }
  });

  it("defaults confidence to 0.0 when tag is missing", async () => {
    const mocks = createMocks();
    mocks.prisma.conversation.findFirst.mockResolvedValue(mockConversation);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue(mockSettings);
    mocks.prisma.promptTemplate.findFirst.mockResolvedValue({
      systemPrompt: "Default Prompt template"
    });
    mocks.knowledgeService.buildKnowledgeContextWithCitations.mockResolvedValue({
      context: "context",
      citations: []
    });
    mocks.scenarioService.buildScenarioInstructions.mockResolvedValue("scenarios");

    mocks.geminiClient.generateReply.mockResolvedValue(
      "สวัสดีค่ะ ไม่มีอะไรแจ้งเตือน"
    );

    const service = createService(mocks);
    const result = await service.generate({
      ...mockBaseInput,
      includeConfidence: true
    });

    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.confidence).toBe(0.0);
      expect(result.suggestionText).toBe("สวัสดีค่ะ ไม่มีอะไรแจ้งเตือน");
    }
  });

  it("does not include confidence instructions or tag parsing when includeConfidence is false", async () => {
    const mocks = createMocks();
    mocks.prisma.conversation.findFirst.mockResolvedValue(mockConversation);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue(mockSettings);
    mocks.prisma.promptTemplate.findFirst.mockResolvedValue({
      systemPrompt: "Default Prompt template"
    });
    mocks.knowledgeService.buildKnowledgeContextWithCitations.mockResolvedValue({
      context: "context",
      citations: []
    });
    mocks.scenarioService.buildScenarioInstructions.mockResolvedValue("scenarios");

    mocks.geminiClient.generateReply.mockResolvedValue(
      "[CONFIDENCE: 0.95]\nสวัสดีค่ะ"
    );

    const service = createService(mocks);
    const result = await service.generate({
      ...mockBaseInput,
      includeConfidence: false
    });

    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.confidence).toBeUndefined();
      // Tag is not stripped since includeConfidence was false
      expect(result.suggestionText).toBe("[CONFIDENCE: 0.95]\nสวัสดีค่ะ");
      expect(result.compiledPrompt).not.toContain("[CRITICAL REQUIREMENT]");
    }
  });
});

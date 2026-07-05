import { AiAgentGender } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GeminiClient } from "../common/llm/gemini.client";
import { OpenAIClient } from "../common/llm/openai.client";
import { ClaudeClient } from "../common/llm/claude.client";
import { GroqClient } from "../common/llm/groq.client";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { ScenarioService } from "../scenario/scenario.service";
import { AiReplyGeneratorService, parseConfidenceTag } from "./ai-reply-generator.service";

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

  it("parses the confidence tag even when the LLM wraps it in markdown bold", () => {
    const result = parseConfidenceTag("**[CONFIDENCE: 0.87]**\nสวัสดีค่ะ มีอะไรให้ช่วยไหมคะ");
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe(0.87);
    expect(result.textToNormalize).toBe("สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ");
  });

  it("parses the confidence tag when there is a stray leading newline/space", () => {
    const result = parseConfidenceTag("\n [CONFIDENCE: 0.72]\nขอบคุณค่ะ");
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe(0.72);
    expect(result.textToNormalize).toBe("ขอบคุณค่ะ");
  });

  it("parses the confidence tag without brackets around it", () => {
    const result = parseConfidenceTag("CONFIDENCE: 0.6\nข้อความตอบกลับ");
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe(0.6);
    expect(result.textToNormalize).toBe("ข้อความตอบกลับ");
  });

  it("does not strip a legitimate [CONFIDENCE:] mention appearing later in the reply", () => {
    const result = parseConfidenceTag(
      "สวัสดีค่ะ ระบบของเราไม่มีการใช้คำว่า [CONFIDENCE: 99] ในคำตอบจริงค่ะ"
    );
    expect(result.matched).toBe(false);
    expect(result.confidence).toBe(0.0);
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

  it("includes CRITICAL SAFETY RULES in the compiled prompt", async () => {
    const mocks = createMocks();
    mocks.prisma.conversation.findFirst.mockResolvedValue(mockConversation);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue(mockSettings);
    mocks.prisma.promptTemplate.findFirst.mockResolvedValue({
      systemPrompt: "Default template with {{knowledge_context}}"
    });
    mocks.knowledgeService.buildKnowledgeContextWithCitations.mockResolvedValue({
      context: "ไม่มี",
      citations: []
    });
    mocks.scenarioService.buildScenarioInstructions.mockResolvedValue("scenarios");

    mocks.geminiClient.generateReply.mockResolvedValue("ขออภัยด้วยค่ะ");

    const service = createService(mocks);
    const result = await service.generate({
      ...mockBaseInput,
      includeConfidence: false
    });

    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.compiledPrompt).toContain("CRITICAL SAFETY RULES");
      expect(result.compiledPrompt).toContain("ห้ามนำหัวข้ออื่นที่ไม่เกี่ยวข้องกับคำถามลูกค้ามาตอบแทนเด็ดขาด");
      expect(result.compiledPrompt).not.toContain("ขนมเค้ก, คุกกี้, ชา, น้ำผลไม้");
    }
  });

  it("binds the customer name into the prompt template", async () => {
    const mocks = createMocks();
    mocks.prisma.conversation.findFirst.mockResolvedValue({
      ...mockConversation,
      customer: {
        id: "cust-1",
        displayName: "Somsak",
        deletedAt: null
      }
    });
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue(mockSettings);
    mocks.prisma.promptTemplate.findFirst.mockResolvedValue({
      systemPrompt: "Hello {{customer_name}}"
    });
    mocks.knowledgeService.buildKnowledgeContextWithCitations.mockResolvedValue({
      context: "ไม่มี",
      citations: []
    });
    mocks.scenarioService.buildScenarioInstructions.mockResolvedValue("scenarios");
    mocks.geminiClient.generateReply.mockResolvedValue("สวัสดี");

    const service = createService(mocks);
    const result = await service.generate({
      ...mockBaseInput,
      includeConfidence: false
    });

    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.compiledPrompt).toContain("Hello Somsak");
    }
  });

  it("enforces hallucination fallback instructions when RAG context is empty", async () => {
    const mocks = createMocks();
    mocks.prisma.conversation.findFirst.mockResolvedValue(mockConversation);
    mocks.prisma.tenantSettings.findUnique.mockResolvedValue(mockSettings);
    mocks.prisma.promptTemplate.findFirst.mockResolvedValue({
      systemPrompt: "System template: {{knowledge_context}}"
    });
    mocks.knowledgeService.buildKnowledgeContextWithCitations.mockResolvedValue({
      context: "ไม่มี",
      citations: []
    });
    mocks.scenarioService.buildScenarioInstructions.mockResolvedValue("scenarios");
    mocks.geminiClient.generateReply.mockResolvedValue("[CONFIDENCE: 0.99]\nขออภัยด้วยค่ะ ปัจจุบันทางระบบยังไม่มีข้อมูลเกี่ยวกับเรื่องนี้ค่ะ");

    const service = createService(mocks);
    const result = await service.generate({
      ...mockBaseInput,
      includeConfidence: true
    });

    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.compiledPrompt).toContain("ในกรณีที่หาข้อมูลไม่พบหรือไม่มีข้อมูลใน Knowledge Base ให้ปฏิเสธอย่างสุภาพเป็นภาษาไทย");
      expect(result.compiledPrompt).toContain("ห้ามนำหัวข้ออื่นที่ไม่เกี่ยวข้องกับคำถามลูกค้ามาตอบแทนเด็ดขาด");
      expect(result.compiledPrompt).not.toContain("ขนมเค้ก, คุกกี้, ชา, น้ำผลไม้");
      expect(result.suggestionText).toBe("ขออภัยด้วยค่ะ ปัจจุบันทางระบบยังไม่มีข้อมูลเกี่ยวกับเรื่องนี้ค่ะ");
      expect(result.confidence).toBe(0.99);
    }
  });
});

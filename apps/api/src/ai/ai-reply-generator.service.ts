import { Injectable, NotFoundException } from "@nestjs/common";
import { PromptTemplate } from "@prisma/client";
import { ClaudeClient } from "../common/llm/claude.client";
import { GeminiClient } from "../common/llm/gemini.client";
import { OpenAIClient } from "../common/llm/openai.client";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { PrismaService } from "../prisma/prisma.service";
import { ScenarioService } from "../scenario/scenario.service";
import {
  buildAgentGenderInstruction,
  normalizeThaiPoliteParticles,
  formatMessagesForLlm
} from "../inbox/thai-speech.util";
import {
  extractLlmErrorCode,
  resolveLlmClient,
  shouldOfferKnowledgeOnlyFallback
} from "./ai-llm.util";
import {
  AiReplyGenerateInput,
  AiReplyGenerateResult
} from "./ai-reply-generator.types";

const DEFAULT_SUGGESTED_REPLY_TEMPLATE = `คุณเป็นผู้ช่วย Agent ร้านค้าที่กำลังตอบแชทลูกค้าผ่าน LINE OA

{{agent_gender_instruction}}

ชื่อลูกค้า: {{customer_name}}
แท็กลูกค้า: {{tags}}
โน้ตภายในทีม (ข้อมูลสำคัญ ห้ามฝ่าฝืนเด็ดขาด): {{notes}}

ข้อมูลจาก Knowledge Base (ใช้เป็นข้อมูลอ้างอิง ห้ามแต่งเพิ่ม):
{{knowledge_context}}

คำสั่ง Scenario ที่ match (ให้ความสำคัญสูงกว่าคำสั่งทั่วไป):
{{scenario_instructions}}

ประวัติการสนทนาล่าสุด:
{{conversation_history}}

ข้อความร่างล่าสุดของ Agent:
{{current_draft}}

คำสั่งสำหรับ action_type = {{action_type}}:
- generate: ร่างคำตอบใหม่ สุภาพ กระชับ ตรงประเด็น
- rewrite: เขียนใหม่ข้อความร่างล่าสุดของ Agent ให้ความหมายเดิมแต่สำนวนต่างออกไป
- shorter: ย่อข้อความร่างล่าสุดของ Agent ให้สั้นลงและกระชับขึ้น
- polite: ปรับข้อความร่างล่าสุดของ Agent ให้สุภาพขึ้น
- friendly: ปรับข้อความร่างล่าสุดของ Agent ให้เป็นกันเองขึ้น

ตอบเป็นข้อความเดียวที่พร้อมส่งจริง ไม่ต้องมีคำอธิบายเพิ่มเติม ไม่ต้องใส่ quote`;

@Injectable()
export class AiReplyGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiClient: GeminiClient,
    private readonly openaiClient: OpenAIClient,
    private readonly claudeClient: ClaudeClient,
    private readonly knowledgeService: KnowledgeService,
    private readonly scenarioService: ScenarioService
  ) {}

  async generate(input: AiReplyGenerateInput): Promise<AiReplyGenerateResult> {
    const {
      tenantId,
      conversationId,
      userId,
      actionType,
      currentText,
      aiAgentGender,
      provider,
      applyScenarioActions = true,
      extraInstructions
    } = input;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        deletedAt: null
      },
      include: {
        customer: true
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (!conversation.customerId || !conversation.customer || conversation.customer.deletedAt !== null) {
      throw new NotFoundException("Customer not found or has been deleted");
    }

    const customer = conversation.customer;

    const [settings, messages] = await Promise.all([
      this.prisma.tenantSettings.findUnique({
        where: { tenantId }
      }),
      this.prisma.message.findMany({
        where: {
          conversationId,
          tenantId,
          deletedAt: null
        },
        orderBy: { createdAt: "desc" },
        take: 15
      })
    ]);

    const descMessages = [...messages];
    const history = messages.reverse();

    const tz = settings?.timezone || "Asia/Bangkok";
    let includeGreeting = false;
    if (descMessages.length === 0) {
      includeGreeting = true;
    } else {
      const latestMsg = descMessages[0];
      const prevMsg = descMessages[1];
      if (!prevMsg) {
        includeGreeting = true;
      } else {
        const latestTime = latestMsg.createdAt.getTime();
        const prevTime = prevMsg.createdAt.getTime();
        const diffHours = (latestTime - prevTime) / (1000 * 60 * 60);

        const getLocalDayString = (date: Date, timezone: string) => {
          try {
            return date.toLocaleDateString("sv-SE", { timeZone: timezone });
          } catch (e) {
            return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
          }
        };

        const latestDay = getLocalDayString(latestMsg.createdAt, tz);
        const prevDay = getLocalDayString(prevMsg.createdAt, tz);

        if (latestDay !== prevDay || diffHours > 3) {
          includeGreeting = true;
        }
      }
    }

    const customerConvs = await this.prisma.conversation.findMany({
      where: {
        customerId: customer.id,
        tenantId,
        deletedAt: null
      },
      include: {
        tagLinks: {
          where: { deletedAt: null },
          include: { tag: true }
        },
        internalNotes: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    const tagsMap = new Set<string>();
    for (const c of customerConvs) {
      for (const link of c.tagLinks) {
        if (link.tag && !link.tag.deletedAt) {
          tagsMap.add(link.tag.name);
        }
      }
    }
    const tagsStr = Array.from(tagsMap).join(", ") || "ไม่มี";

    const notesList = customerConvs
      .flatMap((c) => c.internalNotes.map((n) => n.body))
      .filter((body) => body.trim().length > 0);
    const notesStr = notesList.join("\n- ") ? `\n- ${notesList.join("\n- ")}` : "ไม่มี";

    const conversationHistoryText = history
      .map((msg) => {
        const sender = msg.direction === "INBOUND" ? (customer.displayName || "Customer") : "Agent";
        return `${sender}: ${msg.text || "[Media/Attachment]"}`;
      })
      .join("\n");

    const knowledgeQueryText = [
      ...history
        .filter((msg) => msg.direction === "INBOUND")
        .slice(-3)
        .map((msg) => msg.text || ""),
      currentText || ""
    ]
      .join(" ")
      .trim();

    const knowledgeResult = await this.knowledgeService.buildKnowledgeContextWithCitations(
      tenantId,
      knowledgeQueryText || conversationHistoryText,
      conversation.lineChannelId
    );
    const knowledgeContext = knowledgeResult.context;

    const scenarioMatch = await this.scenarioService.buildScenarioInstructions(
      tenantId,
      knowledgeQueryText || conversationHistoryText,
      Array.from(tagsMap),
      conversation.lineChannelId
    );

    if (applyScenarioActions && scenarioMatch.scenario) {
      await this.scenarioService.applyScenarioActions({
        tenantId,
        conversationId,
        scenario: scenarioMatch.scenario,
        userId,
        source: "ai_suggest"
      });
    }

    const scenarioInstructions = scenarioMatch.instructions;
    const template = await this.loadPromptTemplate(tenantId);
    const systemPromptTemplate = template ? template.systemPrompt : DEFAULT_SUGGESTED_REPLY_TEMPLATE;
    const agentGenderInstruction = buildAgentGenderInstruction(aiAgentGender);

    const compiledPromptBase = systemPromptTemplate
      .replace("{{agent_gender_instruction}}", agentGenderInstruction)
      .replace("{{customer_name}}", customer.displayName || "ลูกค้า")
      .replace("{{tags}}", tagsStr)
      .replace("{{notes}}", notesStr)
      .replace("{{knowledge_context}}", knowledgeContext)
      .replace("{{scenario_instructions}}", scenarioInstructions)
      .replace("{{action_type}}", actionType)
      .replace("{{conversation_history}}", conversationHistoryText)
      .replace("{{current_draft}}", currentText || "ไม่มี");

    const promptWithKnowledge = systemPromptTemplate.includes("{{knowledge_context}}")
      ? compiledPromptBase
      : `${compiledPromptBase}\n\nข้อมูลจาก Knowledge Base (ใช้เป็นข้อมูลอ้างอิง ห้ามแต่งเพิ่ม):\n${knowledgeContext}`;

    const promptWithScenario = systemPromptTemplate.includes("{{scenario_instructions}}")
      ? promptWithKnowledge
      : `${promptWithKnowledge}\n\nคำสั่ง Scenario ที่ match:\n${scenarioInstructions}`;

    const compiledPrompt = systemPromptTemplate.includes("{{agent_gender_instruction}}")
      ? promptWithScenario
      : `${agentGenderInstruction}\n\n${promptWithScenario}`;

    const greetingInstruction = includeGreeting
      ? "คำแนะนำเรื่องการทักทาย: เนื่องจากเป็นแชทแรกของวันหรือไม่มีการคุยกันเกิน 3 ชั่วโมง ให้กล่าวทักทายลูกค้าด้วยคำว่า 'สวัสดี' หรือ 'สวัสดีค่ะ/ครับ' ก่อนเริ่มตอบคำถามอย่างเป็นมิตรและสุภาพ"
      : "คำแนะนำเรื่องการทักทาย: ห้ามใส่คำทักทาย (เช่น สวัสดี, สวัสดีค่ะ, สวัสดีครับ) ในคำตอบเด็ดขาด ให้เข้าสู่เนื้อหาคำตอบทันทีเพื่อไม่ให้เป็นการทักทายซ้ำซ้อนและน่ารำคาญ";

    const promptWithGreeting = `${compiledPrompt}\n\n${greetingInstruction}`;

    const compiledPromptWithInstructions =
      extraInstructions?.trim()
        ? `${promptWithGreeting}\n\nคำสั่งเพิ่มเติมจากร้าน:\n${extraInstructions.trim()}`
        : promptWithGreeting;

    const historyForLlm = formatMessagesForLlm(history);

    const activeLlmClient = resolveLlmClient(provider, {
      gemini: this.geminiClient,
      openai: this.openaiClient,
      claude: this.claudeClient
    });

    const llmStartedAt = Date.now();
    try {
      const rawSuggestion = await activeLlmClient.generateReply({
        systemPrompt: compiledPromptWithInstructions,
        conversationHistory: historyForLlm
      });
      const suggestionText = normalizeThaiPoliteParticles(rawSuggestion, aiAgentGender);

      return {
        outcome: "success",
        suggestionText,
        compiledPrompt: compiledPromptWithInstructions,
        knowledgeCitations: knowledgeResult.citations,
        latencyMs: Date.now() - llmStartedAt,
        provider
      };
    } catch (llmError) {
      const errorCode = extractLlmErrorCode(llmError);
      if (shouldOfferKnowledgeOnlyFallback(errorCode) && knowledgeResult.citations.length > 0) {
        return {
          outcome: "knowledge_only",
          errorCode,
          knowledgeCitations: knowledgeResult.citations,
          provider
        };
      }

      return {
        outcome: "llm_failed",
        errorCode,
        llmError,
        provider
      };
    }
  }

  private async loadPromptTemplate(tenantId: string): Promise<PromptTemplate | null> {
    const tenantTemplate = await this.prisma.promptTemplate.findFirst({
      where: {
        tenantId,
        name: "suggested_reply_default"
      }
    });

    if (tenantTemplate) {
      return tenantTemplate;
    }

    return this.prisma.promptTemplate.findFirst({
      where: {
        tenantId: null,
        name: "suggested_reply_default"
      }
    });
  }
}

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PromptTemplate } from "@prisma/client";
import { ClaudeClient } from "../common/llm/claude.client";
import { GeminiClient } from "../common/llm/gemini.client";
import { GroqClient } from "../common/llm/groq.client";
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

/**
 * Extracts the "[CONFIDENCE: 0.xx]" tag the LLM is instructed to prepend to its reply.
 *
 * LLMs do not always obey "must be the very first characters" instructions literally —
 * they sometimes wrap the tag in markdown emphasis (**[CONFIDENCE: 0.9]**), add a stray
 * leading newline/space, or use smart quotes/backticks. A strict `^\[CONFIDENCE:` anchor
 * on the raw, unmodified string fails in all of these cases and silently falls back to
 * confidence = 0.0, which then always fails the auto-reply confidence threshold check
 * regardless of what the tenant configures it to. To avoid that silent failure mode we
 * strip common leading noise characters before anchoring the match, and only search
 * within a short prefix window so we never accidentally match a "[CONFIDENCE: ...]"
 * that legitimately appears deep inside the reply body.
 */
export function parseConfidenceTag(rawSuggestion: string): {
  confidence: number;
  textToNormalize: string;
  matched: boolean;
} {
  const searchWindow = rawSuggestion.slice(0, 120);
  const strippedPrefix = searchWindow.replace(/^[\s*_`"'#>-]+/, "");
  const leadingNoiseLength = searchWindow.length - strippedPrefix.length;

  const match = strippedPrefix.match(/^\[?\s*CONFIDENCE\s*:\s*([\d.]+)\]?/i);

  if (!match) {
    return { confidence: 0.0, textToNormalize: rawSuggestion, matched: false };
  }

  const parsedValue = parseFloat(match[1]);
  const confidence = Number.isFinite(parsedValue) ? Math.min(1.0, Math.max(0.0, parsedValue)) : 0.0;

  const matchEndInWindow = leadingNoiseLength + match[0].length;
  const trailingNoise = rawSuggestion.slice(matchEndInWindow).match(/^[\s*_`"'\]]*\n?/);
  const consumedLength = matchEndInWindow + (trailingNoise?.[0]?.length ?? 0);

  return {
    confidence,
    textToNormalize: rawSuggestion.slice(consumedLength),
    matched: true
  };
}

@Injectable()
export class AiReplyGeneratorService {
  private readonly logger = new Logger(AiReplyGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiClient: GeminiClient,
    private readonly openaiClient: OpenAIClient,
    private readonly claudeClient: ClaudeClient,
    private readonly groqClient: GroqClient,
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
      extraInstructions,
      includeConfidence
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

    let compiledPromptWithInstructions =
      extraInstructions?.trim()
        ? `${promptWithGreeting}\n\nคำสั่งเพิ่มเติมจากร้าน:\n${extraInstructions.trim()}`
        : promptWithGreeting;

    const antiHallucinationRules =
      "\n\n[ข้อกำหนดเรื่องความถูกต้องและการปฏิเสธ (CRITICAL SAFETY RULES)]\n" +
      "1. ให้ตอบลูกค้าโดยอ้างอิงข้อมูลจาก 'ข้อมูลจาก Knowledge Base' ด้านบนนี้เท่านั้น ห้ามคาดเดาหรือแต่งคำตอบเองเด็ดขาด\n" +
      "2. หากข้อมูลจาก Knowledge Base เป็น 'ไม่มี' หรือไม่มีข้อมูลใดๆ ที่ระบุถึงสิ่งที่ลูกค้าถามถึงโดยตรง (เช่น ถามถึงโปรโมชั่น สมัครสมาชิก หรือปัญหาการฝากเงิน แต่ไม่มีระบุในระบบอ้างอิง) ห้ามเดา ห้ามตอบโดยใช้ความรู้ทั่วไป และห้ามนำข้อมูลเรื่องอื่น (เช่น ขนมเค้ก, คุกกี้, ชา, น้ำผลไม้ หรือบริการอื่นๆ ที่ไม่เกี่ยวข้อง) มาตอบแทนเด็ดขาด\n" +
      "3. ในกรณีที่หาข้อมูลไม่พบหรือไม่มีข้อมูลใน Knowledge Base ให้ปฏิเสธอย่างสุภาพเป็นภาษาไทยว่า 'ขออภัยด้วยค่ะ/ครับ ปัจจุบันทางระบบยังไม่มีข้อมูลเกี่ยวกับเรื่องนี้ค่ะ/ครับ' หรือปฏิเสธในทำนองเดียวกันนี้เท่านั้น ห้ามตอบข้อมูลสมมติใดๆ ทั้งสิ้น";

    compiledPromptWithInstructions += antiHallucinationRules;

    if (includeConfidence) {
      compiledPromptWithInstructions += "\n\n[CRITICAL REQUIREMENT]\n" +
        "You must evaluate your confidence score in the accuracy of your response based on the Knowledge Base and conversation history.\n" +
        "Format the first line of your output exactly as: [CONFIDENCE: <score between 0.00 and 1.00>]\n" +
        "Followed by the reply text. Example:\n" +
        "[CONFIDENCE: 0.95]\n" +
        "สวัสดีค่ะ...";
    }

    const historyForLlm = formatMessagesForLlm(history);

    const activeLlmClient = resolveLlmClient(provider, {
      gemini: this.geminiClient,
      openai: this.openaiClient,
      claude: this.claudeClient,
      groq: this.groqClient
    });

    const llmStartedAt = Date.now();
    try {
      const rawSuggestion = await activeLlmClient.generateReply({
        systemPrompt: compiledPromptWithInstructions,
        conversationHistory: historyForLlm
      });

      let confidence: number | undefined;
      let textToNormalize = rawSuggestion;

      if (includeConfidence) {
        const parsed = parseConfidenceTag(rawSuggestion);
        confidence = parsed.confidence;
        textToNormalize = parsed.textToNormalize;

        if (!parsed.matched) {
          this.logger.warn(
            `LLM did not return a parseable [CONFIDENCE: x.xx] tag; defaulting to 0.0 ` +
              `(conversation=${conversationId}, provider=${provider}). ` +
              `This will always fail the auto-reply confidence threshold and force human escalation. ` +
              `Raw output prefix: ${JSON.stringify(rawSuggestion.slice(0, 120))}`
          );
        }
      }

      const suggestionText = normalizeThaiPoliteParticles(textToNormalize, aiAgentGender);

      return {
        outcome: "success",
        suggestionText,
        compiledPrompt: compiledPromptWithInstructions,
        knowledgeCitations: knowledgeResult.citations,
        latencyMs: Date.now() - llmStartedAt,
        provider,
        confidence
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

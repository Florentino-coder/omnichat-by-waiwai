import { Injectable, Logger } from "@nestjs/common";
import { GeminiClient } from "../common/llm/gemini.client";

export type AiQaScoreResult = {
  relevanceScore: number;
  toneScore: number;
  hallucinationScore: number;
};

@Injectable()
export class AiQaScorerService {
  private readonly logger = new Logger(AiQaScorerService.name);

  constructor(private readonly geminiClient: GeminiClient) {}

  async scoreReply(params: {
    customerMessage: string;
    aiReply: string;
    conversationContext: string;
  }): Promise<AiQaScoreResult | null> {
    const systemPrompt = `You are an AI quality reviewer for customer service chat replies.
Score the AI reply on three dimensions from 1 (poor) to 5 (excellent):
- relevance: Does the reply address the customer's message?
- tone: Is the tone appropriate, polite, and professional for Thai customer service?
- hallucination: 5 = no fabricated facts; 1 = clearly invented information

Respond with ONLY valid JSON: {"relevance":N,"tone":N,"hallucination":N}`;

    const userPrompt = `Customer message:
${params.customerMessage}

Conversation context:
${params.conversationContext}

AI reply to evaluate:
${params.aiReply}`;

    try {
      const raw = await this.geminiClient.generateReply({
        systemPrompt,
        conversationHistory: [{ role: "customer", text: userPrompt }]
      });

      const parsed = this.parseScores(raw);
      if (!parsed) {
        this.logger.warn("AI QA scorer returned unparseable output");
        return null;
      }

      return parsed;
    } catch (error) {
      this.logger.error(
        "AI QA scoring failed",
        error instanceof Error ? error.stack : error
      );
      return null;
    }
  }

  private parseScores(raw: string): AiQaScoreResult | null {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      const data = JSON.parse(match[0]) as Record<string, unknown>;
      const relevance = this.clampScore(data.relevance);
      const tone = this.clampScore(data.tone);
      const hallucination = this.clampScore(data.hallucination);

      if (relevance === null || tone === null || hallucination === null) {
        return null;
      }

      return {
        relevanceScore: relevance,
        toneScore: tone,
        hallucinationScore: hallucination
      };
    } catch {
      return null;
    }
  }

  private clampScore(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    return Math.min(5, Math.max(1, Math.round(value)));
  }
}

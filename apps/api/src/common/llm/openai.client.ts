import { Injectable, Logger } from "@nestjs/common";
import { LLMClient } from "./llm.interface";

@Injectable()
export class OpenAIClient implements LLMClient {
  private readonly logger = new Logger(OpenAIClient.name);

  async generateReply(params: {
    systemPrompt: string;
    conversationHistory: { role: "customer" | "agent"; text: string }[];
  }): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.error("OPENAI_API_KEY is not defined");
      throw new Error("OPENAI_API_KEY is not defined");
    }

    const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const url = "https://api.openai.com/v1/chat/completions";

    const messages = [
      { role: "system", content: params.systemPrompt },
      ...params.conversationHistory.map((item) => ({
        role: item.role === "customer" ? "user" : "assistant",
        content: item.text
      }))
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API failed with status ${response.status}`);
    }

    const data = (await response.json()) as any;
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Invalid response structure from OpenAI API");
    }

    return text.trim();
  }
}

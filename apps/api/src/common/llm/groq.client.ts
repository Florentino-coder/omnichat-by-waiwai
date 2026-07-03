import { Injectable, Logger } from "@nestjs/common";
import { LLMClient } from "./llm.interface";

@Injectable()
export class GroqClient implements LLMClient {
  private readonly logger = new Logger(GroqClient.name);

  async generateReply(params: {
    systemPrompt: string;
    conversationHistory: { role: "customer" | "agent"; text: string }[];
  }): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      this.logger.error("GROQ_API_KEY is not defined");
      throw new Error("GROQ_API_KEY is not defined");
    }

    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const messages = [
      { role: "system", content: params.systemPrompt },
      ...params.conversationHistory.map((item) => ({
        role: item.role === "customer" ? "user" : "assistant",
        content: item.text || ""
      }))
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Groq API error: ${response.status} - ${errorText}`);
      throw new Error(`Groq API failed with status ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      this.logger.error(`Invalid response structure from Groq API: ${JSON.stringify(data)}`);
      throw new Error("Invalid response structure from Groq API");
    }

    return text.trim();
  }
}

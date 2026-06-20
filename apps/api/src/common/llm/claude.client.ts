import { Injectable, Logger } from "@nestjs/common";
import { LLMClient } from "./llm.interface";

@Injectable()
export class ClaudeClient implements LLMClient {
  private readonly logger = new Logger(ClaudeClient.name);

  async generateReply(params: {
    systemPrompt: string;
    conversationHistory: { role: "customer" | "agent"; text: string }[];
  }): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.error("ANTHROPIC_API_KEY is not defined");
      throw new Error("ANTHROPIC_API_KEY is not defined");
    }

    const modelName = process.env.CLAUDE_MODEL || "claude-3-5-haiku-20241022";
    const url = "https://api.anthropic.com/v1/messages";

    const messages: { role: string; content: string }[] = [];
    for (const item of params.conversationHistory) {
      const role = item.role === "customer" ? "user" : "assistant";
      const text = item.text || "";
      if (messages.length > 0 && messages[messages.length - 1].role === role) {
        messages[messages.length - 1].content += `\n${text}`;
      } else {
        messages.push({
          role,
          content: text
        });
      }
    }

    // Claude requires at least one message
    if (messages.length === 0) {
      messages.push({
        role: "user",
        content: "สวัสดี"
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: modelName,
        system: params.systemPrompt,
        messages,
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Claude API error: ${response.status} - ${errorText}`);
      throw new Error(`Claude API failed with status ${response.status}`);
    }

    const data = (await response.json()) as any;
    const text = data.content?.[0]?.text;
    if (!text) {
      throw new Error("Invalid response structure from Claude API");
    }

    return text.trim();
  }
}

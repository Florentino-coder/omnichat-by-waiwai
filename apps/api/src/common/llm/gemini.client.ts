import { Injectable, Logger } from "@nestjs/common";
import { LLMClient } from "./llm.interface";

const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 503]);
const HTTP_MAX_ATTEMPTS = 3;
const EMPTY_CONTENT_MAX_ATTEMPTS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class GeminiClient implements LLMClient {
  private readonly logger = new Logger(GeminiClient.name);

  async generateReply(params: {
    systemPrompt: string;
    conversationHistory: { role: "customer" | "agent"; text: string }[];
  }): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.error("GEMINI_API_KEY is not defined");
      throw new Error("GEMINI_API_KEY is not defined");
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const item of params.conversationHistory) {
      const role = item.role === "customer" ? "user" : "model";
      const text = item.text || "";
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += `\n${text}`;
      } else {
        contents.push({
          role,
          parts: [{ text }]
        });
      }
    }

    // Gemini requires at least one content entry
    if (contents.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: "สวัสดี" }]
      });
    }

    const body = {
      contents,
      systemInstruction: {
        parts: [{ text: params.systemPrompt }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048
      }
    };

    let lastFinishReason: string | undefined;

    for (let contentAttempt = 0; contentAttempt < EMPTY_CONTENT_MAX_ATTEMPTS; contentAttempt++) {
      const response = await this.fetchWithRetry(url, body);

      const data = (await response.json()) as {
        candidates?: Array<{
          finishReason?: string;
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: unknown;
      };

      const candidate = data.candidates?.[0];
      lastFinishReason = candidate?.finishReason;
      const parts = candidate?.content?.parts ?? [];
      const text = parts
        .map((part) => part.text ?? "")
        .join("")
        .trim();

      if (text) {
        return text;
      }

      this.logger.error(
        `Gemini returned empty content (finishReason=${lastFinishReason ?? "unknown"}, attempt=${contentAttempt + 1})`,
        JSON.stringify({ finishReason: lastFinishReason, usageMetadata: data.usageMetadata })
      );

      if (contentAttempt < EMPTY_CONTENT_MAX_ATTEMPTS - 1) {
        continue;
      }
    }

    throw new Error(
      `Gemini returned empty content (finishReason=${lastFinishReason ?? "unknown"})`
    );
  }

  private async fetchWithRetry(
    url: string,
    body: Record<string, unknown>
  ): Promise<Response> {
    let lastErrorText = "";

    for (let attempt = 0; attempt < HTTP_MAX_ATTEMPTS; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        return response;
      }

      const errorText = await response.text();
      lastErrorText = errorText;
      const isRetryable =
        RETRYABLE_HTTP_STATUSES.has(response.status) && attempt < HTTP_MAX_ATTEMPTS - 1;

      if (isRetryable) {
        const delayMs = 1000 * Math.pow(2, attempt);
        this.logger.warn(
          `Gemini API ${response.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${HTTP_MAX_ATTEMPTS})`
        );
        await sleep(delayMs);
        continue;
      }

      this.logger.error(`Gemini API error: ${response.status} - ${errorText}`);
      throw new Error(`Gemini API failed with status ${response.status}: ${errorText}`);
    }

    throw new Error(`Gemini API failed after retries: ${lastErrorText}`);
  }
}

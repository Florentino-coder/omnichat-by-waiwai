import { Injectable, Logger } from "@nestjs/common";
import { LLMClient } from "./llm.interface";

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

    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
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
        maxOutputTokens: 1000
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Gemini API error: ${response.status} - ${errorText}`);
      throw new Error(`Gemini API failed with status ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      this.logger.error(`Invalid response structure from Gemini API: ${JSON.stringify(data)}`);
      throw new Error("Invalid response structure from Gemini API");
    }

    return text.trim();
  }
}

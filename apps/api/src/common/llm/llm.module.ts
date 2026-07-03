import { Module } from "@nestjs/common";
import { GeminiClient } from "./gemini.client";
import { OpenAIClient } from "./openai.client";
import { ClaudeClient } from "./claude.client";
import { GroqClient } from "./groq.client";
import { LlmProvider } from "./supported-providers";

@Module({
  providers: [
    GeminiClient,
    OpenAIClient,
    ClaudeClient,
    GroqClient,
    {
      provide: "LLMClient",
      useFactory: (
        gemini: GeminiClient,
        openai: OpenAIClient,
        claude: ClaudeClient,
        groq: GroqClient
      ) => {
        const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase() as LlmProvider;
        if (provider === "openai") return openai;
        if (provider === "claude") return claude;
        if (provider === "groq") return groq;
        return gemini; // default
      },
      inject: [GeminiClient, OpenAIClient, ClaudeClient, GroqClient]
    }
  ],
  exports: ["LLMClient", GeminiClient, OpenAIClient, ClaudeClient, GroqClient]
})
export class LlmModule {}

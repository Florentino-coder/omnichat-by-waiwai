import { Module } from "@nestjs/common";
import { GeminiClient } from "./gemini.client";
import { OpenAIClient } from "./openai.client";
import { ClaudeClient } from "./claude.client";

@Module({
  providers: [
    GeminiClient,
    OpenAIClient,
    ClaudeClient,
    {
      provide: "LLMClient",
      useFactory: (
        gemini: GeminiClient,
        openai: OpenAIClient,
        claude: ClaudeClient
      ) => {
        const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
        if (provider === "openai") return openai;
        if (provider === "claude") return claude;
        return gemini; // default
      },
      inject: [GeminiClient, OpenAIClient, ClaudeClient]
    }
  ],
  exports: ["LLMClient"]
})
export class LlmModule {}

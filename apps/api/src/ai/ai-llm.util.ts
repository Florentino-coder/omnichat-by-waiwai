import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ClaudeClient } from "../common/llm/claude.client";
import { GeminiClient } from "../common/llm/gemini.client";
import { GroqClient } from "../common/llm/groq.client";
import { LLMClient } from "../common/llm/llm.interface";
import { OpenAIClient } from "../common/llm/openai.client";
import { LlmProvider } from "../common/llm/supported-providers";

const logger = new Logger("AiLlmUtil");

export type LlmClients = {
  gemini: GeminiClient;
  openai: OpenAIClient;
  claude: ClaudeClient;
  groq: GroqClient;
};

export function resolveLlmClient(provider: LlmProvider | string, clients: LlmClients): LLMClient {
  const normalized = provider.toLowerCase();
  if (normalized === "openai") {
    return clients.openai;
  }
  if (normalized === "claude") {
    return clients.claude;
  }
  if (normalized === "groq") {
    return clients.groq;
  }
  return clients.gemini;
}

export function extractLlmErrorCode(llmError: unknown): string {
  const errorMessage = llmError instanceof Error ? llmError.message : String(llmError);

  if (/API_KEY is not defined|OPENAI_API_KEY|ANTHROPIC_API_KEY|CLAUDE_API_KEY|GROQ_API_KEY/i.test(errorMessage)) {
    return "AI_PROVIDER_NOT_CONFIGURED";
  }
  if (/status 429|rate limit|quota/i.test(errorMessage)) {
    return "AI_PROVIDER_RATE_LIMITED";
  }
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(errorMessage)) {
    return "AI_PROVIDER_TIMEOUT";
  }
  return "AI_GENERATION_FAILED";
}

export function shouldOfferKnowledgeOnlyFallback(errorCode: string): boolean {
  return errorCode === "AI_PROVIDER_RATE_LIMITED" || errorCode === "AI_PROVIDER_NOT_CONFIGURED";
}

export function buildLlmHttpException(llmError: unknown, provider?: string): HttpException {
  const errorMessage = llmError instanceof Error ? llmError.message : String(llmError);
  logger.error(`LLM Generation failed: ${errorMessage}`);

  const code = extractLlmErrorCode(llmError);
  
  let providerLabel = "AI provider";
  if (provider) {
    const norm = provider.toLowerCase();
    if (norm === "groq") providerLabel = "Groq";
    else if (norm === "claude" || norm === "anthropic") providerLabel = "Claude";
    else if (norm === "openai") providerLabel = "OpenAI";
    else if (norm === "gemini") providerLabel = "Gemini";
  }

  const messageByCode: Record<string, string> = {
    AI_PROVIDER_NOT_CONFIGURED: `${providerLabel} API key is not configured on the server.`,
    AI_PROVIDER_RATE_LIMITED:
      `${providerLabel} daily quota exceeded. Try again tomorrow or upgrade your API plan.`,
    AI_PROVIDER_TIMEOUT: `${providerLabel} took too long to respond. Please try again.`,
    AI_GENERATION_FAILED: `${providerLabel} generation failed. Please try again.`
  };

  const statusByCode: Record<string, HttpStatus> = {
    AI_PROVIDER_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
    AI_PROVIDER_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
    AI_PROVIDER_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
    AI_GENERATION_FAILED: HttpStatus.BAD_GATEWAY
  };

  return new HttpException(
    {
      success: false,
      error: {
        code,
        message: messageByCode[code] ?? messageByCode.AI_GENERATION_FAILED
      }
    },
    statusByCode[code] ?? HttpStatus.BAD_GATEWAY
  );
}

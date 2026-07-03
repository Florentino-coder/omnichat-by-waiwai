export const SUPPORTED_LLM_PROVIDERS = ["gemini", "openai", "claude", "groq"] as const;
export type LlmProvider = typeof SUPPORTED_LLM_PROVIDERS[number];

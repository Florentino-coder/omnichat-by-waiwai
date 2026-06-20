export interface LLMClient {
  generateReply(params: {
    systemPrompt: string;
    conversationHistory: { role: "customer" | "agent"; text: string }[];
  }): Promise<string>;
}

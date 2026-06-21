import { AiAgentGender } from "@prisma/client";
import { KnowledgeCitation } from "../knowledge/knowledge-rag.util";

export type AiReplyGenerateInput = {
  tenantId: string;
  conversationId: string;
  userId: string;
  actionType: string;
  currentText?: string;
  aiAgentGender: AiAgentGender;
  provider: string;
  applyScenarioActions?: boolean;
};

export type AiReplyGenerateSuccess = {
  outcome: "success";
  suggestionText: string;
  compiledPrompt: string;
  knowledgeCitations: KnowledgeCitation[];
  latencyMs: number;
  provider: string;
};

export type AiReplyGenerateKnowledgeOnly = {
  outcome: "knowledge_only";
  errorCode: string;
  knowledgeCitations: KnowledgeCitation[];
  provider: string;
};

export type AiReplyGenerateFailed = {
  outcome: "llm_failed";
  errorCode: string;
  llmError: unknown;
  provider: string;
};

export type AiReplyGenerateResult =
  | AiReplyGenerateSuccess
  | AiReplyGenerateKnowledgeOnly
  | AiReplyGenerateFailed;

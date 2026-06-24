import { Injectable } from "@nestjs/common";
import {
  getMatchedEscalationKeywords,
  normalizeEscalationKeywords
} from "./ai-auto-reply.constants";

export type AiPolicyCheckResult = {
  allowed: boolean;
  matchedTopics: string[];
};

@Injectable()
export class AiPolicyService {
  checkReply(text: string, blockedTopics: string[] | null | undefined): AiPolicyCheckResult {
    const topics = normalizeEscalationKeywords(blockedTopics ?? []);
    if (topics.length === 0) {
      return { allowed: true, matchedTopics: [] };
    }

    const matchedTopics = getMatchedEscalationKeywords(text, topics);
    return {
      allowed: matchedTopics.length === 0,
      matchedTopics
    };
  }
}

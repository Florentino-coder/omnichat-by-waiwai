import { AiAutoReplyMode } from "@prisma/client";

export const DEFAULT_AI_ESCALATION_KEYWORDS: readonly string[] = [
  "แอดมิน",
  "คุยกับคน",
  "โทรหา",
  "ติดต่อเจ้าหน้าที่",
  "ขอคุยกับคน",
  "พูดกับคน",
  "ฝ่ายบริการ",
  "โทร"
];

export const DEFAULT_AI_AUTO_REPLY_MODE = AiAutoReplyMode.OFF_HOURS_ONLY;
export const DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_START = 8;
export const DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_END = 23;

export function normalizeEscalationKeywords(keywords: string[]): string[] {
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))].slice(0, 20);
}

export function resolveEscalationKeywords(stored: string[] | null | undefined): string[] {
  if (!stored || stored.length === 0) {
    return [...DEFAULT_AI_ESCALATION_KEYWORDS];
  }
  return normalizeEscalationKeywords(stored);
}

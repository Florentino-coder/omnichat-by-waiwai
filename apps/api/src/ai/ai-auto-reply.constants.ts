import { AiAutoReplyMode } from "@prisma/client";
import { getBangkokHour } from "../scenario/scenario-match.util";
import { isOffHours } from "../automation/automation-match.util";

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

export const AI_AUTO_REPLY_CONV_RATE_LIMIT = 5;
export const AI_AUTO_REPLY_CONV_RATE_TTL_SECONDS = 60 * 60;
export const AI_AUTO_REPLY_TENANT_RATE_LIMIT = 200;
export const AI_AUTO_REPLY_TENANT_RATE_TTL_SECONDS = 24 * 60 * 60;
export const AI_AUTO_REPLY_DEBOUNCE_MS = 3000;
export const AI_AUTO_REPLY_MAX_TEXT_LENGTH = 5000;
export const AI_ESCALATED_TAG_NAME = "ai-escalated";

export type AiAutoReplySkipReason =
  | "disabled"
  | "non_text"
  | "mode_blocked"
  | "escalated"
  | "debounce"
  | "no_credits"
  | "rate_limited"
  | "provider_unavailable";

export function getTenantLocalHour(timezone: string, date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false
    });
    return Number(formatter.format(date));
  } catch {
    return getBangkokHour(date);
  }
}

export function getEscalationKeywordsForMatching(stored: string[] | null | undefined): string[] {
  if (stored === null || stored === undefined) {
    return [...DEFAULT_AI_ESCALATION_KEYWORDS];
  }
  if (stored.length === 0) {
    return [];
  }
  return normalizeEscalationKeywords(stored);
}

export function matchesEscalationKeyword(messageText: string, keywords: string[]): boolean {
  if (keywords.length === 0) {
    return false;
  }
  const normalizedMessage = messageText.trim().toLowerCase();
  return keywords.some((keyword) => normalizedMessage.includes(keyword.trim().toLowerCase()));
}

export function passesAutoReplyModeGuard(input: {
  mode: AiAutoReplyMode;
  assignedToMemberId: string | null;
  currentHour: number;
  businessHourStart: number;
  businessHourEnd: number;
}): boolean {
  switch (input.mode) {
    case AiAutoReplyMode.OFF:
      return false;
    case AiAutoReplyMode.WHEN_UNASSIGNED:
      return input.assignedToMemberId === null;
    case AiAutoReplyMode.ALWAYS:
      return true;
    case AiAutoReplyMode.OFF_HOURS_ONLY:
      return isOffHours(input.currentHour, input.businessHourStart, input.businessHourEnd);
    default:
      return false;
  }
}

export function sanitizeAutoReplyText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .trim()
    .slice(0, AI_AUTO_REPLY_MAX_TEXT_LENGTH);
}

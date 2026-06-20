import { AutomationRule, AutomationTriggerType } from "@prisma/client";
import { AutomationDispatchContext } from "./automation-step.types";
import { getBangkokHour, isWithinActiveHours } from "../scenario/scenario-match.util";

export type AutomationRuleMatchFields = Pick<
  AutomationRule,
  | "triggerType"
  | "triggerKeywords"
  | "triggerTagNames"
  | "triggerStatus"
  | "offHourStart"
  | "offHourEnd"
  | "lineChannelId"
  | "isEnabled"
  | "priority"
  | "name"
>;

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

function keywordMatches(messageText: string, keywords: string[]): boolean {
  const normalized = normalizeText(messageText);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function isOffHours(currentHour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null) {
    return false;
  }
  return !isWithinActiveHours(currentHour, start, end);
}

export function automationRuleMatchesContext(
  rule: AutomationRuleMatchFields,
  context: AutomationDispatchContext
): boolean {
  if (!rule.isEnabled || context.skipAutomation) {
    return false;
  }

  if (rule.lineChannelId && rule.lineChannelId !== context.lineChannelId) {
    return false;
  }

  const keywords = rule.triggerKeywords.map((k) => k.trim()).filter(Boolean);
  const tagTriggers = rule.triggerTagNames.map(normalizeTagName).filter(Boolean);
  const messageText = context.messageText ?? "";

  switch (rule.triggerType) {
    case AutomationTriggerType.MESSAGE_RECEIVED:
      if (keywords.length === 0) {
        return messageText.trim().length > 0;
      }
      return keywordMatches(messageText, keywords);

    case AutomationTriggerType.OFF_HOURS:
      if (!isOffHours(context.currentHour, rule.offHourStart, rule.offHourEnd)) {
        return false;
      }
      if (keywords.length === 0) {
        return messageText.trim().length > 0;
      }
      return keywordMatches(messageText, keywords);

    case AutomationTriggerType.CONVERSATION_CREATED:
      return true;

    case AutomationTriggerType.TAG_ADDED: {
      const addedTag = context.addedTagName?.trim();
      if (!addedTag) {
        return false;
      }
      if (tagTriggers.length === 0) {
        return true;
      }
      return tagTriggers.includes(normalizeTagName(addedTag));
    }

    case AutomationTriggerType.STATUS_CHANGED: {
      const status = context.status?.trim();
      if (!status) {
        return false;
      }
      if (!rule.triggerStatus?.trim()) {
        return true;
      }
      return normalizeText(rule.triggerStatus) === normalizeText(status);
    }

    default:
      return false;
  }
}

export function pickMatchingAutomationRules<T extends AutomationRuleMatchFields>(
  rules: T[],
  context: AutomationDispatchContext
): T[] {
  return rules
    .filter((rule) => automationRuleMatchesContext(rule, context))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export { getBangkokHour };

import { AiScenario } from "@prisma/client";

export type ScenarioMatchContext = {
  messageText: string;
  tagNames: string[];
  lineChannelId?: string;
  /** Hour 0-23 in tenant timezone (default Asia/Bangkok) */
  currentHour: number;
};

export type ScenarioMatchFields = Pick<
  AiScenario,
  | "triggerKeywords"
  | "triggerTagNames"
  | "lineChannelId"
  | "activeHourStart"
  | "activeHourEnd"
  | "isEnabled"
>;

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

export function isWithinActiveHours(
  currentHour: number,
  start: number | null,
  end: number | null
): boolean {
  if (start === null || end === null) {
    return true;
  }

  if (start === end) {
    return true;
  }

  if (start < end) {
    return currentHour >= start && currentHour <= end;
  }

  // Overnight window e.g. 22 -> 6
  return currentHour >= start || currentHour <= end;
}

export function scenarioMatchesContext(
  scenario: ScenarioMatchFields,
  context: ScenarioMatchContext
): boolean {
  if (!scenario.isEnabled) {
    return false;
  }

  if (scenario.lineChannelId && scenario.lineChannelId !== context.lineChannelId) {
    return false;
  }

  if (!isWithinActiveHours(context.currentHour, scenario.activeHourStart, scenario.activeHourEnd)) {
    return false;
  }

  const keywords = scenario.triggerKeywords.map((k) => k.trim()).filter(Boolean);
  const tagTriggers = scenario.triggerTagNames.map(normalizeTagName).filter(Boolean);

  if (keywords.length === 0 && tagTriggers.length === 0) {
    return false;
  }

  const normalizedMessage = normalizeText(context.messageText);
  const normalizedTags = new Set(context.tagNames.map(normalizeTagName));

  const keywordMatched =
    keywords.length === 0 ||
    keywords.some((keyword) => normalizedMessage.includes(normalizeText(keyword)));

  const tagMatched =
    tagTriggers.length === 0 ||
    tagTriggers.some((tagName) => normalizedTags.has(tagName));

  // Both trigger types must pass when configured (AND semantics)
  const keywordOk = keywords.length === 0 ? true : keywordMatched;
  const tagOk = tagTriggers.length === 0 ? true : tagMatched;

  return keywordOk && tagOk && (keywords.length > 0 || tagTriggers.length > 0);
}

export function pickBestMatchingScenario<T extends ScenarioMatchFields & { priority: number; instructions: string }>(
  scenarios: T[],
  context: ScenarioMatchContext
): T | null {
  const matches = scenarios
    .filter((scenario) => scenarioMatchesContext(scenario, context))
    .sort((a, b) => a.priority - b.priority || a.instructions.localeCompare(b.instructions));

  return matches[0] ?? null;
}

export function formatScenarioInstructions(
  scenario: Pick<AiScenario, "name" | "instructions"> | null
): string {
  if (!scenario) {
    return "ไม่มี scenario ที่ match — ตอบตาม knowledge และบริบททั่วไป";
  }

  return `Scenario: ${scenario.name}\n${scenario.instructions.trim()}`;
}

export function getBangkokHour(date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "numeric",
    hour12: false
  });
  return Number(formatter.format(date));
}

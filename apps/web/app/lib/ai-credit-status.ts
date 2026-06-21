import { getMessages, type Locale } from "./i18n";

export type AiCreditBlockReason = "PLAN_EXCLUDES_AI" | "MONTHLY_LIMIT_REACHED";

export function getAiCreditStatusMessage(
  blockReason: AiCreditBlockReason | null | undefined,
  locale?: Locale
): string | null {
  const t = getMessages(locale);

  if (blockReason === "PLAN_EXCLUDES_AI") {
    return t.aiCreditPlanExcludes;
  }
  if (blockReason === "MONTHLY_LIMIT_REACHED") {
    return t.aiCreditMonthlyLimit;
  }
  return null;
}

export function getAiCreditErrorMessage(message: string, locale?: Locale): string | null {
  if (
    message.includes("not available on the current plan") ||
    message.includes("PLAN_EXCLUDES_AI")
  ) {
    return getAiCreditStatusMessage("PLAN_EXCLUDES_AI", locale);
  }
  if (
    message.includes("Monthly AI credit limit exceeded") ||
    message.includes("MONTHLY_LIMIT_REACHED")
  ) {
    return getAiCreditStatusMessage("MONTHLY_LIMIT_REACHED", locale);
  }
  if (message.includes("PLAN_LIMIT_EXCEEDED")) {
    return getMessages(locale).aiCreditSettingsHint;
  }
  if (
    message.includes("AI_PROVIDER_RATE_LIMITED") ||
    message.includes("quota exceeded") ||
    message.includes("status 429")
  ) {
    return getMessages(locale).aiProviderRateLimited;
  }
  if (
    message.includes("AI_PROVIDER_NOT_CONFIGURED") ||
    message.includes("API key is not configured")
  ) {
    return getMessages(locale).aiProviderNotConfigured;
  }
  return null;
}

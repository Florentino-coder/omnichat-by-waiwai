"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { Button } from "@omnichat/ui";
import { getAiCreditStatusMessage, type AiCreditBlockReason } from "../../lib/ai-credit-status";
import { useLanguage } from "../../lib/language-context";
import { getMessages, type Locale } from "../../lib/i18n";
import { Sparkles, GitBranch, Cpu, User, Clock, MessageCircle } from "lucide-react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#4636D7] focus:ring-offset-2 ${
        checked ? "bg-[#4636D7]" : "bg-[#ECEBFF]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

type AiAutoReplyMode = "OFF" | "WHEN_UNASSIGNED" | "ALWAYS" | "OFF_HOURS_ONLY";

type AiSettingsData = {
  inProgressAlertMinutes: number;
  enableAiSuggest: boolean;
  enableHybridAutoDraft: boolean;
  enableAiScenarios: boolean;
  aiProvider: string;
  aiAgentGender: "FEMALE" | "MALE";
  enableAiAutoReply: boolean;
  aiAutoReplyMode: AiAutoReplyMode;
  aiAutoReplyBusinessHourStart: number;
  aiAutoReplyBusinessHourEnd: number;
  aiAutoReplyInstructions: string | null;
  aiEscalationKeywords: string[];
  aiAutoReplyConfidenceThreshold: number;
  aiPolicyBlockedTopics: string[];
  aiGuardrailNoticeAt: string | null;
};

type PromptTemplateData = {
  id: string;
  name: string;
  systemPrompt: string;
};

type AiUsageData = {
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  percentage: number;
  planId: string;
  provider: string;
  providerLabel: string;
  modelName: string;
  creditsAvailable: boolean;
  blockReason: AiCreditBlockReason | null;
};

type AiTestResult = {
  suggestion_text: string;
  provider: string;
  provider_label: string;
  model_name: string;
  latency_ms: number;
};

function formatUsagePeriod(startIso: string, endIso: string, locale: Locale): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const formatter = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function usageBarColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-[#4636D7]";
}

function formatNumber(value: number, locale: Locale): string {
  return value.toLocaleString(locale === "th" ? "th-TH" : "en-US");
}

export function AiSettings() {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const numberLocale = locale === "th" ? "th-TH" : "en-US";

  const [settings, setSettings] = useState<AiSettingsData>({
    inProgressAlertMinutes: 10,
    enableAiSuggest: true,
    enableHybridAutoDraft: true,
    enableAiScenarios: true,
    aiProvider: "gemini",
    aiAgentGender: "FEMALE",
    enableAiAutoReply: false,
    aiAutoReplyMode: "OFF_HOURS_ONLY",
    aiAutoReplyBusinessHourStart: 8,
    aiAutoReplyBusinessHourEnd: 23,
    aiAutoReplyInstructions: null,
    aiEscalationKeywords: [],
    aiAutoReplyConfidenceThreshold: 0.80,
    aiPolicyBlockedTopics: [],
    aiGuardrailNoticeAt: null
  });
  const [escalationKeywordsText, setEscalationKeywordsText] = useState("");
  const [policyTopicsText, setPolicyTopicsText] = useState("");
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplateData | null>(null);
  const [usage, setUsage] = useState<AiUsageData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const [sampleMessage, setSampleMessage] = useState<string>(t.aiDefaultSampleMessage);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);

  const placeholderItems = useMemo(
    () => [
      { token: "{{agent_gender_instruction}}", description: t.aiPlaceholderAgentGender },
      { token: "{{customer_name}}", description: t.aiPlaceholderCustomerName },
      { token: "{{tags}}", description: t.aiPlaceholderTags },
      { token: "{{notes}}", description: t.aiPlaceholderNotes },
      { token: "{{knowledge_context}}", description: t.aiPlaceholderKnowledge },
      { token: "{{scenario_instructions}}", description: t.aiPlaceholderScenario },
      { token: "{{conversation_history}}", description: t.aiPlaceholderHistory },
      { token: "{{current_draft}}", description: t.aiPlaceholderDraft }
    ],
    [t]
  );

  useEffect(() => {
    setSampleMessage((current) =>
      current === getMessages("th").aiDefaultSampleMessage ||
      current === getMessages("en").aiDefaultSampleMessage
        ? t.aiDefaultSampleMessage
        : current
    );
  }, [t.aiDefaultSampleMessage]);

  const loadUsage = useCallback(async () => {
    try {
      const usageData = await apiFetch<AiUsageData>("/api/v1/inbox/ai-usage");
      setUsage(usageData);
    } catch {
      setUsage(null);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        const [settingsData, templateData, usageData] = await Promise.all([
          apiFetch<AiSettingsData>("/api/v1/inbox/settings"),
          apiFetch<PromptTemplateData>("/api/v1/inbox/prompt-templates/suggested-reply"),
          apiFetch<AiUsageData>("/api/v1/inbox/ai-usage").catch(() => null)
        ]);

        if (isCurrent) {
          setSettings(settingsData);
          setEscalationKeywordsText(settingsData.aiEscalationKeywords.join(", "));
          setPolicyTopicsText((settingsData.aiPolicyBlockedTopics ?? []).join(", "));
          setPromptTemplate(templateData);
          setUsage(usageData);
        }
      } catch (err) {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : t.aiSettingsLoadError);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }
    void loadData();
    return () => {
      isCurrent = false;
    };
  }, [t.aiSettingsLoadError]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch<AiSettingsData>("/api/v1/inbox/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inProgressAlertMinutes: settings.inProgressAlertMinutes,
          enableAiSuggest: settings.enableAiSuggest,
          enableHybridAutoDraft: settings.enableHybridAutoDraft,
          enableAiScenarios: settings.enableAiScenarios,
          aiProvider: settings.aiProvider,
          aiAgentGender: settings.aiAgentGender,
          enableAiAutoReply: settings.enableAiAutoReply,
          aiAutoReplyMode: settings.aiAutoReplyMode,
          aiAutoReplyBusinessHourStart: settings.aiAutoReplyBusinessHourStart,
          aiAutoReplyBusinessHourEnd: settings.aiAutoReplyBusinessHourEnd,
          aiAutoReplyInstructions: settings.aiAutoReplyInstructions,
          aiAutoReplyConfidenceThreshold: settings.aiAutoReplyConfidenceThreshold,
          aiEscalationKeywords: escalationKeywordsText
            .split(",")
            .map((keyword) => keyword.trim())
            .filter(Boolean),
          aiPolicyBlockedTopics: policyTopicsText
            .split(",")
            .map((topic) => topic.trim())
            .filter(Boolean)
        })
      });

      if (promptTemplate) {
        await apiFetch<PromptTemplateData>("/api/v1/inbox/prompt-templates/suggested-reply", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt: promptTemplate.systemPrompt
          })
        });
      }

      await loadUsage();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.aiSettingsSaveError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestAi() {
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const result = await apiFetch<AiTestResult>("/api/v1/inbox/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sample_message: sampleMessage.trim() || t.aiDefaultSampleMessage
        })
      });
      setTestResult(result);
      await loadUsage();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : t.aiTestFailed);
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4636D7] border-t-transparent"></div>
        <p className="text-sm text-[#767A8C]">{t.aiSettingsLoading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600">
          ❌ {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-600">
          ✓ {t.aiSettingsSaveSuccess}
        </div>
      )}

      {usage && (
        <div className="rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">{t.aiMonthlyQuota}</p>
              <p className="mt-1 text-2xl font-semibold text-[#16182B]">
                {formatNumber(usage.used, locale)}
                <span className="text-base font-medium text-[#767A8C]">
                  {" "}
                  / {formatNumber(usage.limit, locale)} {t.aiTimesUnit}
                </span>
              </p>
              <p className="mt-1 text-xs text-[#767A8C]">
                {t.aiRemainingQuota.replace("{remaining}", formatNumber(usage.remaining, locale))} ·{" "}
                {formatUsagePeriod(usage.periodStart, usage.periodEnd, locale)}
              </p>
            </div>
            <div className="rounded-lg bg-[#F6F5FA] px-3 py-2 text-right">
              <p className="text-xs text-[#767A8C]">{t.aiCurrentProvider}</p>
              <p className="text-sm font-semibold text-[#16182B]">{usage.providerLabel}</p>
              <p className="text-xs text-[#767A8C]">{usage.modelName}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-[#767A8C]">
              <span>{t.aiUsedPercent.replace("{percent}", String(usage.percentage))}</span>
              <span>{t.aiPlanBadge.replace("{plan}", usage.planId.toUpperCase())}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#ECEBFF]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${usageBarColor(usage.percentage)}`}
                style={{ width: `${Math.min(100, usage.percentage)}%` }}
              />
            </div>
            {!usage.creditsAvailable && (
              <p className="mt-2 text-xs font-medium text-red-600">
                {getAiCreditStatusMessage(usage.blockReason, locale) ?? t.aiCreditsUnavailable}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <div className="flex items-center justify-between border-b border-[#F5F4F7] pb-3 mb-3">
              <span className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">
                {t.aiSuggestedReplySystem}
              </span>
              <div className="rounded-lg bg-[#ECEBFF] p-2 text-[#4636D7]">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-semibold text-[#16182B]">{t.aiEnableSuggestedReply}</span>
              <ToggleSwitch
                checked={settings.enableAiSuggest}
                onChange={(val) => setSettings({ ...settings, enableAiSuggest: val })}
              />
            </div>
          </div>
          <p className="text-xs text-[#767A8C] leading-relaxed">{t.aiSuggestedReplyHint}</p>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <div className="flex items-center justify-between border-b border-[#F5F4F7] pb-3 mb-3">
              <span className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">
                {t.aiHybridAutoDraftSystem}
              </span>
              <div className="rounded-lg bg-[#ECEBFF] p-2 text-[#4636D7]">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-semibold text-[#16182B]">{t.aiEnableHybridAutoDraft}</span>
              <ToggleSwitch
                checked={settings.enableHybridAutoDraft}
                onChange={(val) => setSettings({ ...settings, enableHybridAutoDraft: val })}
              />
            </div>
          </div>
          <p className="text-xs text-[#767A8C] leading-relaxed">{t.aiHybridAutoDraftHint}</p>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <div className="flex items-center justify-between border-b border-[#F5F4F7] pb-3 mb-3">
              <span className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">
                {t.aiScenarioEngineSystem}
              </span>
              <div className="rounded-lg bg-[#ECEBFF] p-2 text-[#4636D7]">
                <GitBranch size={16} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-semibold text-[#16182B]">{t.aiEnableScenarioEngine}</span>
              <ToggleSwitch
                checked={settings.enableAiScenarios}
                onChange={(val) => setSettings({ ...settings, enableAiScenarios: val })}
              />
            </div>
          </div>
          <p className="text-xs text-[#767A8C] leading-relaxed">{t.aiScenarioEngineHint}</p>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <div className="flex items-center justify-between border-b border-[#F5F4F7] pb-3 mb-3">
              <span className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">
                {t.aiLlmProvider}
              </span>
              <div className="rounded-lg bg-[#ECEBFF] p-2 text-[#4636D7]">
                <Cpu size={16} />
              </div>
            </div>
            <select
              value={settings.aiProvider}
              onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}
              className="w-full mt-2 rounded-lg border border-[#DEDDE6] bg-white p-2.5 text-sm font-medium text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7] cursor-pointer"
            >
              <option value="gemini">{t.aiProviderGemini}</option>
              <option value="openai">{t.aiProviderOpenai}</option>
              <option value="claude">{t.aiProviderClaude}</option>
            </select>
          </div>
          <p className="text-xs text-[#767A8C] leading-relaxed">{t.aiLlmProviderHint}</p>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <div className="flex items-center justify-between border-b border-[#F5F4F7] pb-3 mb-3">
              <span className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">
                {t.aiAgentGender}
              </span>
              <div className="rounded-lg bg-[#ECEBFF] p-2 text-[#4636D7]">
                <User size={16} />
              </div>
            </div>
            <select
              value={settings.aiAgentGender}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aiAgentGender: e.target.value as AiSettingsData["aiAgentGender"]
                })
              }
              className="w-full mt-2 rounded-lg border border-[#DEDDE6] bg-white p-2.5 text-sm font-medium text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7] cursor-pointer"
            >
              <option value="FEMALE">{t.aiGenderFemale}</option>
              <option value="MALE">{t.aiGenderMale}</option>
            </select>
          </div>
          <p className="text-xs text-[#767A8C] leading-relaxed">{t.aiAgentGenderHint}</p>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <div className="flex items-center justify-between border-b border-[#F5F4F7] pb-3 mb-3">
              <span className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">
                {t.aiSlowReplyAlert}
              </span>
              <div className="rounded-lg bg-[#ECEBFF] p-2 text-[#4636D7]">
                <Clock size={16} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={1}
                max={1440}
                value={settings.inProgressAlertMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inProgressAlertMinutes: Math.max(1, parseInt(e.target.value) || 1)
                  })
                }
                className="w-24 rounded-lg border border-[#DEDDE6] p-2 text-sm font-semibold text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
              />
              <span className="text-sm font-semibold text-[#16182B]">{t.aiMinutesUnit}</span>
            </div>
          </div>
          <p className="text-xs text-[#767A8C] leading-relaxed">{t.aiSlowReplyHint}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#F5F4F7] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[#ECEBFF] p-2 text-[#4636D7]">
                <MessageCircle size={16} />
              </div>
              <h3 className="text-sm font-bold text-[#16182B]">{t.aiAutoReplySectionTitle}</h3>
            </div>
            <p className="mt-2 text-xs text-[#767A8C] leading-relaxed">{t.aiAutoReplySectionHint}</p>
          </div>
          <ToggleSwitch
            checked={settings.enableAiAutoReply}
            onChange={(val) => setSettings({ ...settings, enableAiAutoReply: val })}
          />
        </div>

        {settings.aiGuardrailNoticeAt && !settings.enableAiAutoReply ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            {t.aiGuardrailNotice}
          </div>
        ) : null}

        {settings.enableAiAutoReply && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {t.aiAutoReplyWarning}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="ai-auto-reply-mode" className="text-sm font-semibold text-[#16182B]">
              {t.aiAutoReplyMode}
            </label>
            <select
              id="ai-auto-reply-mode"
              value={settings.aiAutoReplyMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aiAutoReplyMode: e.target.value as AiAutoReplyMode
                })
              }
              className="mt-2 w-full rounded-lg border border-[#DEDDE6] bg-white p-2.5 text-sm font-medium text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
            >
              <option value="OFF_HOURS_ONLY">{t.aiAutoReplyModeOffHours}</option>
              <option value="WHEN_UNASSIGNED">{t.aiAutoReplyModeWhenUnassigned}</option>
              <option value="ALWAYS">{t.aiAutoReplyModeAlways}</option>
              <option value="OFF">{t.aiAutoReplyModeOff}</option>
            </select>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#16182B]">{t.aiAutoReplyBusinessHours}</p>
            <p className="mt-1 text-xs text-[#767A8C]">{t.aiAutoReplyBusinessHoursHint}</p>
            <div className="mt-2 flex items-center gap-3">
              <div>
                <label htmlFor="ai-hour-start" className="text-xs text-[#767A8C]">
                  {t.aiAutoReplyHourStart}
                </label>
                <input
                  id="ai-hour-start"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.aiAutoReplyBusinessHourStart}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiAutoReplyBusinessHourStart: Math.min(
                        23,
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    })
                  }
                  className="mt-1 w-20 rounded-lg border border-[#DEDDE6] p-2 text-sm font-semibold text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
                />
              </div>
              <span className="pt-5 text-sm text-[#767A8C]">–</span>
              <div>
                <label htmlFor="ai-hour-end" className="text-xs text-[#767A8C]">
                  {t.aiAutoReplyHourEnd}
                </label>
                <input
                  id="ai-hour-end"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.aiAutoReplyBusinessHourEnd}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiAutoReplyBusinessHourEnd: Math.min(
                        23,
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    })
                  }
                  className="mt-1 w-20 rounded-lg border border-[#DEDDE6] p-2 text-sm font-semibold text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="ai-escalation-keywords" className="text-sm font-semibold text-[#16182B]">
            {t.aiEscalationKeywords}
          </label>
          <p className="mt-1 text-xs text-[#767A8C]">{t.aiEscalationKeywordsHint}</p>
          <input
            id="ai-escalation-keywords"
            type="text"
            value={escalationKeywordsText}
            onChange={(e) => setEscalationKeywordsText(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[#DEDDE6] p-3 text-sm text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
            placeholder="แอดมิน, คุยกับคน, โทรหา"
          />
        </div>

        <div>
          <label htmlFor="ai-policy-topics" className="text-sm font-semibold text-[#16182B]">
            {t.aiPolicyBlockedTopics}
          </label>
          <p className="mt-1 text-xs text-[#767A8C]">{t.aiPolicyBlockedTopicsHint}</p>
          <input
            id="ai-policy-topics"
            type="text"
            value={policyTopicsText}
            onChange={(e) => setPolicyTopicsText(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[#DEDDE6] p-3 text-sm text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
            placeholder="ราคา, ส่วนลด, refund"
          />
        </div>

        <div>
          <label htmlFor="ai-confidence-threshold" className="text-sm font-semibold text-[#16182B] flex items-center justify-between">
            <span>{t.aiConfidenceThreshold}</span>
            <span className="font-bold text-[#4636D7]">
              {Math.round((settings.aiAutoReplyConfidenceThreshold ?? 0.80) * 100)}%
            </span>
          </label>
          <p className="mt-1 text-xs text-[#767A8C]">{t.aiConfidenceThresholdHint}</p>
          <div className="mt-3 flex items-center gap-4">
            <input
              id="ai-confidence-threshold"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round((settings.aiAutoReplyConfidenceThreshold ?? 0.80) * 100)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  aiAutoReplyConfidenceThreshold: parseFloat(e.target.value) / 100
                })
              }
              className="w-full h-1.5 bg-[#ECEBFF] rounded-lg appearance-none cursor-pointer accent-[#4636D7]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ai-auto-reply-instructions" className="text-sm font-semibold text-[#16182B]">
            {t.aiAutoReplyInstructions}
          </label>
          <p className="mt-1 text-xs text-[#767A8C]">{t.aiAutoReplyInstructionsHint}</p>
          <textarea
            id="ai-auto-reply-instructions"
            rows={4}
            value={settings.aiAutoReplyInstructions ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                aiAutoReplyInstructions: e.target.value.trim() ? e.target.value : null
              })
            }
            className="mt-2 w-full rounded-lg border border-[#DEDDE6] p-3 text-sm text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-4">
          <label className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">
            {t.aiTestSectionTitle}
          </label>
          <p className="text-xs text-[#767A8C]">{t.aiTestSectionHint}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="ai-sample-message" className="text-sm font-semibold text-[#16182B]">
              {t.aiSampleMessageLabel}
            </label>
            <textarea
              id="ai-sample-message"
              rows={3}
              value={sampleMessage}
              onChange={(e) => setSampleMessage(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[#DEDDE6] p-3 text-sm text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
              placeholder={t.aiDefaultSampleMessage}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={isTesting || !settings.enableAiSuggest || usage?.creditsAvailable === false}
              onClick={handleTestAi}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#16182B] px-5 text-sm font-semibold text-white hover:bg-[#2A2D45] transition-all duration-200 cursor-pointer disabled:bg-slate-300"
            >
              {isTesting ? `⏳ ${t.aiTesting}` : `🧪 ${t.aiTestButton}`}
            </Button>
            {!settings.enableAiSuggest && (
              <p className="text-xs text-amber-700">{t.aiEnableBeforeTest}</p>
            )}
            {usage?.creditsAvailable === false && (
              <p className="text-xs text-red-600">
                {getAiCreditStatusMessage(usage.blockReason, locale) ?? t.aiTestCreditsUnavailable}
              </p>
            )}
          </div>

          {testError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {testError}
            </div>
          )}

          {testResult && (
            <div className="rounded-lg border border-[#DEDDE6] bg-[#F9F9FB] p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#767A8C]">
                <span className="rounded-full bg-[#ECEBFF] px-2 py-0.5 font-semibold text-[#4636D7]">
                  {testResult.provider_label}
                </span>
                <span>{testResult.model_name}</span>
                <span>·</span>
                <span>{testResult.latency_ms.toLocaleString(numberLocale)} ms</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#767A8C] mb-1">
                  {t.aiDraftedReply}
                </p>
                <p className="text-sm leading-relaxed text-[#16182B] whitespace-pre-wrap">
                  {testResult.suggestion_text}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {promptTemplate && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#DEDDE6]/60 pb-3 mb-3">
            <div>
              <label className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">
                {t.aiSystemPromptTitle}
              </label>
              <p className="text-xs text-[#767A8C] mt-0.5">{t.aiSystemPromptHint}</p>
            </div>
            <span className="rounded-full bg-[#ECEBFF] px-2.5 py-0.5 text-xs font-bold text-[#4636D7]">
              suggested_reply_default
            </span>
          </div>

          <textarea
            rows={12}
            value={promptTemplate.systemPrompt}
            onChange={(e) => setPromptTemplate({ ...promptTemplate, systemPrompt: e.target.value })}
            className="w-full rounded-lg border border-[#DEDDE6] p-3 text-sm text-[#16182B] font-mono focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7] bg-[#F9F9FB]"
          />

          <div className="mt-4 rounded-lg bg-[#ECEBFF]/40 border border-[#ECEBFF] p-4">
            <h4 className="text-xs font-bold text-[#4636D7] uppercase tracking-wider mb-2">
              {t.aiPlaceholdersTitle}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-[#525770]">
              {placeholderItems.map((item) => (
                <div key={item.token}>
                  <code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">
                    {item.token}
                  </code>
                  : {item.description}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#4636D7] px-8 text-sm font-semibold text-white shadow-md shadow-[#4636D7]/15 hover:bg-[#382BB5] transition-all duration-200 cursor-pointer disabled:bg-slate-300 disabled:shadow-none"
        >
          {isSaving ? `⏳ ${t.saving}` : t.aiSaveSettings}
        </Button>
      </div>
    </div>
  );
}

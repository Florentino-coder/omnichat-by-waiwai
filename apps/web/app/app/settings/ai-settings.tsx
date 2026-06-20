"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { Button } from "@omnichat/ui";
import { getAiCreditStatusMessage, type AiCreditBlockReason } from "../../lib/ai-credit-status";

type AiSettingsData = {
  inProgressAlertMinutes: number;
  enableAiSuggest: boolean;
  aiProvider: string;
  aiAgentGender: "FEMALE" | "MALE";
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

const DEFAULT_SAMPLE_MESSAGE = "สวัสดีครับ มีสินค้าอะไรบ้างคะ";

function formatUsagePeriod(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const formatter = new Intl.DateTimeFormat("th-TH", {
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

export function AiSettings() {
  const [settings, setSettings] = useState<AiSettingsData>({
    inProgressAlertMinutes: 10,
    enableAiSuggest: true,
    aiProvider: "gemini",
    aiAgentGender: "FEMALE"
  });
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplateData | null>(null);
  const [usage, setUsage] = useState<AiUsageData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const [sampleMessage, setSampleMessage] = useState(DEFAULT_SAMPLE_MESSAGE);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);

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
          setPromptTemplate(templateData);
          setUsage(usageData);
        }
      } catch (err) {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : "Failed to load AI settings.");
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
  }, []);

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
          aiProvider: settings.aiProvider,
          aiAgentGender: settings.aiAgentGender
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
      setError(err instanceof Error ? err.message : "Failed to save AI settings.");
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
          sample_message: sampleMessage.trim() || DEFAULT_SAMPLE_MESSAGE
        })
      });
      setTestResult(result);
      await loadUsage();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "AI test failed.");
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4636D7] border-t-transparent"></div>
        <p className="text-sm text-[#767A8C]">กำลังโหลดการตั้งค่า AI...</p>
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
          ✓ บันทึกการตั้งค่า AI สำเร็จแล้ว!
        </div>
      )}

      {usage && (
        <div className="rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">โควต้า AI รายเดือน</p>
              <p className="mt-1 text-2xl font-semibold text-[#16182B]">
                {usage.used.toLocaleString("th-TH")}
                <span className="text-base font-medium text-[#767A8C]"> / {usage.limit.toLocaleString("th-TH")} ครั้ง</span>
              </p>
              <p className="mt-1 text-xs text-[#767A8C]">
                เหลือ {usage.remaining.toLocaleString("th-TH")} ครั้ง · {formatUsagePeriod(usage.periodStart, usage.periodEnd)}
              </p>
            </div>
            <div className="rounded-lg bg-[#F6F5FA] px-3 py-2 text-right">
              <p className="text-xs text-[#767A8C]">Provider ปัจจุบัน</p>
              <p className="text-sm font-semibold text-[#16182B]">{usage.providerLabel}</p>
              <p className="text-xs text-[#767A8C]">{usage.modelName}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-[#767A8C]">
              <span>ใช้ไป {usage.percentage}%</span>
              <span>แผน {usage.planId.toUpperCase()}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#ECEBFF]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${usageBarColor(usage.percentage)}`}
                style={{ width: `${Math.min(100, usage.percentage)}%` }}
              />
            </div>
            {!usage.creditsAvailable && (
              <p className="mt-2 text-xs font-medium text-red-600">
                {getAiCreditStatusMessage(usage.blockReason) ??
                  "โควต้า AI ไม่พร้อมใช้งาน ติดต่อผู้ดูแลระบบ"}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col gap-2 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
          <label className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">ระบบร่างคำตอบอัจฉริยะ</label>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-semibold text-[#16182B]">เปิดใช้งาน AI Suggested Reply</span>
            <input
              type="checkbox"
              checked={settings.enableAiSuggest}
              onChange={(e) => setSettings({ ...settings, enableAiSuggest: e.target.checked })}
              className="h-5 w-5 rounded border-[#DEDDE6] text-[#4636D7] focus:ring-[#4636D7] cursor-pointer"
            />
          </div>
          <p className="text-xs text-[#767A8C] mt-2">
            เปิดหรือปิดการแสดงปุ่ม "✨ AI ร่างคำตอบ" ในหน้าแชทของตัวแทน
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
          <label className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">ผู้ให้บริการโมเดล AI (LLM)</label>
          <select
            value={settings.aiProvider}
            onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}
            className="w-full mt-2 rounded-lg border border-[#DEDDE6] bg-white p-2.5 text-sm font-medium text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
          >
            <option value="gemini">Google Gemini (เสถียรที่สุด)</option>
            <option value="openai">OpenAI GPT</option>
            <option value="claude">Anthropic Claude</option>
          </select>
          <p className="text-xs text-[#767A8C] mt-2">
            โมเดลประมวลผลสำหรับสร้างคำตอบร่าง (ดึงค่าจาก API Key ของส่วนกลางหลังบ้าน)
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
          <label className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">เพศของแอดมิน (คำลงท้าย)</label>
          <select
            value={settings.aiAgentGender}
            onChange={(e) =>
              setSettings({
                ...settings,
                aiAgentGender: e.target.value as AiSettingsData["aiAgentGender"]
              })
            }
            className="w-full mt-2 rounded-lg border border-[#DEDDE6] bg-white p-2.5 text-sm font-medium text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
          >
            <option value="FEMALE">ผู้หญิง (ค่ะ / นะคะ)</option>
            <option value="MALE">ผู้ชาย (ครับ / นะครับ)</option>
          </select>
          <p className="text-xs text-[#767A8C] mt-2">
            AI จะใช้คำลงท้ายตามเพศนี้เท่านั้น ไม่สร้างแบบ ค่ะ/ครับ
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
          <label className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">เวลาเตือนตอบแชทช้า</label>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min={1}
              max={1440}
              value={settings.inProgressAlertMinutes}
              onChange={(e) => setSettings({ ...settings, inProgressAlertMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-24 rounded-lg border border-[#DEDDE6] p-2 text-sm font-semibold text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
            />
            <span className="text-sm font-semibold text-[#16182B]">นาที</span>
          </div>
          <p className="text-xs text-[#767A8C] mt-2">
            เวลาสูงสุดก่อนระบุว่าแชทที่กำลังดำเนินการอยู่นั้นตอบช้าเกินเกณฑ์ (Overdue SLA)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-4">
          <label className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">ทดสอบ AI ก่อนใช้งานจริง</label>
          <p className="text-xs text-[#767A8C]">
            ส่งข้อความตัวอย่างไปยัง LLM ด้วย prompt และเพศแอดมินที่ตั้งไว้ (นับโควต้า 1 ครั้ง)
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="ai-sample-message" className="text-sm font-semibold text-[#16182B]">
              ข้อความลูกค้าตัวอย่าง
            </label>
            <textarea
              id="ai-sample-message"
              rows={3}
              value={sampleMessage}
              onChange={(e) => setSampleMessage(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[#DEDDE6] p-3 text-sm text-[#16182B] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7]"
              placeholder={DEFAULT_SAMPLE_MESSAGE}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={isTesting || !settings.enableAiSuggest || usage?.creditsAvailable === false}
              onClick={handleTestAi}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#16182B] px-5 text-sm font-semibold text-white hover:bg-[#2A2D45] transition-all duration-200 cursor-pointer disabled:bg-slate-300"
            >
              {isTesting ? "⏳ กำลังทดสอบ..." : "🧪 ทดสอบ AI"}
            </Button>
            {!settings.enableAiSuggest && (
              <p className="text-xs text-amber-700">เปิด AI Suggested Reply ก่อนทดสอบ</p>
            )}
            {usage?.creditsAvailable === false && (
              <p className="text-xs text-red-600">
                {getAiCreditStatusMessage(usage.blockReason) ?? "โควต้า AI ไม่พร้อมใช้งาน ไม่สามารถทดสอบได้"}
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
                <span>{testResult.latency_ms.toLocaleString("th-TH")} ms</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#767A8C] mb-1">คำตอบที่ AI ร่าง</p>
                <p className="text-sm leading-relaxed text-[#16182B] whitespace-pre-wrap">{testResult.suggestion_text}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {promptTemplate && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#DEDDE6]/60 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#DEDDE6]/60 pb-3 mb-3">
            <div>
              <label className="text-xs font-bold text-[#767A8C] uppercase tracking-wider">AI System Instruction Template</label>
              <p className="text-xs text-[#767A8C] mt-0.5">
                ปรับแต่งคำสั่งเริ่มต้นของระบบ AI สำหรับจัดหมวดหมู่และเรียบเรียงคำตอบ
              </p>
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
            <h4 className="text-xs font-bold text-[#4636D7] uppercase tracking-wider mb-2">ตัวแปรข้อความ (Placeholders) ที่รองรับ:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-[#525770]">
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{agent_gender_instruction}}"}</code>: กฎคำลงท้ายตามเพศแอดมิน</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{customer_name}}"}</code>: ชื่อลูกค้าปัจจุบัน</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{tags}}"}</code>: รายการแท็กของลูกค้า</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{notes}}"}</code>: โน้ตภายในของลูกค้า</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{knowledge_context}}"}</code>: ข้อมูลจาก Knowledge Base</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{scenario_instructions}}"}</code>: คำสั่งจาก AI Scenario ที่ match</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{conversation_history}}"}</code>: ประวัติแชทล่าสุด</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{current_draft}}"}</code>: ข้อความที่พึ่งพิมพ์ร่างอยู่</div>
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
          {isSaving ? "⏳ กำลังบันทึก..." : "บันทึกการตั้งค่า AI"}
        </Button>
      </div>
    </div>
  );
}

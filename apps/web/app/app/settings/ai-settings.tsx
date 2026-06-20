"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { Button } from "@omnichat/ui";

type AiSettingsData = {
  inProgressAlertMinutes: number;
  enableAiSuggest: boolean;
  aiProvider: string;
};

type PromptTemplateData = {
  id: string;
  name: string;
  systemPrompt: string;
};

export function AiSettings() {
  const [settings, setSettings] = useState<AiSettingsData>({
    inProgressAlertMinutes: 10,
    enableAiSuggest: true,
    aiProvider: "gemini"
  });
  const [promptTemplate, setPromptTemplate] = useState<PromptTemplateData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    let isCurrent = true;
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        const [settingsData, templateData] = await Promise.all([
          apiFetch<AiSettingsData>("/api/v1/inbox/settings"),
          apiFetch<PromptTemplateData>("/api/v1/inbox/prompt-templates/suggested-reply")
        ]);

        if (isCurrent) {
          setSettings(settingsData);
          setPromptTemplate(templateData);
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
      // 1. Save settings
      await apiFetch<AiSettingsData>("/api/v1/inbox/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inProgressAlertMinutes: settings.inProgressAlertMinutes,
          enableAiSuggest: settings.enableAiSuggest,
          aiProvider: settings.aiProvider
        })
      });

      // 2. Save prompt template if available
      if (promptTemplate) {
        await apiFetch<PromptTemplateData>("/api/v1/inbox/prompt-templates/suggested-reply", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt: promptTemplate.systemPrompt
          })
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save AI settings.");
    } finally {
      setIsSaving(false);
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
      {/* Alert States */}
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

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Toggle AI suggestions */}
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

        {/* LLM Provider selection */}
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

        {/* inProgressAlertMinutes */}
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

      {/* Prompt Template editor */}
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

          {/* Placeholders helper card */}
          <div className="mt-4 rounded-lg bg-[#ECEBFF]/40 border border-[#ECEBFF] p-4">
            <h4 className="text-xs font-bold text-[#4636D7] uppercase tracking-wider mb-2">ตัวแปรข้อความ (Placeholders) ที่รองรับ:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-[#525770]">
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{customer_name}}"}</code>: ชื่อลูกค้าปัจจุบัน</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{tags}}"}</code>: รายการแท็กของลูกค้า</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{notes}}"}</code>: โน้ตภายในของลูกค้า</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{conversation_history}}"}</code>: ประวัติแชทล่าสุด</div>
              <div><code className="bg-white px-1.5 py-0.5 rounded border border-[#DEDDE6] font-mono text-[#4636D7] font-semibold">{"{{current_draft}}"}</code>: ข้อความที่พึ่งพิมพ์ร่างอยู่</div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input } from "@omnichat/ui";
import { AlertTriangle, ClipboardCheck, Download, ExternalLink, Loader2 } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";

type QaScoreRow = {
  id: string;
  conversationId: string;
  relevanceScore: number;
  toneScore: number;
  hallucinationScore: number;
  overallScore: number;
  reviewNote: string | null;
  createdAt: string;
  conversation: {
    id: string;
    customerDisplayName: string | null;
  };
};

type ComplianceSummary = {
  policyBlocks: number;
  escalations: number;
  guardrailEvents: number;
  lowQaScores: number;
  qaSampleCount: number;
  aiAutoReplyEnabled: boolean;
  guardrailNoticeAt: string | null;
  from: string;
  to: string;
};

export default function QaCenterPage() {
  const { locale } = useLanguage();
  const t =
    locale === "th"
      ? {
          title: "ศูนย์ QA",
          subtitle: "ตรวจสอบคะแนนคุณภาพ AI และเหตุการณ์ compliance",
          range7d: "7 วัน",
          range30d: "30 วัน",
          compliance: "สรุป Compliance",
          policyBlocks: "ถูกบล็อกนโยบาย",
          escalations: "Escalate",
          lowScores: "คะแนนต่ำ (<3)",
          guardrail: "Guardrail ปิด auto-reply",
          samples: "ตัวอย่าง QA",
          export: "ส่งออก CSV",
          auditLink: "ดู audit log (AI)",
          tableDate: "วันที่",
          tableCustomer: "ลูกค้า",
          tableOverall: "คะแนนรวม",
          tableScores: "R / T / H",
          tableReview: "บันทึก QC",
          tableAction: "แชท",
          openInbox: "เปิดแชท",
          saveReview: "บันทึก",
          loading: "กำลังโหลด...",
          empty: "ยังไม่มีคะแนน QA ในช่วงเวลานี้",
          guardrailBanner:
            "AI ตอบอัตโนมัติถูกปิดโดย guardrail เนื่องจากคะแนน QA ต่ำต่อเนื่อง — เปิดใช้งานใหม่ได้ที่ตั้งค่า AI",
          minScore: "คะแนนขั้นต่ำ"
        }
      : {
          title: "QA Center",
          subtitle: "Review AI quality scores and compliance events",
          range7d: "7 days",
          range30d: "30 days",
          compliance: "Compliance summary",
          policyBlocks: "Policy blocks",
          escalations: "Escalations",
          lowScores: "Low scores (<3)",
          guardrail: "Guardrail disables",
          samples: "QA samples",
          samplesLabel: "QA samples",
          export: "Export CSV",
          auditLink: "View AI audit log",
          tableDate: "Date",
          tableCustomer: "Customer",
          tableOverall: "Overall",
          tableScores: "R / T / H",
          tableReview: "QC note",
          tableAction: "Chat",
          openInbox: "Open chat",
          saveReview: "Save",
          loading: "Loading...",
          empty: "No QA scores in this period",
          guardrailBanner:
            "AI auto-reply was disabled by guardrail due to sustained low QA scores — re-enable in AI settings",
          minScore: "Min score"
        };

  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [scores, setScores] = useState<QaScoreRow[]>([]);
  const [compliance, setCompliance] = useState<ComplianceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const dateRange = useCallback(() => {
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - (range === "7d" ? 7 : 30));
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10)
    };
  }, [range]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const { from, to } = dateRange();
    try {
      const [scoresRes, complianceRes] = await Promise.all([
        apiFetch<QaScoreRow[]>(`/api/v1/qa/scores?from=${from}&to=${to}&limit=100`),
        apiFetch<ComplianceSummary>(`/api/v1/qa/compliance-summary?from=${from}&to=${to}`)
      ]);
      setScores(scoresRes ?? []);
      setCompliance(complianceRes ?? null);
      setReviewDrafts(
        Object.fromEntries((scoresRes ?? []).map((row) => [row.id, row.reviewNote ?? ""]))
      );
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveReview(scoreId: string) {
    setSavingId(scoreId);
    try {
      await apiFetch(`/api/v1/qa/scores/${scoreId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: reviewDrafts[scoreId] || null })
      });
      await loadData();
    } finally {
      setSavingId(null);
    }
  }

  async function exportCsv() {
    const { from, to } = dateRange();
    window.open(`/api/v1/qa/compliance-export?from=${from}&to=${to}`, "_blank");
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F7F7FA] p-4 sm:p-6 md:p-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-bold text-[#16182B]">{t.title}</h1>
          <p className="mt-1 text-sm text-[#767A8C]">{t.subtitle}</p>
        </header>

        {compliance?.guardrailNoticeAt && !compliance.aiAutoReplyEnabled ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p>{t.guardrailBanner}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={range === "7d" ? "primary" : "secondary"}
            onClick={() => setRange("7d")}
          >
            {t.range7d}
          </Button>
          <Button
            variant={range === "30d" ? "primary" : "secondary"}
            onClick={() => setRange("30d")}
          >
            {t.range30d}
          </Button>
          <Link
            href="/app/settings/audit-logs?category=ai"
            className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-[#4636D7] hover:underline"
          >
            {t.auditLink}
            <ExternalLink size={14} />
          </Link>
          <Button variant="secondary" onClick={() => void exportCsv()}>
            <Download size={16} className="mr-2" />
            {t.export}
          </Button>
        </div>

        {compliance ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {[
              { label: t.policyBlocks, value: compliance.policyBlocks },
              { label: t.escalations, value: compliance.escalations },
              { label: t.lowScores, value: compliance.lowQaScores },
              { label: t.guardrail, value: compliance.guardrailEvents },
              { label: t.samples, value: compliance.qaSampleCount }
            ].map((card) => (
              <Card key={card.label} className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#767A8C]">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-[#16182B]">{card.value}</p>
              </Card>
            ))}
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ClipboardCheck size={18} className="text-[#4636D7]" />
            <h2 className="text-sm font-bold text-[#16182B]">{t.samples}</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-[#767A8C]">
              <Loader2 className="animate-spin" size={18} />
              {t.loading}
            </div>
          ) : scores.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#767A8C]">{t.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#F6F5FA] text-left text-xs uppercase tracking-wide text-[#767A8C]">
                  <tr>
                    <th className="px-4 py-3">{t.tableDate}</th>
                    <th className="px-4 py-3">{t.tableCustomer}</th>
                    <th className="px-4 py-3">{t.tableOverall}</th>
                    <th className="px-4 py-3">{t.tableScores}</th>
                    <th className="px-4 py-3">{t.tableReview}</th>
                    <th className="px-4 py-3">{t.tableAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString(
                          locale === "th" ? "th-TH" : "en-US"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.conversation.customerDisplayName ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <span
                          className={
                            row.overallScore < 3 ? "text-red-600" : "text-[#16182B]"
                          }
                        >
                          {row.overallScore.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#767A8C]">
                        {row.relevanceScore}/{row.toneScore}/{row.hallucinationScore}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Input
                            value={reviewDrafts[row.id] ?? ""}
                            onChange={(e) =>
                              setReviewDrafts((prev) => ({
                                ...prev,
                                [row.id]: e.target.value
                              }))
                            }
                            className="min-w-[160px]"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={savingId === row.id}
                            onClick={() => void saveReview(row.id)}
                          >
                            {t.saveReview}
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/inbox?conversationId=${row.conversationId}`}
                          className="font-semibold text-[#4636D7] hover:underline"
                        >
                          {t.openInbox}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

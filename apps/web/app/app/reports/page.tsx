"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Label } from "@omnichat/ui";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  MessageSquare,
  MessageCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";

interface SummaryData {
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
}

interface VolumePoint {
  date: string;
  inbound: number;
  outbound: number;
}

interface TagPoint {
  name: string;
  color: string;
  count: number;
}

interface WorkloadPoint {
  agentName: string;
  count: number;
}

interface ChartsData {
  dailyMessageVolume: VolumePoint[];
  tagDistribution: TagPoint[];
  agentWorkload: WorkloadPoint[];
}

interface AiSummaryData {
  autoReplySent: number;
  autoReplyEscalated: number;
  automationAiReplySent: number;
  skippedByReason: Record<string, number>;
  aiCreditsUsed: number;
}

interface AiQaSummaryData {
  sampleCount: number;
  avgRelevance: number | null;
  avgTone: number | null;
  avgHallucination: number | null;
  avgOverall: number | null;
}

interface ComplianceSummaryData {
  policyBlocks: number;
  escalations: number;
  guardrailEvents: number;
  lowQaScores: number;
  aiAutoReplyEnabled: boolean;
  guardrailNoticeAt: string | null;
}

export default function ReportsPage() {
  const { locale } = useLanguage();
  const [range, setRange] = useState<"today" | "7d" | "30d" | "custom">("7d");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [aiSummary, setAiSummary] = useState<AiSummaryData | null>(null);
  const [aiQaSummary, setAiQaSummary] = useState<AiQaSummaryData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Localization Dictionary
  const t = {
    th: {
      title: "รายงานผลประกอบการ",
      subtitle: "วิเคราะห์ภาพรวมการทำงาน ปริมาณข้อความ และภาระงานของทีมแอดมิน",
      rangeToday: "วันนี้",
      range7d: "7 วันที่ผ่านมา",
      range30d: "30 วันที่ผ่านมา",
      rangeCustom: "กำหนดเอง",
      from: "จากวันที่",
      to: "ถึงวันที่",
      apply: "ดึงข้อมูล",
      statsTotalConversations: "การสนทนาทั้งหมด",
      statsActiveConversations: "แชทที่กำลังดำเนินการ",
      statsResolvedConversations: "แชทที่จัดการเสร็จสิ้น",
      statsTotalMessages: "ข้อความทั้งหมด",
      statsInbound: "ลูกค้าส่งมา",
      statsOutbound: "แอดมินตอบกลับ",
      chartVolumeTitle: "ปริมาณข้อความรายวัน (Message Volume)",
      chartTagsTitle: "การใช้งานป้ายกำกับ (Tag Distribution)",
      chartWorkloadTitle: "ภาระงานของแอดมิน (Agent Active Chats)",
      noData: "ไม่พบข้อมูลในช่วงเวลาที่เลือก",
      loading: "กำลังโหลดข้อมูล...",
      unassigned: "ยังไม่มีผู้รับผิดชอบ",
      inbound: "ข้อความขาเข้า",
      outbound: "ข้อความขาออก",
      chats: "แชท",
      messages: "ข้อความ",
      aiSectionTitle: "รายงาน AI Auto-Reply",
      aiAutoReplySent: "ตอบอัตโนมัติสำเร็จ",
      aiAutoReplyEscalated: "ส่งต่อแอดมิน",
      aiAutomationReplySent: "Automation AI ตอบ",
      aiCreditsUsed: "เครดิต AI ที่ใช้",
      aiSkippedTitle: "ข้าม (ตามเหตุผล)",
      aiQaTitle: "คุณภาพ AI (QA sampling)",
      aiQaSamples: "ตัวอย่างที่ประเมิน",
      aiQaOverall: "คะแนนเฉลี่ยรวม",
      aiQaRelevance: "ความเกี่ยวข้อง",
      aiQaTone: "น้ำเสียง",
      aiQaHallucination: "ความถูกต้อง",
      complianceTitle: "Compliance AI",
      compliancePolicy: "ถูกบล็อกนโยบาย",
      complianceEscalations: "Escalate",
      complianceLowScores: "คะแนนต่ำ",
      complianceGuardrail: "Guardrail",
      complianceQaLink: "เปิด QA Center",
      guardrailBanner:
        "AI ตอบอัตโนมัติถูกปิดโดย guardrail — เปิดใช้งานใหม่ได้ที่ตั้งค่า AI",
    },
    en: {
      title: "Operational Reports",
      subtitle: "Analyze team performance, message volume, and agent workload.",
      rangeToday: "Today",
      range7d: "Last 7 Days",
      range30d: "Last 30 Days",
      rangeCustom: "Custom Range",
      from: "From Date",
      to: "To Date",
      apply: "Apply",
      statsTotalConversations: "Total Conversations",
      statsActiveConversations: "Active Chats",
      statsResolvedConversations: "Resolved Chats",
      statsTotalMessages: "Total Messages",
      statsInbound: "Inbound Messages",
      statsOutbound: "Outbound Messages",
      chartVolumeTitle: "Daily Message Volume",
      chartTagsTitle: "Tag Distribution",
      chartWorkloadTitle: "Agent Workload (Active)",
      noData: "No data found for selected period",
      loading: "Loading report data...",
      unassigned: "Unassigned",
      inbound: "Inbound Messages",
      outbound: "Outbound Messages",
      chats: "Chats",
      messages: "Messages",
      aiSectionTitle: "AI Auto-Reply Report",
      aiAutoReplySent: "Auto-replies sent",
      aiAutoReplyEscalated: "Escalated to admin",
      aiAutomationReplySent: "Automation AI replies",
      aiCreditsUsed: "AI credits used",
      aiSkippedTitle: "Skipped (by reason)",
      aiQaTitle: "AI quality (QA sampling)",
      aiQaSamples: "Samples scored",
      aiQaOverall: "Overall average",
      aiQaRelevance: "Relevance",
      aiQaTone: "Tone",
      aiQaHallucination: "Factual accuracy",
      complianceTitle: "AI compliance",
      compliancePolicy: "Policy blocks",
      complianceEscalations: "Escalations",
      complianceLowScores: "Low QA scores",
      complianceGuardrail: "Guardrail",
      complianceQaLink: "Open QA Center",
      guardrailBanner:
        "AI auto-reply was disabled by guardrail — re-enable in AI settings",
    },
  }[locale === "th" ? "th" : "en"];

  // Hydration safety
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync range presets
  useEffect(() => {
    if (range === "custom") return;

    const to = new Date();
    const from = new Date();

    if (range === "today") {
      // Keep today
    } else if (range === "7d") {
      from.setDate(to.getDate() - 6);
    } else if (range === "30d") {
      from.setDate(to.getDate() - 29);
    }

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    setFromDate(formatDate(from));
    setToDate(formatDate(to));
  }, [range]);

  // Fetch data on range/date apply
  const fetchData = async () => {
    if (!fromDate || !toDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const [summaryRes, chartsRes, aiSummaryRes, aiQaRes, complianceRes] = await Promise.all([
        apiFetch<SummaryData>(`/api/v1/reporting/summary?from=${fromDate}&to=${toDate}`),
        apiFetch<ChartsData>(`/api/v1/reporting/charts?from=${fromDate}&to=${toDate}`),
        apiFetch<AiSummaryData>(`/api/v1/reporting/ai-summary?from=${fromDate}&to=${toDate}`),
        apiFetch<AiQaSummaryData>(`/api/v1/reporting/ai-qa-summary?from=${fromDate}&to=${toDate}`),
        apiFetch<ComplianceSummaryData>(`/api/v1/qa/compliance-summary?from=${fromDate}&to=${toDate}`),
      ]);
      setSummary(summaryRes);
      setCharts(chartsRes);
      setAiSummary(aiSummaryRes);
      setAiQaSummary(aiQaRes);
      setCompliance(complianceRes);
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch reports data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fromDate && toDate && range !== "custom") {
      fetchData();
    }
  }, [fromDate, toDate]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#F7F7FA] p-8">
        <Card className="max-w-md border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <h3 className="mb-1 font-heading text-lg font-semibold text-red-700">Error Loading Reports</h3>
          <p className="mb-4 text-sm text-[#767A8C]">{error}</p>
          <Button onClick={fetchData} className="bg-[#4636D7] hover:bg-[#3527B3] text-white">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  // Define dynamic colors for tags chart
  const COLORS = ["#4636D7", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#64748B"];

  return (
    <div className="h-full overflow-y-auto bg-[#F7F7FA] p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header & Preset Switcher */}
        <div className="flex flex-col gap-4 border-b border-[#DEDDE6]/60 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#16182B]">
              {t.title}
            </h1>
            <p className="text-sm text-[#767A8C]">{t.subtitle}</p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DEDDE6] bg-white p-1 shadow-sm">
            {(["today", "7d", "30d", "custom"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  range === r
                    ? "bg-[#4636D7] text-white shadow-sm shadow-[#4636D7]/10"
                    : "text-[#767A8C] hover:bg-[#F6F5FA] hover:text-[#16182B]"
                }`}
              >
                {r === "today" ? t.rangeToday : r === "7d" ? t.range7d : r === "30d" ? t.range30d : t.rangeCustom}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Form */}
        {range === "custom" && (
          <Card className="flex flex-wrap items-end gap-4 border border-[#DEDDE6]/80 bg-white p-4 shadow-sm rounded-xl">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from" className="text-xs font-semibold text-[#767A8C]">
                {t.from}
              </Label>
              <Input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40 border-[#DEDDE6] focus:border-[#4636D7] focus:ring-[#4636D7]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to" className="text-xs font-semibold text-[#767A8C]">
                {t.to}
              </Label>
              <Input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40 border-[#DEDDE6] focus:border-[#4636D7] focus:ring-[#4636D7]"
              />
            </div>
            <Button
              onClick={fetchData}
              disabled={isLoading || !fromDate || !toDate}
              className="bg-[#4636D7] hover:bg-[#3527B3] text-white px-5 rounded-lg flex items-center gap-1.5"
            >
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t.apply}
            </Button>
          </Card>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#4636D7]" />
            <span className="ml-2 text-sm text-[#767A8C]">{t.loading}</span>
          </div>
        ) : (
          summary && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Total Chats */}
                <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">
                      {t.statsTotalConversations}
                    </span>
                    <h3 className="text-2xl font-bold text-[#16182B]">
                      {summary.totalConversations} <span className="text-sm font-normal text-[#767A8C]">{t.chats}</span>
                    </h3>
                  </div>
                  <div className="rounded-xl bg-[#ECEBFF] p-3 text-[#4636D7]">
                    <MessageSquare size={20} />
                  </div>
                </Card>

                {/* Active Chats */}
                <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">
                      {t.statsActiveConversations}
                    </span>
                    <h3 className="text-2xl font-bold text-[#10B981]">
                      {summary.activeConversations} <span className="text-sm font-normal text-[#767A8C]">{t.chats}</span>
                    </h3>
                  </div>
                  <div className="rounded-xl bg-[#E6F9F2] p-3 text-[#10B981]">
                    <TrendingUp size={20} />
                  </div>
                </Card>

                {/* Resolved Chats */}
                <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">
                      {t.statsResolvedConversations}
                    </span>
                    <h3 className="text-2xl font-bold text-[#8B5CF6]">
                      {summary.resolvedConversations} <span className="text-sm font-normal text-[#767A8C]">{t.chats}</span>
                    </h3>
                  </div>
                  <div className="rounded-xl bg-[#F5F3FF] p-3 text-[#8B5CF6]">
                    <MessageSquare size={20} />
                  </div>
                </Card>

                {/* Message Volume */}
                <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">
                      {t.statsTotalMessages}
                    </span>
                    <h3 className="text-2xl font-bold text-[#16182B]">
                      {summary.totalMessages} <span className="text-sm font-normal text-[#767A8C]">{t.messages}</span>
                    </h3>
                    <div className="flex gap-2 text-xs text-[#767A8C]">
                      <span>Inbound: {summary.inboundMessages}</span>
                      <span>•</span>
                      <span>Outbound: {summary.outboundMessages}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#E0F2FE] p-3 text-[#0284C7]">
                    <MessageCircle size={20} />
                  </div>
                </Card>
              </div>

              {compliance?.guardrailNoticeAt && !compliance.aiAutoReplyEnabled ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {t.guardrailBanner}
                </div>
              ) : null}

              {aiSummary ? (
                <div className="space-y-4">
                  <h2 className="font-heading text-lg font-semibold text-[#16182B]">{t.aiSectionTitle}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border border-[#DEDDE6]/80 bg-white p-4 shadow-sm rounded-2xl">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">{t.aiAutoReplySent}</p>
                      <p className="mt-1 text-2xl font-bold text-[#16182B]">{aiSummary.autoReplySent}</p>
                    </Card>
                    <Card className="border border-[#DEDDE6]/80 bg-white p-4 shadow-sm rounded-2xl">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">{t.aiAutoReplyEscalated}</p>
                      <p className="mt-1 text-2xl font-bold text-amber-600">{aiSummary.autoReplyEscalated}</p>
                    </Card>
                    <Card className="border border-[#DEDDE6]/80 bg-white p-4 shadow-sm rounded-2xl">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">{t.aiAutomationReplySent}</p>
                      <p className="mt-1 text-2xl font-bold text-[#4636D7]">{aiSummary.automationAiReplySent}</p>
                    </Card>
                    <Card className="border border-[#DEDDE6]/80 bg-white p-4 shadow-sm rounded-2xl">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#767A8C]">{t.aiCreditsUsed}</p>
                      <p className="mt-1 text-2xl font-bold text-[#16182B]">{aiSummary.aiCreditsUsed}</p>
                    </Card>
                  </div>
                  {Object.keys(aiSummary.skippedByReason).length > 0 ? (
                    <Card className="border border-[#DEDDE6]/80 bg-white p-4 shadow-sm rounded-2xl">
                      <p className="mb-2 text-sm font-semibold text-[#16182B]">{t.aiSkippedTitle}</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(aiSummary.skippedByReason).map(([reason, count]) => (
                          <span
                            key={reason}
                            className="rounded-full border border-[#DEDDE6] bg-[#F6F5FA] px-3 py-1 text-xs font-medium text-[#767A8C]"
                          >
                            {reason}: {count}
                          </span>
                        ))}
                      </div>
                    </Card>
                  ) : null}
                </div>
              ) : null}

              {aiQaSummary && aiQaSummary.sampleCount > 0 ? (
                <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl space-y-3">
                  <h2 className="font-heading text-base font-semibold text-[#16182B]">{t.aiQaTitle}</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.aiQaSamples}</p>
                      <p className="text-lg font-bold text-[#16182B]">{aiQaSummary.sampleCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.aiQaOverall}</p>
                      <p className="text-lg font-bold text-[#16182B]">{aiQaSummary.avgOverall?.toFixed(2) ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.aiQaRelevance}</p>
                      <p className="text-lg font-bold text-[#16182B]">{aiQaSummary.avgRelevance?.toFixed(2) ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.aiQaTone}</p>
                      <p className="text-lg font-bold text-[#16182B]">{aiQaSummary.avgTone?.toFixed(2) ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.aiQaHallucination}</p>
                      <p className="text-lg font-bold text-[#16182B]">{aiQaSummary.avgHallucination?.toFixed(2) ?? "-"}</p>
                    </div>
                  </div>
                </Card>
              ) : null}

              {compliance ? (
                <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading text-base font-semibold text-[#16182B]">
                      {t.complianceTitle}
                    </h2>
                    <Link href="/app/qa" className="text-sm font-semibold text-[#4636D7] hover:underline">
                      {t.complianceQaLink}
                    </Link>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.compliancePolicy}</p>
                      <p className="text-lg font-bold text-[#16182B]">{compliance.policyBlocks}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.complianceEscalations}</p>
                      <p className="text-lg font-bold text-amber-600">{compliance.escalations}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.complianceLowScores}</p>
                      <p className="text-lg font-bold text-red-600">{compliance.lowQaScores}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#767A8C]">{t.complianceGuardrail}</p>
                      <p className="text-lg font-bold text-[#16182B]">{compliance.guardrailEvents}</p>
                    </div>
                  </div>
                </Card>
              ) : null}

              {/* Charts Grid */}
              {isMounted && charts && (
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Message Volume Chart */}
                  <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-base font-semibold text-[#16182B]">
                        {t.chartVolumeTitle}
                      </h2>
                    </div>
                    <div className="h-80 w-full">
                      {charts.dailyMessageVolume.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-[#767A8C]">
                          {t.noData}
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={charts.dailyMessageVolume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4636D7" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#4636D7" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEBFF" />
                            <XAxis dataKey="date" stroke="#9EA2B6" fontSize={11} tickLine={false} />
                            <YAxis stroke="#9EA2B6" fontSize={11} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #DEDDE6" }} />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Area
                              name={t.inbound}
                              type="monotone"
                              dataKey="inbound"
                              stroke="#06B6D4"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#inboundGrad)"
                            />
                            <Area
                              name={t.outbound}
                              type="monotone"
                              dataKey="outbound"
                              stroke="#4636D7"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#outboundGrad)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </Card>

                  {/* Agent Workload Chart */}
                  <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl space-y-4">
                    <h2 className="font-heading text-base font-semibold text-[#16182B]">
                      {t.chartWorkloadTitle}
                    </h2>
                    <div className="h-80 w-full">
                      {charts.agentWorkload.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-[#767A8C]">
                          {t.noData}
                        </div>
                      ) : (() => {
                        const translatedWorkload = charts.agentWorkload.map((entry) => {
                          const isUnassigned =
                            entry.agentName === "ยังไม่มีผู้รับผิดชอบ" ||
                            entry.agentName === "Unassigned Agent" ||
                            entry.agentName === "Unassigned" ||
                            entry.agentName === "Unknown Agent";
                          if (isUnassigned) {
                            return {
                              ...entry,
                              agentName: locale === "th" ? "ยังไม่มีผู้รับผิดชอบ" : "Unassigned",
                            };
                          }
                          return entry;
                        });
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={translatedWorkload} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEBFF" />
                              <XAxis dataKey="agentName" stroke="#9EA2B6" fontSize={11} tickLine={false} />
                              <YAxis stroke="#9EA2B6" fontSize={11} tickLine={false} allowDecimals={false} />
                              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #DEDDE6" }} />
                              <Bar name={t.chats} dataKey="count" fill="#4636D7" radius={[4, 4, 0, 0]}>
                                {translatedWorkload.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={
                                      entry.agentName === "ยังไม่มีผู้รับผิดชอบ" ||
                                      entry.agentName === "Unassigned"
                                        ? "#94A3B8"
                                        : "#4636D7"
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>
                  </Card>

                  {/* Tag Distribution Pie Chart */}
                  <Card className="border border-[#DEDDE6]/80 bg-white p-5 shadow-sm rounded-2xl space-y-4 lg:col-span-2">
                    <h2 className="font-heading text-base font-semibold text-[#16182B]">
                      {t.chartTagsTitle}
                    </h2>
                    <div className="flex flex-col md:flex-row items-center justify-around gap-6 h-80">
                      {charts.tagDistribution.length === 0 ? (
                        <div className="flex h-full w-full items-center justify-center text-sm text-[#767A8C]">
                          {t.noData}
                        </div>
                      ) : (
                        <>
                          {/* Pie Chart */}
                          <div className="h-64 w-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={charts.tagDistribution}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={90}
                                  paddingAngle={3}
                                  dataKey="count"
                                >
                                  {charts.tagDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #DEDDE6" }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Legend / Lists */}
                          <div className="flex-1 max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                            {charts.tagDistribution.map((tag, idx) => (
                              <div key={tag.name} className="flex items-center justify-between border border-[#DEDDE6]/40 p-2 rounded-xl bg-[#FBFBFC]">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-3.5 w-3.5 rounded-full border border-black/5"
                                    style={{ backgroundColor: tag.color || COLORS[idx % COLORS.length] }}
                                  />
                                  <span className="text-sm font-semibold text-[#16182B]">{tag.name}</span>
                                </div>
                                <span className="text-xs font-bold text-[#767A8C] bg-[#ECEBFF] px-2 py-0.5 rounded-full text-[#4636D7]">
                                  {tag.count} {t.chats}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

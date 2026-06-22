"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Badge, Label } from "@omnichat/ui";
import {
  Search,
  Check,
  Trash2,
  Edit2,
  Download,
  AlertCircle,
  Loader2,
  Sparkles,
  BookOpen,
  Settings2,
} from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";

interface AiTrainingPair {
  id: string;
  customerMessage: string;
  assistantReply: string;
  isSuggestionUsed: boolean;
  isEdited: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export function AiCurationManager() {
  const { locale } = useLanguage();
  const [pairs, setPairs] = useState<AiTrainingPair[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCustomerMessage, setEditCustomerMessage] = useState("");
  const [editAssistantReply, setEditAssistantReply] = useState("");

  // Approval Options Dialog State
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isGlobal, setIsGlobal] = useState(false);

  // Pagination
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  const t = {
    th: {
      searchPlaceholder: "ค้นหาคำถามของลูกค้า หรือคำตอบ...",
      tabPending: "รอตรวจสอบ",
      tabApproved: "อนุมัติแล้ว",
      tabRejected: "ปฏิเสธแล้ว",
      noPairs: "ไม่พบรายการคู่สนทนาที่ต้องการจัดการ",
      customerQ: "คำถามของลูกค้า",
      assistantA: "คำตอบของแอดมิน",
      suggestionUsed: "ใช้คำแนะนำ AI",
      manuallyTyped: "พิมพ์เองทั้งหมด",
      editedByAgent: "แอดมินแก้ไขก่อนส่ง",
      unEdited: "ส่งโดยตรงไม่แก้ไข",
      approveBtn: "อนุมัติเป็น RAG",
      rejectBtn: "ปฏิเสธ",
      deleteBtn: "ลบรายการ",
      editBtn: "แก้ไขข้อมูล",
      saveBtn: "บันทึก",
      cancelBtn: "ยกเลิก",
      exportBtn: "ส่งออกคู่สนทนา (JSON)",
      globalApprovalLabel: "แชร์บทความให้ทุก LINE OA (Global RAG)",
      globalApprovalSub: "หากไม่ได้ติ๊ก ระบบจะเปิดใช้งานสำหรับช่องทางนี้เท่านั้นโดยอัตโนมัติ",
      confirmApproveBtn: "อนุมัติทันที",
      successApprove: "อนุมัติและแปลงเป็นบทความ RAG สำเร็จ",
      successDelete: "ลบคู่สนทนาสำเร็จ",
      successUpdate: "อัปเดตคู่สนทนาสำเร็จ",
    },
    en: {
      searchPlaceholder: "Search customer question or replies...",
      tabPending: "Pending Review",
      tabApproved: "Approved",
      tabRejected: "Rejected",
      noPairs: "No conversational pairs found",
      customerQ: "Customer Message",
      assistantA: "Agent Reply",
      suggestionUsed: "AI Suggested",
      manuallyTyped: "Manual Draft",
      editedByAgent: "Edited by agent",
      unEdited: "Sent as suggested",
      approveBtn: "Approve to RAG",
      rejectBtn: "Reject",
      deleteBtn: "Delete Log",
      editBtn: "Edit Q&A",
      saveBtn: "Save",
      cancelBtn: "Cancel",
      exportBtn: "Export Pairs (JSON)",
      globalApprovalLabel: "Apply to all channels (Global RAG)",
      globalApprovalSub: "If unchecked, RAG is bound to the original LINE channel context.",
      confirmApproveBtn: "Confirm Approval",
      successApprove: "Approved & converted to RAG article successfully",
      successDelete: "Deleted pair successfully",
      successUpdate: "Updated pair successfully",
    },
  }[locale === "th" ? "th" : "en"];

  const loadPairs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = `status=${activeTab}&search=${encodeURIComponent(debouncedSearch)}&limit=${limit}&offset=${offset}`;
      const data = await apiFetch<{ items: AiTrainingPair[]; total: number }>(`/api/v1/ai/curation?${query}`);
      setPairs(data?.items || []);
      setTotalCount(data?.total || 0);
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch training pairs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPairs();
  }, [activeTab, debouncedSearch, offset]);

  // Handle actions
  const handleEditStart = (pair: AiTrainingPair) => {
    setEditingId(pair.id);
    setEditCustomerMessage(pair.customerMessage);
    setEditAssistantReply(pair.assistantReply);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const handleEditSave = async (id: string) => {
    try {
      await apiFetch(`/api/v1/ai/curation/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          customerMessage: editCustomerMessage,
          assistantReply: editAssistantReply,
        }),
      });
      setEditingId(null);
      loadPairs();
    } catch (err: any) {
      alert(err.message || "Failed to update pair");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await apiFetch(`/api/v1/ai/curation/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      });
      loadPairs();
    } catch (err: any) {
      alert(err.message || "Failed to reject pair");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(locale === "th" ? "คุณต้องการลบรายการนี้ใช่หรือไม่?" : "Are you sure you want to delete this log?")) return;
    try {
      await apiFetch(`/api/v1/ai/curation/${id}`, {
        method: "DELETE",
      });
      loadPairs();
    } catch (err: any) {
      alert(err.message || "Failed to delete pair");
    }
  };

  const handleApproveClick = (id: string) => {
    setApprovingId(id);
    setIsGlobal(false);
  };

  const handleApproveConfirm = async () => {
    if (!approvingId) return;
    try {
      await apiFetch(`/api/v1/ai/curation/${approvingId}/approve`, {
        method: "POST",
        body: JSON.stringify({ global: isGlobal }),
      });
      setApprovingId(null);
      loadPairs();
    } catch (err: any) {
      alert(err.message || "Failed to approve pair");
    }
  };

  const handleExport = async () => {
    if (totalCount > 5000) {
      const confirmMsg = locale === "th"
        ? `ข้อมูลมีทั้งหมด ${totalCount} รายการ ระบบจะส่งออกเฉพาะ 5,000 รายการแรกเท่านั้น ต้องการดำเนินการต่อหรือไม่?`
        : `Total matching items is ${totalCount}. System will export the first 5,000 items only. Do you want to continue?`;
      if (!confirm(confirmMsg)) return;
    }
    setExporting(true);
    try {
      const data = await apiFetch<{ messages: any[] }[]>(
        `/api/v1/ai/curation/export?status=${activeTab}&from=&to=`
      );

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `omnichat-ai-finetune-${activeTab}-${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#DEDDE6]/60 pb-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-[#16182B]">AI Curation Panel</h2>
          <p className="text-sm text-[#767A8C]">
            {locale === "th" ? "จัดการข้อมูลแชทจริงของแอดมิน เพื่อแปลงไปเป็นคู่ความรู้ RAG หรือส่งออกสำหรับ Fine-tuning AI" : "Review real conversations to convert into RAG pairs or export for fine-tuning."}
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || pairs.length === 0}
          className="bg-white hover:bg-[#F6F5FA] text-[#16182B] border border-[#DEDDE6] px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold shadow-sm shrink-0"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#4636D7]" />
          ) : (
            <Download size={16} className="text-[#4636D7]" />
          )}
          {t.exportBtn}
        </Button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#ECEBFF]/40 border border-[#DEDDE6]/50 rounded-xl p-1 shadow-inner self-start">
          {(["pending", "approved", "rejected"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setOffset(0);
              }}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer transition-all duration-200 ${
                activeTab === tab
                  ? "bg-[#4636D7] text-white shadow-md shadow-[#4636D7]/15"
                  : "text-[#767A8C] hover:text-[#16182B]"
              }`}
            >
              {tab === "pending" ? t.tabPending : tab === "approved" ? t.tabApproved : t.tabRejected}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9EA2B6]" />
          <Input
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="pl-10 border-[#DEDDE6] focus:border-[#4636D7] focus:ring-[#4636D7] rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#4636D7]" />
        </div>
      ) : error ? (
        <Card className="border border-red-200 bg-white p-6 text-center rounded-2xl">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : pairs.length === 0 ? (
        <Card className="border border-dashed border-[#DEDDE6] bg-white p-12 text-center rounded-2xl">
          <p className="text-sm text-[#767A8C]">{t.noPairs}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pairs.map((pair) => (
            <Card
              key={pair.id}
              className={`border p-5 bg-white shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl ${
                editingId === pair.id ? "ring-2 ring-[#4636D7]/30 border-[#4636D7]" : "border-[#DEDDE6]/80"
              }`}
            >
              {/* Badges / Meta */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DEDDE6]/40 pb-3 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      pair.status === "approved"
                        ? "bg-[#E6F9F2] text-[#10B981] border-none"
                        : pair.status === "rejected"
                        ? "bg-red-50 text-red-600 border-none"
                        : "bg-[#ECEBFF] text-[#4636D7] border-none"
                    }
                  >
                    {pair.status === "approved" ? t.tabApproved : pair.status === "rejected" ? t.tabRejected : t.tabPending}
                  </Badge>

                  {pair.isSuggestionUsed ? (
                    <Badge className="bg-[#E0F2FE] text-[#0284C7] border-none flex items-center gap-1">
                      <Sparkles size={10} />
                      {t.suggestionUsed}
                    </Badge>
                  ) : (
                    <Badge className="bg-[#F1F5F9] text-[#64748B] border-none">
                      {t.manuallyTyped}
                    </Badge>
                  )}

                  {pair.isSuggestionUsed && (
                    <Badge className="bg-white text-[#767A8C] border border-[#DEDDE6] font-normal">
                      {pair.isEdited ? t.editedByAgent : t.unEdited}
                    </Badge>
                  )}
                </div>

                <span className="text-xs text-[#9EA2B6]">
                  {new Date(pair.createdAt).toLocaleString(locale === "th" ? "th-TH" : "en-US")}
                </span>
              </div>

              {/* Editable Contents */}
              {editingId === pair.id ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#767A8C]">{t.customerQ}</Label>
                    <Input
                      value={editCustomerMessage}
                      onChange={(e) => setEditCustomerMessage(e.target.value)}
                      className="border-[#DEDDE6] focus:border-[#4636D7] rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#767A8C]">{t.assistantA}</Label>
                    <textarea
                      value={editAssistantReply}
                      onChange={(e) => setEditAssistantReply(e.target.value)}
                      className="w-full border border-[#DEDDE6] focus:border-[#4636D7] focus:ring-1 focus:ring-[#4636D7] rounded-xl p-3 text-sm focus:outline-none min-h-[80px]"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={handleEditCancel}
                      className="bg-[#F6F5FA] hover:bg-[#ECEBFF] text-[#767A8C] hover:text-[#16182B] text-xs font-semibold px-4 py-2 rounded-xl"
                    >
                      {t.cancelBtn}
                    </Button>
                    <Button
                      onClick={() => handleEditSave(pair.id)}
                      className="bg-[#4636D7] hover:bg-[#3527B3] text-white text-xs font-semibold px-4 py-2 rounded-xl"
                    >
                      {t.saveBtn}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Customer Q */}
                  <div className="flex gap-3 items-start bg-[#FBFBFC] p-3 rounded-xl border border-[#DEDDE6]/30">
                    <div className="bg-[#4636D7]/10 text-[#4636D7] text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">Q</div>
                    <div className="text-sm font-semibold text-[#16182B] whitespace-pre-wrap">{pair.customerMessage}</div>
                  </div>

                  {/* Assistant A */}
                  <div className="flex gap-3 items-start bg-[#E6F9F2]/20 p-3 rounded-xl border border-[#10B981]/10">
                    <div className="bg-[#10B981]/10 text-[#10B981] text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">A</div>
                    <div className="text-sm text-[#16182B] whitespace-pre-wrap">{pair.assistantReply}</div>
                  </div>

                  {/* Curation Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DEDDE6]/30">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleEditStart(pair)}
                        className="bg-[#F6F5FA] hover:bg-[#ECEBFF] text-[#16182B] border border-[#DEDDE6]/50 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                      >
                        <Edit2 size={13} className="text-[#767A8C]" />
                        {t.editBtn}
                      </Button>
                      <Button
                        onClick={() => handleDelete(pair.id)}
                        className="bg-white hover:bg-red-50 hover:border-red-200 text-red-600 border border-[#DEDDE6]/50 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                      >
                        <Trash2 size={13} />
                        {t.deleteBtn}
                      </Button>
                    </div>

                    {pair.status !== "approved" && (
                      <div className="flex items-center gap-2">
                        {pair.status === "pending" && (
                          <Button
                            onClick={() => handleReject(pair.id)}
                            className="bg-white hover:bg-red-50 text-red-500 hover:text-red-700 border border-red-200 text-xs font-semibold px-4 py-2 rounded-xl"
                          >
                            {t.rejectBtn}
                          </Button>
                        )}
                        <Button
                          onClick={() => handleApproveClick(pair.id)}
                          className="bg-[#4636D7] hover:bg-[#3527B3] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                        >
                          <BookOpen size={13} />
                          {t.approveBtn}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
          {/* Pagination Controls */}
          {totalCount > limit && (
            <div className="flex items-center justify-between border-t border-[#DEDDE6]/40 pt-4 mt-4">
              <span className="text-xs text-[#767A8C]">
                {locale === "th"
                  ? `แสดง ${offset + 1} - ${Math.min(offset + limit, totalCount)} จากทั้งหมด ${totalCount} รายการ`
                  : `Showing ${offset + 1} - ${Math.min(offset + limit, totalCount)} of ${totalCount}`}
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={offset === 0}
                  onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                  className="bg-white hover:bg-[#F6F5FA] border border-[#DEDDE6] text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
                >
                  {locale === "th" ? "ก่อนหน้า" : "Previous"}
                </Button>
                <Button
                  disabled={offset + limit >= totalCount}
                  onClick={() => setOffset((prev) => prev + limit)}
                  className="bg-white hover:bg-[#F6F5FA] border border-[#DEDDE6] text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
                >
                  {locale === "th" ? "ถัดไป" : "Next"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scoped Approval Options Dialog Modal */}
      {approvingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-white border border-[#DEDDE6] p-6 shadow-xl rounded-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5 text-[#4636D7] border-b border-[#DEDDE6]/60 pb-3">
              <Settings2 size={20} />
              <h3 className="font-heading text-base font-semibold text-[#16182B]">Approval Settings</h3>
            </div>

            {/* Checkbox */}
            <div className="flex items-start gap-3 bg-[#ECEBFF]/25 p-4 rounded-xl border border-[#DEDDE6]/40">
              <input
                id="global-rag"
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-[#DEDDE6] text-[#4636D7] focus:ring-[#4636D7] mt-0.5 cursor-pointer"
              />
              <div className="space-y-1">
                <Label htmlFor="global-rag" className="text-sm font-semibold text-[#16182B] cursor-pointer">
                  {t.globalApprovalLabel}
                </Label>
                <p className="text-xs text-[#767A8C]">{t.globalApprovalSub}</p>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setApprovingId(null)}
                className="bg-[#F6F5FA] hover:bg-[#ECEBFF] text-[#767A8C] hover:text-[#16182B] text-xs font-semibold px-4 py-2 rounded-xl"
              >
                {t.cancelBtn}
              </Button>
              <Button
                onClick={handleApproveConfirm}
                className="bg-[#4636D7] hover:bg-[#3527B3] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <Check size={13} />
                {t.confirmApproveBtn}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

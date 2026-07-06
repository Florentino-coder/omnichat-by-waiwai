import { useState, useEffect } from "react";
import { Check, Pencil, StickyNote, Tags, UserPlus, X, ChevronDown, Zap, Smartphone, Globe, MessageSquare, Sparkles } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../../app/lib/api-client";
import { useLanguage } from "../../../app/lib/language-context";
import { getMessages, type Messages } from "../../../app/lib/i18n";
import { AssignDropdown } from "./AssignDropdown";
import { QuickReplyList } from "./QuickReplyList";
import { TagList } from "./TagList";
import { useSlipVerifications } from "../../../app/app/inbox/hooks/useSlipVerifications";
import { SlipVerificationPanel } from "../SlipVerificationPanel";

interface CustomerPanelProps {
  customerName: string;
  customerInitial: string;
  lineLabel: string;
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "No conversation";
  sourceId?: string;
  sourceType?: string;
  lineChannelId?: string;
  latestMessageType?: string;
  latestMessageId?: string;
  lineProfile?: {
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
    language?: string;
  } | null;
  isEditingName?: boolean;
  nicknameDraft?: string;
  isSavingName?: boolean;
  assigneeValue?: string;
  assigneeOptions?: Array<{ id: string; label: string }>;
  isSavingAssignment?: boolean;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  availableTags?: Array<{ id: string; name: string; color?: string | null; isAttached: boolean }>;
  savedReplies?: Array<{ id: string; title: string; subtitle: string; body: string; rawTitle: string }>;
  autoQuickReply?: boolean;
  noteDraft?: string;
  notes?: Array<{ id: string; body: string; createdAt: string }>;
  isSavingNote?: boolean;
  isLoadingOperations?: boolean;
  disabled?: boolean;
  onNicknameChange?: (value: string) => void;
  onStartEditingName?: () => void;
  onCancelEditingName?: () => void;
  onSaveCustomerName?: () => void;
  onAssigneeChange?: (value: string) => void;
  onSaveAssignment?: (value?: string) => void;
  onToggleTag?: (tag: { id: string; name: string; color?: string | null; isAttached: boolean }) => void;
  onCreateTag?: (name: string) => void;
  onToggleAutoQuickReply?: () => void;
  onSelectQuickReply?: (id: string) => void;
  onNoteDraftChange?: (value: string) => void;
  onCreateNote?: () => void;
  phone?: string | null;
  email?: string | null;
  onSaveContactDetails?: (phone: string, email: string) => void;
  conversationId?: string | null;
  enableAiSuggest?: boolean;
}

export function CustomerPanel({
  customerName,
  customerInitial,
  lineLabel,
  status = "No conversation",
  sourceId = "-",
  sourceType = "-",
  lineChannelId = "-",
  latestMessageType = "-",
  latestMessageId = "-",
  lineProfile,
  isEditingName = false,
  nicknameDraft = "",
  isSavingName = false,
  assigneeValue = "",
  assigneeOptions = [],
  isSavingAssignment = false,
  tags = [],
  availableTags = [],
  savedReplies = [],
  autoQuickReply = false,
  noteDraft = "",
  notes = [],
  isSavingNote = false,
  isLoadingOperations = false,
  disabled = false,
  onNicknameChange,
  onStartEditingName,
  onCancelEditingName,
  onSaveCustomerName,
  onAssigneeChange,
  onSaveAssignment,
  onToggleTag,
  onCreateTag,
  onToggleAutoQuickReply,
  onSelectQuickReply,
  onNoteDraftChange,
  onCreateNote,
  phone,
  email,
  onSaveContactDetails,
  conversationId = null,
  enableAiSuggest = false
}: CustomerPanelProps) {
  const [newTagName, setNewTagName] = useState("");
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(phone || "");
  const [emailDraft, setEmailDraft] = useState(email || "");

  useEffect(() => {
    setPhoneDraft(phone || "");
    setEmailDraft(email || "");
  }, [phone, email]);

  const { locale } = useLanguage();
  const t = getMessages(locale);
  const [summary, setSummary] = useState<string>("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [rateLimitLock, setRateLimitLock] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const { slips, isLoading: isLoadingSlips } = useSlipVerifications(conversationId);

  useEffect(() => {
    let timer: number;
    if (rateLimitLock && rateLimitCountdown > 0) {
      timer = window.setInterval(() => {
        setRateLimitCountdown((prev) => {
          if (prev <= 1) {
            setRateLimitLock(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [rateLimitLock, rateLimitCountdown]);

  useEffect(() => {
    setSummary("");
    setSummaryError(null);
  }, [conversationId]);

  const handleGenerateSummary = async () => {
    if (!conversationId) return;
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      const res = await apiFetch<{ summary: string }>(
        `/api/v1/inbox/conversations/${conversationId}/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale })
        }
      );
      setSummary(res.summary);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : t.summaryFailed;
      const msg = formatSummaryError(rawMsg, t);
      if (msg === t.summaryRateLimit || rawMsg.includes("Too many AI summaries") || rawMsg.includes("RATE_LIMIT")) {
        setRateLimitLock(true);
        setRateLimitCountdown(15);
        setSummaryError(t.summaryRateLimit);
      } else {
        setSummaryError(msg);
      }
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    assign: true,
    tags: true,
    quickReply: true,
    notes: true,
    contact: false,
    channel: false,
    latestMessage: false,
    summary: true,
    slipVerification: false
  });

  const toggleSection = (section: string) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderSectionHeader = (title: string, icon: React.ReactNode, key: string) => {
    const isExpanded = expanded[key];
    return (
      <button
        onClick={() => toggleSection(key)}
        className="flex w-full items-center justify-between py-4 text-left font-heading font-semibold text-[#6B6D7A] hover:text-foreground transition-colors"
        type="button"
      >
        <span className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={18}
          className={`text-muted-foreground transition-transform duration-200 ${
            isExpanded ? "transform rotate-0" : "transform -rotate-90"
          }`}
        />
      </button>
    );
  };

  const renderQuickReplyHeader = () => {
    const isExpanded = expanded.quickReply;
    return (
      <div className="flex w-full items-center justify-between py-4 text-left font-heading font-semibold text-[#6B6D7A] transition-colors">
        <button
          onClick={() => toggleSection("quickReply")}
          className="flex flex-1 items-center gap-2 text-base text-[#6B6D7A] hover:text-foreground transition-colors"
          type="button"
        >
          <Zap size={17} aria-hidden="true" />
          Quick Reply
        </button>
        <div className="flex items-center gap-2">
          <button
            className={[
              "flex h-7 w-16 items-center rounded-full px-1 transition-colors",
              autoQuickReply ? "justify-end bg-primary" : "justify-start bg-[#E6E5ED]"
            ].join(" ")}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onToggleAutoQuickReply?.();
            }}
            type="button"
            role="switch"
            aria-checked={autoQuickReply}
            aria-label="Quick Reply Auto Enter"
          >
            <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
          </button>
          <button
            onClick={() => toggleSection("quickReply")}
            className="text-muted-foreground transition-colors p-1"
            type="button"
          >
            <ChevronDown
              size={18}
              className={`transition-transform duration-200 ${
                isExpanded ? "transform rotate-0" : "transform -rotate-90"
              }`}
            />
          </button>
        </div>
      </div>
    );
  };

  if (disabled) {
    return (
      <aside className="flex h-full min-h-0 w-full flex-col items-center justify-center border-l border-border bg-white p-6 text-center select-none" aria-labelledby="context-heading-empty">
        <Tags size={40} className="text-slate-300 dark:text-zinc-700 mb-3" />
        <h2 id="context-heading-empty" className="sr-only">Customer info empty</h2>
        <p className="text-sm font-medium text-slate-400 dark:text-zinc-500">
          เลือกห้องสนทนาเพื่อดูข้อมูลลูกค้า
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-white" aria-labelledby="context-heading">
      <div className="shrink-0 border-b border-border px-6 py-5">
        <h2 id="context-heading" className="font-heading text-lg font-semibold">ข้อมูลลูกค้า</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-border px-6 py-6">
          <div className="flex items-center gap-4">
            {lineProfile?.pictureUrl ? (
              <img
                src={lineProfile.pictureUrl}
                alt=""
                className="h-16 w-16 rounded-full border-2 border-[#CFD5FF] object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#CFD5FF] bg-[#EEF1FF] text-3xl font-medium text-primary">
                {customerInitial}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold">{customerName}</h3>
              <p className="mt-1 truncate text-base font-medium text-muted-foreground">LINE OA · {lineLabel}</p>
              {lineProfile?.statusMessage ? (
                <p className="mt-1 truncate text-sm text-muted-foreground">{lineProfile.statusMessage}</p>
              ) : null}
              {lineProfile?.language ? (
                <span className="mt-2 inline-flex rounded-full bg-[#F0F0F5] px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {lineProfile.language}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <section className="flex items-center justify-between border-b border-border px-6 py-5">
          <p className="text-base font-medium text-[#60636F]">สถานะแชท</p>
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusDot(status) }} />
            {statusLabel(status)}
          </p>
        </section>

        {/* ยืนยันสลิป */}
        <SlipVerificationPanel
          slips={slips}
          isLoading={isLoadingSlips}
          isExpanded={expanded.slipVerification}
          onToggle={() => toggleSection("slipVerification")}
        />

        {/* สรุปบทสนทนา (AI) */}
        {enableAiSuggest && (
          <section className="border-b border-border px-6">
            {renderSectionHeader(t.summaryTitle, <Sparkles size={17} className="text-purple-500" aria-hidden="true" />, "summary")}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                expanded.summary ? "max-h-[500px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
              }`}
            >
              {summary ? (
                <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 text-sm text-foreground">
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-zinc-300 font-medium">
                    {summary}
                  </p>
                  <button
                    type="button"
                    className="mt-3 text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-60"
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary || rateLimitLock}
                  >
                    {isGeneratingSummary ? t.updatingSummary : rateLimitLock ? `${t.summaryRateLimit} (${rateLimitCountdown}s)` : t.reSummary}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <Sparkles size={24} className="text-purple-400 mb-2 animate-pulse" />
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    {t.summaryPlaceholder}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold hover:from-violet-600 hover:to-indigo-700 shadow-sm rounded-xl px-4 disabled:from-slate-300 disabled:to-slate-400 disabled:opacity-60"
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary || rateLimitLock}
                  >
                    {isGeneratingSummary ? t.summaryGenerating : rateLimitLock ? `${t.summaryRateLimit} (${rateLimitCountdown}s)` : t.startSummary}
                  </Button>
                </div>
              )}
              {summaryError && !rateLimitLock && (
                <p className="mt-2 text-xs text-danger">{summaryError}</p>
              )}
            </div>
          </section>
        )}

        {/* มอบหมายให้ */}
        <section className="border-b border-border px-6">
          {renderSectionHeader("มอบหมายให้", <UserPlus size={17} aria-hidden="true" />, "assign")}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              expanded.assign ? "max-h-[300px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
            }`}
          >
            <AssignDropdown
              disabled={disabled || isSavingAssignment}
              value={assigneeValue}
              options={assigneeOptions}
              onChange={(value) => {
                onAssigneeChange?.(value);
                onSaveAssignment?.(value);
              }}
            />
          </div>
        </section>

        {/* แท็ก */}
        <section className="border-b border-border px-6">
          {renderSectionHeader("แท็ก", <Tags size={17} aria-hidden="true" />, "tags")}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              expanded.tags ? "max-h-[400px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
            }`}
          >
            <TagList tags={tags.map((tag) => tag.name)} onAdd={() => document.getElementById("new-tag-input")?.focus()} />
            <div className="mt-3 flex flex-wrap gap-2">
              {availableTags.length === 0 && !isLoadingOperations ? (
                <span className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
                  ยังไม่มีแท็ก
                </span>
              ) : null}
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-label={`${tag.isAttached ? "Remove" : "Add"} tag ${tag.name}`}
                  className={[
                    "rounded-full border px-3 py-1.5 text-sm font-semibold",
                    tag.isAttached ? "text-white" : "bg-white text-foreground hover:bg-secondary"
                  ].join(" ")}
                  disabled={disabled}
                  onClick={() => onToggleTag?.(tag)}
                  style={
                    tag.isAttached
                      ? { backgroundColor: tag.color ?? "#64748b", borderColor: tag.color ?? "#64748b" }
                      : { borderColor: tag.color ?? "#cbd5e1" }
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newTagName.trim() && onCreateTag) {
                  onCreateTag(newTagName.trim());
                  setNewTagName("");
                }
              }}
              className="mt-4 flex items-center gap-2"
            >
              <Input
                id="new-tag-input"
                type="text"
                placeholder="เพิ่มแท็กใหม่ เช่น สนใจ, VIP"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-9 text-xs"
                disabled={disabled}
              />
              <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={disabled || !newTagName.trim()}>
                สร้าง
              </Button>
            </form>
          </div>
        </section>

        {/* ควิกรีพลาย */}
        <section id="quick-reply-section" className="border-b border-border px-6">
          {renderQuickReplyHeader()}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              expanded.quickReply ? "max-h-[500px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
            }`}
          >
            <QuickReplyList
              autoEnabled={autoQuickReply}
              replies={savedReplies}
              disabled={disabled}
              hideHeader={true}
              onToggleAuto={onToggleAutoQuickReply ?? (() => undefined)}
              onSelect={(id) => onSelectQuickReply?.(id)}
            />
          </div>
        </section>

        {/* โน้ตภายใน */}
        <section className="border-b border-border px-6">
          {renderSectionHeader("โน้ตภายใน", <StickyNote size={17} aria-hidden="true" />, "notes")}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              expanded.notes ? "max-h-[500px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
            }`}
          >
            <textarea
              aria-label="Internal note"
              className="min-h-24 w-full resize-none rounded-xl border border-border bg-[#F7F6FB] px-3 py-3 text-sm outline-none focus:border-primary"
              disabled={disabled || isSavingNote}
              maxLength={2000}
              onChange={(event) => onNoteDraftChange?.(event.target.value)}
              placeholder="บันทึกเฉพาะทีม ไม่ส่งให้ลูกค้า"
              value={noteDraft}
            />
            <button
              type="button"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
              disabled={disabled || isSavingNote || !noteDraft.trim()}
              onClick={onCreateNote}
            >
              บันทึก
            </button>
            <div className="mt-3 grid gap-2">
              {notes.length === 0 && !isLoadingOperations ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีโน้ต</p>
              ) : null}
              {notes.map((note) => (
                <div key={note.id} className="rounded-xl border border-[#F2C94C] bg-[#FFF9E8] px-3 py-3 text-sm">
                  <p className="whitespace-pre-wrap text-[#7A470F]">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="border-b border-border px-6">
          {renderSectionHeader("Contact", <Smartphone size={17} aria-hidden="true" />, "contact")}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              expanded.contact ? "max-h-[500px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
            }`}
          >
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-sm text-muted-foreground">ชื่อลูกค้า</dt>
                <dd className="mt-1">
                  {isEditingName ? (
                    <div className="grid gap-2">
                      <Label htmlFor="customer-nickname" className="sr-only">
                        Customer nickname
                      </Label>
                      <Input
                        id="customer-nickname"
                        name="customer-nickname"
                        value={nicknameDraft}
                        onChange={(event) => onNicknameChange?.(event.target.value)}
                        autoComplete="off"
                        maxLength={80}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={onSaveCustomerName}
                          disabled={isSavingName || nicknameDraft.trim().length === 0}
                          aria-label="Save customer name"
                        >
                          <Check size={14} aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={onCancelEditingName}
                          aria-label="Cancel customer name edit"
                        >
                          <X size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <span className="break-all font-semibold">{customerName}</span>
                      {!disabled ? (
                        <button
                          type="button"
                          className="rounded-md border border-border p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={onStartEditingName}
                          aria-label="Edit customer name"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </dd>
              </div>

              {isEditingContact ? (
                <div className="space-y-3 pt-2">
                  <div>
                    <Label htmlFor="customer-phone" className="text-xs text-muted-foreground">เบอร์โทรศัพท์</Label>
                    <Input
                      id="customer-phone"
                      type="text"
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      placeholder="เบอร์โทรศัพท์"
                      className="mt-1 h-9 text-xs"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer-email" className="text-xs text-muted-foreground">อีเมล</Label>
                    <Input
                      id="customer-email"
                      type="email"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      placeholder="อีเมล"
                      className="mt-1 h-9 text-xs"
                      disabled={disabled}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onSaveContactDetails?.(phoneDraft, emailDraft);
                        setIsEditingContact(false);
                      }}
                      disabled={disabled}
                    >
                      บันทึก
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setPhoneDraft(phone || "");
                        setEmailDraft(email || "");
                        setIsEditingContact(false);
                      }}
                      disabled={disabled}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">เบอร์โทรศัพท์</dt>
                      <dd className="mt-1 font-semibold">{phone || "-"}</dd>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">อีเมล</dt>
                      <dd className="mt-1 font-semibold break-all">{email || "-"}</dd>
                    </div>
                    {!disabled ? (
                      <button
                        type="button"
                        className="rounded-md border border-border p-1 text-muted-foreground hover:bg-secondary hover:text-foreground shrink-0 self-end"
                        onClick={() => setIsEditingContact(true)}
                        aria-label="Edit contact details"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              <Description label="Customer ID" value={sourceId} mono />
            </dl>
          </div>
        </section>

        {/* Channel */}
        <section className="border-b border-border px-6">
          {renderSectionHeader("Channel", <Globe size={17} aria-hidden="true" />, "channel")}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              expanded.channel ? "max-h-[300px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
            }`}
          >
            <dl className="space-y-4 text-sm">
              <Description label="Source" value="LINE OA" />
              <Description label="LINE source type" value={sourceType} />
              <Description label="OA channel name" value={lineLabel} />
              <Description label="OA channel ID" value={lineChannelId} mono />
            </dl>
          </div>
        </section>

        {/* Latest message */}
        <section className="px-6">
          {renderSectionHeader("Latest message", <MessageSquare size={17} aria-hidden="true" />, "latestMessage")}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              expanded.latestMessage ? "max-h-[200px] opacity-100 pb-5" : "max-h-0 opacity-0 pointer-events-none pb-0"
            }`}
          >
            <dl className="space-y-4 text-sm">
              <Description label="Message type" value={latestMessageType} />
              <Description label="Message ID" value={latestMessageId} mono />
            </dl>
          </div>
        </section>
      </div>
    </aside>
  );
}

function Description({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={["mt-1 font-semibold", mono ? "break-all font-mono text-xs text-foreground" : ""].join(" ")}>
        {value}
      </dd>
    </div>
  );
}

function statusLabel(status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "No conversation"): string {
  switch (status) {
    case "OPEN":
      return "เปิด";
    case "IN_PROGRESS":
      return "เปิดอยู่";
    case "RESOLVED":
      return "ปิดแล้ว";
    case "No conversation":
      return "-";
  }
}

function statusDot(status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "No conversation"): string {
  if (status === "OPEN" || status === "IN_PROGRESS") {
    return "#20A77A";
  }
  if (status === "RESOLVED") {
    return "#9A9DB0";
  }
  return "#D8D6CC";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function formatSummaryError(rawMsg: string, t: Messages): string {
  if (rawMsg.includes("AI_PROVIDER_RATE_LIMITED")) {
    return t.aiProviderRateLimited;
  }
  if (rawMsg.includes("AI_PROVIDER_NOT_CONFIGURED")) {
    return t.aiProviderNotConfigured;
  }
  if (rawMsg.includes("AI_GENERATION_FAILED") || rawMsg.includes("AI_PROVIDER_TIMEOUT")) {
    return t.summaryFailed;
  }
  return rawMsg;
}

export { AssignDropdown } from "./AssignDropdown";
export { QuickReplyList } from "./QuickReplyList";
export { TagList };

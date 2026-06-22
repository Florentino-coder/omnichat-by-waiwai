"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@omnichat/ui";
import { ImagePlus, SendHorizontal, X } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { getAiCreditErrorMessage } from "../../lib/ai-credit-status";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";

type AiSuggestionResponse = {
  mode?: "llm" | "knowledge_only";
  suggestion_id: string | null;
  suggestion_text: string | null;
  knowledge_citations?: Array<{
    type: "article" | "document";
    title: string;
    score?: number;
    excerpt?: string;
  }>;
};

interface ReplyComposerProps {
  conversationId: string | null;
  insertText?: string;
  insertNonce?: number;
  lineChannelName?: string | null;
  enableAiSuggest?: boolean;
  onSendStart?: (payload: { text: string; conversationId: string }) => void;
  onSent?: () => Promise<void> | void;
  refreshSuggestionNonce?: number;
}

type SavedReply = {
  id: string;
  title: string;
  body: string;
  shortcutKey?: string | null;
  imageUrl?: string | null;
  hotkeyBinding?: string | null;
};

export function ReplyComposer({
  conversationId,
  insertText,
  insertNonce,
  lineChannelName,
  enableAiSuggest = true,
  onSendStart,
  onSent,
  refreshSuggestionNonce = 0
}: ReplyComposerProps) {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isImagePanelOpen, setIsImagePanelOpen] = useState(false);
  const [pastedImagePreview, setPastedImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedText = text.trim();
  const trimmedImageUrl = imageUrl.trim();
  const canSend = Boolean(conversationId && !isSending && (trimmedText || trimmedImageUrl));

  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // AI Suggest Reply states
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [lastSuggestionText, setLastSuggestionText] = useState<string | null>(null);
  const [knowledgeCitations, setKnowledgeCitations] = useState<
    NonNullable<AiSuggestionResponse["knowledge_citations"]>
  >([]);
  const [rateLimitLock, setRateLimitLock] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [knowledgeOnlyMode, setKnowledgeOnlyMode] = useState(false);
  const [cameFromAiGenerate, setCameFromAiGenerate] = useState(false);
  const isProgrammaticRef = useRef(false);

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

  // Load active suggestion helper
  const loadActiveSuggestion = async (convId: string) => {
    try {
      const res = await apiFetch<{
        suggestion_id: string | null;
        suggestion_text: string | null;
        knowledge_citations: any[];
      }>(`/api/v1/inbox/conversations/${convId}/active-suggestion`);

      if (res && res.suggestion_id) {
        // Composer Overwrite Prevention Policy
        const currentVal = textareaRef.current ? textareaRef.current.value : text;
        const isComposerEmptyOrUnmodified =
          currentVal.trim() === "" || currentVal === lastSuggestionText;

        if (isComposerEmptyOrUnmodified) {
          setSuggestionId(res.suggestion_id);
          setKnowledgeCitations(res.knowledge_citations || []);
          if (res.suggestion_text) {
            isProgrammaticRef.current = true;
            setText(res.suggestion_text);
            setLastSuggestionText(res.suggestion_text);
            setKnowledgeOnlyMode(false);
          } else {
            isProgrammaticRef.current = true;
            setText("");
            setLastSuggestionText("");
            setKnowledgeOnlyMode(true);
          }
          setCameFromAiGenerate(true);
        }
      }
    } catch (err) {
      // Ignore
    }
  };

  // Reset suggestion when conversation changes
  useEffect(() => {
    setSuggestionId(null);
    setLastSuggestionText(null);
    setKnowledgeCitations([]);
    setKnowledgeOnlyMode(false);
    setCameFromAiGenerate(false);

    if (conversationId) {
      void loadActiveSuggestion(conversationId);
    }
  }, [conversationId]);

  // Load active suggestion on refresh nonce
  useEffect(() => {
    if (conversationId && refreshSuggestionNonce && refreshSuggestionNonce > 0) {
      void loadActiveSuggestion(conversationId);
    }
  }, [refreshSuggestionNonce]);

  // Fetch all saved replies for autocomplete
  useEffect(() => {
    if (!conversationId) {
      setSavedReplies([]);
      return;
    }
    async function loadSavedReplies() {
      try {
        const replies = await apiFetch<SavedReply[]>("/api/v1/inbox/saved-replies?type=all");
        setSavedReplies(Array.isArray(replies) ? replies : []);
      } catch (err) {
        // Ignore
      }
    }
    void loadSavedReplies();
  }, [conversationId]);

  // Match slash commands like "/hello"
  const slashMatch = text.match(/\/(\w*)$/);
  const isSlashActive = Boolean(slashMatch);
  const slashQuery = slashMatch ? slashMatch[1].toLowerCase() : "";

  const filteredReplies = useMemo(() => {
    if (!isSlashActive) {
      return [];
    }
    return savedReplies.filter((reply) =>
      reply.shortcutKey && reply.shortcutKey.toLowerCase().startsWith(slashQuery)
    );
  }, [savedReplies, isSlashActive, slashQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredReplies.length]);

  function selectReply(reply: SavedReply) {
    const replacedText = text.replace(/\/(\w*)$/, reply.body);
    isProgrammaticRef.current = true;
    setText(replacedText);
    if (reply.imageUrl) {
      setImageUrl(reply.imageUrl);
      setIsImagePanelOpen(true);
    }
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (insertText) {
      isProgrammaticRef.current = true;
      setText(insertText);
    }
  }, [insertNonce, insertText]);

  async function handleAiSuggest(actionType: string) {
    if (!conversationId) return;
    setIsGeneratingSuggestion(true);
    setError(null);

    const isRefinement = actionType !== "generate";

    if (actionType === "generate") {
      setCameFromAiGenerate(true);
    }

    if (suggestionId && !isRefinement) {
      await apiFetch(`/api/v1/inbox/ai-suggestions/${suggestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" })
      }).catch(() => {});
      setSuggestionId(null);
      setLastSuggestionText(null);
    }

    try {
      const requestBody: Record<string, unknown> = { action_type: actionType };
      if (isRefinement) {
        requestBody.current_text = text;
        requestBody.previous_suggestion_id = suggestionId;
      }

      const data = await apiFetch<AiSuggestionResponse>(
        `/api/v1/inbox/conversations/${conversationId}/ai-suggest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        }
      );

      if (data.mode === "knowledge_only") {
        setKnowledgeOnlyMode(true);
        setSuggestionId(null);
        setLastSuggestionText(null);
        setKnowledgeCitations(data.knowledge_citations ?? []);
        setError(null);
        return;
      }

      setKnowledgeOnlyMode(false);
      isProgrammaticRef.current = true;
      setText(data.suggestion_text || "");
      setSuggestionId(data.suggestion_id);
      setLastSuggestionText(data.suggestion_text || "");
      setKnowledgeCitations(data.knowledge_citations ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const quotaMessage = getAiCreditErrorMessage(message, locale);
      if (quotaMessage) {
        setError(quotaMessage);
      } else if (message.includes("Too many AI suggestions") || message.includes("RATE_LIMIT")) {
        setRateLimitLock(true);
        setRateLimitCountdown(15);
        setError("ใช้ AI บ่อยเกินไป รอสักครู่แล้วลองใหม่");
      } else if (message.includes("disabled") || message.includes("AI_SUGGEST_DISABLED")) {
        setError("ฟีเจอร์ AI ถูกปิดในการตั้งค่า");
      } else if (message.includes("Customer not found")) {
        setError("ไม่พบข้อมูลลูกค้า ต้องเชื่อม CRM ก่อนใช้ AI");
      } else if (message.includes("AI generation failed") || message.includes("AI_GENERATION_FAILED")) {
        setError("สร้างคำตอบไม่สำเร็จ ตรวจสอบ API key แล้วลองใหม่");
      } else if (message.includes("AI_PROVIDER_RATE_LIMITED") || message.includes("quota exceeded")) {
        setError(t.aiProviderRateLimited);
      } else if (message.includes("AI_PROVIDER_NOT_CONFIGURED")) {
        setError(t.aiProviderNotConfigured);
      } else {
        setError(message || "เกิดข้อผิดพลาดในการเรียก AI");
      }
    } finally {
      setIsGeneratingSuggestion(false);
    }
  }

  async function handleDismissSuggestion() {
    if (!suggestionId) return;
    await apiFetch(`/api/v1/inbox/ai-suggestions/${suggestionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" })
    }).catch(() => {});
    setSuggestionId(null);
    setLastSuggestionText(null);
    setKnowledgeCitations([]);
    setKnowledgeOnlyMode(false);
    isProgrammaticRef.current = true;
    setText("");
  }

  function handleDismissKnowledgeFallback() {
    setKnowledgeOnlyMode(false);
    setKnowledgeCitations([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!conversationId || !canSend) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      onSendStart?.({ text: trimmedText || trimmedImageUrl, conversationId });

      await apiFetch<null>(`/api/v1/line/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          trimmedImageUrl
            ? { imageUrl: trimmedImageUrl, aiSuggestionId: suggestionId || undefined }
            : { text: trimmedText, aiSuggestionId: suggestionId || undefined }
        )
      });

      if (suggestionId) {
        const isEdited = trimmedText !== lastSuggestionText;
        await apiFetch(`/api/v1/inbox/ai-suggestions/${suggestionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: isEdited ? "edited" : "sent",
            final_sent_text: trimmedText
          })
        }).catch(() => {});
        setSuggestionId(null);
        setLastSuggestionText(null);
      }

      isProgrammaticRef.current = true;
      setText("");
      setImageUrl("");
      setPastedImagePreview(null);
      await onSent?.();
      setTimeout(() => textareaRef.current?.focus(), 0);
    } catch {
      setError(t.replyFailed);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isSlashActive && filteredReplies.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredReplies.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredReplies.length) % filteredReplies.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectReply(filteredReplies[selectedIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setText(text.replace(/\/(\w*)$/, ""));
        return;
      }
    }

    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedText = event.clipboardData.getData("text/plain").trim();
    if (isHttpsImageUrl(pastedText)) {
      event.preventDefault();
      setImageUrl(pastedText);
      setIsImagePanelOpen(true);
      setError(null);
      return;
    }

    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    const imageFile = imageItem?.getAsFile();
    if (!imageFile) {
      return;
    }

    event.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPastedImagePreview(reader.result);
        setError("Pasted image ready for preview. Upload storage is needed before LINE can send copied image files.");
      }
    };
    reader.readAsDataURL(imageFile);
  }

  return (
    <form
      ref={formRef}
      className="shrink-0 border-t border-border bg-white"
      onSubmit={handleSubmit}
    >
      <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-6 py-3 text-sm font-medium text-muted-foreground">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            aria-label={locale === "th" ? "เพิ่มรูปภาพด้วย URL" : "Add image URL"}
            className={[
              "inline-flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60",
              imageUrl ? "border-primary bg-primary-soft text-primary" : "border-border bg-white"
            ].join(" ")}
            disabled={!conversationId || isSending}
            onClick={() => setIsImagePanelOpen((current) => !current)}
            title={locale === "th" ? "เพิ่มรูปภาพด้วย URL" : "Add image URL"}
          >
            <ImagePlus aria-hidden="true" className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
          <span className="truncate font-medium">
            LINE OA: {lineChannelName ?? "-"}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {enableAiSuggest && (
            <button
              type="button"
              className={[
                "inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all duration-200 hover:from-violet-600 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:opacity-60 disabled:shadow-none",
                rateLimitLock ? "cursor-not-allowed" : ""
              ].join(" ")}
              disabled={!conversationId || isSending || isGeneratingSuggestion || rateLimitLock}
              onClick={() => handleAiSuggest("generate")}
            >
              <span>{isGeneratingSuggestion ? "⏳ กำลังคิด..." : rateLimitLock ? `⏳ รอ ${rateLimitCountdown} วินาที` : "✨ AI ร่างคำตอบ"}</span>
            </button>
          )}
          <span className="hidden shrink-0 sm:inline">{t.enterSends}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-5">
        {knowledgeOnlyMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
            <span className="flex-1">{t.knowledgeOnlyFallbackHint}</span>
            <button
              type="button"
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-amber-800 transition-colors hover:bg-amber-100"
              onClick={handleDismissKnowledgeFallback}
            >
              ✕
            </button>
          </div>
        ) : null}
        {knowledgeCitations.length > 0 ? (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
            <p className="mb-2 font-semibold">{t.knowledgeCitationsTitle}</p>
            <ul className="flex flex-wrap gap-2">
              {knowledgeCitations.map((citation, index) => (
                <li
                  key={`${citation.type}-${citation.title}-${index}`}
                  className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5"
                  title={citation.excerpt}
                >
                  <span className="font-semibold text-indigo-700">
                    {citation.type === "article" ? t.sourceArticle : t.sourceDocument}:
                  </span>{" "}
                  {citation.title}
                  {typeof citation.score === "number" ? (
                    <span className="ml-1 text-indigo-500">({Math.round(citation.score * 100)}%)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {(suggestionId || text.trim().length > 0) && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-purple-50 p-3 border border-purple-100 text-xs font-semibold text-purple-700">
            <span className="mr-1">{t.toneRefineHeader}</span>
            <button
              type="button"
              className="rounded-lg bg-white px-2.5 py-1.5 border border-purple-200 hover:bg-purple-100 transition-colors"
              onClick={() => handleAiSuggest("rewrite")}
              disabled={isGeneratingSuggestion || rateLimitLock}
            >
              {t.rewriteBtn}
            </button>
            <button
              type="button"
              className="rounded-lg bg-white px-2.5 py-1.5 border border-purple-200 hover:bg-purple-100 transition-colors"
              onClick={() => handleAiSuggest("shorter")}
              disabled={isGeneratingSuggestion || rateLimitLock}
            >
              {t.shorterBtn}
            </button>
            <button
              type="button"
              className="rounded-lg bg-white px-2.5 py-1.5 border border-purple-200 hover:bg-purple-100 transition-colors"
              onClick={() => handleAiSuggest("polite")}
              disabled={isGeneratingSuggestion || rateLimitLock}
            >
              {t.politeBtn}
            </button>
            <button
              type="button"
              className="rounded-lg bg-white px-2.5 py-1.5 border border-purple-200 hover:bg-purple-100 transition-colors"
              onClick={() => handleAiSuggest("friendly")}
              disabled={isGeneratingSuggestion || rateLimitLock}
            >
              {t.friendlyBtn}
            </button>
            {suggestionId && cameFromAiGenerate && (
              <button
                type="button"
                className="rounded-lg bg-white px-2.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 transition-colors ml-auto"
                onClick={handleDismissSuggestion}
                disabled={isGeneratingSuggestion}
              >
                {t.dismissBtn}
              </button>
            )}
            <span className="text-purple-400 font-normal ml-2 sm:ml-4 select-none">
              {t.aiCreditCostHint}
            </span>
          </div>
        )}
        <label className="sr-only" htmlFor="reply-text">
          Reply text
        </label>
        <div className="flex flex-col gap-3 sm:flex-row flex-1">
          <div className="relative flex-1 flex flex-col">
            {isSlashActive && filteredReplies.length > 0 ? (
              <div className="absolute bottom-full left-0 mb-2 z-50 bg-white border border-border rounded-xl shadow-lg w-80 max-h-48 overflow-y-auto p-1 flex flex-col">
                {filteredReplies.map((reply, index) => (
                  <button
                    key={reply.id}
                    type="button"
                    className={[
                      "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between",
                      index === selectedIndex ? "bg-primary text-white" : "hover:bg-secondary text-foreground"
                    ].join(" ")}
                    onClick={() => selectReply(reply)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="font-semibold truncate">/{reply.shortcutKey}</span>
                    <span className={`text-xs truncate ml-2 ${index === selectedIndex ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {reply.title}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <textarea
              ref={textareaRef}
              id="reply-text"
              aria-label="Reply text"
              className="min-h-14 flex-1 resize-none rounded-[14px] border-2 border-[#C9C7D1] bg-[#F7F6FB] px-5 py-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary sm:min-h-16 w-full"
              disabled={!conversationId || isSending}
              maxLength={5000}
              onChange={(event) => {
                if (isProgrammaticRef.current) {
                  isProgrammaticRef.current = false;
                } else {
                  setCameFromAiGenerate(false);
                }
                setText(event.target.value);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t.typeReply}
              value={text}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              aria-label="Send reply"
              className="min-h-14 gap-2 self-stretch rounded-[14px] px-6 text-base font-bold sm:self-end"
              disabled={!canSend}
              type="submit"
            >
              <SendHorizontal aria-hidden="true" size={16} />
              {isSending ? t.sending : t.send}
            </Button>
          </div>
        </div>
        {isImagePanelOpen ? (
          <div className="grid gap-2 rounded-xl border border-border bg-white p-3">
            <div className="flex items-center gap-2">
              <ImagePlus aria-hidden="true" size={16} className="text-muted-foreground" />
              <label className="sr-only" htmlFor="reply-image-url">
                Reply image URL
              </label>
              <input
                id="reply-image-url"
                aria-label="Reply image URL"
                className="h-10 min-w-0 flex-1 text-sm outline-none placeholder:text-muted-foreground"
                disabled={!conversationId || isSending}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder={locale === "th" ? "วาง https image URL" : "Paste https image URL"}
                type="url"
                value={imageUrl}
              />
              {imageUrl ? (
              <button
                type="button"
                aria-label="Clear image URL"
                className="rounded p-1 text-muted-foreground hover:bg-secondary"
                onClick={() => setImageUrl("")}
              >
                <X aria-hidden="true" size={14} />
              </button>
              ) : null}
            </div>
            {pastedImagePreview ? (
            <div className="flex items-center gap-2 rounded-md border border-border p-2">
              <img
                src={pastedImagePreview}
                alt="Pasted preview"
                className="h-10 w-10 rounded object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                Clipboard image preview
              </span>
              <button
                type="button"
                aria-label="Clear pasted image"
                className="rounded p-1 text-muted-foreground hover:bg-secondary"
                onClick={() => {
                  setPastedImagePreview(null);
                  setError(null);
                }}
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

function isHttpsImageUrl(value: string): boolean {
  return /^https:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(value);
}

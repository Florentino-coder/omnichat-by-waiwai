"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@omnichat/ui";
import { ImagePlus, SendHorizontal, X } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";

interface ReplyComposerProps {
  conversationId: string | null;
  insertText?: string;
  insertNonce?: number;
  lineChannelName?: string | null;
  onSent?: () => Promise<void> | void;
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
  onSent
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
    setText(replacedText);
    if (reply.imageUrl) {
      setImageUrl(reply.imageUrl);
      setIsImagePanelOpen(true);
    }
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (insertText) {
      setText(insertText);
    }
  }, [insertNonce, insertText]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!conversationId || !canSend) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await apiFetch<null>(`/api/v1/line/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmedImageUrl ? { imageUrl: trimmedImageUrl } : { text: trimmedText })
      });
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
              "inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60",
              imageUrl ? "border-primary bg-primary-soft text-primary" : "border-border bg-white"
            ].join(" ")}
            disabled={!conversationId || isSending}
            onClick={() => setIsImagePanelOpen((current) => !current)}
            title={locale === "th" ? "เพิ่มรูปภาพด้วย URL" : "Add image URL"}
          >
            <ImagePlus aria-hidden="true" size={15} />
          </button>
          <span className="truncate font-medium">
            LINE OA: {lineChannelName ?? "-"}
          </span>
        </div>
        <span className="hidden shrink-0 sm:inline">{t.enterSends}</span>
      </div>
      <div className="flex flex-col gap-3 p-5">
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
              onChange={(event) => setText(event.target.value)}
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

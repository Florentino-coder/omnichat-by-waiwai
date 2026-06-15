"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@omnichat/ui";
import { ImagePlus, SendHorizontal, X } from "lucide-react";
import { apiFetch } from "../../lib/api-client";

interface ReplyComposerProps {
  conversationId: string | null;
  insertText?: string;
  insertNonce?: number;
  lineChannelName?: string | null;
  onSent?: () => Promise<void> | void;
}

export function ReplyComposer({
  conversationId,
  insertText,
  insertNonce,
  lineChannelName,
  onSent
}: ReplyComposerProps) {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isImagePanelOpen, setIsImagePanelOpen] = useState(false);
  const [pastedImagePreview, setPastedImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const trimmedText = text.trim();
  const trimmedImageUrl = imageUrl.trim();
  const canSend = Boolean(conversationId && !isSending && (trimmedText || trimmedImageUrl));

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
    } catch {
      setError("Reply failed. Try again.");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
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
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground lg:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="Add image URL"
            className={[
              "inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60",
              imageUrl ? "border-primary bg-primary-soft text-primary" : "border-border bg-white"
            ].join(" ")}
            disabled={!conversationId || isSending}
            onClick={() => setIsImagePanelOpen((current) => !current)}
            title="Add image URL"
          >
            <ImagePlus aria-hidden="true" size={15} />
          </button>
          <span className="truncate font-medium">
            LINE OA: {lineChannelName ?? "-"}
          </span>
        </div>
        <span className="hidden shrink-0 sm:inline">Enter sends</span>
      </div>
      <div className="flex flex-col gap-3 p-3 lg:p-4">
        <label className="sr-only" htmlFor="reply-text">
          Reply text
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <textarea
            id="reply-text"
            aria-label="Reply text"
            className="min-h-16 flex-1 resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground sm:min-h-20"
            disabled={!conversationId || isSending}
            maxLength={5000}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type LINE reply"
            value={text}
          />
          <div className="flex items-end gap-2">
            <Button
              className="gap-2 self-stretch sm:self-end"
              disabled={!canSend}
              type="submit"
            >
              <SendHorizontal aria-hidden="true" size={16} />
              {isSending ? "Sending" : "Send reply"}
            </Button>
          </div>
        </div>
        {isImagePanelOpen ? (
          <div className="grid gap-2 rounded-md border border-border bg-white p-2">
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
                placeholder="Paste https image URL"
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

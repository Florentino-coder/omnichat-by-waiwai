"use client";

import { FormEvent, useState } from "react";
import { Button } from "@omnichat/ui";
import { SendHorizontal } from "lucide-react";
import { apiFetch } from "../../lib/api-client";

interface ReplyComposerProps {
  conversationId: string | null;
  onSent?: () => Promise<void> | void;
}

export function ReplyComposer({ conversationId, onSent }: ReplyComposerProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedText = text.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!conversationId || !trimmedText || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await apiFetch<null>(`/api/v1/line/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText })
      });
      setText("");
      await onSent?.();
    } catch {
      setError("Reply failed. Try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form className="shrink-0 border-t border-border bg-white p-3 lg:p-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="reply-text">
          Reply text
        </label>
        <textarea
          id="reply-text"
          aria-label="Reply text"
          className="min-h-16 flex-1 resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground sm:min-h-20"
          disabled={!conversationId || isSending}
          maxLength={5000}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type LINE reply"
          value={text}
        />
        <Button
          className="gap-2 self-stretch sm:self-end"
          disabled={!conversationId || !trimmedText || isSending}
          type="submit"
        >
          <SendHorizontal aria-hidden="true" size={16} />
          {isSending ? "Sending" : "Send reply"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

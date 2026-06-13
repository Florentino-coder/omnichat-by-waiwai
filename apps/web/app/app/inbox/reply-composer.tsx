"use client";

import { FormEvent, useState } from "react";
import { Button } from "@omnichat/ui";
import { SendHorizontal } from "lucide-react";

interface ReplyComposerProps {
  conversationId: string;
}

export function ReplyComposer({ conversationId }: ReplyComposerProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedText = text.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedText || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    const response = await fetch(`/api/v1/line/conversations/${conversationId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmedText })
    });

    setIsSending(false);

    if (!response.ok) {
      setError("Reply failed. Try again.");
      return;
    }

    setText("");
  }

  return (
    <form className="border-t border-border bg-white p-4" onSubmit={handleSubmit}>
      <div className="flex gap-3">
        <label className="sr-only" htmlFor="reply-text">
          Reply text
        </label>
        <textarea
          id="reply-text"
          aria-label="Reply text"
          className="min-h-20 flex-1 resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          disabled={isSending}
          maxLength={5000}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type LINE reply"
          value={text}
        />
        <Button className="gap-2 self-end" disabled={!trimmedText || isSending} type="submit">
          <SendHorizontal aria-hidden="true" size={16} />
          {isSending ? "Sending" : "Send reply"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}

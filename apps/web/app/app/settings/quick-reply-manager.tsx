"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";

type LineChannel = {
  id: string;
  name: string;
  badgeColor?: string | null;
  lineChannelId: string;
};

type SavedReply = {
  id: string;
  lineChannelId?: string | null;
  title: string;
  body: string;
  isActive?: boolean;
};

type FormState = {
  title: string;
  body: string;
};

const emptyForm: FormState = {
  title: "",
  body: ""
};

export function QuickReplyManager() {
  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [selectedLineChannelId, setSelectedLineChannelId] = useState("");
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedLineChannelId) ?? null,
    [channels, selectedLineChannelId]
  );
  const isEditing = Boolean(editingReplyId);
  const canSave = Boolean(selectedLineChannelId && form.title.trim() && form.body.trim() && !isSaving);

  useEffect(() => {
    let isCurrent = true;

    async function loadChannels(): Promise<void> {
      setIsLoadingChannels(true);
      setError(null);
      try {
        const channelData = await apiFetch<LineChannel[]>("/api/v1/line/channels");
        if (!isCurrent) {
          return;
        }
        const safeChannelData = Array.isArray(channelData) ? channelData : [];
        setChannels(safeChannelData);
        setSelectedLineChannelId((current) => current || safeChannelData[0]?.id || "");
      } catch (loadError) {
        if (isCurrent) {
          setError(readMessage(loadError, "Could not load LINE channels."));
        }
      } finally {
        if (isCurrent) {
          setIsLoadingChannels(false);
        }
      }
    }

    void loadChannels();

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedLineChannelId) {
      setReplies([]);
      return;
    }

    void loadReplies(selectedLineChannelId);
  }, [selectedLineChannelId]);

  async function loadReplies(lineChannelId: string): Promise<void> {
    setIsLoadingReplies(true);
    setError(null);
    try {
      const replyData = await apiFetch<SavedReply[]>(
        `/api/v1/inbox/saved-replies?lineChannelId=${encodeURIComponent(lineChannelId)}`
      );
      setReplies(Array.isArray(replyData) ? replyData : []);
    } catch (loadError) {
      setError(readMessage(loadError, "Could not load Quick Replies."));
    } finally {
      setIsLoadingReplies(false);
    }
  }

  function updateField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setError(null);
    };
  }

  async function saveReply(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        lineChannelId: selectedLineChannelId,
        title: form.title.trim(),
        body: form.body.trim()
      };
      if (editingReplyId) {
        await apiFetch<SavedReply>(`/api/v1/inbox/saved-replies/${editingReplyId}`, {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        });
      } else {
        await apiFetch<SavedReply>("/api/v1/inbox/saved-replies", {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
      }
      setForm(emptyForm);
      setEditingReplyId(null);
      await loadReplies(selectedLineChannelId);
    } catch (saveError) {
      setError(readMessage(saveError, "Could not save Quick Reply."));
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(reply: SavedReply): void {
    setEditingReplyId(reply.id);
    setForm({
      title: reply.title,
      body: reply.body
    });
    setError(null);
  }

  function cancelEdit(): void {
    setEditingReplyId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function deleteReply(reply: SavedReply): Promise<void> {
    if (!selectedLineChannelId || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch<SavedReply>(`/api/v1/inbox/saved-replies/${reply.id}`, {
        method: "DELETE"
      });
      await loadReplies(selectedLineChannelId);
    } catch (deleteError) {
      setError(readMessage(deleteError, "Could not delete Quick Reply."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4 grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="quick-reply-line-channel">LINE OA</Label>
        <select
          id="quick-reply-line-channel"
          aria-label="Quick Reply LINE OA"
          className="h-10 rounded-md border border-border bg-white px-3 text-sm"
          disabled={isLoadingChannels || channels.length === 0}
          onChange={(event) => {
            setSelectedLineChannelId(event.target.value);
            cancelEdit();
          }}
          value={selectedLineChannelId}
        >
          {channels.length === 0 ? <option value="">No LINE OA connected</option> : null}
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>

      <form className="grid gap-3 rounded-md border border-border bg-white p-4" onSubmit={saveReply}>
        <div className="grid gap-2">
          <Label htmlFor="quick-reply-title">Quick Reply title</Label>
          <Input
            id="quick-reply-title"
            maxLength={80}
            onChange={updateField("title")}
            placeholder="Greeting"
            value={form.title}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quick-reply-body">Quick Reply body</Label>
          <textarea
            id="quick-reply-body"
            aria-label="Quick Reply body"
            className="min-h-24 resize-none rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
            maxLength={5000}
            onChange={updateField("body")}
            placeholder="ข้อความตอบกลับ"
            value={form.body}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canSave}>
            <Plus size={14} aria-hidden="true" />
            {isEditing ? "Save Quick Reply" : "Add Quick Reply"}
          </Button>
          {isEditing ? (
            <Button type="button" variant="secondary" onClick={cancelEdit} disabled={isSaving}>
              <X size={14} aria-hidden="true" />
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <div className="grid gap-2">
        {isLoadingReplies ? <p className="text-sm text-muted-foreground">Loading Quick Replies...</p> : null}
        {!isLoadingReplies && replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Quick Reply for this LINE OA yet.</p>
        ) : null}
        {replies.map((reply) => (
          <div
            key={reply.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-white p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {selectedChannel?.name ?? "LINE OA"} : Quick Reply {reply.title}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{reply.body}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`Edit Quick Reply ${reply.title}`}
                className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => startEdit(reply)}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Delete Quick Reply ${reply.title}`}
                className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                disabled={isSaving}
                onClick={() => void deleteReply(reply)}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

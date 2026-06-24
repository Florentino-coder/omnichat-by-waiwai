"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X, Image as ImageIcon, Keyboard, Zap } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";
import { canManageSharedQuickReplies } from "../../lib/settings-rbac";
import { useAuthSession } from "../../lib/use-auth-session";

type LineChannel = {
  id: string;
  name: string;
  badgeColor?: string | null;
  lineChannelId: string;
};

type SavedReply = {
  id: string;
  lineChannelId?: string | null;
  userId?: string | null;
  title: string;
  body: string;
  isActive?: boolean;
  shortcutKey?: string | null;
  imageUrl?: string | null;
  hotkeyBinding?: string | null;
};

type FormState = {
  title: string;
  body: string;
  shortcutKey: string;
  imageUrl: string;
  hotkeyBinding: string;
};

const emptyForm: FormState = {
  title: "",
  body: "",
  shortcutKey: "",
  imageUrl: "",
  hotkeyBinding: ""
};

export function QuickReplyManager() {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const { user } = useAuthSession();

  const [channels, setChannels] = useState<LineChannel[]>([]);
  const [selectedLineChannelId, setSelectedLineChannelId] = useState("");
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab: shared (ส่วนรวม) vs personal (ส่วนตัว)
  const [replyTab, setReplyTab] = useState<"shared" | "personal">("shared");

  const isEditing = Boolean(editingReplyId);
  const canSave = Boolean(
    selectedLineChannelId &&
    form.title.trim() &&
    form.body.trim() &&
    !isSaving
  );

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedLineChannelId) ?? null,
    [channels, selectedLineChannelId]
  );

  const canManageShared = canManageSharedQuickReplies(user?.role);

  // Load Channels
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

  // Load Replies when channel or tab changes
  useEffect(() => {
    if (!selectedLineChannelId) {
      setReplies([]);
      return;
    }

    void loadReplies(selectedLineChannelId, replyTab);
  }, [selectedLineChannelId, replyTab]);

  async function loadReplies(lineChannelId: string, tab: "shared" | "personal"): Promise<void> {
    setIsLoadingReplies(true);
    setError(null);
    try {
      const replyData = await apiFetch<SavedReply[]>(
        `/api/v1/inbox/saved-replies?lineChannelId=${encodeURIComponent(lineChannelId)}&type=${tab}`
      );
      setReplies(Array.isArray(replyData) ? replyData : []);
    } catch (loadError) {
      setError(readMessage(loadError, "Could not load Quick Replies."));
    } finally {
      setIsLoadingReplies(false);
    }
  }

  function updateField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value
      }));
    };
  }

  async function saveReply(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedLineChannelId || !canSave) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      lineChannelId: selectedLineChannelId,
      title: form.title.trim(),
      body: form.body.trim(),
      shortcutKey: form.shortcutKey.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      hotkeyBinding: (form.hotkeyBinding && form.hotkeyBinding !== "NONE") ? form.hotkeyBinding : undefined,
      // For personal replies, set the userId
      userId: replyTab === "personal" ? user?.id : undefined
    };

    try {
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
      await loadReplies(selectedLineChannelId, replyTab);
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
      body: reply.body,
      shortcutKey: reply.shortcutKey || "",
      imageUrl: reply.imageUrl || "",
      hotkeyBinding: reply.hotkeyBinding || "NONE"
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
      await loadReplies(selectedLineChannelId, replyTab);
    } catch (deleteError) {
      setError(readMessage(deleteError, "Could not delete Quick Reply."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4 grid gap-5">
      {/* LINE OA Selector */}
      <div className="grid gap-2">
        <Label htmlFor="quick-reply-line-channel">{t.channel}</Label>
        <select
          id="quick-reply-line-channel"
          aria-label="Quick Reply LINE OA"
          className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          disabled={isLoadingChannels || channels.length === 0}
          onChange={(event) => {
            setSelectedLineChannelId(event.target.value);
            cancelEdit();
          }}
          value={selectedLineChannelId}
        >
          {channels.length === 0 ? (
            <option value="">{locale === "th" ? "ไม่มี LINE OA เชื่อมต่ออยู่" : "No LINE OA connected"}</option>
          ) : null}
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs Switcher: Shared vs Personal */}
      <div className="flex gap-2 border-b border-border pb-1">
        <button
          type="button"
          onClick={() => {
            setReplyTab("shared");
            cancelEdit();
          }}
          className={`pb-2 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            replyTab === "shared"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {locale === "th" ? "คำตอบด่วนส่วนรวม (Shared)" : "Shared Templates"}
        </button>
        <button
          type="button"
          onClick={() => {
            setReplyTab("personal");
            cancelEdit();
          }}
          className={`pb-2 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            replyTab === "personal"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {locale === "th" ? "คำตอบด่วนส่วนตัว (Personal)" : "Personal Templates"}
        </button>
      </div>

      {/* Form Card (Hide if Shared tab and user is not Owner/Admin) */}
      {(replyTab === "personal" || canManageShared) ? (
        <form className="grid gap-4 rounded-xl border border-[#DEDDE6]/80 bg-white p-5 shadow-sm" onSubmit={saveReply}>
          <div className="grid gap-2">
            <Label htmlFor="quick-reply-title">
              {locale === "th" ? "หัวข้อคำตอบด่วน" : "Quick Reply title"}
            </Label>
            <Input
              id="quick-reply-title"
              maxLength={80}
              onChange={updateField("title")}
              placeholder={locale === "th" ? "ทักทาย" : "Greeting"}
              value={form.title}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quick-reply-body">
              {locale === "th" ? "ข้อความคำตอบด่วน" : "Quick Reply body"}
            </Label>
            <textarea
              id="quick-reply-body"
              aria-label="Quick Reply body"
              className="min-h-24 resize-none rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
              maxLength={5000}
              onChange={updateField("body")}
              placeholder={locale === "th" ? "ข้อความตอบกลับ" : "Reply content"}
              value={form.body}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Shortcut Key field */}
            <div className="grid gap-2">
              <Label htmlFor="quick-reply-shortcut">
                {locale === "th" ? "คีย์ลัดสำหรับพิมพ์ (พิมพ์ /shortcut)" : "Shortcut Command (/shortcut)"}
              </Label>
              <Input
                id="quick-reply-shortcut"
                maxLength={30}
                onChange={(e) => {
                  // remove leading slash if typed
                  const val = e.target.value.replace(/^\//, "").replace(/\s+/g, "");
                  setForm(c => ({ ...c, shortcutKey: val }));
                }}
                placeholder="hi"
                value={form.shortcutKey}
              />
            </div>

            {/* Hotkey Select field */}
            <div className="grid gap-2">
              <Label htmlFor="quick-reply-hotkey">
                {locale === "th" ? "ปุ่มลัด Hotkey (Inbox)" : "Hotkey Binding (Inbox)"}
              </Label>
              <select
                id="quick-reply-hotkey"
                className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                onChange={updateField("hotkeyBinding")}
                value={form.hotkeyBinding || "NONE"}
              >
                <option value="NONE">None</option>
                {Array.from({ length: 12 }, (_, i) => `F${i + 1}`).map((fKey) => (
                  <option key={fKey} value={fKey}>
                    {fKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Image URL field */}
            <div className="grid gap-2">
              <Label htmlFor="quick-reply-image">
                {locale === "th" ? "ที่อยู่รูปภาพ URL (ถ้ามี)" : "Image URL (Optional)"}
              </Label>
              <Input
                id="quick-reply-image"
                type="url"
                maxLength={500}
                onChange={updateField("imageUrl")}
                placeholder="https://example.com/image.png"
                value={form.imageUrl}
              />
            </div>
          </div>

          {form.imageUrl.trim() && (
            <div className="flex flex-col gap-1.5 p-2 rounded-lg border border-border bg-[#F7F6FB] max-w-sm">
              <span className="text-xs text-muted-foreground">Image Preview:</span>
              <img
                src={form.imageUrl.trim()}
                alt="Image reply preview"
                className="max-h-32 object-contain rounded border border-border bg-white"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={!canSave}>
              <Plus size={14} aria-hidden="true" />
              {isEditing ? t.saveQuickReply : t.addQuickReply}
            </Button>
            {isEditing ? (
              <Button type="button" variant="secondary" onClick={cancelEdit} disabled={isSaving}>
                <X size={14} aria-hidden="true" />
                {t.cancelEdit}
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-warning-strong font-medium">
          {locale === "th"
            ? "⚠️ เฉพาะเจ้าของ (Owner) หรือผู้จัดระบบ (Admin) เท่านั้นที่สามารถสร้างและแก้ไขคำตอบด่วนส่วนรวมได้"
            : "⚠️ Only owners and administrators can manage shared quick replies."}
        </div>
      )}

      {/* Replies List */}
      <div className="grid gap-3">
        {isLoadingReplies ? (
          <p className="text-sm text-muted-foreground">
            {locale === "th" ? "กำลังโหลดคำตอบด่วน..." : "Loading Quick Replies..."}
          </p>
        ) : null}
        {!isLoadingReplies && replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noQuickReplyYet}</p>
        ) : null}
        
        {replies.map((reply) => (
          <div
            key={reply.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white p-4 hover:shadow-sm transition-all"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {selectedChannel?.name ?? "LINE OA"} : Quick Reply {reply.title}
                </span>

                {/* Badge tags for quick metadata identification */}
                {reply.shortcutKey && (
                  <span className="inline-flex items-center gap-1 rounded bg-[#EBF5FF] px-2 py-0.5 text-[10px] font-bold text-[#0066CC]">
                    <Zap size={10} />
                    /{reply.shortcutKey}
                  </span>
                )}
                {reply.hotkeyBinding && (
                  <span className="inline-flex items-center gap-1 rounded bg-[#ECEBFF] px-2 py-0.5 text-[10px] font-bold text-[#4636D7]">
                    <Keyboard size={10} />
                    {reply.hotkeyBinding}
                  </span>
                )}
                {reply.imageUrl && (
                  <span className="inline-flex items-center gap-1 rounded bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">
                    <ImageIcon size={10} />
                    {locale === "th" ? "รูปภาพ" : "Image"}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
                {reply.body}
              </p>

              {reply.imageUrl && (
                <div className="mt-2">
                  <img
                    src={reply.imageUrl}
                    alt="Quick reply visual"
                    className="max-h-20 object-contain rounded border border-border"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Edit / Delete (Hide if shared and user is not Owner/Admin) */}
            {(replyTab === "personal" || canManageShared) ? (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Edit Quick Reply ${reply.title}`}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  onClick={() => startEdit(reply)}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete Quick Reply ${reply.title}`}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors"
                  disabled={isSaving}
                  onClick={() => void deleteReply(reply)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ) : null}
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

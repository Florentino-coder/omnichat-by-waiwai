import { useState } from "react";
import { Check, Pencil, StickyNote, Tags, UserPlus, X } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { AssignDropdown } from "./AssignDropdown";
import { QuickReplyList } from "./QuickReplyList";
import { TagList } from "./TagList";

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
  onSaveAssignment?: () => void;
  onToggleTag?: (tag: { id: string; name: string; color?: string | null; isAttached: boolean }) => void;
  onCreateTag?: (name: string) => void;
  onToggleAutoQuickReply?: () => void;
  onSelectQuickReply?: (id: string) => void;
  onNoteDraftChange?: (value: string) => void;
  onCreateNote?: () => void;
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
  onCreateNote
}: CustomerPanelProps) {
  const [newTagName, setNewTagName] = useState("");
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

        <section className="border-b border-border px-6 py-5">
          <p className="mb-3 flex items-center gap-2 text-base font-semibold text-[#6B6D7A]">
            <UserPlus size={17} aria-hidden="true" />
            มอบหมายให้
          </p>
          <AssignDropdown
            disabled={disabled || isSavingAssignment}
            value={assigneeValue}
            options={assigneeValue ? [{ id: assigneeValue, label: assigneeValue }] : []}
            onChange={(value) => onAssigneeChange?.(value)}
          />
          <div className="mt-3 grid gap-2">
            <label className="sr-only" htmlFor="assignee-member-id">
              Workspace member ID
            </label>
            <input
              id="assignee-member-id"
              className="h-11 rounded-xl border border-border bg-[#F7F6FB] px-3 text-sm outline-none focus:border-primary"
              disabled={disabled || isSavingAssignment}
              onChange={(event) => onAssigneeChange?.(event.target.value)}
              placeholder="Workspace member ID"
              value={assigneeValue}
            />
            <button
              type="button"
              aria-label="Assign conversation"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
              disabled={disabled || isSavingAssignment}
              onClick={onSaveAssignment}
            >
              <UserPlus size={16} aria-hidden="true" />
              Assign
            </button>
          </div>
        </section>

        <section className="border-b border-border px-6 py-5">
          <p className="mb-3 flex items-center gap-2 text-base font-semibold text-[#6B6D7A]">
            <Tags size={17} aria-hidden="true" />
            แท็ก
          </p>
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
        </section>

        <section id="quick-reply-section" className="border-b border-border px-6 py-5">
          <QuickReplyList
            autoEnabled={autoQuickReply}
            replies={savedReplies}
            disabled={disabled}
            onToggleAuto={onToggleAutoQuickReply ?? (() => undefined)}
            onSelect={(id) => onSelectQuickReply?.(id)}
          />
        </section>

        <section className="border-b border-border px-6 py-5">
          <p className="mb-3 flex items-center gap-2 text-base font-semibold text-[#6B6D7A]">
            <StickyNote size={17} aria-hidden="true" />
            โน้ตภายใน
          </p>
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
        </section>

        <section className="border-b border-border px-6 py-5">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Contact</p>
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
            <Description label="Customer ID" value={sourceId} mono />
          </dl>
        </section>

        <section className="border-b border-border px-6 py-5">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Channel</p>
          <dl className="space-y-4 text-sm">
            <Description label="Source" value="LINE OA" />
            <Description label="LINE source type" value={sourceType} />
            <Description label="OA channel name" value={lineLabel} />
            <Description label="OA channel ID" value={lineChannelId} mono />
          </dl>
        </section>

        <section className="px-6 py-5">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Latest message</p>
          <dl className="space-y-4 text-sm">
            <Description label="Message type" value={latestMessageType} />
            <Description label="Message ID" value={latestMessageId} mono />
          </dl>
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
    timeStyle: "short"
  }).format(date);
}

export { AssignDropdown } from "./AssignDropdown";
export { QuickReplyList } from "./QuickReplyList";
export { TagList };

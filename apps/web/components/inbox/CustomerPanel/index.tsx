import { Check, Pencil, StickyNote, Tags, UserPlus, X } from "lucide-react";
import { Button, Input, Label } from "@omnichat/ui";
import { AssignDropdown } from "./AssignDropdown";
import { QuickReplyList } from "./QuickReplyList";
import { TagList } from "./TagList";

interface CustomerPanelProps {
  customerName: string;
  customerInitial: string;
  lineLabel: string;
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
  onToggleAutoQuickReply?: () => void;
  onSelectQuickReply?: (id: string) => void;
  onNoteDraftChange?: (value: string) => void;
  onCreateNote?: () => void;
}

export function CustomerPanel({
  customerName,
  customerInitial,
  lineLabel,
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
  onToggleAutoQuickReply,
  onSelectQuickReply,
  onNoteDraftChange,
  onCreateNote
}: CustomerPanelProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-white" aria-labelledby="context-heading">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 id="context-heading" className="font-heading text-sm font-medium">ข้อมูลลูกค้า</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">ข้อมูล LINE และการจัดการแชท</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            {lineProfile?.pictureUrl ? (
              <img
                src={lineProfile.pictureUrl}
                alt=""
                className="h-10 w-10 rounded-full border-2 border-border object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FF] text-sm font-medium text-primary">
                {customerInitial}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-xs font-medium">{customerName}</h3>
              <p className="truncate text-[11px] text-muted-foreground">LINE OA · {lineLabel}</p>
              {lineProfile?.statusMessage ? (
                <p className="truncate text-[11px] text-muted-foreground">{lineProfile.statusMessage}</p>
              ) : null}
              {lineProfile?.language ? (
                <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {lineProfile.language}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <section className="border-b border-border px-4 py-3">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <UserPlus size={12} aria-hidden="true" />
            Assignment
          </p>
          <AssignDropdown
            disabled={disabled || isSavingAssignment}
            value={assigneeValue}
            options={assigneeValue ? [{ id: assigneeValue, label: assigneeValue }] : []}
            onChange={(value) => onAssigneeChange?.(value)}
          />
          <div className="mt-2 grid gap-2">
            <label className="sr-only" htmlFor="assignee-member-id">
              Workspace member ID
            </label>
            <input
              id="assignee-member-id"
              className="h-9 rounded-md border border-border bg-white px-2 text-xs"
              disabled={disabled || isSavingAssignment}
              onChange={(event) => onAssigneeChange?.(event.target.value)}
              placeholder="Workspace member ID"
              value={assigneeValue}
            />
            <button
              type="button"
              aria-label="Assign conversation"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium hover:bg-secondary disabled:opacity-60"
              disabled={disabled || isSavingAssignment}
              onClick={onSaveAssignment}
            >
              <UserPlus size={14} aria-hidden="true" />
              Assign
            </button>
          </div>
        </section>

        <section className="border-b border-border px-4 py-3">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Tags size={12} aria-hidden="true" />
            แท็ก
          </p>
          <TagList tags={tags.map((tag) => tag.name)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {availableTags.length === 0 && !isLoadingOperations ? (
              <span className="rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                ยังไม่มีแท็ก
              </span>
            ) : null}
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                aria-label={`${tag.isAttached ? "Remove" : "Add"} tag ${tag.name}`}
                className={[
                  "rounded-full border px-2 py-1 text-xs font-medium",
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
        </section>

        <section className="border-b border-border px-4 py-3">
          <QuickReplyList
            autoEnabled={autoQuickReply}
            replies={savedReplies}
            disabled={disabled}
            onToggleAuto={onToggleAutoQuickReply ?? (() => undefined)}
            onSelect={(id) => onSelectQuickReply?.(id)}
          />
        </section>

        <section className="border-b border-border px-4 py-3">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <StickyNote size={12} aria-hidden="true" />
            โน้ตภายใน
          </p>
          <textarea
            aria-label="Internal note"
            className="min-h-20 w-full resize-none rounded-md border border-border bg-white px-2 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            disabled={disabled || isSavingNote}
            maxLength={2000}
            onChange={(event) => onNoteDraftChange?.(event.target.value)}
            placeholder="บันทึกเฉพาะทีม ไม่ส่งให้ลูกค้า"
            value={noteDraft}
          />
          <button
            type="button"
            className="mt-2 inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-xs font-medium hover:bg-secondary disabled:opacity-60"
            disabled={disabled || isSavingNote || !noteDraft.trim()}
            onClick={onCreateNote}
          >
            บันทึก
          </button>
          <div className="mt-3 grid gap-2">
            {notes.length === 0 && !isLoadingOperations ? (
              <p className="text-xs text-muted-foreground">ยังไม่มีโน้ต</p>
            ) : null}
            {notes.map((note) => (
              <div key={note.id} className="rounded-md border border-border bg-secondary px-2 py-2 text-xs">
                <p className="whitespace-pre-wrap text-foreground">{note.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(note.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-border px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">ชื่อลูกค้า</dt>
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
                    <span className="break-all font-medium">{customerName}</span>
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

        <section className="border-b border-border px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Channel</p>
          <dl className="space-y-3 text-sm">
            <Description label="Source" value="LINE OA" />
            <Description label="LINE source type" value={sourceType} />
            <Description label="OA channel name" value={lineLabel} />
            <Description label="OA channel ID" value={lineChannelId} mono />
          </dl>
        </section>

        <section className="px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Latest message</p>
          <dl className="space-y-3 text-sm">
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={["mt-1 font-medium", mono ? "break-all font-mono text-xs text-foreground" : ""].join(" ")}>
        {value}
      </dd>
    </div>
  );
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

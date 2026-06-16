import { Check, Flag, MessageSquareQuote, UserCircle } from "lucide-react";
import { STATUS_CONFIG, type ConvStatus } from "../status-config";

type StatusAction = "OPEN" | "IN_PROGRESS" | "RESOLVED";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface ChatHeaderProps {
  customerName: string;
  customerInitial: string;
  status: Extract<ConvStatus, "OPEN" | "PENDING" | "RESOLVED">;
  channelLabel: string;
  priority: Priority;
  disableActions?: boolean;
  disablePriority?: boolean;
  disableQuickReply?: boolean;
  disableStatus?: boolean;
  statusElapsed?: string | null;
  statusMenuOpen?: boolean;
  onOpenCustomer?: () => void;
  onQuickReply: () => void;
  onUpdatePriority: () => void;
  onUpdateStatus: (status: StatusAction) => void;
  toggleStatusMenu: () => void;
}

export function ChatHeader({
  customerName,
  customerInitial,
  status,
  channelLabel,
  priority,
  disableActions = false,
  disablePriority = false,
  disableQuickReply = false,
  disableStatus = false,
  statusElapsed,
  statusMenuOpen = false,
  onOpenCustomer,
  onQuickReply,
  onUpdatePriority,
  onUpdateStatus,
  toggleStatusMenu
}: ChatHeaderProps) {
  const config = STATUS_CONFIG[status];
  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
          style={{ backgroundColor: config.bg, borderColor: config.border, color: config.avatarText }}
        >
          {customerInitial}
        </div>
        <div className="min-w-0">
          <h2 id="thread-heading" className="truncate text-[13px] font-medium">{customerName}</h2>
          <p className="truncate text-[11px] text-muted-foreground">{channelLabel}</p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
          style={{ backgroundColor: config.bg, borderColor: config.border, color: config.avatarText }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.dot }} />
          {config.text}
          {statusElapsed ? ` · ${statusElapsed}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Priority"
          className={priorityButtonClass(priority)}
          disabled={disableActions || disablePriority}
          onClick={onUpdatePriority}
        >
          <Flag size={14} aria-hidden="true" />
          {priorityLabel(priority)}
        </button>
        <button
          type="button"
          aria-label="Insert saved reply"
          className="hidden min-h-8 items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60 sm:inline-flex"
          disabled={disableActions || disableQuickReply}
          onClick={onQuickReply}
        >
          <MessageSquareQuote size={14} aria-hidden="true" />
          Quick reply
        </button>
        <div className="relative">
          <button
            aria-label="Change conversation status"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#1F9D72] bg-[#ECFDF5] px-2 text-xs text-[#065F46] disabled:opacity-60"
            disabled={disableActions || disableStatus}
            onClick={toggleStatusMenu}
            type="button"
          >
            <Check size={13} aria-hidden="true" />
            {status === "RESOLVED" ? "ปิดแล้ว" : status === "PENDING" ? "กำลังดำเนินการ" : "เปิดอยู่"}
          </button>
          {statusMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-border bg-white p-1 shadow-sm"
            >
              {(["OPEN", "IN_PROGRESS", "RESOLVED"] as StatusAction[]).map((nextStatus) => (
                <button
                  key={nextStatus}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
                  onClick={() => onUpdateStatus(nextStatus)}
                >
                  {statusActionLabel(nextStatus)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          aria-label="Open customer info"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border md:hidden"
          onClick={onOpenCustomer}
          type="button"
        >
          <UserCircle size={17} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function priorityLabel(priority: Priority): string {
  switch (priority) {
    case "LOW":
      return "Low";
    case "HIGH":
      return "High";
    case "URGENT":
      return "Urgent";
    case "NORMAL":
      return "Normal";
  }
}

function priorityButtonClass(priority: Priority): string {
  const base =
    "inline-flex min-h-8 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60";
  if (priority === "URGENT") {
    return `${base} border-danger bg-red-50 text-danger hover:bg-red-100`;
  }
  if (priority === "HIGH") {
    return `${base} border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100`;
  }
  if (priority === "LOW") {
    return `${base} border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100`;
  }
  return `${base} border-border bg-white text-muted-foreground hover:bg-secondary`;
}

function statusActionLabel(status: StatusAction): string {
  switch (status) {
    case "IN_PROGRESS":
      return "กำลังดำเนินการ";
    case "RESOLVED":
      return "ดำเนินการแล้ว";
    case "OPEN":
      return "OPEN";
  }
}

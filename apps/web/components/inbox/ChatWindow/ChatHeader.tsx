import { Check, Flag, MessageSquareQuote, UserCircle, X } from "lucide-react";
import { STATUS_CONFIG, type ConvStatus } from "../status-config";

type StatusAction = "OPEN" | "IN_PROGRESS" | "RESOLVED";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface ChatHeaderProps {
  customerName: string;
  customerInitial: string;
  aiAutoReplyBadge?: string;
  escalationBadge?: string;
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
  onClose?: () => void;
}

export function ChatHeader({
  customerName,
  customerInitial,
  aiAutoReplyBadge,
  escalationBadge,
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
  toggleStatusMenu,
  onClose
}: ChatHeaderProps) {
  const config = STATUS_CONFIG[status];
  return (
    <header className="flex min-h-[72px] md:min-h-[104px] shrink-0 items-center justify-between gap-2 md:gap-4 border-b border-border bg-white px-4 py-3 md:px-6 md:py-5">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <div
          className="flex h-9 w-9 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-full border text-sm md:text-lg font-medium md:hidden"
          style={{ backgroundColor: config.bg, borderColor: config.border, color: config.avatarText }}
        >
          {customerInitial}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
            <h2 id="thread-heading" className="truncate text-base md:text-xl font-semibold">{customerName}</h2>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F0F0F5] px-2 py-0.5 md:px-3 md:py-1 text-[11px] md:text-sm font-semibold text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full" style={{ backgroundColor: config.dot }} />
              {config.text}
              {statusElapsed ? ` · ${statusElapsed}` : ""}
            </span>
            {aiAutoReplyBadge ? (
              <span className="inline-flex shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] md:text-xs font-semibold text-violet-700">
                {aiAutoReplyBadge}
              </span>
            ) : null}
            {escalationBadge ? (
              <span className="inline-flex shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] md:text-xs font-semibold text-amber-800">
                {escalationBadge}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 md:mt-1 truncate text-xs md:text-sm font-medium text-muted-foreground">
            ตอบกลับผ่าน LINE API · {channelLabel}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <button
          type="button"
          aria-label="Priority"
          className={`${priorityButtonClass(priority)} w-10 md:w-auto justify-center`}
          disabled={disableActions || disablePriority}
          onClick={onUpdatePriority}
        >
          <Flag size={14} className="md:w-4 md:h-4" aria-hidden="true" />
          <span className="hidden md:inline">{priorityLabel(priority)}</span>
        </button>
        <button
          type="button"
          aria-label="Insert saved reply"
          className="hidden min-h-14 items-center gap-2 rounded-xl border-2 border-[#D6D4DD] bg-white px-4 py-2 text-sm font-semibold text-[#585B68] hover:bg-secondary disabled:opacity-60 sm:inline-flex"
          disabled={disableActions || disableQuickReply}
          onClick={onQuickReply}
        >
          <MessageSquareQuote size={16} aria-hidden="true" />
          Quick reply
        </button>
        <div className="relative">
          <button
            aria-label="Change conversation status"
            className="inline-flex min-h-10 w-10 md:w-auto md:min-h-14 items-center justify-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl border-2 border-[#20A77A] bg-[#EFFFF8] px-2.5 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold text-[#08704F] disabled:opacity-60"
            disabled={disableActions || disableStatus}
            onClick={toggleStatusMenu}
            type="button"
          >
            <Check size={14} className="md:w-4 md:h-4" aria-hidden="true" />
            <span className="hidden md:inline">{status === "RESOLVED" ? "ดำเนินการแล้ว" : status === "PENDING" ? "รอแอดมิน" : "เปิดอยู่"}</span>
          </button>
          {statusMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-40 md:w-48 rounded-lg md:rounded-xl border border-border bg-white p-1 shadow-lg"
            >
              {(["OPEN", "IN_PROGRESS", "RESOLVED"] as StatusAction[]).map((nextStatus) => (
                <button
                  key={nextStatus}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-left text-xs md:text-sm font-medium hover:bg-secondary"
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
          className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg md:rounded-xl border border-border md:hidden bg-white text-muted-foreground hover:bg-secondary transition-colors"
          onClick={onOpenCustomer}
          type="button"
        >
          <UserCircle size={18} className="md:w-[22px] md:h-[22px]" aria-hidden="true" />
        </button>
        <button
          aria-label="Close conversation"
          className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg md:rounded-xl border border-[#D6D4DD] bg-white text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          onClick={onClose}
          type="button"
        >
          <X size={18} className="md:w-5 md:h-5" aria-hidden="true" />
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
    "inline-flex min-h-10 md:min-h-14 items-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl border-2 px-2.5 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-semibold transition-colors disabled:opacity-60";
  if (priority === "URGENT") {
    return `${base} border-danger bg-red-50 text-danger hover:bg-red-100`;
  }
  if (priority === "HIGH") {
    return `${base} border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100`;
  }
  if (priority === "LOW") {
    return `${base} border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100`;
  }
  return `${base} border-[#D6D4DD] bg-white text-[#585B68] hover:bg-secondary`;
}

function statusActionLabel(status: StatusAction): string {
  switch (status) {
    case "IN_PROGRESS":
      return "กำลังดำเนินการ";
    case "RESOLVED":
      return "ดำเนินการแล้ว";
    case "OPEN":
      return "เปิด";
  }
}

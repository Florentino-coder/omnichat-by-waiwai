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
    <header className="flex min-h-[104px] shrink-0 items-center justify-between gap-4 border-b border-border bg-white px-6 py-5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-lg font-medium md:hidden"
          style={{ backgroundColor: config.bg, borderColor: config.border, color: config.avatarText }}
        >
          {customerInitial}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 id="thread-heading" className="truncate text-xl font-semibold">{customerName}</h2>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F0F0F5] px-3 py-1 text-sm font-semibold text-muted-foreground"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.dot }} />
              {config.text}
              {statusElapsed ? ` · ${statusElapsed}` : ""}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-muted-foreground">
            ตอบกลับผ่าน LINE API · {channelLabel}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Priority"
          className={priorityButtonClass(priority)}
          disabled={disableActions || disablePriority}
          onClick={onUpdatePriority}
        >
          <Flag size={16} aria-hidden="true" />
          {priorityLabel(priority)}
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
            className="inline-flex min-h-14 items-center gap-2 rounded-xl border-2 border-[#20A77A] bg-[#EFFFF8] px-4 py-2 text-sm font-bold text-[#08704F] disabled:opacity-60"
            disabled={disableActions || disableStatus}
            onClick={toggleStatusMenu}
            type="button"
          >
            <Check size={16} aria-hidden="true" />
            {status === "RESOLVED" ? "ดำเนินการแล้ว" : status === "PENDING" ? "รอแอดมิน" : "เปิดอยู่"}
          </button>
          {statusMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-border bg-white p-1 shadow-lg"
            >
              {(["OPEN", "IN_PROGRESS", "RESOLVED"] as StatusAction[]).map((nextStatus) => (
                <button
                  key={nextStatus}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-secondary"
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
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-border md:hidden"
          onClick={onOpenCustomer}
          type="button"
        >
          <UserCircle size={22} aria-hidden="true" />
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
    "inline-flex min-h-14 items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60";
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

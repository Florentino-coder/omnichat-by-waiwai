import { type CSSProperties } from "react";
import { STATUS_CONFIG, type ConvStatus } from "../status-config";

export interface ConversationCardProps {
  id: string;
  customerName: string;
  customerInitial: string;
  preview: string;
  time: string;
  channelTag: string;
  channelStyle?: CSSProperties;
  status: Extract<ConvStatus, "OPEN" | "PENDING" | "RESOLVED">;
  unreadCount?: number;
  isActive?: boolean;
  onSelect?: (id: string) => void;
}

export function ConversationCard({
  id,
  customerName,
  customerInitial,
  preview,
  time,
  channelTag,
  channelStyle,
  status,
  unreadCount,
  isActive = false,
  onSelect
}: ConversationCardProps) {
  const config = STATUS_CONFIG[status];
  return (
    <button
      aria-label={`Open conversation ${customerName}`}
      className={[
        "grid w-full grid-cols-[30px_minmax(0,1fr)] gap-2 border-b border-border px-3 py-3 text-left transition-colors hover:bg-secondary",
        isActive ? "border-l-[2.5px] border-l-primary bg-[#EEF2FF]" : "border-l-[2.5px] border-l-transparent bg-white"
      ].join(" ")}
      onClick={() => onSelect?.(id)}
      type="button"
    >
      <span
        className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full border text-xs font-medium"
        style={{
          backgroundColor: config.bg,
          borderColor: config.border,
          color: config.avatarText
        }}
      >
        {customerInitial}
        {status !== "RESOLVED" ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white"
            style={{ backgroundColor: config.dot }}
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-foreground">{customerName}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>
        </span>
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">{preview}</span>
        <span className="mt-2 flex items-center justify-between gap-2">
          <span
            className="inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium text-[#3730A3] bg-[#E0E7FF]"
            style={channelStyle}
          >
            {channelTag}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.dot }} />
            {config.text}
            {unreadCount ? (
              <span className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#D97706] px-1 text-[10px] text-white">
                {unreadCount}
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}

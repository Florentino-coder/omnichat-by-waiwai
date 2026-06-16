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
        "grid min-h-[120px] w-full grid-cols-[54px_minmax(0,1fr)] gap-3 border-b border-border px-5 py-4 text-left transition-colors hover:bg-[#F7F7FF]",
        isActive ? "border-l-[3px] border-l-primary bg-[#EEF1FF]" : "border-l-[3px] border-l-transparent bg-white"
      ].join(" ")}
      onClick={() => onSelect?.(id)}
      type="button"
    >
      <span
        className="relative flex h-12 w-12 items-center justify-center rounded-full border text-lg font-medium"
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
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white"
            style={{ backgroundColor: config.dot }}
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="flex items-start justify-between gap-3">
          <span className="truncate text-base font-semibold text-foreground">{customerName}</span>
          <span className="shrink-0 text-sm font-medium text-muted-foreground">{time}</span>
        </span>
        <span className="mt-1 block truncate text-sm text-[#6F7180]">{preview}</span>
        <span className="mt-3 flex items-center justify-between gap-2">
          <span
            className="inline-flex rounded-md border border-[#DDE1FF] bg-[#E8EBFF] px-2.5 py-1 text-sm font-semibold text-[#4E47C8]"
            style={channelStyle}
          >
            {channelTag}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.dot }} />
            {config.text}
            {unreadCount ? (
              <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#E49A27] px-1.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}

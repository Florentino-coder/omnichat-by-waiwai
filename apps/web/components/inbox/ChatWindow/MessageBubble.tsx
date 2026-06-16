import { LockKeyhole } from "lucide-react";

export type MessageVariant = "outbound" | "inbound" | "note" | "system";

interface MessageBubbleProps {
  variant: MessageVariant;
  body: string;
  time?: string;
  authorInitial?: string;
}

export function MessageBubble({ variant, body, time, authorInitial }: MessageBubbleProps) {
  if (variant === "system") {
    return (
      <div className="flex justify-center">
        <div className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
          {body}
        </div>
      </div>
    );
  }

  const isOutbound = variant === "outbound";
  const isNote = variant === "note";
  return (
    <div className={["flex gap-2", isOutbound ? "justify-end" : "justify-start"].join(" ")}>
      {!isOutbound ? (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#C7D2FE] bg-[#EEF2FF] text-[10px] font-medium text-primary">
          {authorInitial ?? "C"}
        </div>
      ) : null}
      <div
        className={[
          "max-w-[70%] whitespace-pre-wrap px-[13px] py-[9px] text-xs",
          isOutbound
            ? "rounded-[14px_14px_3px_14px] bg-primary text-white"
            : isNote
              ? "rounded-[3px_14px_14px_14px] border border-[#FCD34D] bg-[#FFFBEB] text-[#78350F]"
              : "rounded-[3px_14px_14px_14px] border border-border bg-white text-foreground"
        ].join(" ")}
      >
        {isNote ? (
          <span className="mb-1 flex items-center gap-1 text-[10px] font-medium">
            <LockKeyhole size={11} aria-hidden="true" />
            โน้ตทีม
          </span>
        ) : null}
        <p>
          {body.split("\n").map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
        {time ? (
          <p className={["mt-1 text-[10px]", isOutbound ? "text-white/70" : "text-muted-foreground"].join(" ")}>
            {time}
          </p>
        ) : null}
      </div>
    </div>
  );
}

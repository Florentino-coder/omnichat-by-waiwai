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
      <div className="flex justify-center py-1">
        <div className="rounded-full border border-[#D8D6CC] bg-[#F5F4EF] px-4 py-1.5 text-sm font-medium text-muted-foreground">
          {body}
        </div>
      </div>
    );
  }

  const isOutbound = variant === "outbound";
  const isNote = variant === "note";
  return (
    <div className={["flex items-end gap-2", isOutbound ? "justify-end" : "justify-start"].join(" ")}>
      {!isOutbound ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#C9D1FF] bg-[#EEF1FF] text-sm font-medium text-primary">
          {authorInitial ?? "F"}
        </div>
      ) : null}
      <div className={["max-w-[76%]", isOutbound ? "text-right" : "text-left"].join(" ")}>
        <div
          className={[
            "inline-block whitespace-pre-wrap px-6 py-4 text-base leading-7 shadow-sm",
            isOutbound
              ? "rounded-[18px_18px_4px_18px] bg-primary text-white"
              : isNote
                ? "rounded-[14px] border-2 border-[#F2C94C] bg-[#FFF9E8] text-[#8B4C11]"
                : "rounded-[18px_18px_18px_4px] border border-[#DCD9E3] bg-white text-foreground"
          ].join(" ")}
        >
          {isNote ? (
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <LockKeyhole size={14} aria-hidden="true" />
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
        </div>
        {time ? (
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {time}
          </p>
        ) : null}
      </div>
    </div>
  );
}

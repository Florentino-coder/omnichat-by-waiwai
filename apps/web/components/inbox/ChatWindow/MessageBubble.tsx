import { useState } from "react";
import { LockKeyhole, FileDown, X } from "lucide-react";

export type MessageVariant = "outbound" | "inbound" | "note" | "system";

interface MessageBubbleProps {
  variant: MessageVariant;
  body: string;
  time?: string;
  authorInitial?: string;
  type?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaR2Key?: string | null;
  mediaFileName?: string | null;
}

export function MessageBubble({
  variant,
  body,
  time,
  authorInitial,
  type,
  mediaUrl,
  mediaMimeType: _mediaMimeType,
  mediaSize,
  mediaR2Key: _mediaR2Key,
  mediaFileName
}: MessageBubbleProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

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
  const isMedia = ["IMAGE", "VIDEO", "AUDIO", "FILE"].includes(type || "");

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
            "inline-block whitespace-pre-wrap shadow-sm",
            isMedia ? "rounded-[18px] p-1.5" : "px-6 py-4 text-base leading-7",
            isOutbound
              ? isMedia
                ? "bg-transparent text-white"
                : "rounded-[18px_18px_4px_18px] bg-primary text-white"
              : isNote
                ? "rounded-[14px] border-2 border-[#F2C94C] bg-[#FFF9E8] text-[#8B4C11]"
                : isMedia
                  ? "bg-transparent text-foreground"
                  : "rounded-[18px_18px_18px_4px] border border-[#DCD9E3] bg-white text-foreground"
          ].join(" ")}
        >
          {isNote ? (
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold px-4 pt-3">
              <LockKeyhole size={14} aria-hidden="true" />
              โน้ตทีม
            </span>
          ) : null}

          {type === "IMAGE" ? (
            <div className="relative">
              <img
                src={mediaUrl || ""}
                alt={mediaFileName || "Image"}
                className="max-w-xs rounded-xl cursor-pointer hover:opacity-95 transition-opacity border border-slate-200 shadow-sm object-cover max-h-60"
                onClick={() => setIsLightboxOpen(true)}
              />
              {isLightboxOpen && (
                <div
                  className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
                  onClick={() => setIsLightboxOpen(false)}
                >
                  <button
                    type="button"
                    className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLightboxOpen(false);
                    }}
                  >
                    <X size={24} />
                  </button>
                  <img
                    src={mediaUrl || ""}
                    alt={mediaFileName || "Lightbox Image"}
                    className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                  />
                </div>
              )}
            </div>
          ) : type === "VIDEO" ? (
            <div>
              <video
                src={mediaUrl || ""}
                controls
                className="max-w-xs sm:max-w-md rounded-xl overflow-hidden shadow-md border border-slate-200"
              />
            </div>
          ) : type === "AUDIO" ? (
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200">
              <audio
                src={mediaUrl || ""}
                controls
                className="max-w-xs"
              />
            </div>
          ) : type === "FILE" ? (
            <div>
              <a
                href={mediaUrl || "#"}
                download={mediaFileName || "file"}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  "flex items-center gap-3 border p-3.5 rounded-xl transition-all max-w-xs sm:max-w-md",
                  isOutbound
                    ? "bg-primary border-primary-dark hover:bg-primary/90 text-white"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-foreground"
                ].join(" ")}
              >
                <div className={[
                  "p-2.5 rounded-lg shrink-0",
                  isOutbound ? "bg-white/20 text-white" : "bg-[#EEF1FF] text-primary"
                ].join(" ")}>
                  <FileDown size={20} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold truncate leading-tight">
                    {mediaFileName || "Document"}
                  </p>
                  <p className={[
                    "text-xs font-medium mt-0.5",
                    isOutbound ? "text-white/70" : "text-muted-foreground"
                  ].join(" ")}>
                    {mediaSize ? `${(mediaSize / 1024).toFixed(1)} KB` : "Unknown size"}
                  </p>
                </div>
              </a>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">
              {body.split("\n").map((line, idx) => (
                <span key={idx} className="block">
                  {line}
                </span>
              ))}
            </p>
          )}
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

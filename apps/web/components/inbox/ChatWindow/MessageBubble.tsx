import { useEffect, useState } from "react";
import { LockKeyhole, FileDown, X } from "lucide-react";

export type MessageVariant = "outbound" | "inbound" | "inbound-escalation" | "note" | "system";

function getStickerUrl(rawPayload: unknown): string | null {
  if (!rawPayload || typeof rawPayload !== "object") return null;
  const payload = rawPayload as Record<string, unknown>;
  
  const messageObj = payload.message && typeof payload.message === "object" ? payload.message : payload;
  if (!messageObj || typeof messageObj !== "object") return null;
  const messageRecord = messageObj as Record<string, unknown>;
  
  const stickerId = typeof messageRecord.stickerId === "string" ? messageRecord.stickerId : null;
  if (!stickerId) return null;
  
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker_key@2x.png`;
}

interface MessageBubbleProps {
  variant: MessageVariant;
  body: string;
  time?: string;
  authorInitial?: string;
  type?: string | null;
  mediaUrl?: string | null;
  proxyMediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaR2Key?: string | null;
  mediaFileName?: string | null;
  rawPayload?: unknown;
  escalationLabel?: string;
  escalationReason?: string;
  escalationDraft?: string;
}

export function MessageBubble({
  variant,
  body,
  time,
  authorInitial,
  type,
  mediaUrl,
  proxyMediaUrl,
  mediaMimeType: _mediaMimeType,
  mediaSize,
  mediaR2Key: _mediaR2Key,
  mediaFileName,
  rawPayload,
  escalationLabel,
  escalationReason,
  escalationDraft
}: MessageBubbleProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState(mediaUrl || "");

  useEffect(() => {
    setResolvedMediaUrl(mediaUrl || "");
  }, [mediaUrl, proxyMediaUrl]);

  const handleMediaLoadError = () => {
    if (proxyMediaUrl && resolvedMediaUrl !== proxyMediaUrl) {
      setResolvedMediaUrl(proxyMediaUrl);
    }
  };

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
  const isEscalation = variant === "inbound-escalation";
  const stickerUrl = type === "STICKER" ? getStickerUrl(rawPayload) : null;
  const isMedia = ["IMAGE", "VIDEO", "AUDIO", "FILE"].includes(type || "") || !!stickerUrl;

  return (
    <div className={["flex items-end gap-2", isOutbound ? "justify-end" : "justify-start"].join(" ")}>
      {!isOutbound ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#C9D1FF] bg-[#EEF1FF] text-sm font-medium text-primary">
          {authorInitial ?? "F"}
        </div>
      ) : null}
      <div
        data-testid="message-bubble-frame"
        className={["min-w-0 max-w-full sm:max-w-[76%]", isOutbound ? "text-right" : "text-left"].join(" ")}
      >
        <div
          className={[
            "inline-block max-w-full overflow-hidden whitespace-pre-wrap break-words shadow-sm [overflow-wrap:anywhere]",
            isMedia ? "rounded-[18px] p-1.5 shadow-none" : "px-6 py-4 text-base leading-7",
            isOutbound
              ? isMedia
                ? "bg-transparent text-white"
                : "rounded-[18px_18px_4px_18px] bg-primary text-white"
              : isNote
                ? "rounded-[14px] border-2 border-[#F2C94C] bg-[#FFF9E8] text-[#8B4C11]"
                : isEscalation
                  ? "rounded-[18px_18px_18px_4px] border-2 border-amber-300 bg-amber-50 text-amber-950"
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
          {isEscalation && escalationLabel ? (
            <span className="mb-1 flex items-center gap-2 px-4 pt-3 text-sm font-semibold text-amber-900">
              {escalationLabel}
            </span>
          ) : null}
          {isEscalation && escalationReason ? (
            <p className="px-4 pb-1 text-xs font-medium text-amber-800">{escalationReason}</p>
          ) : null}
          {isEscalation && escalationDraft ? (
            <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-left text-sm text-amber-950">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                AI draft
              </p>
              <p className="whitespace-pre-wrap">{escalationDraft}</p>
            </div>
          ) : null}

          {stickerUrl ? (
            <div className="relative">
              <img
                src={stickerUrl}
                alt="LINE Sticker"
                className="w-24 h-24 sm:w-32 sm:h-32 object-contain hover:scale-105 transition-transform"
              />
              {body.split("\n").map((line, idx) => (
                <span key={idx} className="sr-only">
                  {line}
                </span>
              ))}
            </div>
          ) : type === "IMAGE" ? (
            <div className="relative">
              <img
                src={resolvedMediaUrl || mediaUrl || ""}
                alt={mediaFileName || "Image"}
                className="max-h-60 max-w-full rounded-xl cursor-pointer hover:opacity-95 transition-opacity border border-slate-200 shadow-sm object-cover"
                onClick={() => setIsLightboxOpen(true)}
                onError={handleMediaLoadError}
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
                    src={resolvedMediaUrl || mediaUrl || ""}
                    alt={mediaFileName || "Lightbox Image"}
                    className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                    onError={handleMediaLoadError}
                  />
                </div>
              )}
            </div>
          ) : type === "VIDEO" ? (
            <div>
              <video
                src={resolvedMediaUrl || mediaUrl || ""}
                controls
                className="max-w-full sm:max-w-md rounded-xl overflow-hidden shadow-md border border-slate-200"
                onError={handleMediaLoadError}
              />
            </div>
          ) : type === "AUDIO" ? (
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200">
              <audio
                src={resolvedMediaUrl || mediaUrl || ""}
                controls
                className="max-w-full"
                onError={handleMediaLoadError}
              />
            </div>
          ) : type === "FILE" ? (
            <div>
              <a
                href={resolvedMediaUrl || mediaUrl || "#"}
                download={mediaFileName || "file"}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  "flex max-w-full items-center gap-3 border p-3.5 rounded-xl transition-all sm:max-w-md",
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
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {body.split("\n").map((line, idx) => (
                <span key={idx} className="block break-words [overflow-wrap:anywhere]">
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

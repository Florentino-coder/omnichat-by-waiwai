interface QuickReply {
  id: string;
  title: string;
  subtitle: string;
  body?: string;
  rawTitle?: string;
}

interface QuickReplyListProps {
  replies: QuickReply[];
  autoEnabled: boolean;
  disabled?: boolean;
  onToggleAuto: () => void;
  onSelect: (id: string) => void;
}

export function QuickReplyList({
  replies,
  autoEnabled,
  disabled = false,
  onToggleAuto,
  onSelect
}: QuickReplyListProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-base font-semibold text-[#6B6D7A]">Quick Reply</p>
        <button
          className={[
            "flex h-7 w-16 items-center rounded-full px-1 transition-colors",
            autoEnabled ? "justify-end bg-primary" : "justify-start bg-[#E6E5ED]"
          ].join(" ")}
          disabled={disabled}
          onClick={onToggleAuto}
          type="button"
          role="switch"
          aria-checked={autoEnabled}
          aria-label="Quick Reply Auto Enter"
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
        </button>
      </div>
      <div className="grid gap-3">
        {replies.map((reply) => (
          <button
            key={reply.id}
            aria-label={`Add ${reply.title.replace(" : Quick Reply ", " Quick Reply ")}`}
            className="rounded-xl border border-[#DAD8E1] bg-[#F7F6FB] px-4 py-3 text-left transition hover:border-primary disabled:opacity-60"
            disabled={disabled}
            onClick={() => onSelect(reply.id)}
            type="button"
          >
            <span className="sr-only">{reply.title}</span>
            <span className="block truncate text-base font-semibold">{reply.rawTitle ?? reply.title}</span>
            <span className="mt-1 block truncate text-sm font-medium text-muted-foreground">{reply.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

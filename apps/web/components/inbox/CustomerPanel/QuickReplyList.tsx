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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">⚡ Quick Reply</p>
        <button
          className={[
            "flex h-5 w-9 items-center rounded-full px-0.5 transition-colors",
            autoEnabled ? "justify-end bg-primary" : "justify-start bg-secondary"
          ].join(" ")}
          disabled={disabled}
          onClick={onToggleAuto}
          type="button"
          role="switch"
          aria-checked={autoEnabled}
          aria-label="Quick Reply Auto Enter"
        >
          <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
        </button>
      </div>
      <div className="grid gap-2">
        {replies.map((reply) => (
          <button
            key={reply.id}
            aria-label={`Add ${reply.title.replace(" : Quick Reply ", " Quick Reply ")}`}
            className="rounded-md border border-border bg-secondary px-2.5 py-2 text-left"
            disabled={disabled}
            onClick={() => onSelect(reply.id)}
            type="button"
          >
            <span className="block text-[11px] font-medium">{reply.title}</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">{reply.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

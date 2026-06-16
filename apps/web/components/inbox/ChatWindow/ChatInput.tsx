import { Bolt, Image, Paperclip, Send } from "lucide-react";

interface ChatInputProps {
  value: string;
  channelLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function ChatInput({ value, channelLabel, disabled = false, onChange, onSend }: ChatInputProps) {
  return (
    <div className="shrink-0 border-t border-border bg-white">
      <div className="flex min-h-10 items-center justify-between border-b border-border px-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {[Paperclip, Image, Bolt].map((Icon, index) => (
            <button
              key={index}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary"
              disabled={disabled}
              type="button"
            >
              <Icon size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
        <span className="truncate">LINE OA: {channelLabel}</span>
      </div>
      <div className="flex items-end gap-2 p-3">
        <textarea
          className="min-h-10 flex-1 resize-none rounded-full border border-border bg-secondary px-4 py-2 text-sm outline-none focus:border-primary"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="พิมพ์ข้อความตอบกลับ..."
          value={value}
        />
        <button
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
          disabled={disabled || value.trim().length === 0}
          onClick={onSend}
          type="button"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

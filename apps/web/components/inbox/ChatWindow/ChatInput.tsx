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
      <div className="flex min-h-12 items-center justify-between border-b border-border px-4 text-sm font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          {[Paperclip, Image, Bolt].map((Icon, index) => (
            <button
              key={index}
              className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-md hover:bg-secondary transition-colors"
              disabled={disabled}
              type="button"
            >
              <Icon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
            </button>
          ))}
        </div>
        <span className="truncate">LINE OA: {channelLabel}</span>
      </div>
      <div className="flex items-end gap-3 p-4">
        <textarea
          className="min-h-12 flex-1 resize-none rounded-[14px] border-2 border-[#C9C7D1] bg-secondary px-5 py-3 text-base outline-none focus:border-primary"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="พิมพ์ข้อความตอบกลับ..."
          value={value}
        />
        <button
          aria-label="Send message"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
          disabled={disabled || value.trim().length === 0}
          onClick={onSend}
          type="button"
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

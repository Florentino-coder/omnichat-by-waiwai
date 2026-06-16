import { type RefObject, type ReactNode } from "react";
import { ChatHeader } from "./ChatHeader";
import { DateSeparator } from "./DateSeparator";
import { MessageBubble, type MessageVariant } from "./MessageBubble";

export interface ChatMessageItem {
  id: string;
  variant: MessageVariant;
  body: string;
  time?: string;
  authorInitial?: string;
}

interface ChatWindowProps {
  customerName: string;
  customerInitial: string;
  channelLabel: string;
  status: "OPEN" | "PENDING" | "RESOLVED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  messages: ChatMessageItem[];
  composer: ReactNode;
  disableActions?: boolean;
  disablePriority?: boolean;
  disableQuickReply?: boolean;
  disableStatus?: boolean;
  emptyText?: string;
  isLoading?: boolean;
  loadingText?: string;
  messagesEndRef?: RefObject<HTMLDivElement | null>;
  statusElapsed?: string | null;
  statusMenuOpen?: boolean;
  onOpenCustomer?: () => void;
  onQuickReply: () => void;
  onUpdatePriority: () => void;
  onUpdateStatus: (status: "OPEN" | "IN_PROGRESS" | "RESOLVED") => void;
  toggleStatusMenu: () => void;
}

export function ChatWindow({
  customerName,
  customerInitial,
  channelLabel,
  status,
  priority,
  messages,
  composer,
  disableActions = false,
  disablePriority = false,
  disableQuickReply = false,
  disableStatus = false,
  emptyText,
  isLoading = false,
  loadingText = "กำลังโหลดข้อความ...",
  messagesEndRef,
  statusElapsed,
  statusMenuOpen = false,
  onOpenCustomer,
  onQuickReply,
  onUpdatePriority,
  onUpdateStatus,
  toggleStatusMenu
}: ChatWindowProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#F7F6FB]" aria-labelledby="thread-heading">
      <ChatHeader
        channelLabel={channelLabel}
        customerInitial={customerInitial}
        customerName={customerName}
        disableActions={disableActions}
        disablePriority={disablePriority}
        disableQuickReply={disableQuickReply}
        disableStatus={disableStatus}
        onOpenCustomer={onOpenCustomer}
        onQuickReply={onQuickReply}
        onUpdatePriority={onUpdatePriority}
        onUpdateStatus={onUpdateStatus}
        priority={priority}
        status={status}
        statusElapsed={statusElapsed}
        statusMenuOpen={statusMenuOpen}
        toggleStatusMenu={toggleStatusMenu}
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <DateSeparator label="15 มิ.ย. · เริ่มแชท" />
        {isLoading ? <ChatWindowSkeleton label={loadingText} /> : null}
        {!isLoading && emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}
        {!isLoading &&
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              authorInitial={message.authorInitial}
              body={message.body}
              time={message.time}
              variant={message.variant}
            />
          ))}
        <div ref={messagesEndRef} />
      </div>
      {composer}
    </section>
  );
}

function ChatWindowSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-4" aria-label={label}>
      <div className="ml-auto h-16 w-2/5 rounded-2xl bg-primary/30" />
      <div className="h-16 w-1/2 rounded-2xl bg-white" />
      <div className="ml-auto h-16 w-3/5 rounded-2xl bg-primary/30" />
    </div>
  );
}

export { ChatHeader } from "./ChatHeader";
export { ChatInput } from "./ChatInput";
export { DateSeparator } from "./DateSeparator";
export { MessageBubble };

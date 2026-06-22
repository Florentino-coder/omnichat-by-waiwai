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
  type?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaR2Key?: string | null;
  mediaFileName?: string | null;
  rawPayload?: unknown;
  escalationLabel?: string;
}

interface ChatWindowProps {
  customerName: string;
  customerInitial: string;
  channelLabel: string;
  aiAutoReplyBadge?: string;
  escalationBadge?: string;
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
  hasMoreMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  loadOlderText?: string;
  loadingOlderText?: string;
  onLoadOlder?: () => void;
  messagesScrollRef?: RefObject<HTMLDivElement | null>;
  messagesEndRef?: RefObject<HTMLDivElement | null>;
  statusElapsed?: string | null;
  statusMenuOpen?: boolean;
  onOpenCustomer?: () => void;
  onQuickReply: () => void;
  onUpdatePriority: () => void;
  onUpdateStatus: (status: "OPEN" | "IN_PROGRESS" | "RESOLVED") => void;
  toggleStatusMenu: () => void;
  onClose?: () => void;
}

export function ChatWindow({
  customerName,
  customerInitial,
  channelLabel,
  aiAutoReplyBadge,
  escalationBadge,
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
  hasMoreMessages = false,
  isLoadingOlderMessages = false,
  loadOlderText = "Load older messages",
  loadingOlderText = "Loading older messages...",
  onLoadOlder,
  messagesScrollRef,
  messagesEndRef,
  statusElapsed,
  statusMenuOpen = false,
  onOpenCustomer,
  onQuickReply,
  onUpdatePriority,
  onUpdateStatus,
  toggleStatusMenu,
  onClose
}: ChatWindowProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#F7F6FB]" aria-labelledby="thread-heading">
      <ChatHeader
        aiAutoReplyBadge={aiAutoReplyBadge}
        escalationBadge={escalationBadge}
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
        onClose={onClose}
      />
      <div ref={messagesScrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <DateSeparator label="15 มิ.ย. · เริ่มแชท" />
        {hasMoreMessages && onLoadOlder ? (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={isLoadingOlderMessages}
              className="rounded-full border border-[#DEDDE6] bg-white px-4 py-1.5 text-xs font-medium text-[#767A8C] hover:bg-[#F7F6FB] disabled:opacity-60"
            >
              {isLoadingOlderMessages ? loadingOlderText : loadOlderText}
            </button>
          </div>
        ) : null}
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
              escalationLabel={message.escalationLabel}
              type={message.type}
              mediaUrl={message.mediaUrl}
              mediaMimeType={message.mediaMimeType}
              mediaSize={message.mediaSize}
              mediaR2Key={message.mediaR2Key}
              mediaFileName={message.mediaFileName}
              rawPayload={message.rawPayload}
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

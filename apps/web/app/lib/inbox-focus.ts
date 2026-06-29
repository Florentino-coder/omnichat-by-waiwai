/** Tracks which inbox conversation is open in the thread panel (if any). */
let activeInboxConversationId: string | null = null;

export function setActiveInboxConversationId(conversationId: string | null): void {
  activeInboxConversationId = conversationId;
}

export function getActiveInboxConversationId(): string | null {
  return activeInboxConversationId;
}

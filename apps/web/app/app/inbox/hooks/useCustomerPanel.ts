import { useCallback, useState } from "react";
import { apiFetch } from "../../../lib/api-client";
import type { ConversationTag, SavedReply, ConversationInternalNote, InboxConversation } from "../inbox-client";

export function useCustomerPanel({
  selectedConversation,
  conversationsRef,
  isMountedRef,
  setError,
}: {
  selectedConversation: InboxConversation | null;
  conversationsRef: React.MutableRefObject<InboxConversation[]>;
  isMountedRef: React.MutableRefObject<boolean>;
  setError: (error: string | null) => void;
}) {
  const [tags, setTags] = useState<ConversationTag[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [internalNotes, setInternalNotes] = useState<ConversationInternalNote[]>([]);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);

  const loadInboxOperations = useCallback(async (conversationId: string): Promise<void> => {
    setIsLoadingOperations(true);
    const lineChannelId = selectedConversation?.lineChannel.id;
    const customerId = selectedConversation?.customerId;

    try {
      const [tagResult, replyResult, noteResult, customerResult] = await Promise.allSettled([
        apiFetch<ConversationTag[]>("/api/v1/inbox/tags"),
        apiFetch<SavedReply[]>(
          lineChannelId
            ? `/api/v1/inbox/saved-replies?lineChannelId=${encodeURIComponent(lineChannelId)}`
            : "/api/v1/inbox/saved-replies"
        ),
        apiFetch<ConversationInternalNote[]>(`/api/v1/inbox/conversations/${conversationId}/notes`),
        customerId
          ? apiFetch<{ id: string; phone?: string | null; email?: string | null }>(`/api/v1/customers/${customerId}`)
          : Promise.resolve(null)
      ]);

      if (!isMountedRef.current || conversationsRef.current.every((item) => item.id !== conversationId)) {
        return;
      }
      if (tagResult.status === "fulfilled") {
        setTags(Array.isArray(tagResult.value) ? tagResult.value : []);
      }
      if (replyResult.status === "fulfilled") {
        setSavedReplies(Array.isArray(replyResult.value) ? replyResult.value : []);
      }
      if (noteResult.status === "fulfilled") {
        setInternalNotes(Array.isArray(noteResult.value) ? noteResult.value : []);
      }
      if (customerResult.status === "fulfilled" && customerResult.value) {
        const cust = customerResult.value;
        setCustomerPhone(cust?.phone ?? null);
        setCustomerEmail(cust?.email ?? null);
      } else {
        setCustomerPhone(null);
        setCustomerEmail(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingOperations(false);
      }
    }
  }, [selectedConversation, conversationsRef, isMountedRef]);

  const saveContactDetails = useCallback(async (phone: string, email: string): Promise<void> => {
    if (!selectedConversation?.customerId) {
      return;
    }
    setError(null);
    try {
      const updated = await apiFetch<{ id: string; phone?: string | null; email?: string | null }>(
        `/api/v1/customers/${selectedConversation.customerId}`,
        {
          body: JSON.stringify({ phone: phone.trim(), email: email.trim() }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      );
      setCustomerPhone(updated.phone ?? null);
      setCustomerEmail(updated.email ?? null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : typeof saveError === "object" && saveError && "error" in saveError
            ? String((saveError as any).error)
            : "Could not update contact details."
      );
    }
  }, [selectedConversation, setError]);

  return {
    tags,
    setTags,
    savedReplies,
    setSavedReplies,
    internalNotes,
    setInternalNotes,
    customerPhone,
    setCustomerPhone,
    customerEmail,
    setCustomerEmail,
    isLoadingOperations,
    loadInboxOperations,
    saveContactDetails,
  };
}

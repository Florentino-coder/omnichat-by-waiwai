import { useCallback, useState, MutableRefObject } from "react";
import { apiFetch } from "../../../lib/api-client";
import type { InboxMessage, ConversationMessagesPage } from "../inbox-client";

export function useMessages({
  selectedIdRef,
  isMountedRef,
  messagesScrollRef,
  isPrependingMessagesRef,
  setError,
  onStateUpdateTrace,
}: {
  selectedIdRef: MutableRefObject<string | null>;
  isMountedRef: MutableRefObject<boolean>;
  messagesScrollRef: MutableRefObject<HTMLDivElement | null>;
  isPrependingMessagesRef: MutableRefObject<boolean>;
  setError: (error: string | null) => void;
  onStateUpdateTrace: () => void;
}) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);

  const loadMessages = useCallback(
    async (conversationId: string, options?: { quiet?: boolean }): Promise<void> => {
      if (!options?.quiet) {
        setIsLoadingMessages(true);
      }
      setError(null);
      try {
        const data = await apiFetch<ConversationMessagesPage | InboxMessage[]>(
          `/api/v1/inbox/conversations/${conversationId}/messages?limit=50`
        );
        console.log('[SSE] loadMessages fetched data for:', conversationId, '| currently selected:', selectedIdRef.current, '| match:', selectedIdRef.current === conversationId, '| isMounted:', isMountedRef.current);
        if (isMountedRef.current && selectedIdRef.current === conversationId) {
          console.log('[SSE] condition matched! Setting messages state with:', Array.isArray(data) ? data.length : (data as any)?.messages?.length, 'messages');
          onStateUpdateTrace();
          const page = Array.isArray(data)
            ? { messages: data, hasMore: false, oldestId: data[0]?.id ?? null }
            : data;
          const messagesArray = Array.isArray(page.messages) ? page.messages : [];
          console.log('[SSE] Fetched messages range: First (Oldest):', messagesArray[0]?.text, 'at', messagesArray[0]?.createdAt, '| Last (Newest):', messagesArray[messagesArray.length - 1]?.text, 'at', messagesArray[messagesArray.length - 1]?.createdAt);
          setMessages(messagesArray);
          setHasMoreMessages(Boolean(page.hasMore));
        }
      } catch (loadError) {
        if (isMountedRef.current && !options?.quiet) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : typeof loadError === "object" && loadError && "error" in loadError
                ? String((loadError as any).error)
                : "Could not load messages."
          );
        }
      } finally {
        if (isMountedRef.current && selectedIdRef.current === conversationId && !options?.quiet) {
          setIsLoadingMessages(false);
        }
      }
    },
    [onStateUpdateTrace, selectedIdRef, setError]
  );

  const loadOlderMessages = useCallback(async (): Promise<void> => {
    const conversationId = selectedIdRef.current;
    const oldestId = messages[0]?.id;
    if (!conversationId || !oldestId || !hasMoreMessages || isLoadingOlderMessages) {
      return;
    }

    const scrollContainer = messagesScrollRef.current;
    const previousScrollHeight = scrollContainer?.scrollHeight ?? 0;

    setIsLoadingOlderMessages(true);
    isPrependingMessagesRef.current = true;
    try {
      const data = await apiFetch<ConversationMessagesPage | InboxMessage[]>(
        `/api/v1/inbox/conversations/${conversationId}/messages?limit=50&before=${encodeURIComponent(oldestId)}`
      );

      if (selectedIdRef.current !== conversationId) {
        return;
      }

      const page = Array.isArray(data)
        ? { messages: data, hasMore: false, oldestId: data[0]?.id ?? null }
        : data;

      setMessages((current) => [...(Array.isArray(page.messages) ? page.messages : []), ...current]);
      setHasMoreMessages(Boolean(page.hasMore));

      window.requestAnimationFrame(() => {
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight - previousScrollHeight;
        }
        isPrependingMessagesRef.current = false;
      });
    } catch (loadError) {
      isPrependingMessagesRef.current = false;
      if (isMountedRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : typeof loadError === "object" && loadError && "error" in loadError
              ? String((loadError as any).error)
              : "Could not load older messages."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingOlderMessages(false);
      }
    }
  }, [hasMoreMessages, isLoadingOlderMessages, messages, messagesScrollRef, selectedIdRef, isPrependingMessagesRef, setError]);

  return {
    messages,
    setMessages,
    isLoadingMessages,
    setIsLoadingMessages,
    hasMoreMessages,
    setHasMoreMessages,
    isLoadingOlderMessages,
    setIsLoadingOlderMessages,
    loadMessages,
    loadOlderMessages,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/api-client";
import type { InboxConversation } from "../inbox-client";

const CONVERSATION_PAGE_SIZE = 10;

export function useConversations({
  initialConversations,
  onConversationsLoaded,
  onStateUpdateTrace,
}: {
  initialConversations: InboxConversation[];
  onConversationsLoaded: (previous: InboxConversation[], next: InboxConversation[], isAppend: boolean, isHydrated: boolean) => void;
  onStateUpdateTrace: () => void;
}) {
  const [conversations, setConversations] = useState<InboxConversation[]>(initialConversations);
  const [isLoadingConversations, setIsLoadingConversations] = useState(initialConversations.length === 0);
  const [hasMoreConversations, setHasMoreConversations] = useState(initialConversations.length === CONVERSATION_PAGE_SIZE);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  
  const conversationsHydratedRef = useRef(initialConversations.length > 0);
  const conversationsRef = useRef<InboxConversation[]>(initialConversations);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const loadConversations = useCallback(
    async (options?: { append?: boolean; offset?: number; quiet?: boolean }): Promise<void> => {
      if (!options?.quiet) {
        setIsLoadingConversations(true);
      }
      setError(null);
      try {
        const offset = options?.offset ?? 0;
        const data = await apiFetch<InboxConversation[]>(
          `/api/v1/inbox/conversations?limit=${CONVERSATION_PAGE_SIZE}&offset=${offset}`
        );
        if (!isMountedRef.current) {
          return;
        }
        const safeData = Array.isArray(data) ? data : [];
        const previousConversations = conversationsRef.current;
        const nextConversations = options?.append
          ? [...conversationsRef.current, ...safeData]
          : safeData;

        onConversationsLoaded(previousConversations, nextConversations, !!options?.append, conversationsHydratedRef.current);

        conversationsHydratedRef.current = true;
        setHasMoreConversations(safeData.length === CONVERSATION_PAGE_SIZE);
        conversationsRef.current = nextConversations;

        onStateUpdateTrace();

        setConversations(nextConversations);
      } catch (loadError) {
        if (isMountedRef.current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : typeof loadError === "object" && loadError && "error" in loadError
                ? String((loadError as any).error)
                : "Could not load conversations."
          );
        }
      } finally {
        if (isMountedRef.current && !options?.quiet) {
          setIsLoadingConversations(false);
        }
      }
    },
    [onConversationsLoaded, onStateUpdateTrace]
  );

  return {
    conversations,
    setConversations,
    conversationsRef,
    isLoadingConversations,
    setIsLoadingConversations,
    hasMoreConversations,
    setHasMoreConversations,
    isLoadingMoreConversations,
    setIsLoadingMoreConversations,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    error,
    setError,
    loadConversations,
    conversationsHydratedRef,
  };
}

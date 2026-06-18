"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ChatWindow, type ChatMessageItem } from "../../../components/inbox/ChatWindow";
import {
  ConversationList,
  type ConversationCardProps,
  type FilterPill
} from "../../../components/inbox/ConversationList";
import { CustomerPanel } from "../../../components/inbox/CustomerPanel";
import { BottomNav, type MobileInboxTab } from "../../../components/inbox/mobile/BottomNav";
import { apiFetch } from "../../lib/api-client";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";
import { ReplyComposer } from "./reply-composer";

type MessageDirection = "INBOUND" | "OUTBOUND";
type ConversationStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
type ConversationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type ConversationPreviewMessage = {
  id: string;
  direction: MessageDirection;
  type?: string | null;
  text: string | null;
  rawPayload?: LineMessagePayload | null;
  createdAt: string;
};

export type InboxConversation = {
  id: string;
  workspaceId?: string;
  externalThreadId: string;
  displayName?: string | null;
  nickname?: string | null;
  status?: string | null;
  priority?: ConversationPriority | null;
  assignedToMemberId?: string | null;
  tagLinks?: ConversationTagLink[];
  inProgressStartedAt?: string | null;
  lastMessageAt?: string | null;
  unreadInboundMessageCount?: number;
  lineChannel: {
    id: string;
    name: string;
    badgeColor?: string | null;
    lineChannelId: string;
  };
  messages: ConversationPreviewMessage[];
};

type AuthUser = {
  displayName?: string | null;
  tenantId?: string | null;
  workspaceId?: string | null;
};

type WorkspaceMember = {
  id: string;
  user?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
};

type TenantRealtimeEvent = {
  type: string;
  data?: {
    conversationId?: string;
  };
};

type ConversationTag = {
  id: string;
  name: string;
  color?: string | null;
};

type ConversationTagLink = {
  id: string;
  tagId: string;
  deletedAt?: string | null;
  tag?: ConversationTag | null;
};

type SavedReply = {
  id: string;
  lineChannelId?: string | null;
  title: string;
  body: string;
  isActive?: boolean;
  shortcutKey?: string | null;
  imageUrl?: string | null;
  hotkeyBinding?: string | null;
};

type ConversationInternalNote = {
  id: string;
  body: string;
  createdAt: string;
  authorMemberId?: string | null;
};

type InboxMessage = {
  id: string;
  direction: MessageDirection;
  type?: string | null;
  text: string | null;
  createdAt: string;
  rawPayload?: LineMessagePayload | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaR2Key?: string | null;
  mediaFileName?: string | null;
};

type LineMessagePayload = {
  source?: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    id?: string;
    type?: string;
    packageId?: string;
    stickerId?: string;
    stickerResourceType?: string;
  };
  timestamp?: number;
  lineProfile?: {
    displayName?: string;
    pictureUrl?: string;
    statusMessage?: string;
    language?: string;
  };
};

interface InboxClientProps {
  initialConversations?: InboxConversation[];
}

const CONVERSATION_PAGE_SIZE = 10;

type ConvReadState = "unread" | "read-not-replied" | "normal";

export default function InboxClient({ initialConversations = [] }: InboxClientProps) {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const [conversations, setConversations] = useState<InboxConversation[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(initialConversations.length === 0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [inProgressAlertMinutes, setInProgressAlertMinutes] = useState(10);
  const [alertMinutesDraft, setAlertMinutesDraft] = useState("10");
  const [isSavingAlertMinutes, setIsSavingAlertMinutes] = useState(false);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [composerInsertText, setComposerInsertText] = useState("");
  const [composerInsertNonce, setComposerInsertNonce] = useState(0);
  const [isQuickReplyAutoEnter, setIsQuickReplyAutoEnter] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("omni_quick_reply_auto_enter") === "true";
  });
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);
  const [tags, setTags] = useState<ConversationTag[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [internalNotes, setInternalNotes] = useState<ConversationInternalNote[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileInboxTab>("chats");
  const [now, setNow] = useState(() => Date.now());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const isMountedRef = useRef(false);
  const hasInitialConversationsRef = useRef(initialConversations.length > 0);
  const conversationsRef = useRef<InboxConversation[]>(initialConversations);
  const selectedIdRef = useRef<string | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const markingReadRef = useRef(new Set<string>());
  const isLoadingOperations = false;

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const selectedCustomerName = selectedConversation ? customerLabel(selectedConversation) : "";
  const latestInboundMessage = useMemo(
    () => [...messages].reverse().find((message) => message.direction === "INBOUND") ?? null,
    [messages]
  );
  const lineProfile = latestInboundMessage?.rawPayload?.lineProfile ?? null;
  const lineSource = latestInboundMessage?.rawPayload?.source ?? null;
  const lineMessage = latestInboundMessage?.rawPayload?.message ?? null;
  const selectedTagIds = useMemo(
    () =>
      new Set(
        (selectedConversation?.tagLinks ?? [])
          .filter((link) => !link.deletedAt)
          .map((link) => link.tagId)
      ),
    [selectedConversation]
  );
  const activeSavedReplies = useMemo(
    () =>
      savedReplies.filter(
        (reply) =>
          reply.isActive !== false &&
          (!selectedConversation || reply.lineChannelId === selectedConversation.lineChannel.id)
      ),
    [savedReplies, selectedConversation]
  );
  const unreadCount = useMemo(
    () => conversations.filter((conversation) => getReadState(conversation, selectedId) === "unread").length,
    [conversations, selectedId]
  );
  const readNotRepliedCount = useMemo(
    () =>
      conversations.filter((conversation) => getReadState(conversation, selectedId) === "read-not-replied").length,
    [conversations, selectedId]
  );
  const overdueInProgressConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        isInProgressOverdue(conversation, now, inProgressAlertMinutes)
      ),
    [conversations, inProgressAlertMinutes, now]
  );

  const filteredConversations = useMemo(() => {
    const byText = conversations.filter((conversation) => {
      if (!searchQuery.trim()) {
        return true;
      }
      const query = searchQuery.toLowerCase();
      const latestMessage = conversation.messages?.[0];
      return (
        customerLabel(conversation).toLowerCase().includes(query) ||
        conversation.lineChannel.name.toLowerCase().includes(query) ||
        (latestMessage ? messageSummary(latestMessage).toLowerCase().includes(query) : false)
      );
    });

    if (activeFilter === "unread") {
      return byText.filter((conversation) => getReadState(conversation, selectedId) === "unread");
    }
    if (activeFilter === "pending") {
      return byText.filter(
        (conversation) =>
          getReadState(conversation, selectedId) === "read-not-replied" ||
          conversationStatus(conversation) === "IN_PROGRESS"
      );
    }
    if (activeFilter === "resolved") {
      return byText.filter((conversation) => conversationStatus(conversation) === "RESOLVED");
    }
    return byText;
  }, [activeFilter, conversations, searchQuery, selectedId]);

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
        const nextConversations = options?.append
          ? [...conversationsRef.current, ...safeData]
          : safeData;
        setHasMoreConversations(safeData.length === CONVERSATION_PAGE_SIZE);
        conversationsRef.current = nextConversations;
        setConversations(nextConversations);
        setSelectedId((current) => {
          if (current && nextConversations.some((conversation) => conversation.id === current)) {
            selectedIdRef.current = current;
            return current;
          }
          selectedIdRef.current = null;
          return null;
        });
      } catch (loadError) {
        if (isMountedRef.current) {
          setError(readMessage(loadError, "Could not load conversations."));
        }
      } finally {
        if (isMountedRef.current && !options?.quiet) {
          setIsLoadingConversations(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    isMountedRef.current = true;
    setCurrentUser(readCurrentUser());
    if (hasInitialConversationsRef.current) {
      setIsLoadingConversations(false);
      setHasMoreConversations(initialConversations.length === CONVERSATION_PAGE_SIZE);
    } else {
      void loadConversations();
    }
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadConversations({ quiet: true });
      }
    }, 60000);
    const clockTimer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const active = document.activeElement;
        const isInput =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.getAttribute("contenteditable") === "true");
        if (!isInput) {
          setSelectedId(null);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      isMountedRef.current = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [initialConversations.length, loadConversations]);

  useEffect(() => {
    if (!currentUser?.tenantId) {
      return;
    }

    const abortController = new AbortController();
    void streamTenantEvents(currentUser.tenantId, abortController.signal, (event) => {
      if (!isMountedRef.current) {
        return;
      }
      if (event.type === "message.created" || event.type === "message.deleted" || event.type === "conversation.updated") {
        void loadConversations({ quiet: true });
        const eventConversationId = event.data?.conversationId;
        const selectedConversationId = selectedIdRef.current;
        if (eventConversationId && selectedConversationId === eventConversationId) {
          void loadMessages(selectedConversationId, { quiet: true });
        }
      }
    });

    return () => {
      abortController.abort();
    };
  }, [currentUser?.tenantId, loadConversations]);

  useEffect(() => {
    const workspaceId = selectedConversation?.workspaceId;
    if (!workspaceId) {
      setWorkspaceMembers([]);
      return;
    }

    let isCurrent = true;
    async function loadMembers() {
      try {
        const data = await apiFetch<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`);
        if (isCurrent) {
          setWorkspaceMembers(data || []);
        }
      } catch (err) {
        console.error("Failed to load workspace members", err);
      }
    }
    void loadMembers();
    return () => {
      isCurrent = false;
    };
  }, [selectedConversation?.workspaceId]);

  useEffect(() => {
    if (selectedId && selectedConversation && hasUnreadInboundMessages(selectedConversation)) {
      void markLineConversationAsRead(selectedId);
    }
  }, [selectedConversation?.unreadInboundMessageCount, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    prevMessageCountRef.current = 0;
    void loadMessages(selectedId);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMessages(selectedId, { quiet: true });
      }
    }, 30000);
    return () => window.clearInterval(refreshTimer);
  }, [selectedId]);

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      window.requestAnimationFrame(() => {
        const scrollContainer = messagesScrollRef.current;
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
          return;
        }
        messagesEndRef.current?.scrollIntoView?.({ behavior: "auto", block: "end" });
      });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    setIsEditingName(false);
    setNicknameDraft(selectedCustomerName);
    setAssigneeDraft(selectedConversation?.assignedToMemberId ?? "");
    setNoteDraft("");
  }, [selectedConversation?.assignedToMemberId, selectedCustomerName, selectedId]);

  useEffect(() => {
    if (!selectedId || !selectedConversation || !("tagLinks" in selectedConversation)) {
      setInternalNotes([]);
      return;
    }
    void loadInboxOperations(selectedId);
  }, [selectedConversation, selectedId]);

  useEffect(() => {
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      const fKeyMatch = event.key.match(/^F(1[0-2]|[1-9])$/);
      if (!fKeyMatch) {
        return;
      }

      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === "INPUT") {
        return;
      }
      if (activeEl && activeEl.tagName === "TEXTAREA" && activeEl.id !== "reply-text") {
        return;
      }

      const fKey = event.key;
      const foundReply = activeSavedReplies.find((reply) => reply.hotkeyBinding === fKey);
      if (foundReply) {
        event.preventDefault();
        void useQuickReply(foundReply);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [activeSavedReplies, selectedConversation, isQuickReplyAutoEnter, isSendingQuickReply]);

  async function loadInboxOperations(conversationId: string): Promise<void> {
    const lineChannelId = selectedConversation?.lineChannel.id;
    const [tagResult, replyResult, noteResult] = await Promise.allSettled([
      apiFetch<ConversationTag[]>("/api/v1/inbox/tags"),
      apiFetch<SavedReply[]>(
        lineChannelId
          ? `/api/v1/inbox/saved-replies?lineChannelId=${encodeURIComponent(lineChannelId)}`
          : "/api/v1/inbox/saved-replies"
      ),
      apiFetch<ConversationInternalNote[]>(`/api/v1/inbox/conversations/${conversationId}/notes`)
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
  }

  async function loadMessages(conversationId: string, options?: { quiet?: boolean }): Promise<void> {
    if (!options?.quiet) {
      setIsLoadingMessages(true);
    }
    setError(null);
    try {
      const data = await apiFetch<InboxMessage[]>(`/api/v1/inbox/conversations/${conversationId}/messages`);
      if (isMountedRef.current && selectedIdRef.current === conversationId) {
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (loadError) {
      if (isMountedRef.current && !options?.quiet) {
        setError(readMessage(loadError, "Could not load messages."));
      }
    } finally {
      if (isMountedRef.current && selectedIdRef.current === conversationId && !options?.quiet) {
        setIsLoadingMessages(false);
      }
    }
  }

  async function markLineConversationAsRead(conversationId: string): Promise<void> {
    if (markingReadRef.current.has(conversationId)) {
      return;
    }
    markingReadRef.current.add(conversationId);
    try {
      await apiFetch(`/api/v1/inbox/conversations/${conversationId}/mark-as-read`, {
        method: "PATCH"
      });
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadInboundMessageCount: 0 }
            : conversation
        )
      );
    } catch {
      // LINE read receipt is best-effort; keep inbox usable if LINE rejects token.
    } finally {
      markingReadRef.current.delete(conversationId);
    }
  }

  async function saveCustomerName(): Promise<void> {
    const cleanName = nicknameDraft.trim();
    if (!selectedConversation || !cleanName || isSavingName) {
      return;
    }
    setIsSavingName(true);
    setError(null);
    try {
      const updated = await apiFetch<{ id: string; nickname?: string | null }>(
        `/api/v1/inbox/conversations/${selectedConversation.id}/customer-name`,
        {
          body: JSON.stringify({ nickname: cleanName }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, nickname: updated.nickname ?? cleanName }
            : conversation
        )
      );
      setIsEditingName(false);
    } catch (saveError) {
      setError(readMessage(saveError, "Could not rename customer."));
    } finally {
      setIsSavingName(false);
    }
  }

  async function loadMoreConversations(): Promise<void> {
    if (isLoadingMoreConversations) {
      return;
    }
    setIsLoadingMoreConversations(true);
    try {
      await loadConversations({ append: true, offset: conversations.length, quiet: true });
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMoreConversations(false);
      }
    }
  }

  async function updateConversationStatus(status: ConversationStatus): Promise<void> {
    if (!selectedConversation || isSavingStatus) {
      return;
    }
    setIsSavingStatus(true);
    setError(null);
    try {
      const updated = await apiFetch<InboxConversation>(
        `/api/v1/inbox/conversations/${selectedConversation.id}/status`,
        {
          body: JSON.stringify({ status }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                status: updated.status ?? status,
                inProgressStartedAt:
                  updated.inProgressStartedAt ??
                  (status === "IN_PROGRESS" ? new Date().toISOString() : null)
              }
            : conversation
        )
      );
      setIsStatusMenuOpen(false);
    } catch (statusError) {
      setError(readMessage(statusError, "Could not update conversation status."));
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function saveAlertMinutes(): Promise<void> {
    const nextMinutes = Number.parseInt(alertMinutesDraft, 10);
    if (!Number.isFinite(nextMinutes) || nextMinutes < 1 || nextMinutes > 1440) {
      setError("Alert minutes must be between 1 and 1440.");
      return;
    }
    setIsSavingAlertMinutes(true);
    setError(null);
    try {
      const updated = await apiFetch<{ inProgressAlertMinutes: number }>("/api/v1/inbox/settings", {
        body: JSON.stringify({ inProgressAlertMinutes: nextMinutes }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      setInProgressAlertMinutes(updated.inProgressAlertMinutes);
      setAlertMinutesDraft(String(updated.inProgressAlertMinutes));
    } catch (settingsError) {
      setError(readMessage(settingsError, "Could not save inbox alert setting."));
    } finally {
      setIsSavingAlertMinutes(false);
    }
  }

  async function saveAssignment(nextValue?: string): Promise<void> {
    if (!selectedConversation || isSavingAssignment) {
      return;
    }
    const memberId = (nextValue ?? assigneeDraft).trim() || null;
    setIsSavingAssignment(true);
    setError(null);
    try {
      const updated = await apiFetch<InboxConversation>(
        `/api/v1/inbox/conversations/${selectedConversation.id}/assignment`,
        {
          body: JSON.stringify({ memberId }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, assignedToMemberId: updated.assignedToMemberId ?? memberId }
            : conversation
        )
      );
    } catch (assignmentError) {
      setError(readMessage(assignmentError, "Could not assign conversation."));
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function updatePriority(): Promise<void> {
    if (!selectedConversation || isSavingPriority) {
      return;
    }
    const priority = nextPriority(conversationPriority(selectedConversation));
    setIsSavingPriority(true);
    setError(null);
    try {
      const updated = await apiFetch<InboxConversation>(
        `/api/v1/inbox/conversations/${selectedConversation.id}/priority`,
        {
          body: JSON.stringify({ priority }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, priority: updated.priority ?? priority }
            : conversation
        )
      );
    } catch (priorityError) {
      setError(readMessage(priorityError, "Could not update priority."));
    } finally {
      setIsSavingPriority(false);
    }
  }

  async function createInternalNote(): Promise<void> {
    if (!selectedConversation || isSavingNote || !noteDraft.trim()) {
      return;
    }
    setIsSavingNote(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/inbox/conversations/${selectedConversation.id}/notes`, {
        body: JSON.stringify({ body: noteDraft.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      setNoteDraft("");
      await loadInboxOperations(selectedConversation.id);
    } catch (noteError) {
      setError(readMessage(noteError, "Could not save internal note."));
    } finally {
      setIsSavingNote(false);
    }
  }

  async function addTagToConversation(tag: ConversationTag): Promise<void> {
    if (!selectedConversation || selectedTagIds.has(tag.id)) {
      return;
    }
    setError(null);
    try {
      const link = await apiFetch<ConversationTagLink>(
        `/api/v1/inbox/conversations/${selectedConversation.id}/tags/${tag.id}`,
        { method: "POST" }
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                tagLinks: [
                  ...(conversation.tagLinks ?? []).filter((item) => item.tagId !== tag.id),
                  { ...link, tagId: tag.id, tag }
                ]
              }
            : conversation
        )
      );
    } catch (tagError) {
      setError(readMessage(tagError, "Could not add tag."));
    }
  }

  async function removeTagFromConversation(tag: ConversationTag): Promise<void> {
    if (!selectedConversation || !selectedTagIds.has(tag.id)) {
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/v1/inbox/conversations/${selectedConversation.id}/tags/${tag.id}`, {
        method: "DELETE"
      });
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                tagLinks: (conversation.tagLinks ?? []).filter((item) => item.tagId !== tag.id)
              }
            : conversation
        )
      );
    } catch (tagError) {
      setError(readMessage(tagError, "Could not remove tag."));
    }
  }

  async function handleCreateTag(name: string): Promise<void> {
    if (!name.trim()) return;
    setError(null);
    try {
      const newTag = await apiFetch<ConversationTag>("/api/v1/inbox/tags", {
        body: JSON.stringify({ name: name.trim(), color: "#4f46e5" }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      setTags((current) => [...current, newTag]);
      await addTagToConversation(newTag);
    } catch (tagError) {
      setError(readMessage(tagError, "Could not create tag."));
    }
  }

  function insertComposerText(body: string): void {
    setComposerInsertText(body);
    setComposerInsertNonce((current) => current + 1);
  }

  function toggleQuickReplyAutoEnter(): void {
    setIsQuickReplyAutoEnter((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("omni_quick_reply_auto_enter", String(next));
      } catch {
        // localStorage may be unavailable in restricted browsers.
      }
      return next;
    });
  }

  async function useQuickReply(reply: SavedReply): Promise<void> {
    if (!selectedConversation || isSendingQuickReply) {
      return;
    }
    if (!isQuickReplyAutoEnter) {
      insertComposerText(reply.body);
      return;
    }
    setIsSendingQuickReply(true);
    setError(null);
    try {
      await apiFetch<null>(`/api/v1/line/conversations/${selectedConversation.id}/reply`, {
        body: JSON.stringify(reply.imageUrl ? { imageUrl: reply.imageUrl } : { text: reply.body }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      await loadMessages(selectedConversation.id);
    } catch (quickReplyError) {
      setError(readMessage(quickReplyError, "Could not send quick reply."));
    } finally {
      setIsSendingQuickReply(false);
    }
  }

  function handleSelectConversation(id: string) {
    selectedIdRef.current = id;
    setSelectedId(id);
    setMobileTab("thread");
  }

  const filters: FilterPill[] = [
    { id: "all", label: t.filterAll, count: conversations.length },
    { id: "unread", label: t.filterOpen, count: unreadCount },
    { id: "pending", label: t.filterWaiting, count: readNotRepliedCount },
    {
      id: "resolved",
      label: t.filterClosed,
      count: conversations.filter((conversation) => conversationStatus(conversation) === "RESOLVED").length
    }
  ];
  const cards = filteredConversations.map((conversation): ConversationCardProps => {
    const latestMessage = conversation.messages?.[0];
    const readState = getReadState(conversation, selectedId);
    return {
      id: conversation.id,
      customerName: customerLabel(conversation),
      customerInitial: customerInitial(customerLabel(conversation)),
      preview: latestMessage
        ? `${latestMessage.direction === "OUTBOUND" ? (locale === "th" ? "คุณ: " : "You: ") : ""}${messageSummary(latestMessage)}`
        : t.noMessagesYet,
      time: formatRelativeTime(conversation.lastMessageAt ?? latestMessage?.createdAt),
      channelTag: conversation.lineChannel.name,
      channelStyle: lineChannelBadgeStyle(conversation.lineChannel),
      status: conversationCardStatus(conversation, readState),
      unreadCount: readState === "unread" ? 1 : undefined,
      isActive: conversation.id === selectedId
    };
  });
  const chatMessages: ChatMessageItem[] = messages.map((message) => ({
    id: message.id,
    variant: message.direction === "OUTBOUND" ? "outbound" : "inbound",
    body: messageSummary(message),
    authorInitial: message.direction === "INBOUND" ? customerInitial(selectedCustomerName) : undefined,
    time: message.direction === "OUTBOUND"
      ? `${currentUser?.displayName ?? "คุณ"} · ${formatDateTime(message.createdAt)}`
      : `${selectedCustomerName} · ${formatDateTime(message.createdAt)}`,
    type: message.type,
    mediaUrl: message.mediaUrl,
    mediaMimeType: message.mediaMimeType,
    mediaSize: message.mediaSize,
    mediaR2Key: message.mediaR2Key,
    mediaFileName: message.mediaFileName,
    rawPayload: message.rawPayload
  }));
  const selectedTags = (selectedConversation?.tagLinks ?? [])
    .filter((link) => !link.deletedAt && link.tag)
    .map((link) => ({ id: link.tagId, name: link.tag?.name ?? link.tagId, color: link.tag?.color ?? null }));
  const availableTags = tags.map((tag) => ({
    ...tag,
    isAttached: selectedTagIds.has(tag.id)
  }));
  const assigneeOptions = workspaceMembers.map((m) => ({
    id: m.id,
    label: m.user?.displayName || m.user?.email || m.id
  }));
  const customerPanel = (
    <CustomerPanel
      customerName={selectedConversation ? selectedCustomerName : "-"}
      customerInitial={customerInitial(selectedCustomerName)}
      lineLabel={selectedConversation?.lineChannel.name ?? "-"}
      status={conversationStatus(selectedConversation)}
      lineProfile={lineProfile}
      sourceId={
        lineSource?.userId ??
        lineSource?.groupId ??
        lineSource?.roomId ??
        selectedConversation?.externalThreadId ??
        "-"
      }
      sourceType={lineSource?.type ?? "-"}
      lineChannelId={selectedConversation?.lineChannel.lineChannelId ?? "-"}
      latestMessageType={lineMessage?.type ?? "-"}
      latestMessageId={lineMessage?.id ?? "-"}
      isEditingName={isEditingName}
      nicknameDraft={nicknameDraft}
      onNicknameChange={setNicknameDraft}
      onStartEditingName={() => setIsEditingName(true)}
      onCancelEditingName={() => {
        setNicknameDraft(selectedCustomerName);
        setIsEditingName(false);
      }}
      onSaveCustomerName={saveCustomerName}
      isSavingName={isSavingName}
      assigneeValue={assigneeDraft}
      assigneeOptions={assigneeOptions}
      onAssigneeChange={setAssigneeDraft}
      onSaveAssignment={(val) => void saveAssignment(val)}
      isSavingAssignment={isSavingAssignment}
      tags={selectedTags}
      availableTags={availableTags}
      onToggleTag={(tag) => void (tag.isAttached ? removeTagFromConversation(tag) : addTagToConversation(tag))}
      onCreateTag={handleCreateTag}
      savedReplies={activeSavedReplies.map((reply) => ({
        id: reply.id,
        title: `${selectedConversation?.lineChannel.name ?? "LINE OA"} : Quick Reply ${reply.title}`,
        subtitle: reply.body,
        body: reply.body,
        rawTitle: reply.title
      }))}
      autoQuickReply={isQuickReplyAutoEnter}
      onToggleAutoQuickReply={toggleQuickReplyAutoEnter}
      onSelectQuickReply={(replyId) => {
        const reply = activeSavedReplies.find((item) => item.id === replyId);
        if (reply) {
          void useQuickReply(reply);
        }
      }}
      noteDraft={noteDraft}
      onNoteDraftChange={setNoteDraft}
      onCreateNote={createInternalNote}
      isSavingNote={isSavingNote}
      notes={internalNotes}
      isLoadingOperations={isLoadingOperations}
      disabled={!selectedConversation}
    />
  );

  const emptyState = (
    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 p-8 text-center select-none">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 mb-5">
        <svg viewBox="0 0 24 24" className="h-11 w-11 fill-current" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 10.3c0-5.7-5.4-10.3-12-10.3S0 4.6 0 10.3c0 5.1 4.3 9.3 10.1 10.1.4.1.9.3 1 .7.1.3.1.8 0 1.2l-.2 1.3c-.1.5-.4 1.8 1.6 1 2-1 10.6-6.2 11.2-10.7.2-.9.3-1.9.3-2.9z"/>
        </svg>
      </div>
      <h2 className="font-heading text-lg font-semibold text-slate-800 dark:text-zinc-200">ลองแชทได้เลย!</h2>
      <p className="mt-1.5 text-sm text-slate-400 dark:text-zinc-500 max-w-xs leading-relaxed">
        เลือกห้องสนทนาจากรายการด้านซ้ายเพื่อเปิดกล่องข้อความและดูแลลูกค้าของคุณ
      </p>
    </div>
  );

  return (
    <section aria-labelledby="inbox-heading" className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-white">
      <h1 id="inbox-heading" className="sr-only">Unified Inbox</h1>
      {error ? <p className="shrink-0 px-6 py-2 text-sm text-danger">{error}</p> : null}

      <div
        data-testid="inbox-layout"
        className="grid h-full min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(21rem,22.5rem)_minmax(0,1fr)] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(18rem,21rem)] lg:grid-cols-[minmax(21.5rem,22.75rem)_minmax(0,1fr)_minmax(19.5rem,20.75rem)]"
      >
        <div
          data-testid="conversation-list-panel"
          className={[mobileTab === "chats" ? "flex" : "hidden", "h-full flex flex-col min-h-0 md:flex"].join(" ")}
        >
          <ConversationList
            activeFilter={activeFilter}
            conversations={cards}
            emptyText={searchQuery ? t.noResults : t.noConversations}
            filters={filters}
            footer={
              <>
                <OperationsSummary
                  alertMinutesDraft={alertMinutesDraft}
                  inProgressAlertMinutes={inProgressAlertMinutes}
                  isSavingAlertMinutes={isSavingAlertMinutes}
                  overdueConversations={overdueInProgressConversations}
                  readNotRepliedCount={readNotRepliedCount}
                  unreadCount={unreadCount}
                  now={now}
                  onAlertMinutesChange={setAlertMinutesDraft}
                  onSaveAlertMinutes={saveAlertMinutes}
                  onSelectConversation={handleSelectConversation}
                />
                {hasMoreConversations ? (
                  <div className="p-3">
                    <button
                      type="button"
                      aria-label="Load older conversations"
                      className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
                      disabled={isLoadingMoreConversations}
                      onClick={loadMoreConversations}
                    >
                      {isLoadingMoreConversations ? t.loadingConversations : t.olderConversations}
                    </button>
                  </div>
                ) : null}
              </>
            }
            isLoading={isLoadingConversations}
            loadingText={t.loadingConversations}
            onFilterChange={setActiveFilter}
            onSearchChange={setSearchQuery}
            onSelectConversation={handleSelectConversation}
            searchValue={searchQuery}
          />
        </div>

        {selectedConversation ? (
          <>
            <div className={[mobileTab === "thread" ? "flex" : "hidden", "h-full flex flex-col min-h-0 md:flex"].join(" ")}>
              <ChatWindow
                onClose={() => setSelectedId(null)}
                channelLabel={selectedConversation?.lineChannel.name ?? "-"}
                composer={
                  <ReplyComposer
                    conversationId={selectedConversation?.id ?? null}
                    insertNonce={composerInsertNonce}
                    insertText={composerInsertText}
                    lineChannelName={selectedConversation?.lineChannel.name ?? null}
                    onSent={async () => {
                      if (selectedConversation) {
                        await Promise.all([
                          loadMessages(selectedConversation.id, { quiet: true }),
                          loadConversations({ quiet: true })
                        ]);
                      }
                    }}
                  />
                }
                customerInitial={customerInitial(selectedCustomerName)}
                customerName={selectedConversation ? selectedCustomerName : t.messageThread}
                emptyText={
                  !selectedConversation && !isLoadingConversations
                    ? t.connectLine
                    : selectedConversation && messages.length === 0
                      ? t.noThreadMessages
                      : undefined
                }
                isLoading={isLoadingMessages}
                loadingText={t.loadingMessages}
                messages={chatMessages}
                messagesScrollRef={messagesScrollRef}
                messagesEndRef={messagesEndRef}
                onOpenCustomer={() => setMobileTab("customers")}
                onQuickReply={() => {
                  setMobileTab("customers");
                  setTimeout(() => {
                    document.getElementById("quick-reply-section")?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                onUpdatePriority={updatePriority}
                onUpdateStatus={(status) => void updateConversationStatus(status)}
                priority={conversationPriority(selectedConversation)}
                status={conversationHeaderStatus(selectedConversation)}
                statusElapsed={
                  conversationStatus(selectedConversation) === "IN_PROGRESS" && selectedConversation?.inProgressStartedAt
                    ? formatElapsed(selectedConversation.inProgressStartedAt, now)
                    : null
                }
                statusMenuOpen={isStatusMenuOpen}
                toggleStatusMenu={() => setIsStatusMenuOpen((current) => !current)}
                disableActions={!selectedConversation}
                disableQuickReply={!selectedConversation || activeSavedReplies.length === 0}
                disablePriority={!selectedConversation || isSavingPriority}
                disableStatus={!selectedConversation || isSavingStatus}
              />
            </div>
          </>
        ) : (
          <div className="hidden md:flex min-h-0 flex-1">
            {emptyState}
          </div>
        )}

        <div
          data-testid="customer-context-panel"
          className={[mobileTab === "customers" ? "flex" : "hidden", "h-full flex flex-col min-h-0 lg:flex xl:flex"].join(" ")}
        >
          <div data-testid="mobile-customer-panel" className="h-full">
            {customerPanel}
          </div>
        </div>
      </div>

      <BottomNav activeTab={mobileTab} onChange={setMobileTab} />
    </section>
  );
}

function OperationsSummary({
  alertMinutesDraft,
  inProgressAlertMinutes,
  isSavingAlertMinutes,
  now,
  overdueConversations,
  readNotRepliedCount,
  unreadCount,
  onAlertMinutesChange,
  onSaveAlertMinutes,
  onSelectConversation
}: {
  alertMinutesDraft: string;
  inProgressAlertMinutes: number;
  isSavingAlertMinutes: boolean;
  now: number;
  overdueConversations: InboxConversation[];
  readNotRepliedCount: number;
  unreadCount: number;
  onAlertMinutesChange: (value: string) => void;
  onSaveAlertMinutes: () => void;
  onSelectConversation: (id: string) => void;
}) {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  return (
    <div className="border-b border-border px-3 py-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {unreadCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            {unreadCount} ยังไม่ได้อ่าน
          </span>
        ) : null}
        {readNotRepliedCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {readNotRepliedCount} อ่านแล้วไม่ตอบ
          </span>
        ) : null}
        {unreadCount === 0 && readNotRepliedCount === 0 ? (
          <p className="text-xs text-muted-foreground">{t.allReplied}</p>
        ) : null}
      </div>
      {overdueConversations.length > 0 ? (
        <details className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold">
            <AlertTriangle size={14} aria-hidden="true" />
            {overdueConversations.length} กำลังดำเนินการเกิน {inProgressAlertMinutes} นาที
          </summary>
          <div className="mt-1 grid gap-1">
            {overdueConversations.slice(0, 5).map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className="truncate rounded bg-white px-2 py-1 text-left hover:bg-amber-100"
                onClick={() => onSelectConversation(conversation.id)}
              >
                {customerLabel(conversation)} · {formatElapsed(conversation.inProgressStartedAt, now)}
              </button>
            ))}
          </div>
        </details>
      ) : null}
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="in-progress-alert-minutes">
          In-progress alert minutes
        </label>
        <input
          id="in-progress-alert-minutes"
          aria-label="In-progress alert minutes"
          className="h-8 w-20 rounded-md border border-border bg-white px-2 text-xs"
          inputMode="numeric"
          min={1}
          max={1440}
          onChange={(event) => onAlertMinutesChange(event.target.value)}
          type="number"
          value={alertMinutesDraft}
        />
        <span className="text-xs text-muted-foreground">{t.alertMinutes}</span>
        <button
          type="button"
          aria-label="Save alert minutes"
          className="ml-auto h-8 rounded-md border border-border px-2 text-xs font-medium hover:bg-secondary disabled:opacity-60"
          disabled={isSavingAlertMinutes}
          onClick={onSaveAlertMinutes}
        >
          {t.save}
        </button>
      </div>
    </div>
  );
}

function getReadState(conversation: InboxConversation, selectedId: string | null): ConvReadState {
  const latestMessage = conversation.messages?.[0];
  if (!latestMessage || latestMessage.direction === "OUTBOUND") {
    return "normal";
  }
  if (conversation.id === selectedId) {
    return "read-not-replied";
  }
  return hasUnreadInboundMessages(conversation) ? "unread" : "read-not-replied";
}

function hasUnreadInboundMessages(conversation: InboxConversation): boolean {
  return (conversation.unreadInboundMessageCount ?? 0) > 0;
}

function readCurrentUser(): AuthUser | null {
  try {
    const stored = window.localStorage.getItem("omnichat.user");
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null;
  }
}

async function streamTenantEvents(
  tenantId: string,
  signal: AbortSignal,
  onEvent: (event: TenantRealtimeEvent) => void
): Promise<void> {
  try {
    const token = window.localStorage.getItem("omnichat.accessToken");
    const response = await fetch(`/api/v1/sse/tenant/${encodeURIComponent(tenantId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal
    });
    const reader = response.body?.getReader();
    if (!response.ok || !reader) {
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseSseBlock(block);
        if (event) {
          onEvent(event);
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
    reader.releaseLock();
  } catch {
    if (!signal.aborted) {
      // Polling remains as fallback when the realtime stream is unavailable.
    }
  }
}

function parseSseBlock(block: string): TenantRealtimeEvent | null {
  const lines = block.split(/\r?\n/);
  const eventType = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim();
  const dataLine = lines.find((line) => line.startsWith("data:"))?.slice("data:".length).trim();
  if (!eventType) {
    return null;
  }
  if (!dataLine) {
    return { type: eventType };
  }
  try {
    const data = JSON.parse(dataLine) as TenantRealtimeEvent["data"];
    return { type: eventType, data };
  } catch {
    return { type: eventType };
  }
}

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function customerLabel(conversation: InboxConversation): string {
  return conversation.nickname ?? conversation.displayName ?? conversation.externalThreadId;
}

function customerInitial(value: string): string {
  return (value.trim().charAt(0) || "?").toUpperCase();
}

function messageSummary(message: {
  text: string | null;
  type?: string | null;
  rawPayload?: LineMessagePayload | null;
}): string {
  if (message.text) {
    return message.text;
  }
  if (message.type === "IMAGE") {
    return "[Image]";
  }
  if (message.type === "VIDEO") {
    return "[Video]";
  }
  if (message.type === "AUDIO") {
    return "[Audio]";
  }
  if (message.type === "FILE") {
    return "[File]";
  }
  if (isStickerMessage(message)) {
    return `Sticker ${message.rawPayload?.message?.stickerId ?? "received"}\nPackage ${message.rawPayload?.message?.packageId ?? "-"}`;
  }
  return "(Unsupported message)";
}

function isStickerMessage(message: {
  type?: string | null;
  rawPayload?: LineMessagePayload | null;
}): boolean {
  return message.type === "STICKER" || message.rawPayload?.message?.type === "sticker";
}

function lineChannelBadgeStyle(lineChannel: InboxConversation["lineChannel"]) {
  if (lineChannel.badgeColor) {
    return {
      backgroundColor: lineChannel.badgeColor,
      borderColor: lineChannel.badgeColor,
      color: "#fff"
    };
  }

  return {
    backgroundColor: "#E8EBFF",
    borderColor: "#DDE1FF",
    color: "#4E47C8"
  };
}

function conversationStatus(conversation: InboxConversation | null): ConversationStatus | "No conversation" {
  if (!conversation) {
    return "No conversation";
  }
  return isConversationStatus(conversation.status) ? conversation.status : "OPEN";
}

function isConversationStatus(status: string | null | undefined): status is ConversationStatus {
  return status === "OPEN" || status === "IN_PROGRESS" || status === "RESOLVED";
}

function conversationCardStatus(
  conversation: InboxConversation,
  readState: ConvReadState
): ConversationCardProps["status"] {
  if (conversationStatus(conversation) === "RESOLVED") {
    return "RESOLVED";
  }
  if (readState === "unread") {
    return "UNREAD";
  }
  if (conversationStatus(conversation) === "IN_PROGRESS" || readState === "read-not-replied") {
    return "PENDING";
  }
  return "OPEN";
}

function conversationHeaderStatus(conversation: InboxConversation | null): "OPEN" | "PENDING" | "RESOLVED" {
  const status = conversationStatus(conversation);
  if (status === "RESOLVED") {
    return "RESOLVED";
  }
  if (status === "IN_PROGRESS") {
    return "PENDING";
  }
  return "OPEN";
}

function conversationPriority(conversation: InboxConversation | null): ConversationPriority {
  return isConversationPriority(conversation?.priority) ? conversation.priority : "NORMAL";
}

function isConversationPriority(priority: string | null | undefined): priority is ConversationPriority {
  return priority === "LOW" || priority === "NORMAL" || priority === "HIGH" || priority === "URGENT";
}

function nextPriority(priority: ConversationPriority): ConversationPriority {
  switch (priority) {
    case "LOW":
      return "NORMAL";
    case "NORMAL":
      return "HIGH";
    case "HIGH":
      return "URGENT";
    case "URGENT":
      return "LOW";
  }
}

function isInProgressOverdue(conversation: InboxConversation, now: number, alertMinutes: number): boolean {
  if (conversationStatus(conversation) !== "IN_PROGRESS" || !conversation.inProgressStartedAt) {
    return false;
  }
  const startedAt = new Date(conversation.inProgressStartedAt).getTime();
  return Number.isFinite(startedAt) && now - startedAt >= alertMinutes * 60_000;
}

function formatElapsed(value: string | null | undefined, now: number): string {
  if (!value) {
    return "0m";
  }
  const startedAt = new Date(value).getTime();
  if (!Number.isFinite(startedAt)) {
    return "0m";
  }
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatRelativeTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

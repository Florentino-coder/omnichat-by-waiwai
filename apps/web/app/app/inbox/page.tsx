"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { AlertTriangle, Check, Clock, Pencil, Search, X } from "lucide-react";
import { Badge, Button, Card, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { ReplyComposer } from "./reply-composer";

type MessageDirection = "INBOUND" | "OUTBOUND";

type ConversationPreviewMessage = {
  id: string;
  direction: MessageDirection;
  type?: string | null;
  text: string | null;
  rawPayload?: LineMessagePayload | null;
  createdAt: string;
};

type InboxConversation = {
  id: string;
  externalThreadId: string;
  displayName?: string | null;
  nickname?: string | null;
  status?: string | null;
  inProgressStartedAt?: string | null;
  lastMessageAt?: string | null;
  lineChannel: {
    id: string;
    name: string;
    badgeColor?: string | null;
    lineChannelId: string;
  };
  messages: ConversationPreviewMessage[];
};

type ConversationStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

const CONVERSATION_PAGE_SIZE = 10;

type InboxMessage = {
  id: string;
  direction: MessageDirection;
  type?: string | null;
  text: string | null;
  createdAt: string;
  rawPayload?: LineMessagePayload | null;
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

// Track read state in sessionStorage (per conversationId, storing the latest read message ID)
function markRead(id: string, messageId: string) {
  try {
    const key = `omni_read_${id}`;
    sessionStorage.setItem(key, messageId);
  } catch {
    // ignore
  }
}

function isRead(id: string, messageId: string): boolean {
  try {
    return sessionStorage.getItem(`omni_read_${id}`) === messageId;
  } catch {
    return false;
  }
}

/** Determine conversation read/reply state */
type ConvReadState = "unread" | "read-not-replied" | "normal";

function getReadState(
  conversation: InboxConversation,
  selectedId: string | null
): ConvReadState {
  const latestMsg = conversation.messages?.[0];
  if (!latestMsg) {
    return "normal";
  }

  // If last message is ours (OUTBOUND), it's always read & replied
  if (latestMsg.direction === "OUTBOUND") {
    return "normal";
  }

  // Latest message is INBOUND (customer)
  const isCurrentlySelected = conversation.id === selectedId;
  const read = isCurrentlySelected || isRead(conversation.id, latestMsg.id);

  if (!read) {
    return "unread";
  }

  // Read but latest message is still INBOUND (not replied yet)
  return "read-not-replied";
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [inProgressAlertMinutes, setInProgressAlertMinutes] = useState(10);
  const [alertMinutesDraft, setAlertMinutesDraft] = useState("10");
  const [isSavingAlertMinutes, setIsSavingAlertMinutes] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isMountedRef = useRef(false);
  const conversationsRef = useRef<InboxConversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const latestInboundMessage = useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    return [...safeMessages].reverse().find((message) => message.direction === "INBOUND") ?? null;
  }, [messages]);
  const lineProfile = latestInboundMessage?.rawPayload?.lineProfile ?? null;
  const lineSource = latestInboundMessage?.rawPayload?.source ?? null;
  const lineMessage = latestInboundMessage?.rawPayload?.message ?? null;
  const selectedCustomerName = selectedConversation ? customerLabel(selectedConversation) : "";

  // Filtered conversations for search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const name = customerLabel(c).toLowerCase();
      const channel = c.lineChannel.name.toLowerCase();
      const lastMsg = c.messages?.[0] ? messageSummary(c.messages[0]).toLowerCase() : "";
      return name.includes(q) || channel.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, searchQuery]);

  // Count unread / read-not-replied
  const unreadCount = useMemo(
    () => conversations.filter((c) => getReadState(c, selectedId) === "unread").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, selectedId]
  );
  const readNotRepliedCount = useMemo(
    () => conversations.filter((c) => getReadState(c, selectedId) === "read-not-replied").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, selectedId]
  );
  const overdueInProgressConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        isInProgressOverdue(conversation, now, inProgressAlertMinutes)
      ),
    [conversations, inProgressAlertMinutes, now]
  );

  const loadConversations = useCallback(async (options?: {
    append?: boolean;
    offset?: number;
    quiet?: boolean;
  }): Promise<void> => {
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
          return current;
        }
        return nextConversations[0]?.id ?? null;
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
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadConversations();
    const refreshTimer = window.setInterval(() => {
      void loadConversations({ quiet: true });
    }, 3000);
    const clockTimer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      isMountedRef.current = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadConversations]);

  // Automatically mark the selected conversation's latest message as read
  useEffect(() => {
    if (selectedId) {
      const selectedConv = conversations.find((c) => c.id === selectedId);
      const latestMsg = selectedConv?.messages?.[0];
      if (latestMsg) {
        markRead(selectedId, latestMsg.id);
      }
    }
  }, [selectedId, conversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedId);
    const refreshTimer = window.setInterval(() => {
      void loadMessages(selectedId, { quiet: true });
    }, 2000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [selectedId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    setIsEditingName(false);
    setNicknameDraft(selectedCustomerName);
  }, [selectedCustomerName, selectedId]);

  async function loadMessages(
    conversationId: string,
    options?: { quiet?: boolean }
  ): Promise<void> {
    if (!options?.quiet) {
      setIsLoadingMessages(true);
    }
    setError(null);
    try {
      const data = await apiFetch<InboxMessage[]>(
        `/api/v1/inbox/conversations/${conversationId}/messages`
      );
      if (isMountedRef.current) {
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (loadError) {
      if (isMountedRef.current && !options?.quiet) {
        setError(readMessage(loadError, "Could not load messages."));
      }
    } finally {
      if (isMountedRef.current && !options?.quiet) {
        setIsLoadingMessages(false);
      }
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
      await loadConversations({
        append: true,
        offset: conversations.length,
        quiet: true
      });
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

  function handleSelectConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    const latestMsg = conv?.messages?.[0];
    if (latestMsg) {
      markRead(id, latestMsg.id);
    }
    setSelectedId(id);
  }

  return (
    <section
      aria-labelledby="inbox-heading"
      className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-4 border-b border-border bg-background">
        <div>
          <h1 id="inbox-heading" className="font-heading text-2xl font-medium">
            Inbox
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            LINE conversations synced from verified webhooks.
          </p>
        </div>
        <Badge variant="primary">Stage 3</Badge>
      </div>

      {error ? <p className="shrink-0 px-6 py-2 text-sm text-danger">{error}</p> : null}

      {/* 3-column layout */}
      <div
        data-testid="inbox-layout"
        className="grid h-[calc(100vh-12rem)] min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(220px,300px)]"
      >
        {/* Conversation sidebar */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-r border-border bg-white lg:w-[280px]">
          {/* Sidebar header */}
          <div className="shrink-0 border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-medium">Conversations</h2>
            </div>
            {/* Counter badges */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {unreadCount > 0 && (
                <span
                  title={`${unreadCount} แชทที่ยังไม่ได้อ่าน`}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {unreadCount} ยังไม่ได้อ่าน
                </span>
              )}
              {readNotRepliedCount > 0 && (
                <span
                  title={`${readNotRepliedCount} แชทที่อ่านแล้วแต่ยังไม่ตอบ`}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {readNotRepliedCount} อ่านแล้วไม่ตอบ
                </span>
              )}
              {unreadCount === 0 && readNotRepliedCount === 0 && (
                <p className="text-xs text-muted-foreground">ตอบครบทุกแชทแล้ว 🎉</p>
              )}
            </div>
            {overdueInProgressConversations.length > 0 ? (
              <details className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {overdueInProgressConversations.length} กำลังดำเนินการเกิน {inProgressAlertMinutes} นาที
                </summary>
                <div className="mt-1 grid gap-1">
                  {overdueInProgressConversations.slice(0, 5).map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className="truncate rounded bg-white px-2 py-1 text-left hover:bg-amber-100"
                      onClick={() => handleSelectConversation(conversation.id)}
                    >
                      {customerLabel(conversation)} · {formatElapsed(conversation.inProgressStartedAt, now)}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
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
                onChange={(event) => setAlertMinutesDraft(event.target.value)}
                type="number"
                value={alertMinutesDraft}
              />
              <span className="text-xs text-muted-foreground">นาทีเตือน</span>
              <button
                type="button"
                aria-label="Save alert minutes"
                className="ml-auto h-8 rounded-md border border-border px-2 text-xs font-medium hover:bg-secondary disabled:opacity-60"
                disabled={isSavingAlertMinutes}
                onClick={saveAlertMinutes}
              >
                Save
              </button>
            </div>
            {/* Search */}
            <div className="relative mt-2">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="ค้นหาชื่อ, แชท, ช่อง..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
            {isLoadingConversations ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Loading conversations...</p>
            ) : null}
            {!isLoadingConversations && conversations.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No LINE conversations yet.
              </p>
            ) : null}
            {filteredConversations.map((conversation) => {
              const latestMessage = conversation.messages?.[0];
              const isSelected = conversation.id === selectedId;
              const readState = getReadState(conversation, selectedId);
              const isUnread = readState === "unread";
              const isReadNotReplied = readState === "read-not-replied";
              const isInProgress = conversationStatus(conversation) === "IN_PROGRESS";
              const isOverdue = isInProgressOverdue(conversation, now, inProgressAlertMinutes);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={[
                    "relative w-full px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "bg-primary/10 border-l-[3px] border-l-primary"
                      : isUnread
                        ? "bg-blue-50 border-l-[3px] border-l-blue-500 hover:bg-blue-100"
                        : isReadNotReplied
                          ? "bg-amber-50 border-l-[3px] border-l-amber-400 hover:bg-amber-100"
                          : "bg-white border-l-[3px] border-l-transparent hover:bg-secondary"
                  ].join(" ")}
                  onClick={() => handleSelectConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-1.5">
                      {isUnread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="ยังไม่อ่าน" />
                      )}
                      {isReadNotReplied && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="อ่านแล้วไม่ตอบ" />
                      )}
                      <p
                        className={[
                          "truncate text-sm",
                          isUnread
                            ? "font-bold text-blue-800"
                            : isReadNotReplied
                              ? "font-semibold text-amber-800"
                              : "font-medium text-foreground"
                        ].join(" ")}
                      >
                        {customerLabel(conversation)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(conversation.lastMessageAt ?? latestMessage?.createdAt)}
                    </span>
                  </div>
                  <p
                    className={[
                      "mt-0.5 truncate text-xs",
                      isUnread
                        ? "text-blue-600"
                        : isReadNotReplied
                          ? "text-amber-600"
                          : "text-muted-foreground"
                    ].join(" ")}
                  >
                    {latestMessage
                      ? `${latestMessage.direction === "OUTBOUND" ? "You: " : ""}${messageSummary(latestMessage)}`
                      : "No messages yet"}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <Badge style={lineChannelBadgeStyle(conversation.lineChannel)}>
                      {conversation.lineChannel.name}
                    </Badge>
                    <span
                      className={[
                        "text-xs font-medium",
                        isUnread
                          ? "text-blue-600"
                          : isReadNotReplied
                            ? "text-amber-600"
                            : "text-muted-foreground"
                      ].join(" ")}
                    >
                      {isUnread ? "⬤ ยังไม่ได้อ่าน" : isReadNotReplied ? "◎ อ่านแล้วไม่ตอบ" : conversationStatus(conversation)}
                    </span>
                  </div>
                  {isInProgress ? (
                    <div
                      className={[
                        "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        isOverdue ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-700"
                      ].join(" ")}
                    >
                      <Clock size={12} aria-hidden="true" />
                      กำลังดำเนินการ {formatElapsed(conversation.inProgressStartedAt, now)}
                    </div>
                  ) : null}
                </button>
              );
            })}
            {filteredConversations.length === 0 && !isLoadingConversations && searchQuery ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">ไม่พบผลลัพธ์</p>
            ) : null}
            {hasMoreConversations ? (
              <div className="p-3">
                <button
                  type="button"
                  aria-label="Load older conversations"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
                  disabled={isLoadingMoreConversations}
                  onClick={loadMoreConversations}
                >
                  {isLoadingMoreConversations ? "Loading..." : "ดูแชทเก่ากว่า"}
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        {/* Message thread */}
        <section
          className="flex flex-1 min-w-0 min-h-0 flex-col bg-secondary/50"
          aria-labelledby="thread-heading"
        >
          <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4 py-3 lg:px-5">
            <div>
              <h2 id="thread-heading" className="font-heading text-sm font-medium">
                Message thread
              </h2>
              <p className="text-xs text-muted-foreground">Replies use Stage 2 LINE API.</p>
            </div>
            <div className="relative">
              <button
                type="button"
                aria-label="Change conversation status"
                className={statusButtonClass(selectedConversation)}
                disabled={!selectedConversation || isSavingStatus}
                onClick={() => setIsStatusMenuOpen((current) => !current)}
              >
                {statusLabel(conversationStatus(selectedConversation))}
                {conversationStatus(selectedConversation) === "IN_PROGRESS" &&
                selectedConversation?.inProgressStartedAt
                  ? ` · ${formatElapsed(selectedConversation.inProgressStartedAt, now)}`
                  : ""}
              </button>
              {isStatusMenuOpen && selectedConversation ? (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-border bg-white p-1 shadow-sm"
                >
                  {(["OPEN", "IN_PROGRESS", "RESOLVED"] as ConversationStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
                      onClick={() => updateConversationStatus(status)}
                    >
                      {statusLabel(status)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Scrollable messages */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-4 lg:p-5">
            {isLoadingMessages ? (
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            ) : null}
            {!isLoadingMessages && selectedConversation && messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
            ) : null}
            {!selectedConversation && !isLoadingConversations ? (
              <p className="text-sm text-muted-foreground">Connect LINE OA and send a message.</p>
            ) : null}
            {(Array.isArray(messages) ? messages : []).map((message) => (
              <Card
                key={message.id}
                className={`max-w-[min(34rem,88%)] p-3 ${
                  message.direction === "OUTBOUND"
                    ? "ml-auto border-primary bg-primary text-white"
                    : ""
                }`}
              >
                {isStickerMessage(message) ? (
                  <StickerDisplay message={message} isOutbound={message.direction === "OUTBOUND"} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{messageSummary(message)}</p>
                )}
                <p
                  className={`mt-2 text-xs ${
                    message.direction === "OUTBOUND" ? "text-white/80" : "text-muted-foreground"
                  }`}
                >
                  {message.direction === "OUTBOUND" ? "Outbound" : "Inbound"} ·{" "}
                  {formatDateTime(message.createdAt)}
                </p>
              </Card>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ReplyComposer
            conversationId={selectedConversation?.id ?? null}
            onSent={async () => {
              if (selectedConversation) {
                await loadMessages(selectedConversation.id);
              }
            }}
          />
        </section>

        {/* Customer context */}
        <aside
          className="flex min-h-0 w-full shrink-0 flex-col border-l border-border bg-white lg:w-[280px]"
          aria-labelledby="context-heading"
        >
          <div className="shrink-0 border-b border-border px-4 py-3">
            <h2 id="context-heading" className="font-heading text-sm font-medium">
              Customer context
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">LINE profile and channel detail</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Section: Identity */}
            {(lineProfile?.pictureUrl || lineProfile?.displayName) && (
              <div className="border-b border-border bg-gradient-to-b from-slate-50 to-white px-4 py-4">
                <div className="flex items-center gap-3">
                  {lineProfile?.pictureUrl ? (
                    <img
                      src={lineProfile.pictureUrl}
                      alt=""
                      className="h-12 w-12 rounded-full border-2 border-border object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
                      {(lineProfile?.displayName ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm text-foreground">
                      {lineProfile?.displayName ?? "-"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lineProfile?.statusMessage || "No status message"}
                    </p>
                    {lineProfile?.language && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {lineProfile.language}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section: Contact */}
            <div className="border-b border-border px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contact
              </p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Customer name</dt>
                  <dd className="mt-1">
                    {isEditingName && selectedConversation ? (
                      <div className="grid gap-2">
                        <Label htmlFor="customer-nickname" className="sr-only">
                          Customer nickname
                        </Label>
                        <Input
                          id="customer-nickname"
                          name="customer-nickname"
                          value={nicknameDraft}
                          onChange={(event) => setNicknameDraft(event.target.value)}
                          autoComplete="off"
                          maxLength={80}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={saveCustomerName}
                            disabled={isSavingName || nicknameDraft.trim().length === 0}
                            aria-label="Save customer name"
                          >
                            <Check size={14} aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setNicknameDraft(selectedCustomerName);
                              setIsEditingName(false);
                            }}
                            aria-label="Cancel customer name edit"
                          >
                            <X size={14} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <span className="break-all font-medium">
                          {selectedConversation ? selectedCustomerName : "-"}
                        </span>
                        {selectedConversation ? (
                          <button
                            type="button"
                            className="rounded-md border border-border p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            onClick={() => setIsEditingName(true)}
                            aria-label="Edit customer name"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Customer ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs font-medium text-foreground">
                    {lineSource?.userId ??
                      lineSource?.groupId ??
                      lineSource?.roomId ??
                      selectedConversation?.externalThreadId ??
                      "-"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Section: Channel */}
            <div className="border-b border-border px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Channel
              </p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Source</dt>
                  <dd className="mt-1 font-medium">LINE OA</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">LINE source type</dt>
                  <dd className="mt-1 font-medium">{lineSource?.type ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">OA channel name</dt>
                  <dd className="mt-1 font-medium">{selectedConversation?.lineChannel.name ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">OA channel ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs font-medium text-foreground">
                    {selectedConversation?.lineChannel.lineChannelId ?? "-"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Section: Message */}
            <div className="px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Latest message
              </p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Message type</dt>
                  <dd className="mt-1 font-medium">{lineMessage?.type ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Message ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs font-medium text-foreground">
                    {lineMessage?.id ?? "-"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

// ── Sticker display component ────────────────────────────────────────────────

function StickerDisplay({
  message,
  isOutbound
}: {
  message: InboxMessage;
  isOutbound: boolean;
}) {
  const stickerId = message.rawPayload?.message?.stickerId;
  const packageId = message.rawPayload?.message?.packageId;
  const [imgError, setImgError] = useState(false);

  const stickerUrl = stickerId
    ? `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`
    : null;

  if (stickerUrl && !imgError) {
    return (
      <div className="grid gap-1">
        <img
          src={stickerUrl}
          alt={`Sticker ${stickerId ?? ""}`}
          className="h-24 w-24 object-contain"
          onError={() => setImgError(true)}
        />
        <p className={`text-xs ${isOutbound ? "text-white/70" : "text-muted-foreground"}`}>
          Sticker {stickerId}
        </p>
        <p className={`text-xs ${isOutbound ? "text-white/70" : "text-muted-foreground"}`}>
          Package {packageId ?? "-"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <p className="text-sm font-medium">
        🎭 Sticker {stickerId ?? "received"}
      </p>
      <p className={`text-xs ${isOutbound ? "text-white/70" : "text-muted-foreground"}`}>
        Package {packageId ?? "-"}
      </p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function customerLabel(conversation: InboxConversation): string {
  return conversation.nickname ?? conversation.displayName ?? conversation.externalThreadId;
}

function messageSummary(message: {
  text: string | null;
  type?: string | null;
  rawPayload?: LineMessagePayload | null;
}): string {
  if (message.text) {
    return message.text;
  }
  if (isStickerMessage(message)) {
    return `🎭 Sticker ${message.rawPayload?.message?.stickerId ?? "received"}`;
  }
  return "(Unsupported message)";
}

function isStickerMessage(message: {
  type?: string | null;
  rawPayload?: LineMessagePayload | null;
}): boolean {
  return message.type === "STICKER" || message.rawPayload?.message?.type === "sticker";
}

function lineChannelBadgeStyle(lineChannel: InboxConversation["lineChannel"]): CSSProperties {
  const color = lineChannel.badgeColor ?? "#4f46e5";
  return {
    backgroundColor: color,
    borderColor: color,
    color: "#fff"
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

function statusLabel(status: ConversationStatus | "No conversation"): string {
  switch (status) {
    case "IN_PROGRESS":
      return "กำลังดำเนินการ";
    case "RESOLVED":
      return "ดำเนินการแล้ว";
    case "OPEN":
      return "OPEN";
    default:
      return "No conversation";
  }
}

function statusButtonClass(conversation: InboxConversation | null): string {
  const status = conversationStatus(conversation);
  const base =
    "inline-flex min-h-8 items-center rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60";

  if (status === "IN_PROGRESS") {
    return `${base} border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`;
  }
  if (status === "RESOLVED") {
    return `${base} border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200`;
  }
  if (status === "OPEN") {
    return `${base} border-success bg-success-soft text-success hover:bg-success-soft`;
  }

  return `${base} border-border bg-secondary text-muted-foreground`;
}

function isInProgressOverdue(
  conversation: InboxConversation,
  now: number,
  alertMinutes: number
): boolean {
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
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
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

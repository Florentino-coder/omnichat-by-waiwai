"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { Check, Pencil, X } from "lucide-react";
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
  lastMessageAt?: string | null;
  lineChannel: {
    id: string;
    name: string;
    badgeColor?: string | null;
    lineChannelId: string;
  };
  messages: ConversationPreviewMessage[];
};

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
  const isMountedRef = useRef(false);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const latestInboundMessage = useMemo(
    () => [...messages].reverse().find((message) => message.direction === "INBOUND") ?? null,
    [messages]
  );
  const lineProfile = latestInboundMessage?.rawPayload?.lineProfile ?? null;
  const lineSource = latestInboundMessage?.rawPayload?.source ?? null;
  const lineMessage = latestInboundMessage?.rawPayload?.message ?? null;
  const selectedCustomerName = selectedConversation ? customerLabel(selectedConversation) : "";

  const loadConversations = useCallback(async (options?: { quiet?: boolean }): Promise<void> => {
    if (!options?.quiet) {
      setIsLoadingConversations(true);
    }
    setError(null);
    try {
      const data = await apiFetch<InboxConversation[]>("/api/v1/inbox/conversations");
      if (!isMountedRef.current) {
        return;
      }
      setConversations(data);
      setSelectedId((current) => {
        if (current && data.some((conversation) => conversation.id === current)) {
          return current;
        }
        return data[0]?.id ?? null;
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

    return () => {
      isMountedRef.current = false;
      window.clearInterval(refreshTimer);
    };
  }, [loadConversations]);

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
        setMessages(data);
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

  return (
    <section aria-labelledby="inbox-heading" className="flex min-h-[calc(100vh-7rem)] flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
        <div>
          <h1 id="inbox-heading" className="font-heading text-2xl font-medium">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            LINE conversations synced from verified webhooks.
          </p>
        </div>
        <Badge variant="primary">Stage 3</Badge>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div
        data-testid="inbox-layout"
        className="grid h-[calc(100vh-12rem)] min-h-[520px] flex-1 grid-cols-1 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(220px,300px)]"
      >
        <aside className="min-h-0 overflow-y-auto border-b border-border bg-white lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-10 border-b border-border bg-white px-4 py-3">
            <h2 className="font-heading text-sm font-medium">Conversations</h2>
            <p className="mt-1 text-xs text-muted-foreground">Newest activity first</p>
          </div>
          <div className="divide-y divide-border">
            {isLoadingConversations ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Loading conversations...</p>
            ) : null}
            {!isLoadingConversations && conversations.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No LINE conversations yet.
              </p>
            ) : null}
            {conversations.map((conversation) => {
              const latestMessage = conversation.messages[0];
              const isSelected = conversation.id === selectedId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`w-full px-4 py-3 text-left ${
                    isSelected ? "bg-primary-soft" : "bg-white hover:bg-secondary"
                  }`}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {customerLabel(conversation)}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {latestMessage
                          ? `${latestMessage.direction === "OUTBOUND" ? "You: " : ""}${messageSummary(latestMessage)}`
                          : "No messages yet"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(conversation.lastMessageAt ?? latestMessage?.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge style={lineChannelBadgeStyle(conversation.lineChannel)}>
                      {conversation.lineChannel.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {conversationStatus(conversation)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-secondary/50" aria-labelledby="thread-heading">
          <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4 py-3 lg:px-5">
            <div>
              <h2 id="thread-heading" className="font-heading text-sm font-medium">
                Message thread
              </h2>
              <p className="text-xs text-muted-foreground">Replies use Stage 2 LINE API.</p>
            </div>
            <Badge variant={conversationStatus(selectedConversation) === "OPEN" ? "success" : "muted"}>
              {conversationStatus(selectedConversation)}
            </Badge>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 lg:p-5">
            {isLoadingMessages ? (
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            ) : null}
            {!isLoadingMessages && selectedConversation && messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
            ) : null}
            {!selectedConversation && !isLoadingConversations ? (
              <p className="text-sm text-muted-foreground">Connect LINE OA and send a message.</p>
            ) : null}
            {messages.map((message) => (
              <Card
                key={message.id}
                className={`max-w-[min(34rem,88%)] p-3 ${
                  message.direction === "OUTBOUND"
                    ? "ml-auto border-primary bg-primary text-white"
                    : ""
                }`}
              >
                {isStickerMessage(message) ? (
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">
                      Sticker {message.rawPayload?.message?.stickerId ?? "received"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Package {message.rawPayload?.message?.packageId ?? "-"}
                    </p>
                  </div>
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

        <aside className="min-h-0 overflow-y-auto border-t border-border bg-white lg:border-l lg:border-t-0" aria-labelledby="context-heading">
          <div className="sticky top-0 z-10 border-b border-border bg-white px-4 py-3">
            <h2 id="context-heading" className="font-heading text-sm font-medium">
              Customer context
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">LINE profile and channel detail</p>
          </div>
          <dl className="space-y-4 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Source</dt>
              <dd className="mt-1 font-medium">LINE OA</dd>
            </div>
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
              <dd className="mt-1 break-all font-medium">
                {lineSource?.userId ??
                  lineSource?.groupId ??
                  lineSource?.roomId ??
                  selectedConversation?.externalThreadId ??
                  "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">LINE profile</dt>
              <dd className="mt-2 flex items-center gap-3">
                {lineProfile?.pictureUrl ? (
                  <img
                    src={lineProfile.pictureUrl}
                    alt=""
                    className="h-10 w-10 rounded-full border border-border object-cover"
                  />
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {lineProfile?.displayName ?? "-"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {lineProfile?.statusMessage ?? "No status message"}
                  </span>
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">OA channel name</dt>
              <dd className="mt-1 font-medium">{selectedConversation?.lineChannel.name ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">OA channel ID</dt>
              <dd className="mt-1 break-all font-medium">
                {selectedConversation?.lineChannel.lineChannelId ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">LINE source type</dt>
              <dd className="mt-1 font-medium">{lineSource?.type ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Latest LINE message ID</dt>
              <dd className="mt-1 break-all font-medium">{lineMessage?.id ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Message type</dt>
              <dd className="mt-1 font-medium">{lineMessage?.type ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Language</dt>
              <dd className="mt-1 font-medium">{lineProfile?.language ?? "-"}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

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
    return `Sticker ${message.rawPayload?.message?.stickerId ?? "received"}`;
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

function conversationStatus(conversation: InboxConversation | null): string {
  return conversation?.status ?? (conversation ? "OPEN" : "No conversation");
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
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

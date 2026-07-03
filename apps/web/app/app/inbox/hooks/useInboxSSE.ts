import { useEffect } from "react";
import { devTrace } from "../../../lib/dev-trace";
import {
  isInboundRealtimeDirection,
  tryShowInboundMessageNotification,
} from "../../../lib/browser-notifications";
import { streamTenantEvents } from "../../../lib/tenant-sse-stream";
import { customerLabel, telemetryAuthHeaders } from "../inbox-client";
import type { InboxConversation } from "../inbox-client";

export function useInboxSSE({
  tenantId,
  isMountedRef,
  pendingFlowIdRef,
  sseReceivedMapRef,
  browserReceivedPostedRef,
  sseConnectedRef,
  trace,
  refreshThread,
  loadConversations,
  selectedIdRef,
  setRefreshSuggestionNonce,
  conversationsRef,
  setSelectedId,
  setMobileTab,
  pendingHybridDraftRef,
  setHybridDraftFailedNonce,
}: {
  tenantId: string | null | undefined;
  isMountedRef: React.MutableRefObject<boolean>;
  pendingFlowIdRef: React.MutableRefObject<string | undefined>;
  sseReceivedMapRef: React.MutableRefObject<Map<string, number>>;
  browserReceivedPostedRef: React.MutableRefObject<Set<string>>;
  sseConnectedRef: React.MutableRefObject<boolean>;
  trace: (flowId: string, stage: string) => void;
  refreshThread: (conversationId: string, options?: { quiet?: boolean }) => Promise<void>;
  loadConversations: (options?: { quiet?: boolean }) => Promise<void>;
  selectedIdRef: React.MutableRefObject<string | null>;
  setRefreshSuggestionNonce: React.Dispatch<React.SetStateAction<number>>;
  conversationsRef: React.MutableRefObject<InboxConversation[]>;
  setSelectedId: (id: string | null) => void;
  setMobileTab: (tab: any) => void;
  pendingHybridDraftRef: React.MutableRefObject<Set<string>>;
  setHybridDraftFailedNonce: React.Dispatch<React.SetStateAction<number>>;
}) {
  useEffect(() => {
    if (!tenantId) {
      return;
    }

    const abortController = new AbortController();
    let reconnectTimeoutId: number | undefined;

    function startStream() {
      if (abortController.signal.aborted) {
        return;
      }

      const connTime = Date.now();
      devTrace(`[TRACE] [SSE_CONNECT] ts=${connTime} time=${new Date(connTime).toISOString()}`);

      void streamTenantEvents(
        tenantId as string,
        abortController.signal,
        (event: any) => {
          if (!isMountedRef.current) {
            return;
          }

          const flowId = event.flowId || event.data?.flowId;
          if (flowId) {
            const now = Date.now();
            devTrace("[TRACE] BROWSER_RECEIVE", flowId, now);
            devTrace("[TRACE] SSE_HANDLER_START", flowId, now);
            trace(flowId, "BROWSER_RECEIVE");
            trace(flowId, "SSE_HANDLER_START");

            const sseReceivedVal = now;
            sseReceivedMapRef.current.set(flowId, sseReceivedVal);

            if (!browserReceivedPostedRef.current.has(flowId)) {
              browserReceivedPostedRef.current.add(flowId);
              void fetch(`/api/v1/monitor/browser-received`, {
                method: "POST",
                credentials: "include",
                headers: telemetryAuthHeaders(),
                body: JSON.stringify({ flowId, timestamp: now })
              });
            }
            pendingFlowIdRef.current = flowId;
            performance.mark(`render-start-${flowId}`);
          }

          if (
            event.type === "message.created" ||
            event.type === "message.deleted" ||
            event.type === "conversation.updated"
          ) {
            if (flowId) {
              trace(flowId, "STATE_UPDATE");
            }
            const eventConversationId = event.data?.conversationId;
            if (eventConversationId) {
              void refreshThread(eventConversationId, { quiet: true });
              if (
                event.type === "message.created" &&
                eventConversationId === selectedIdRef.current
              ) {
                setRefreshSuggestionNonce((prev) => prev + 1);
              }
              if (
                event.type === "message.created" &&
                event.data &&
                isInboundRealtimeDirection(event.data.direction) &&
                event.data.messageId &&
                eventConversationId
              ) {
                const eventData = event.data;
                const inboundMessageId = eventData.messageId;
                if (inboundMessageId) {
                  const conversation = conversationsRef.current.find(
                    (item) => item.id === eventConversationId
                  );
                  tryShowInboundMessageNotification({
                    messageId: inboundMessageId,
                    conversationId: eventConversationId,
                    customerName:
                      eventData.customerName ??
                      (conversation ? customerLabel(conversation) : "Customer"),
                    body: eventData.preview,
                    activeConversationId: selectedIdRef.current,
                    onSelectConversation: (conversationId: string) => {
                      setSelectedId(conversationId);
                      selectedIdRef.current = conversationId;
                      setMobileTab("chats");
                    },
                  });
                }
              }
            } else {
              void loadConversations({ quiet: true });
            }
          }

          if (event.type === "ai-suggestion.created") {
            const eventConversationId = event.data?.conversationId;
            if (eventConversationId) {
              pendingHybridDraftRef.current.add(eventConversationId);
              if (eventConversationId === selectedIdRef.current) {
                setRefreshSuggestionNonce((prev) => prev + 1);
              }
            }
          }

          if (event.type === "ai-suggestion.failed") {
            const eventConversationId = event.data?.conversationId;
            if (eventConversationId && eventConversationId === selectedIdRef.current) {
              setHybridDraftFailedNonce((prev) => prev + 1);
            }
          }
        },
        {
          onOpen: () => {
            sseConnectedRef.current = true;
          },
          onClose: () => {
            sseConnectedRef.current = false;
          }
        }
      )
        .then((result: any) => {
          if (result === "auth_failed" || abortController.signal.aborted) {
            return;
          }
          const discTime = Date.now();
          devTrace(`[TRACE] [SSE_DISCONNECT] ts=${discTime} time=${new Date(discTime).toISOString()}`);
          devTrace(`[TRACE] [SSE_RECONNECT] ts=${discTime + 1000} time=${new Date(discTime + 1000).toISOString()}`);
          reconnectTimeoutId = window.setTimeout(startStream, 1000);
        })
        .catch(() => {
          if (!abortController.signal.aborted) {
            const discTime = Date.now();
            devTrace(`[TRACE] [SSE_DISCONNECT] ts=${discTime} time=${new Date(discTime).toISOString()}`);
            devTrace(`[TRACE] [SSE_RECONNECT] ts=${discTime + 1000} time=${new Date(discTime + 1000).toISOString()}`);
            reconnectTimeoutId = window.setTimeout(startStream, 1000);
          }
        });
    }

    startStream();

    return () => {
      abortController.abort();
      if (reconnectTimeoutId) {
        window.clearTimeout(reconnectTimeoutId);
      }
    };
  }, [
    tenantId,
    loadConversations,
    refreshThread,
    browserReceivedPostedRef,
    conversationsRef,
    isMountedRef,
    pendingFlowIdRef,
    pendingHybridDraftRef,
    selectedIdRef,
    setHybridDraftFailedNonce,
    setMobileTab,
    setRefreshSuggestionNonce,
    setSelectedId,
    sseConnectedRef,
    sseReceivedMapRef,
    trace,
  ]);
}

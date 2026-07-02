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
      console.log('[SSE] useEffect skipped - no tenantId');
      return;
    }

    console.log('[SSE] useEffect initiated. Deps snapshot:', {
      tenantId,
      hasLoadConversations: !!loadConversations,
      hasRefreshThread: !!refreshThread,
      browserReceivedPostedRef: browserReceivedPostedRef.current,
      conversationsCount: conversationsRef.current?.length,
      isMounted: isMountedRef.current,
      pendingFlowId: pendingFlowIdRef.current,
      pendingHybridDraft: Array.from(pendingHybridDraftRef.current || []),
      selectedId: selectedIdRef.current,
      hasSetHybridDraftFailedNonce: !!setHybridDraftFailedNonce,
      hasSetMobileTab: !!setMobileTab,
      hasSetRefreshSuggestionNonce: !!setRefreshSuggestionNonce,
      hasSetSelectedId: !!setSelectedId,
      sseConnected: sseConnectedRef.current,
      sseReceivedMapSize: sseReceivedMapRef.current?.size,
      hasTrace: !!trace
    });

    const abortController = new AbortController();
    let reconnectTimeoutId: number | undefined;

    function startStream() {
      if (abortController.signal.aborted) {
        console.log('[SSE] startStream skipped - aborted');
        return;
      }

      const connTime = Date.now();
      devTrace(`[TRACE] [SSE_CONNECT] ts=${connTime} time=${new Date(connTime).toISOString()}`);
      console.log('[SSE] startStream calling streamTenantEvents...');

      void streamTenantEvents(
        tenantId as string,
        abortController.signal,
        (event: any) => {
          if (!isMountedRef.current) {
            console.log('[SSE] Event ignored - component not mounted');
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
              const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
              void fetch(`${apiBaseUrl}/api/v1/monitor/browser-received`, {
                method: "POST",
                credentials: "include",
                headers: telemetryAuthHeaders(),
                body: JSON.stringify({ flowId, timestamp: now })
              });
            }
            pendingFlowIdRef.current = flowId;
            performance.mark(`render-start-${flowId}`);
          }

          console.log('[SSE] event received:', event.type, 'data:', event.data);

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
            console.log('[SSE] Connection opened successfully');
            sseConnectedRef.current = true;
          },
          onClose: () => {
            console.log('[SSE] Connection closed/ended');
            sseConnectedRef.current = false;
          }
        }
      )
        .then((result: any) => {
          console.log('[SSE] streamTenantEvents finished. Result:', result, 'Aborted:', abortController.signal.aborted);
          if (result === "auth_failed" || abortController.signal.aborted) {
            return;
          }
          const discTime = Date.now();
          devTrace(`[TRACE] [SSE_DISCONNECT] ts=${discTime} time=${new Date(discTime).toISOString()}`);
          devTrace(`[TRACE] [SSE_RECONNECT] ts=${discTime + 1000} time=${new Date(discTime + 1000).toISOString()}`);
          reconnectTimeoutId = window.setTimeout(startStream, 1000);
        })
        .catch((err: any) => {
          console.log('[SSE] streamTenantEvents caught error:', err, 'Aborted:', abortController.signal.aborted);
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
      console.log('[SSE] useEffect cleanup triggered. Deps snapshot:', {
        tenantId,
        hasLoadConversations: !!loadConversations,
        hasRefreshThread: !!refreshThread,
        browserReceivedPostedRef: browserReceivedPostedRef.current,
        conversationsCount: conversationsRef.current?.length,
        isMounted: isMountedRef.current,
        pendingFlowId: pendingFlowIdRef.current,
        pendingHybridDraft: Array.from(pendingHybridDraftRef.current || []),
        selectedId: selectedIdRef.current,
        hasSetHybridDraftFailedNonce: !!setHybridDraftFailedNonce,
        hasSetMobileTab: !!setMobileTab,
        hasSetRefreshSuggestionNonce: !!setRefreshSuggestionNonce,
        hasSetSelectedId: !!setSelectedId,
        sseConnected: sseConnectedRef.current,
        sseReceivedMapSize: sseReceivedMapRef.current?.size,
        hasTrace: !!trace
      });
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

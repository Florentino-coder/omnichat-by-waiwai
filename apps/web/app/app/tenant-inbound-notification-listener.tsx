"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  canShowDesktopNotification,
  shouldShowDesktopNotification,
  showInboundMessageNotification,
} from "../lib/browser-notifications";
import { getActiveInboxConversationId } from "../lib/inbox-focus";
import { streamTenantEvents } from "../lib/tenant-sse-stream";
import { useAuthSession } from "../lib/use-auth-session";

/**
 * Listens for inbound LINE messages on non-inbox pages (Settings, Reports, etc.)
 * so desktop notifications still fire while the user tests settings or works elsewhere.
 * Inbox page runs its own SSE handler with richer UI updates.
 */
export function TenantInboundNotificationListener() {
  const pathname = usePathname();
  const { user } = useAuthSession();
  const tenantId = user?.tenantId;
  const isInboxPage = pathname?.startsWith("/app/inbox") ?? false;

  useEffect(() => {
    if (!tenantId || isInboxPage) {
      return;
    }

    const activeTenantId = tenantId;
    const abortController = new AbortController();
    let reconnectTimeoutId: number | undefined;

    function startStream() {
      if (abortController.signal.aborted) {
        return;
      }

      void streamTenantEvents(activeTenantId, abortController.signal, (event) => {
        if (event.type !== "message.created") {
          return;
        }

        const conversationId = event.data?.conversationId;
        const messageId = event.data?.messageId;
        if (
          event.data?.direction !== "INBOUND" ||
          !conversationId ||
          !messageId ||
          !canShowDesktopNotification() ||
          !shouldShowDesktopNotification({
            incomingConversationId: conversationId,
            activeConversationId: getActiveInboxConversationId(),
          })
        ) {
          return;
        }

        showInboundMessageNotification({
          messageId,
          conversationId,
          customerName: event.data.customerName ?? "Customer",
          body: event.data.preview,
          onSelectConversation: (id) => {
            window.location.assign(`/app/inbox?conversation=${encodeURIComponent(id)}`);
          },
        });
      }).then((result) => {
        if (result === "auth_failed" || abortController.signal.aborted) {
          return;
        }
        reconnectTimeoutId = window.setTimeout(startStream, 1000);
      });
    }

    startStream();

    return () => {
      abortController.abort();
      if (reconnectTimeoutId) {
        window.clearTimeout(reconnectTimeoutId);
      }
    };
  }, [tenantId, isInboxPage]);

  return null;
}

import { devTrace, devTraceError } from "./dev-trace";
import { authorizedFetch, handleLogoutRedirect } from "./api-client";

export type TenantRealtimeEvent = {
  type: string;
  data?: {
    conversationId?: string;
    messageId?: string;
    direction?: string;
    customerName?: string;
    preview?: string;
    flowId?: string;
  };
  flowId?: string;
};

export type StreamTenantEventsResult = "completed" | "auth_failed" | "aborted";

export type StreamTenantEventsOptions = {
  onOpen?: () => void;
  onClose?: () => void;
};

export async function streamTenantEvents(
  tenantId: string,
  signal: AbortSignal,
  onEvent: (event: TenantRealtimeEvent) => void,
  options?: StreamTenantEventsOptions
): Promise<StreamTenantEventsResult> {
  if (signal.aborted) {
    return "aborted";
  }

  try {
    const streamUrl = `/api/v1/sse/tenant/${encodeURIComponent(tenantId)}`;
    const response = await authorizedFetch(streamUrl, { signal });

    if (signal.aborted) {
      return "aborted";
    }

    if (response.status === 401) {
      handleLogoutRedirect();
      return "auth_failed";
    }

    const reader = response.body?.getReader();
    if (!response.ok || !reader) {
      return "completed";
    }

    options?.onOpen?.();
    devTrace("[TRACE] SSE_OPEN", Date.now());

    const decoder = new TextDecoder();
    let buffer = "";
    try {
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
          devTrace("[TRACE] RAW_SSE_MESSAGE", Date.now(), block);
          const event = parseSseBlock(block);
          if (event) {
            onEvent(event);
          } else {
            devTraceError("[TRACE] SSE_PARSE_ERROR", "Could not parse block:", block);
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } finally {
      reader.releaseLock();
      options?.onClose?.();
    }
    return signal.aborted ? "aborted" : "completed";
  } catch {
    options?.onClose?.();
    return signal.aborted ? "aborted" : "completed";
  }
}

export function parseSseBlock(block: string): TenantRealtimeEvent | null {
  const lines = block.split(/\r?\n/);
  const eventType = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim();
  const dataLine = lines.find((line) => line.startsWith("data:"))?.slice("data:".length).trim();

  let parsedData: TenantRealtimeEvent["data"] | null = null;
  if (dataLine) {
    try {
      parsedData = JSON.parse(dataLine) as TenantRealtimeEvent["data"];
    } catch {
      // ignore
    }
  }

  const type = eventType || (parsedData as { type?: string; event?: string } | null)?.type || (parsedData as { event?: string } | null)?.event;
  if (!type) {
    return null;
  }

  const flowId = parsedData?.flowId;

  return { type, data: parsedData ?? undefined, flowId };
}

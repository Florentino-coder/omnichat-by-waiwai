/** Status codes that must not include a response body (Fetch / Response spec). */
const NO_BODY_RESPONSE_STATUSES = new Set([204, 205, 304]);

export function readApiBaseUrl(): string | null {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  return apiBaseUrl ?? null;
}

/**
 * Builds the BFF response from an upstream API fetch.
 * 204/205/304 must use a null body — Next.js throws (500) if a buffer is passed.
 */
export async function buildBffResponseFromUpstream(upstream: Response): Promise<Response> {
  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("Content-Type", upstreamContentType);
  }
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) {
    responseHeaders.set("Cache-Control", cacheControl);
  }

  if (upstreamContentType?.includes("text/event-stream") && upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  }

  if (NO_BODY_RESPONSE_STATUSES.has(upstream.status)) {
    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders
    });
  }

  const responseBody = await upstream.arrayBuffer();
  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders
  });
}

export async function proxyApiRequest(
  path: string,
  init: RequestInit & { accessToken?: string | null } = {}
): Promise<Response> {
  const apiBaseUrl = readApiBaseUrl();
  if (!apiBaseUrl) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { message: "API base URL is not configured" }
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const headers = new Headers(init.headers);
  if (init.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers
  });
}

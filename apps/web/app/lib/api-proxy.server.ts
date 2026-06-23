export function readApiBaseUrl(): string | null {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  return apiBaseUrl ?? null;
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

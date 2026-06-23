export function authFetchOptions(options: RequestInit = {}): RequestInit {
  const legacyToken = window.localStorage.getItem("omnichat.accessToken");
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string> | undefined) ?? {})
  };

  if (legacyToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${legacyToken}`;
  }

  return {
    ...options,
    credentials: "include",
    headers: Object.keys(headers).length > 0 ? headers : options.headers
  };
}

const defaultAuthMeResponse = {
  ok: true,
  json: async () => ({
    success: true,
    data: {
      id: "user-1",
      email: "test@omnichat.local",
      displayName: "Test User",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      role: "AGENT"
    }
  })
};

export function withAuthMeHandler(
  impl: (url: string, init?: RequestInit) => unknown
): jest.Mock {
  return jest.fn((url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/api/v1/auth/me")) {
      return Promise.resolve(defaultAuthMeResponse);
    }
    return impl(url, init);
  });
}

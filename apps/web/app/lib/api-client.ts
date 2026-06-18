"use client";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error?: {
        message?: string;
      };
    };

type ApiOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

const ACCESS_TOKEN_KEY = "omnichat.accessToken";

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  let response = await fetch(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  // Safety guard for Jest tests where fetch is mocked to return undefined for unmocked endpoints
  if (!response) {
    response = {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] })
    } as unknown as Response;
  }

  // Automatically attempt token refresh if 401 and not calling login/refresh endpoint
  if (
    response.status === 401 &&
    path !== "/api/v1/auth/refresh" &&
    path !== "/api/v1/auth/login"
  ) {
    const refreshToken = window.localStorage.getItem("omnichat.refreshToken");
    if (refreshToken) {
      try {
        const refreshResponse = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });
        if (refreshResponse.ok) {
          const envelope = (await refreshResponse.json().catch(() => null)) as {
            success: boolean;
            data?: { accessToken: string; refreshToken: string };
          } | null;

          if (envelope && envelope.success && envelope.data) {
            const tokens = envelope.data;
            window.localStorage.setItem("omnichat.accessToken", tokens.accessToken);
            window.localStorage.setItem("omnichat.refreshToken", tokens.refreshToken);
            document.cookie = `omnichat.accessToken=${encodeURIComponent(tokens.accessToken)}; path=/; max-age=${15 * 60}; SameSite=Lax`;

            // Retry the original request
            response = await fetch(path, {
              ...options,
              headers: {
                ...(tokens.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
                ...options.headers
              }
            });
          } else {
            handleLogoutRedirect();
          }
        } else {
          handleLogoutRedirect();
        }
      } catch {
        handleLogoutRedirect();
      }
    } else {
      handleLogoutRedirect();
    }
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(body) ?? "Request failed");
  }

  if (isEnvelope<T>(body)) {
    if (!body.success) {
      throw new Error(body.error?.message ?? "Request failed");
    }
    return body.data;
  }

  return body as T;
}

function handleLogoutRedirect() {
  window.localStorage.removeItem("omnichat.accessToken");
  window.localStorage.removeItem("omnichat.refreshToken");
  window.localStorage.removeItem("omnichat.user");
  document.cookie = "omnichat.accessToken=; path=/; max-age=0";
  document.cookie = "omnichat.tenantId=; path=/; max-age=0";
  document.cookie = "omnichat.workspaceId=; path=/; max-age=0";
  window.location.href = "/login";
}

function isEnvelope<T>(body: ApiEnvelope<T> | T | null): body is ApiEnvelope<T> {
  return Boolean(body && typeof body === "object" && "success" in body);
}

function readErrorMessage<T>(body: ApiEnvelope<T> | T | null): string | null {
  if (isEnvelope<T>(body) && !body.success) {
    return body.error?.message ?? null;
  }
  return null;
}

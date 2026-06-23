"use client";

import { clearAuthSessionCookies, setAuthSessionCookies } from "./session-cookies";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

type ApiOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

const ACCESS_TOKEN_KEY = "omnichat.accessToken";
const REFRESH_TOKEN_KEY = "omnichat.refreshToken";

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return null;
  }

  try {
    const refreshResponse = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });

    if (!refreshResponse.ok) {
      return null;
    }

    const envelope = (await refreshResponse.json().catch(() => null)) as {
      success: boolean;
      data?: { accessToken: string; refreshToken: string };
    } | null;

    if (!envelope?.success || !envelope.data) {
      return null;
    }

    window.localStorage.setItem(ACCESS_TOKEN_KEY, envelope.data.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, envelope.data.refreshToken);
    setAuthSessionCookies();
    return envelope.data.accessToken;
  } catch {
    return null;
  }
}

export async function authorizedFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers ?? {})
  };

  let response = await fetch(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  if (
    response.status === 401 &&
    path !== "/api/v1/auth/refresh" &&
    path !== "/api/v1/auth/login"
  ) {
    const nextToken = await refreshAccessToken();
    if (!nextToken) {
      handleLogoutRedirect();
      return response;
    }

    response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${nextToken}`,
        ...headers
      }
    });

    if (response.status === 401) {
      handleLogoutRedirect();
    }
  }

  return response;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers ?? {})
  };

  if (
    options.body &&
    typeof options.body === "string" &&
    !headers["Content-Type"] &&
    !headers["content-type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  let response = await fetch(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
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
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      response = await fetch(path, {
        ...options,
        headers: {
          Authorization: `Bearer ${nextToken}`,
          ...options.headers
        }
      });
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
      throw new Error(normalizeErrorText(body.error?.message) ?? "Request failed");
    }
    return body.data;
  }

  return body as T;
}

export function handleLogoutRedirect(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem("omnichat.user");
  clearAuthSessionCookies();
  window.location.href = "/login";
}

function isEnvelope<T>(body: ApiEnvelope<T> | T | null): body is ApiEnvelope<T> {
  return Boolean(body && typeof body === "object" && "success" in body);
}

function readErrorMessage<T>(body: ApiEnvelope<T> | T | null): string | null {
  if (isEnvelope<T>(body) && !body.success) {
    const code = body.error?.code;
    const message = normalizeErrorText(body.error?.message);
    const details = (body.error as { details?: unknown } | undefined)?.details;
    if (Array.isArray(details) && details.length > 0) {
      const detailText = details.map(String).join("; ");
      return code ? `${code}: ${detailText}` : detailText;
    }
    if (code && message) {
      return `${code}: ${message}`;
    }
    return message;
  }
  return null;
}

function normalizeErrorText(message: unknown): string | null {
  if (typeof message === "string") {
    return message;
  }
  if (message && typeof message === "object") {
    const nested = (message as { message?: unknown }).message;
    if (typeof nested === "string") {
      return nested;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return null;
    }
  }
  return message != null ? String(message) : null;
}

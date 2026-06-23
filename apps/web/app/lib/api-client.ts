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

const LEGACY_ACCESS_TOKEN_KEY = "omnichat.accessToken";
const LEGACY_REFRESH_TOKEN_KEY = "omnichat.refreshToken";
const LEGACY_USER_KEY = "omnichat.user";

const FETCH_CREDENTIALS: RequestCredentials = "include";

let refreshInFlight: Promise<boolean> | null = null;

export function clearLegacyAuthStorage(): void {
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_USER_KEY);
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const refreshResponse = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: FETCH_CREDENTIALS
      });

      if (!refreshResponse.ok) {
        return false;
      }

      const envelope = (await refreshResponse.json().catch(() => null)) as {
        success: boolean;
      } | null;

      if (!envelope?.success) {
        return false;
      }

      setAuthSessionCookies();
      clearLegacyAuthStorage();
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function logoutSession(): Promise<void> {
  try {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: FETCH_CREDENTIALS
    });
  } catch {
    // Best-effort server logout.
  }
  handleLogoutRedirect();
}

export async function authorizedFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  let response = await fetch(path, {
    ...options,
    credentials: FETCH_CREDENTIALS,
    headers: {
      ...buildAuthHeaders(),
      ...(options.headers ?? {})
    }
  });

  if (
    response.status === 401 &&
    path !== "/api/v1/auth/refresh" &&
    path !== "/api/v1/auth/login"
  ) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      handleLogoutRedirect();
      return response;
    }

    response = await fetch(path, {
      ...options,
      credentials: FETCH_CREDENTIALS,
      headers: {
        ...buildAuthHeaders(),
        ...(options.headers ?? {})
      }
    });

    if (response.status === 401) {
      handleLogoutRedirect();
    }
  }

  return response;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
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
    credentials: FETCH_CREDENTIALS,
    headers: {
      ...buildAuthHeaders(),
      ...headers
    }
  });

  if (!response) {
    response = {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] })
    } as unknown as Response;
  }

  if (
    response.status === 401 &&
    path !== "/api/v1/auth/refresh" &&
    path !== "/api/v1/auth/login"
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(path, {
        ...options,
        credentials: FETCH_CREDENTIALS,
        headers: {
          ...buildAuthHeaders(),
          ...headers
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
  clearLegacyAuthStorage();
  clearAuthSessionCookies();
  window.location.href = "/login";
}

function buildAuthHeaders(): Record<string, string> {
  const legacyToken = window.localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  if (legacyToken) {
    return { Authorization: `Bearer ${legacyToken}` };
  }
  return {};
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

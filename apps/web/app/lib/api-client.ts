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
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
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

function isEnvelope<T>(body: ApiEnvelope<T> | T | null): body is ApiEnvelope<T> {
  return Boolean(body && typeof body === "object" && "success" in body);
}

function readErrorMessage<T>(body: ApiEnvelope<T> | T | null): string | null {
  if (isEnvelope<T>(body) && !body.success) {
    return body.error?.message ?? null;
  }
  return null;
}

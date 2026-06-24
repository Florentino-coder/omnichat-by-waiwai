import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAMES } from "./auth-cookie-names";
import { readCookieValue } from "./auth-cookies.server";
import { verifyAccessToken } from "./jwt-edge";

export type MiddlewareSession = {
  isSuperOwner: boolean;
  tenantId?: string;
  workspaceId?: string;
};

type CookieReader = {
  get(name: string): string | null;
};

export function readJwtSecret(): string | undefined {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  return process.env.NODE_ENV !== "production" ? "replace-with-local-dev-secret" : undefined;
}

function createCookieReader(cookieHeader: string | undefined): CookieReader {
  return {
    get(name: string) {
      return readCookieValue(cookieHeader, name);
    }
  };
}

function createCookieReaderFromRequest(request: NextRequest): CookieReader {
  return {
    get(name: string) {
      const fromRequest = request.cookies.get(name)?.value;
      if (fromRequest != null && fromRequest !== "") {
        return fromRequest;
      }
      return readCookieValue(request.headers.get("cookie") ?? undefined, name);
    }
  };
}

function readMarkerSession(cookies: CookieReader): MiddlewareSession {
  return {
    isSuperOwner: cookies.get(AUTH_COOKIE_NAMES.superOwner) === "1",
    tenantId: cookies.get(AUTH_COOKIE_NAMES.tenantId) ?? undefined,
    workspaceId: cookies.get(AUTH_COOKIE_NAMES.workspaceId) ?? undefined
  };
}

function hasMarkerFallback(cookies: CookieReader): boolean {
  if (cookies.get(AUTH_COOKIE_NAMES.session) === "1") {
    return true;
  }

  return Boolean(
    cookies.get(AUTH_COOKIE_NAMES.tenantId) && cookies.get(AUTH_COOKIE_NAMES.workspaceId)
  );
}

function mergeTenantContext(
  payload: { tenantId?: string; workspaceId?: string; isSuperOwner?: boolean },
  markers: MiddlewareSession
): MiddlewareSession {
  return {
    isSuperOwner: Boolean(payload.isSuperOwner ?? markers.isSuperOwner),
    tenantId: payload.tenantId ?? markers.tenantId,
    workspaceId: payload.workspaceId ?? markers.workspaceId
  };
}

/**
 * Resolves the session for Edge middleware.
 * Prefer verified JWT claims when JWT_SECRET is available; otherwise fall back to
 * BFF-set session marker cookies so /app routes work when edge JWT verification fails.
 */
export async function resolveMiddlewareSession(
  cookieHeader: string | undefined
): Promise<MiddlewareSession | null> {
  return resolveMiddlewareSessionFromReader(createCookieReader(cookieHeader));
}

export async function resolveMiddlewareSessionFromRequest(
  request: NextRequest
): Promise<MiddlewareSession | null> {
  return resolveMiddlewareSessionFromReader(createCookieReaderFromRequest(request));
}

async function resolveMiddlewareSessionFromReader(
  cookies: CookieReader
): Promise<MiddlewareSession | null> {
  const accessToken = cookies.get(AUTH_COOKIE_NAMES.accessToken);
  const refreshToken = cookies.get(AUTH_COOKIE_NAMES.refreshToken);
  const markers = readMarkerSession(cookies);

  if (!accessToken && !refreshToken) {
    return null;
  }

  // Access token cookie expired but refresh session is still valid — allow
  // navigation while the BFF/client refresh flow renews the access token.
  if (!accessToken && refreshToken && hasMarkerFallback(cookies)) {
    return markers;
  }

  if (!accessToken) {
    return null;
  }

  const jwtSecret = readJwtSecret();

  if (jwtSecret) {
    const payload = await verifyAccessToken(accessToken, jwtSecret);
    if (payload) {
      return mergeTenantContext(payload, markers);
    }
  }

  if (!hasMarkerFallback(cookies)) {
    return null;
  }

  return markers;
}

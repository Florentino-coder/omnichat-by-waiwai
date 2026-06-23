import { AUTH_COOKIE_NAMES } from "./auth-cookie-names";
import { readCookieValue } from "./auth-cookies.server";
import { verifyAccessToken } from "./jwt-edge";

export type MiddlewareSession = {
  isSuperOwner: boolean;
  tenantId?: string;
  workspaceId?: string;
};

export function readJwtSecret(): string | undefined {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  return process.env.NODE_ENV !== "production" ? "replace-with-local-dev-secret" : undefined;
}

/**
 * Resolves the session for Edge middleware.
 * Prefer verified JWT claims when JWT_SECRET is available; otherwise fall back to
 * BFF-set session marker cookies so /app routes work when the web app lacks JWT_SECRET.
 */
export async function resolveMiddlewareSession(
  cookieHeader: string | undefined
): Promise<MiddlewareSession | null> {
  const accessToken = readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.accessToken);
  if (!accessToken) {
    return null;
  }

  const jwtSecret = readJwtSecret();
  if (jwtSecret) {
    const payload = await verifyAccessToken(accessToken, jwtSecret);
    if (payload) {
      return {
        isSuperOwner: Boolean(payload.isSuperOwner),
        tenantId: payload.tenantId,
        workspaceId: payload.workspaceId
      };
    }
  }

  if (readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.session) !== "1") {
    return null;
  }

  return {
    isSuperOwner: readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.superOwner) === "1",
    tenantId: readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.tenantId) ?? undefined,
    workspaceId: readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.workspaceId) ?? undefined
  };
}

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  SESSION_MARKER_MAX_AGE_SECONDS
} from "./auth-cookie-names";

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type SessionUser = {
  isSuperOwner?: boolean;
  tenantId?: string;
  workspaceId?: string;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function httpOnlyCookieOptions(maxAge: number, path = "/") {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path,
    maxAge
  };
}

function markerCookieOptions(maxAge: number) {
  return {
    httpOnly: false,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}

export function setAuthCookiesOnResponse(response: NextResponse, tokens: AuthTokens): void {
  response.cookies.set(
    AUTH_COOKIE_NAMES.accessToken,
    tokens.accessToken,
    httpOnlyCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS)
  );
  response.cookies.set(
    AUTH_COOKIE_NAMES.refreshToken,
    tokens.refreshToken,
    httpOnlyCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS, "/api/v1/auth")
  );
}

export function setSessionMarkerCookiesOnResponse(
  response: NextResponse,
  user: SessionUser
): void {
  response.cookies.set(
    AUTH_COOKIE_NAMES.session,
    "1",
    markerCookieOptions(SESSION_MARKER_MAX_AGE_SECONDS)
  );

  if (user.isSuperOwner) {
    response.cookies.set(
      AUTH_COOKIE_NAMES.superOwner,
      "1",
      markerCookieOptions(SESSION_MARKER_MAX_AGE_SECONDS)
    );
  } else {
    response.cookies.set(AUTH_COOKIE_NAMES.superOwner, "", { ...markerCookieOptions(0), maxAge: 0 });
  }

  if (user.tenantId) {
    response.cookies.set(
      AUTH_COOKIE_NAMES.tenantId,
      encodeURIComponent(user.tenantId),
      markerCookieOptions(SESSION_MARKER_MAX_AGE_SECONDS)
    );
  }

  if (user.workspaceId) {
    response.cookies.set(
      AUTH_COOKIE_NAMES.workspaceId,
      encodeURIComponent(user.workspaceId),
      markerCookieOptions(SESSION_MARKER_MAX_AGE_SECONDS)
    );
  }
}

export function clearAuthCookiesOnResponse(response: NextResponse): void {
  const names = [
    AUTH_COOKIE_NAMES.accessToken,
    AUTH_COOKIE_NAMES.refreshToken,
    AUTH_COOKIE_NAMES.session,
    AUTH_COOKIE_NAMES.superOwner,
    AUTH_COOKIE_NAMES.tenantId,
    AUTH_COOKIE_NAMES.workspaceId
  ];

  for (const name of names) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
    if (name === AUTH_COOKIE_NAMES.refreshToken) {
      response.cookies.set(name, "", { path: "/api/v1/auth", maxAge: 0 });
    }
  }
}

export async function readAccessTokenFromCookies(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(AUTH_COOKIE_NAMES.accessToken)?.value ?? null;
  } catch {
    return null;
  }
}

export async function readRefreshTokenFromCookies(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(AUTH_COOKIE_NAMES.refreshToken)?.value ?? null;
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  const pattern = new RegExp(`(?:^|;\\s*)${name.replace(".", "\\.")}=([^;]*)`);
  const match = cookieHeader.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

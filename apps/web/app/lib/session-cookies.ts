import {
  AUTH_COOKIE_NAMES,
  SESSION_MARKER_MAX_AGE_SECONDS
} from "./auth-cookie-names";

type AuthSessionCookieOptions = {
  isSuperOwner?: boolean;
  tenantId?: string;
  workspaceId?: string;
};

function markerCookieSuffix(maxAge: number): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  return `path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function setAuthSessionCookies(options: AuthSessionCookieOptions = {}): void {
  const suffix = markerCookieSuffix(SESSION_MARKER_MAX_AGE_SECONDS);
  document.cookie = `${AUTH_COOKIE_NAMES.session}=1; ${suffix}`;

  if (options.isSuperOwner === true) {
    document.cookie = `${AUTH_COOKIE_NAMES.superOwner}=1; ${suffix}`;
  } else if (options.isSuperOwner === false) {
    document.cookie = `${AUTH_COOKIE_NAMES.superOwner}=; path=/; max-age=0`;
  }

  if (options.tenantId) {
    document.cookie = `${AUTH_COOKIE_NAMES.tenantId}=${encodeURIComponent(options.tenantId)}; ${suffix}`;
  }

  if (options.workspaceId) {
    document.cookie = `${AUTH_COOKIE_NAMES.workspaceId}=${encodeURIComponent(options.workspaceId)}; ${suffix}`;
  }
}

export function clearAuthSessionCookies(): void {
  const names = [
    AUTH_COOKIE_NAMES.session,
    AUTH_COOKIE_NAMES.superOwner,
    AUTH_COOKIE_NAMES.tenantId,
    AUTH_COOKIE_NAMES.workspaceId
  ];

  for (const name of names) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
}

export function hasAuthSessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) {
    return false;
  }
  return (
    new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAMES.session}=1(?:;|$)`).test(cookieHeader) ||
    new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAMES.accessToken}=`).test(cookieHeader)
  );
}

export function hasSuperOwnerSessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) {
    return false;
  }
  return new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAMES.superOwner}=1(?:;|$)`).test(cookieHeader);
}

export { AUTH_COOKIE_NAMES };

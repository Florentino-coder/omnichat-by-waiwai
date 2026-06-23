import {
  AUTH_COOKIE_NAMES,
  SESSION_MARKER_MAX_AGE_SECONDS
} from "./auth-cookie-names";

type AuthSessionCookieOptions = {
  isSuperOwner?: boolean;
  tenantId?: string;
  workspaceId?: string;
};

export function setAuthSessionCookies(options: AuthSessionCookieOptions = {}): void {
  document.cookie = `${AUTH_COOKIE_NAMES.session}=1; path=/; max-age=${SESSION_MARKER_MAX_AGE_SECONDS}; SameSite=Lax`;

  if (options.isSuperOwner === true) {
    document.cookie = `${AUTH_COOKIE_NAMES.superOwner}=1; path=/; max-age=${SESSION_MARKER_MAX_AGE_SECONDS}; SameSite=Lax`;
  } else if (options.isSuperOwner === false) {
    document.cookie = `${AUTH_COOKIE_NAMES.superOwner}=; path=/; max-age=0`;
  }

  if (options.tenantId) {
    document.cookie = `${AUTH_COOKIE_NAMES.tenantId}=${encodeURIComponent(options.tenantId)}; path=/; max-age=${SESSION_MARKER_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  if (options.workspaceId) {
    document.cookie = `${AUTH_COOKIE_NAMES.workspaceId}=${encodeURIComponent(options.workspaceId)}; path=/; max-age=${SESSION_MARKER_MAX_AGE_SECONDS}; SameSite=Lax`;
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

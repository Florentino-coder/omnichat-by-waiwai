const SESSION_COOKIE = "omnichat.session";
const SUPER_OWNER_COOKIE = "omnichat.isSuperOwner";
const LEGACY_ACCESS_TOKEN_COOKIE = "omnichat.accessToken";
const TENANT_COOKIE = "omnichat.tenantId";
const WORKSPACE_COOKIE = "omnichat.workspaceId";
const SESSION_MAX_AGE_SECONDS = 15 * 60;

type AuthSessionCookieOptions = {
  isSuperOwner?: boolean;
  tenantId?: string;
  workspaceId?: string;
};

export function setAuthSessionCookies(options: AuthSessionCookieOptions = {}): void {
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;

  if (options.isSuperOwner === true) {
    document.cookie = `${SUPER_OWNER_COOKIE}=1; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
  } else if (options.isSuperOwner === false) {
    document.cookie = `${SUPER_OWNER_COOKIE}=; path=/; max-age=0`;
  }

  if (options.tenantId) {
    document.cookie = `${TENANT_COOKIE}=${encodeURIComponent(options.tenantId)}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  if (options.workspaceId) {
    document.cookie = `${WORKSPACE_COOKIE}=${encodeURIComponent(options.workspaceId)}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  // Remove legacy cookie that exposed the bearer token to JavaScript.
  document.cookie = `${LEGACY_ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
}

export function clearAuthSessionCookies(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${SUPER_OWNER_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${LEGACY_ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${TENANT_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${WORKSPACE_COOKIE}=; path=/; max-age=0`;
}

export function hasAuthSessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) {
    return false;
  }
  return (
    /(?:^|;\s*)omnichat\.session=1(?:;|$)/.test(cookieHeader) ||
    /(?:^|;\s*)omnichat\.accessToken=/.test(cookieHeader)
  );
}

export function hasSuperOwnerSessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) {
    return false;
  }
  return /(?:^|;\s*)omnichat\.isSuperOwner=1(?:;|$)/.test(cookieHeader);
}

export const AUTH_COOKIE_NAMES = {
  accessToken: "omnichat.accessToken",
  refreshToken: "omnichat.refreshToken",
  session: "omnichat.session",
  superOwner: "omnichat.isSuperOwner",
  tenantId: "omnichat.tenantId",
  workspaceId: "omnichat.workspaceId"
} as const;

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
/** Non-sensitive UI/middleware markers — keep alive while refresh token is valid. */
export const SESSION_MARKER_MAX_AGE_SECONDS = REFRESH_TOKEN_MAX_AGE_SECONDS;
/** Refresh access tokens before they expire (2 minutes early). */
export const ACCESS_TOKEN_REFRESH_INTERVAL_MS = Math.max(
  60_000,
  (ACCESS_TOKEN_MAX_AGE_SECONDS - 120) * 1000
);

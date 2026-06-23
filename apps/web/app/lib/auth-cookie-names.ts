export const AUTH_COOKIE_NAMES = {
  accessToken: "omnichat.accessToken",
  refreshToken: "omnichat.refreshToken",
  session: "omnichat.session",
  superOwner: "omnichat.isSuperOwner",
  tenantId: "omnichat.tenantId",
  workspaceId: "omnichat.workspaceId",
  /** Legacy cookie — cleared on login; never set for new sessions. */
  legacyAccessToken: "omnichat.accessToken"
} as const;

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_MARKER_MAX_AGE_SECONDS = ACCESS_TOKEN_MAX_AGE_SECONDS;

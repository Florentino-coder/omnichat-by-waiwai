import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  ACCESS_TOKEN_REFRESH_INTERVAL_MS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  SESSION_MARKER_MAX_AGE_SECONDS
} from "../app/lib/auth-cookie-names";

describe("auth cookie max ages", () => {
  it("keeps session markers alive for the refresh token lifetime", () => {
    expect(SESSION_MARKER_MAX_AGE_SECONDS).toBe(REFRESH_TOKEN_MAX_AGE_SECONDS);
  });

  it("refreshes access tokens before they expire", () => {
    expect(ACCESS_TOKEN_REFRESH_INTERVAL_MS).toBeLessThan(ACCESS_TOKEN_MAX_AGE_SECONDS * 1000);
  });
});

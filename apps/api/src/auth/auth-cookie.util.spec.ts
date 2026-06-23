import {
  readAccessTokenFromCookieHeader,
  readRefreshTokenFromCookieHeader
} from "./auth-cookie.util";

describe("auth-cookie.util", () => {
  it("reads access and refresh tokens from cookie headers", () => {
    const cookieHeader =
      "omnichat.accessToken=access-token-value; omnichat.refreshToken=refresh-token-value";

    expect(readAccessTokenFromCookieHeader(cookieHeader)).toBe("access-token-value");
    expect(readRefreshTokenFromCookieHeader(cookieHeader)).toBe("refresh-token-value");
  });

  it("returns undefined when cookies are missing", () => {
    expect(readAccessTokenFromCookieHeader(undefined)).toBeUndefined();
    expect(readRefreshTokenFromCookieHeader(undefined)).toBeUndefined();
  });
});

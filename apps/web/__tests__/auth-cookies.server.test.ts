import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_MAX_AGE_SECONDS
} from "../app/lib/auth-cookie-names";
import { setAuthCookiesOnResponse } from "../app/lib/auth-cookies.server";

type StoredCookie = {
  name: string;
  value: string;
  maxAge?: number;
  path?: string;
};

function createMockResponse(): { response: Parameters<typeof setAuthCookiesOnResponse>[0]; jar: StoredCookie[] } {
  const jar: StoredCookie[] = [];
  const response = {
    cookies: {
      set(name: string, value: string, options?: { maxAge?: number; path?: string }) {
        jar.push({ name, value, maxAge: options?.maxAge, path: options?.path });
      }
    }
  };

  return { response: response as Parameters<typeof setAuthCookiesOnResponse>[0], jar };
}

describe("setAuthCookiesOnResponse", () => {
  it("sets access and refresh tokens without clearing the access token", () => {
    const { response, jar } = createMockResponse();

    setAuthCookiesOnResponse(response, {
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token"
    });

    const accessCookies = jar.filter((cookie) => cookie.name === AUTH_COOKIE_NAMES.accessToken);
    const refreshCookie = jar.find((cookie) => cookie.name === AUTH_COOKIE_NAMES.refreshToken);

    expect(accessCookies).toHaveLength(1);
    expect(accessCookies[0]?.value).toBe("test-access-token");
    expect(accessCookies[0]?.maxAge).toBe(ACCESS_TOKEN_MAX_AGE_SECONDS);
    expect(refreshCookie?.value).toBe("test-refresh-token");
    expect(refreshCookie?.path).toBe("/");
    expect(refreshCookie?.maxAge).toBe(REFRESH_TOKEN_MAX_AGE_SECONDS);
  });
});

import { NextResponse } from "next/server";
import { proxyApiRequest } from "../../../../lib/api-proxy.server";
import {
  clearAuthCookiesOnResponse,
  readRefreshTokenFromCookies,
  readCookieValue,
  setAuthCookiesOnResponse,
  setSessionMarkerCookiesOnResponse
} from "../../../../lib/auth-cookies.server";
import { AUTH_COOKIE_NAMES } from "../../../../lib/auth-cookie-names";

type RefreshEnvelope = {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
  };
};

export async function POST(request: Request): Promise<NextResponse> {
  const refreshToken = await readRefreshTokenFromCookies();
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { message: "Missing refresh token" } },
      { status: 401 }
    );
  }

  const upstream = await proxyApiRequest("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  const payload = (await upstream.json().catch(() => null)) as RefreshEnvelope | null;
  if (!upstream.ok || !payload?.success || !payload.data) {
    const response = NextResponse.json(payload ?? { success: false }, { status: upstream.status });
    if (upstream.status === 401) {
      clearAuthCookiesOnResponse(response);
    }
    return response;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const response = NextResponse.json({ success: true, data: { refreshed: true } });
  setAuthCookiesOnResponse(response, payload.data);
  setSessionMarkerCookiesOnResponse(response, {
    isSuperOwner: readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.superOwner) === "1",
    tenantId: readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.tenantId) ?? undefined,
    workspaceId: readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.workspaceId) ?? undefined
  });

  return response;
}

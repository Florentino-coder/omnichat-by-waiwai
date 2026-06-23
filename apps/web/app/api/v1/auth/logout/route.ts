import { NextResponse } from "next/server";
import { proxyApiRequest } from "../../../../lib/api-proxy.server";
import {
  clearAuthCookiesOnResponse,
  readRefreshTokenFromCookies
} from "../../../../lib/auth-cookies.server";

export async function POST(): Promise<NextResponse> {
  const refreshToken = await readRefreshTokenFromCookies();

  if (refreshToken) {
    await proxyApiRequest("/api/v1/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  clearAuthCookiesOnResponse(response);
  return response;
}

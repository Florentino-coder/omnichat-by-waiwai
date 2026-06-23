import { NextResponse } from "next/server";
import { proxyApiRequest } from "../../../../lib/api-proxy.server";
import { readAccessTokenFromCookies } from "../../../../lib/auth-cookies.server";

export async function GET(): Promise<NextResponse> {
  const accessToken = await readAccessTokenFromCookies();
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const upstream = await proxyApiRequest("/api/v1/auth/me", {
    method: "GET",
    accessToken
  });

  const payload = await upstream.json().catch(() => null);
  return NextResponse.json(payload ?? { success: false }, { status: upstream.status });
}

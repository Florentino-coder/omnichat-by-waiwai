import { NextResponse } from "next/server";
import { proxyApiRequest } from "../../../../lib/api-proxy.server";
import {
  setAuthCookiesOnResponse,
  setSessionMarkerCookiesOnResponse
} from "../../../../lib/auth-cookies.server";

type AuthEnvelope = {
  success: boolean;
  data?: {
    tokens: { accessToken: string; refreshToken: string };
    user: {
      id: string;
      email: string;
      displayName: string;
      tenantId?: string;
      workspaceId?: string;
      role?: string;
      isSuperOwner?: boolean;
    };
  };
  error?: { message?: string };
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.text();
  const upstream = await proxyApiRequest("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });

  const payload = (await upstream.json().catch(() => null)) as AuthEnvelope | null;
  if (!upstream.ok || !payload?.success || !payload.data) {
    return NextResponse.json(payload ?? { success: false }, { status: upstream.status });
  }

  const response = NextResponse.json({
    success: true,
    data: { user: payload.data.user }
  });
  setAuthCookiesOnResponse(response, payload.data.tokens);
  setSessionMarkerCookiesOnResponse(response, payload.data.user);
  return response;
}

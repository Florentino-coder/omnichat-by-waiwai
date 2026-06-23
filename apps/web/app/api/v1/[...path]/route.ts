import { NextRequest, NextResponse } from "next/server";
import { proxyApiRequest } from "../../../lib/api-proxy.server";
import { AUTH_COOKIE_NAMES } from "../../../lib/auth-cookie-names";
import {
  readAccessTokenFromCookies,
  readCookieValue
} from "../../../lib/auth-cookies.server";

/** Handled by dedicated route handlers that set/clear HttpOnly cookies. */
const RESERVED_AUTH_PATHS = new Set([
  "auth/login",
  "auth/logout",
  "auth/refresh",
  "auth/switch-tenant"
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyToApi(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  const pathKey = path.join("/");

  if (RESERVED_AUTH_PATHS.has(pathKey)) {
    return NextResponse.json(
      { success: false, error: { message: "Not found" } },
      { status: 404 }
    );
  }

  const accessToken =
    (await readAccessTokenFromCookies()) ??
    readCookieValue(request.headers.get("cookie") ?? undefined, AUTH_COOKIE_NAMES.accessToken);

  const { search } = new URL(request.url);
  const upstreamPath = `/api/v1/${pathKey}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("Accept", accept);
  }

  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined;

  const upstream = await proxyApiRequest(upstreamPath, {
    method: request.method,
    headers,
    body,
    accessToken
  });

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("Content-Type", upstreamContentType);
  }

  const responseBody = await upstream.arrayBuffer();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders
  });
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyToApi(request, context);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyToApi(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyToApi(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyToApi(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyToApi(request, context);
}

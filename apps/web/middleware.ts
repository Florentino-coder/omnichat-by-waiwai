import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAMES } from "./app/lib/auth-cookie-names";
import { readCookieValue } from "./app/lib/auth-cookies.server";
import { verifyAccessToken } from "./app/lib/jwt-edge";

type MiddlewareSession = {
  isSuperOwner: boolean;
  tenantId?: string;
  workspaceId?: string;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const accessToken = readCookieValue(cookieHeader, AUTH_COOKIE_NAMES.accessToken);
  const jwtSecret =
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV !== "production" ? "replace-with-local-dev-secret" : undefined);

  let session: MiddlewareSession | null = null;
  if (accessToken && jwtSecret) {
    const payload = await verifyAccessToken(accessToken, jwtSecret);
    if (payload) {
      session = {
        isSuperOwner: Boolean(payload.isSuperOwner),
        tenantId: payload.tenantId,
        workspaceId: payload.workspaceId
      };
    }
  }

  if (pathname.startsWith("/super-admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!session.isSuperOwner) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/app/admin/monitor") {
    if (!session.isSuperOwner) {
      return NextResponse.redirect(new URL("/app/inbox", request.url));
    }
    return NextResponse.next();
  }

  if (!session.tenantId || !session.workspaceId) {
    return NextResponse.redirect(new URL("/tenant-select", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/super-admin", "/super-admin/:path*"]
};

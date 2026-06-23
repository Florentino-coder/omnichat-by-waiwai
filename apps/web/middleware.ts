import { NextResponse, type NextRequest } from "next/server";
import {
  hasAuthSessionCookie,
  hasSuperOwnerSessionCookie
} from "./app/lib/session-cookies";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieHeader = request.headers.get("cookie") ?? undefined;
  const hasSession = hasAuthSessionCookie(cookieHeader);

  if (pathname.startsWith("/super-admin")) {
    if (!hasSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!hasSuperOwnerSessionCookie(cookieHeader)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/app/admin/monitor") {
    if (!hasSuperOwnerSessionCookie(cookieHeader)) {
      return NextResponse.redirect(new URL("/app/inbox", request.url));
    }
    return NextResponse.next();
  }

  const hasTenantContext = Boolean(
    request.cookies.get("omnichat.tenantId")?.value &&
      request.cookies.get("omnichat.workspaceId")?.value
  );
  if (!hasTenantContext) {
    return NextResponse.redirect(new URL("/tenant-select", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/super-admin", "/super-admin/:path*"]
};

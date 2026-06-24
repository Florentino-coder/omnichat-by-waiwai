import { NextResponse, type NextRequest } from "next/server";
import { resolveMiddlewareSessionFromRequest } from "./app/lib/middleware-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await resolveMiddlewareSessionFromRequest(request);

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

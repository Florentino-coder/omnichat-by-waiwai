import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const hasAccessToken = Boolean(request.cookies.get("omnichat.accessToken")?.value);
  if (!hasAccessToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Skip tenant-context check for platform-wide admin monitoring dashboard
  if (pathname === "/app/admin/monitor") {
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
  matcher: ["/app/:path*"]
};

import { NextResponse, type NextRequest } from "next/server";

import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import {
  getDashboardPathForRole,
  isAdminDashboardPath,
  isLibrarianDashboardPath,
} from "@/lib/routing";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/me"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.match(/\.(?:png|jpg|jpeg|svg|ico|webp|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const session = await parseSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isAuthenticated = !!session;
  const sessionDashboardPath = session ? getDashboardPathForRole(session.role) : "/login";

  if (pathname.startsWith("/api")) {
    if (!isPublicPath(pathname) && !isAuthenticated) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (pathname.startsWith("/api/admin") && session?.role !== "Admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (!isAuthenticated && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL(sessionDashboardPath, request.url));
  }

  if (isAdminDashboardPath(pathname) && session?.role !== "Admin") {
    return NextResponse.redirect(new URL(sessionDashboardPath, request.url));
  }

  if (isLibrarianDashboardPath(pathname) && (!session || !["Admin", "Librarian"].includes(session.role))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

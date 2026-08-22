import { NextResponse, type NextRequest } from "next/server";

import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth";
import {
  getDashboardPathForRole,
  isAdminDashboardPath,
  isAdminRole,
  isLibrarianDashboardPath,
  isSuperAdminDashboardPath,
  isSuperAdminRole,
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

  // --- API Protection ---
  if (pathname.startsWith("/api")) {
    if (!isPublicPath(pathname) && !isAuthenticated) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Super Admin API Guard: Strict Super Admin check
    if (pathname.startsWith("/api/super-admin")) {
      if (!isSuperAdminRole(session?.role)) {
        return NextResponse.json({ message: "Super Admin privileges required." }, { status: 403 });
      }
      return NextResponse.next();
    }

    // Admin API Guard
    if (pathname.startsWith("/api/admin") && !isAdminRole(session?.role)) {
      const allowedLibrarianApis = [
        "/api/admin/prompt-search",
        "/api/admin/announcements",
        "/api/admin/dashboard",
        "/api/admin/books",
        "/api/admin/history",
        "/api/admin/transactions",
        "/api/admin/profile",
        "/api/admin/records-catalog",
        "/api/admin/reminders",
      ];
      const isAllowed = allowedLibrarianApis.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );
      if (
        isAllowed &&
        ["Librarian", "Technical Librarian", "Circulation Librarian", "TECHNICAL_LIBRARIAN", "CIRCULATION_LIBRARIAN"].includes(
          session?.role ?? "",
        )
      ) {
        return NextResponse.next();
      }
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next();
  }

  // --- Web Page Route Protection ---
  if (!isAuthenticated && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL(sessionDashboardPath, request.url));
  }

  // Super Admin Pages: strictly for SUPER_ADMIN role
  if (isSuperAdminDashboardPath(pathname) && !isSuperAdminRole(session?.role)) {
    return NextResponse.redirect(new URL(sessionDashboardPath, request.url));
  }

  // Admin Pages: for ADMIN & SUPER_ADMIN
  if (isAdminDashboardPath(pathname) && !isAdminRole(session?.role)) {
    return NextResponse.redirect(new URL(sessionDashboardPath, request.url));
  }

  // Librarian Pages
  if (
    isLibrarianDashboardPath(pathname) &&
    (!session ||
      ![
        "Super Admin",
        "SUPER_ADMIN",
        "Admin",
        "ADMIN",
        "Librarian",
        "Technical Librarian",
        "Circulation Librarian",
        "TECHNICAL_LIBRARIAN",
        "CIRCULATION_LIBRARIAN",
      ].includes(session.role))
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

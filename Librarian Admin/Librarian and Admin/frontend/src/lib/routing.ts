import type { Role } from "@/lib/types";

const adminDashboardPaths = ["/admin"];

function matchesPath(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function getDashboardPathForRole(role: Role) {
  if (role === "Admin") {
    return "/admin/dashboard";
  }

  if (role === "Technical Librarian") {
    return "/technical";
  }

  if (role === "Circulation Librarian" || role === "Librarian") {
    return "/circulation";
  }

  return "/login";
}

export function isAdminDashboardPath(pathname: string) {
  return adminDashboardPaths.some((target) => matchesPath(pathname, target));
}

export function isTechnicalDashboardPath(pathname: string) {
  return matchesPath(pathname, "/technical");
}

export function isCirculationDashboardPath(pathname: string) {
  return matchesPath(pathname, "/circulation");
}

export function isLibrarianDashboardPath(pathname: string) {
  return matchesPath(pathname, "/librarian") || matchesPath(pathname, "/circulation") || matchesPath(pathname, "/technical");
}

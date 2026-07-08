import type { Role } from "@/lib/types";

const adminDashboardPaths = ["/admin"];

function matchesPath(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function getDashboardPathForRole(role: Role) {
  if (role === "Admin") {
    return "/admin/dashboard";
  }

  if (role === "Librarian") {
    return "/librarian";
  }

  return "/login";
}

export function isAdminDashboardPath(pathname: string) {
  return adminDashboardPaths.some((target) => matchesPath(pathname, target));
}

export function isLibrarianDashboardPath(pathname: string) {
  return matchesPath(pathname, "/librarian");
}

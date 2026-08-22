import type { Role } from "@/lib/types";

function matchesPath(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function normalizeRoleKey(role?: string | null): string {
  if (!role) return "";
  return role.trim().toUpperCase().replace(/\s+/g, "_");
}

export function isSuperAdminRole(role?: string | null): boolean {
  const normalized = normalizeRoleKey(role);
  return normalized === "SUPER_ADMIN" || normalized === "SUPERADMIN";
}

export function isAdminRole(role?: string | null): boolean {
  const normalized = normalizeRoleKey(role);
  return normalized === "ADMIN" || normalized === "LIBRARY_ADMIN" || isSuperAdminRole(role);
}

export function isStaffRole(role?: string | null): boolean {
  const normalized = normalizeRoleKey(role);
  return (
    isSuperAdminRole(role) ||
    isAdminRole(role) ||
    normalized === "CIRCULATION_LIBRARIAN" ||
    normalized === "LIBRARIAN" ||
    normalized === "TECHNICAL_LIBRARIAN"
  );
}

export function getDashboardPathForRole(role?: Role | string | null): string {
  const normalized = normalizeRoleKey(role);

  if (normalized === "SUPER_ADMIN" || normalized === "SUPERADMIN") {
    return "/super-admin/home";
  }

  if (normalized === "ADMIN" || normalized === "LIBRARY_ADMIN") {
    return "/admin/home";
  }

  if (normalized === "TECHNICAL_LIBRARIAN") {
    return "/technical";
  }

  if (normalized === "CIRCULATION_LIBRARIAN" || normalized === "LIBRARIAN") {
    return "/circulation";
  }

  return "/login";
}

export function isSuperAdminDashboardPath(pathname: string): boolean {
  return matchesPath(pathname, "/super-admin");
}

export function isAdminDashboardPath(pathname: string): boolean {
  return matchesPath(pathname, "/admin");
}

export function isTechnicalDashboardPath(pathname: string): boolean {
  return matchesPath(pathname, "/technical");
}

export function isCirculationDashboardPath(pathname: string): boolean {
  return matchesPath(pathname, "/circulation");
}

export function isLibrarianDashboardPath(pathname: string): boolean {
  return (
    matchesPath(pathname, "/librarian") ||
    matchesPath(pathname, "/circulation") ||
    matchesPath(pathname, "/technical")
  );
}

import {
  BellRing,
  BookCopy,
  BrainCircuit,
  ChartColumnBig,
  ClipboardList,
  Database,
  History,
  Home,
  LibraryBig,
  Megaphone,
  Server,
  Settings,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Users,
  type LucideIcon,
} from "lucide-react";

export type DashboardVariant = "super_admin" | "admin" | "librarian" | "technical" | "circulation";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface DashboardVariantConfig {
  label: string;
  title: string;
  description: string;
  profileLabel: string;
  basePath: string;
  navItems: DashboardNavItem[];
}

export const dashboardVariantConfig: Record<DashboardVariant, DashboardVariantConfig> = {
  super_admin: {
    label: "BOOKHIVE",
    title: "BOOKHIVE SUPER ADMIN",
    description: "GOVERNANCE & INFRASTRUCTURE",
    profileLabel: "Super Admin",
    basePath: "/super-admin",
    navItems: [
      { href: "/super-admin/home", label: "Home", icon: Home },
      { href: "/super-admin/system-management", label: "System Management", icon: Users },
      { href: "/super-admin/audit-logs", label: "Audit & Security Logs", icon: ShieldAlert },
      { href: "/super-admin/records", label: "Records", icon: ClipboardList },
      { href: "/super-admin/settings", label: "Global Settings", icon: Settings2 },
    ],
  },
  admin: {
    label: "BOOKHIVE",
    title: "BOOKHIVE ADMIN",
    description: "SYSTEM OVERSIGHT",
    profileLabel: "Library Admin",
    basePath: "/admin",
    navItems: [
      { href: "/admin/home", label: "Home", icon: Home },
      { href: "/admin/catalog", label: "Catalog View", icon: ClipboardList },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumnBig },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/restrictions", label: "Restrictions", icon: ShieldCheck },
    ],
  },
  technical: {
    label: "BOOKHIVE",
    title: "TECHNICAL LIBRARIAN",
    description: "CATALOGING & CIRCULATION MANAGEMENT",
    profileLabel: "Technical Librarian",
    basePath: "/technical",
    navItems: [
      { href: "/technical", label: "Home", icon: Home },
      { href: "/technical/records", label: "Add & Manage Books", icon: ClipboardList },
      { href: "/circulation/transactions", label: "Transactions", icon: Sparkles },
      { href: "/circulation/reminders", label: "Violations & Reminders", icon: BellRing },
      { href: "/librarian/reports", label: "Reports", icon: ChartColumnBig },
      { href: "/technical/history", label: "History", icon: History },
      { href: "/technical/settings", label: "Settings", icon: Settings },
    ],
  },
  circulation: {
    label: "BOOKHIVE",
    title: "CIRCULATION LIBRARIAN",
    description: "CIRCULATION & CATALOG MANAGEMENT",
    profileLabel: "Circulation Librarian",
    basePath: "/circulation",
    navItems: [
      { href: "/circulation", label: "Home", icon: Home },
      { href: "/circulation/records", label: "Add & Manage Books", icon: ClipboardList },
      { href: "/circulation/transactions", label: "Transactions", icon: Sparkles },
      { href: "/circulation/reminders", label: "Violations & Reminders", icon: BellRing },
      { href: "/librarian/reports", label: "Reports", icon: ChartColumnBig },
      { href: "/circulation/history", label: "History", icon: History },
      { href: "/circulation/settings", label: "Settings", icon: Settings },
    ],
  },
  librarian: {
    label: "BOOKHIVE",
    title: "BOOKHIVE LIBRARIAN",
    description: "CATALOGING & CIRCULATION MANAGEMENT",
    profileLabel: "Librarian",
    basePath: "/librarian",
    navItems: [
      { href: "/librarian", label: "Home", icon: Home },
      { href: "/librarian/records", label: "Add & Manage Books", icon: ClipboardList },
      { href: "/librarian/transactions", label: "Transactions", icon: Sparkles },
      { href: "/librarian/reminders", label: "Violations & Reminders", icon: BellRing },
      { href: "/librarian/reports", label: "Reports", icon: ChartColumnBig },
      { href: "/librarian/history", label: "History", icon: History },
      { href: "/librarian/settings", label: "Settings", icon: Settings },
    ],
  },
};

import {
  BellRing,
  BookCopy,
  BrainCircuit,
  ChartColumnBig,
  ClipboardList,
  History,
  Home,
  LibraryBig,
  Megaphone,
  Settings,
  Settings2,
  ShieldAlert,
  Sparkles,
  UserCircle2,
  Users,
  type LucideIcon,
} from "lucide-react";

export type DashboardVariant = "admin" | "librarian" | "technical" | "circulation";

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
  admin: {
    label: "BOOKHIVE",
    title: "BOOKHIVE ADMIN",
    description: "SYSTEM OVERSIGHT",
    profileLabel: "Library Admin",
    basePath: "/admin",
    navItems: [
      { href: "/admin/dashboard", label: "Dashboard", icon: Home },
      { href: "/admin/management", label: "Management", icon: Users },
      { href: "/admin/transactions", label: "Transactions", icon: Sparkles },
      { href: "/admin/ai-prompt-search", label: "AI Prompt Search", icon: BrainCircuit },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumnBig },
      { href: "/admin/system-monitoring", label: "System Monitoring", icon: ShieldAlert },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/settings", label: "Settings", icon: Settings2 },
    ],
  },
  technical: {
    label: "BOOKHIVE",
    title: "TECHNICAL LIBRARIAN",
    description: "CATALOGING & ACQUISITIONS",
    profileLabel: "Technical Librarian",
    basePath: "/technical",
    navItems: [
      { href: "/technical", label: "Home", icon: Home },
      { href: "/technical/records", label: "Add & Manage Books", icon: ClipboardList },
      { href: "/technical/history", label: "Catalog History", icon: History },
      { href: "/technical/settings", label: "Settings", icon: Settings },
    ],
  },
  circulation: {
    label: "BOOKHIVE",
    title: "CIRCULATION LIBRARIAN",
    description: "CIRCULATION & LOANS CONTROL",
    profileLabel: "Circulation Librarian",
    basePath: "/circulation",
    navItems: [
      { href: "/circulation", label: "Home", icon: Home },
      { href: "/circulation/records", label: "Catalog View", icon: ClipboardList },
      { href: "/circulation/transactions", label: "Transactions", icon: Sparkles },
      { href: "/circulation/reminders", label: "Violations & Reminders", icon: BellRing },
      { href: "/circulation/history", label: "History", icon: History },
      { href: "/circulation/settings", label: "Settings", icon: Settings },
    ],
  },
  librarian: {
    label: "BOOKHIVE",
    title: "CIRCULATION LIBRARIAN",
    description: "CIRCULATION CONTROL",
    profileLabel: "Circulation Librarian",
    basePath: "/librarian",
    navItems: [
      { href: "/librarian", label: "Home", icon: Home },
      { href: "/librarian/records", label: "Catalog View", icon: ClipboardList },
      { href: "/librarian/transactions", label: "Transactions", icon: Sparkles },
      { href: "/librarian/reminders", label: "Violations & Reminders", icon: BellRing },
      { href: "/librarian/history", label: "History", icon: History },
      { href: "/librarian/settings", label: "Settings", icon: Settings },
    ],
  },
};

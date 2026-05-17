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

export type DashboardVariant = "admin" | "librarian";

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
      { href: "/admin/user-management", label: "User Management", icon: Users },
      { href: "/admin/book-management", label: "Book Management & Catalog", icon: BookCopy },
      { href: "/admin/transactions", label: "Transactions", icon: Sparkles },
      { href: "/admin/ai-prompt-search", label: "AI Prompt Search", icon: BrainCircuit },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumnBig },
      { href: "/admin/system-monitoring", label: "System Monitoring", icon: ShieldAlert },
      { href: "/admin/settings", label: "Settings", icon: Settings2 },
    ],
  },
  librarian: {
    label: "BOOKHIVE",
    title: "BOOKHIVE LIBRARIAN",
    description: "CIRCULATION CONTROL",
    profileLabel: "Librarian",
    basePath: "/librarian",
    navItems: [
      { href: "/librarian", label: "Home", icon: Home },
      { href: "/librarian/records", label: "Records", icon: ClipboardList },
      { href: "/librarian/transactions", label: "Transactions", icon: Sparkles },
      { href: "/librarian/reports", label: "Reports", icon: BellRing },
      { href: "/librarian/history", label: "History", icon: History },
      { href: "/librarian/announcements", label: "Announcements", icon: Megaphone },
      { href: "/librarian/settings", label: "Settings", icon: Settings },
    ],
  },
};

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings, Palette } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { dashboardVariantConfig, type DashboardVariant } from "@/lib/dashboard-config";
import { cn } from "@/lib/utils";

export function Sidebar({
  isOpen,
  collapsed,
  onClose,
  onToggleCollapse,
  variant = "admin",
}: {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  variant?: DashboardVariant;
}) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const { theme, toggleTheme } = useTheme();
  const config = dashboardVariantConfig[variant];

  const normalizedPathname =
    pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  function isActiveHref(href: string) {
    const normalizedHref = href !== "/" && href.endsWith("/") ? href.slice(0, -1) : href;
    if (normalizedHref === "/" || normalizedHref === config.basePath) {
      return normalizedPathname === normalizedHref;
    }
    return (
      normalizedPathname === normalizedHref ||
      normalizedPathname.startsWith(`${normalizedHref}/`)
    );
  }

  const activeHref =
    config.navItems
      .map((item) => item.href)
      .filter((href) => isActiveHref(href))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ease-out lg:hidden",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[250px] flex-col border-r border-[var(--line)] px-6 pb-8 pt-8 text-[var(--sidebar-foreground)] shadow-[24px_0_80px_rgba(0,0,0,0.36)] transition-all duration-300 ease-out overflow-y-auto lg:translate-x-0 lg:shadow-[24px_0_64px_rgba(0,0,0,0.18)] bg-[var(--sidebar-bg)]",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-white">
            Admin Console
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400">SYSTEM OVERSIGHT</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {config.navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ease-out",
                  isActive
                    ? "border-l-4 border-[#FFD600] bg-slate-800/40 text-[#FFD600]"
                    : "border-l-4 border-transparent text-slate-300 hover:bg-slate-800/20 hover:text-slate-100",
                )}
                title={label}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="space-y-4 border-t border-slate-700/50 pt-6">
          {/* New Record Button */}
          <button
            type="button"
            className="w-full rounded-lg bg-[#FFD600] px-4 py-3 text-sm font-bold text-slate-900 transition-all duration-200 ease-out hover:bg-yellow-500 hover:-translate-y-0.5 shadow-lg shadow-yellow-600/20"
            title="New Record"
          >
            + NEW RECORD
          </button>

          {/* Appearance Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600/50 bg-slate-800/30 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 ease-out hover:bg-slate-800/50 hover:text-slate-100"
            title="Toggle appearance"
          >
            <Palette className="h-4 w-4" />
            <span>Appearance</span>
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600/50 bg-slate-800/30 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 ease-out hover:bg-slate-800/50 hover:text-slate-100"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

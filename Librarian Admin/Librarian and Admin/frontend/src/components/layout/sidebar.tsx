"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
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
            {config.title}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400">{config.description}</p>
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
        <div className="mt-auto space-y-4 border-t border-white/10 pt-6">
          
          {/* User Profile Card */}
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0F1D29]/50 p-3 shadow-inner transition-all hover:border-white/10 hover:bg-[#0F1D29]/80">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[#152E47] to-[#0F1D29] text-sm font-bold text-[#FCD400] shadow-sm">
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-white">{user?.name || 'Administrator'}</span>
                <span className="truncate text-[10px] uppercase tracking-wider text-slate-400">{user?.role || config.profileLabel}</span>
              </div>
            </div>
            <Link 
              href={`${config.basePath}/profile`}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:scale-110 hover:bg-white/10 hover:text-[#FCD400] active:scale-95" 
              title="Profile Settings"
              onClick={onClose}
            >
              <Settings className="h-4 w-4 transition-transform hover:rotate-45" />
            </Link>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={logout}
            className="group flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-gradient-to-r from-red-500/5 to-transparent px-4 py-3 text-sm font-bold tracking-widest text-slate-400 transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)]"
            title="Logout"
          >
            <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>LOGOUT</span>
          </button>
        </div>
      </aside>
    </>
  );
}

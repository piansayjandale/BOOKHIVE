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

  const isLibrarianRole =
    variant === "librarian" ||
    variant === "technical" ||
    variant === "circulation" ||
    ["Librarian", "Technical Librarian", "Circulation Librarian", "TECHNICAL_LIBRARIAN", "CIRCULATION_LIBRARIAN"].includes(
      user?.role ?? ""
    );

  function isItemPermitted(href: string) {
    if (!isLibrarianRole) return true;
    if (!user?.permissions) return true;

    if (href.includes("/records") && user.permissions.records === false) return false;
    if (href.includes("/transactions") && user.permissions.transactions === false) return false;
    if (href.includes("/reminders") && user.permissions.reminders === false) return false;
    if (href.includes("/reports") && user.permissions.reports === false) return false;
    if (href.includes("/history") && user.permissions.history === false) return false;
    if ((href.includes("/settings") || href.includes("/profile")) && user.permissions.settings === false) return false;

    return true;
  }

  const visibleNavItems = config.navItems.filter((item) => isItemPermitted(item.href));

  const activeHref =
    visibleNavItems
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
          {visibleNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ease-out",
                  isActive
                    ? "border-l-4 border-[#FFD600] bg-white/20 text-white shadow-xs"
                    : "border-l-4 border-transparent text-white/90 hover:bg-white/20 hover:text-white",
                )}
                title={label}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0 transition-colors bg-transparent", isActive ? "text-white" : "text-white/85 group-hover:text-white")} />
                <span className={cn("truncate transition-colors bg-transparent", isActive ? "text-white font-bold" : "text-white/90 group-hover:text-white font-semibold")}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto space-y-4 border-t border-white/10 pt-6">
          
          {/* User Profile Card */}
          <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur shadow-sm transition-all hover:border-white/25 hover:bg-white/15">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="sidebar-profile-avatar flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFF300] text-base font-black text-[#0274BB] shadow-sm">
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-white">{user?.name || 'Administrator'}</span>
                <span className="truncate text-[10px] uppercase font-bold tracking-wider text-sky-200">{user?.role || config.profileLabel}</span>
              </div>
            </div>
            {isItemPermitted(`${config.basePath}/settings`) && (
              <Link 
                href={`${config.basePath}/profile`}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/75 transition-all hover:scale-110 hover:bg-white/15 hover:text-[#FFF300] active:scale-95" 
                title="Profile Settings"
                onClick={onClose}
              >
                <Settings className="h-4 w-4 transition-transform hover:rotate-45" />
              </Link>
            )}
          </div>

          {/* Logout Button */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={logout}
            className="btn-logout group flex w-full items-center justify-center gap-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 px-4 py-3 text-sm font-bold tracking-widest text-white shadow-lg shadow-red-950/25 border border-red-500/50 transition-all duration-200 cursor-pointer"
            style={{ color: "#ffffff", backgroundColor: "#dc2626" }}
            title="Logout"
          >
            <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" style={{ color: "#ffffff" }} />
            <span className="font-extrabold tracking-widest" style={{ color: "#ffffff" }}>LOGOUT</span>
          </button>
        </div>
      </aside>
    </>
  );
}

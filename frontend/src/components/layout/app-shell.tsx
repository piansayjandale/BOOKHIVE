"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { DashboardVariant } from "@/lib/dashboard-config";

export function AppShell({
  children,
  variant = "admin",
}: {
  children: React.ReactNode;
  variant?: DashboardVariant;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--background)] text-[var(--card-foreground)] transition-colors duration-300 ease-out">
      <Sidebar
        isOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        variant={variant}
      />
      <button
        type="button"
        suppressHydrationWarning
        className="fixed left-4 top-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--topbar-bg)] text-[var(--card-foreground)] shadow-lg transition-all duration-300 ease-out hover:shadow-xl lg:hidden"
        onClick={() => setSidebarOpen((current) => !current)}
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>
      <main className="flex-1 h-screen overflow-y-auto lg:pl-0 transition-all duration-300 ease-out relative">
        <div className="lg:ml-[250px] min-h-full bg-[var(--content-bg)] px-4 pb-8 pt-6 sm:px-5 lg:px-8 lg:pt-8 transition-all duration-300 ease-out">
          <Topbar variant={variant} />
          <div className="mx-auto max-w-[1400px] mt-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

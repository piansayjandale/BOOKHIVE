"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { DashboardVariant } from "@/lib/dashboard-config";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  variant = "admin",
}: {
  children: React.ReactNode;
  variant?: DashboardVariant;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const isReportsPage = pathname?.includes("/reports");

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--background)] text-[var(--card-foreground)] transition-colors duration-300 ease-out">
      <Sidebar
        isOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        variant={variant}
      />

      <main
        className={cn(
          "flex-1 h-screen lg:pl-0 transition-all duration-300 ease-out relative",
          isReportsPage ? "overflow-hidden flex flex-col" : "overflow-y-auto"
        )}
      >
        <div
          className={cn(
            "lg:ml-[250px] bg-[var(--content-bg)] px-4 sm:px-5 lg:px-8 transition-all duration-300 ease-out",
            isReportsPage
              ? "h-full flex flex-col pt-5 pb-2 overflow-hidden"
              : "min-h-full pb-8 pt-6 sm:px-5 lg:px-8 lg:pt-8"
          )}
        >
          <Topbar variant={variant} />
          <div
            className={cn(
              "mx-auto max-w-[1400px] w-full",
              isReportsPage ? "mt-4 flex-1 h-full min-h-0 overflow-hidden flex flex-col" : "mt-6"
            )}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

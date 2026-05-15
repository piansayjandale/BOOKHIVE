"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, Search } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { dashboardVariantConfig, type DashboardVariant } from "@/lib/dashboard-config";

export function Topbar({
  variant = "admin",
}: {
  variant?: DashboardVariant;
}) {
  const { user } = useSession();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsCount = 2;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const config = dashboardVariantConfig[variant];

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined;
    }

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationsOpen]);

  return (
    <header style={{
      backgroundColor: '#FFFFFF',
      borderColor: '#e2e8f0',
      color: '#1e293b'
    }} className="sticky top-0 z-20 mb-8 flex items-center justify-between gap-4 rounded-[12px] border px-6 py-4 shadow-sm transition-colors duration-300 ease-out">
      <div className="pl-0 flex-1">
        <p style={{ color: '#64748b' }} className="text-xs font-semibold uppercase tracking-[0.32em]">
          {config.label}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <svg className="h-5 w-5" style={{ color: '#3b82f6' }} fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
          </svg>
          <h2 style={{ color: '#0f172a' }} className="text-2xl font-bold tracking-[0.12em]">
            {config.title}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div ref={panelRef} className="relative">
          <button
            type="button"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: '#1e293b'
            }}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] border transition-all duration-300 ease-out hover:bg-slate-100"
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((current) => !current)}
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationsCount > 0 ? (
              <span style={{ backgroundColor: '#3b82f6', color: '#ffffff' }} className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold">
                {notificationsCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#e2e8f0',
              boxShadow: '0 10px 25px rgba(15, 23, 42, 0.1)'
            }} className="absolute right-0 z-30 mt-3 w-80 rounded-[28px] border p-4">
              <div className="mb-4 flex items-center justify-between">
                <p style={{ color: '#1e293b' }} className="text-sm font-semibold">Notifications</p>
                <button
                  type="button"
                  style={{ color: '#64748b' }}
                  className="text-xs font-semibold uppercase tracking-[0.18em] transition hover:text-slate-900"
                  onClick={() => setNotificationsOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                <div style={{ backgroundColor: '#f1f5f9' }} className="rounded-3xl p-3">
                  <p style={{ color: '#1e293b' }} className="text-sm font-semibold">New borrow request</p>
                  <p style={{ color: '#64748b' }} className="mt-1 text-xs leading-5">
                    John Doe requested to borrow "The Great Gatsby"
                  </p>
                </div>
                <div style={{ backgroundColor: '#f1f5f9' }} className="rounded-3xl p-3">
                  <p style={{ color: '#1e293b' }} className="text-sm font-semibold">Book returned</p>
                  <p style={{ color: '#64748b' }} className="mt-1 text-xs leading-5">
                    Sarah returned "To Kill a Mockingbird"
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Bell, AlertTriangle, Search, Sun, Moon, X, ArrowLeft } from "lucide-react";
import { createPortal } from "react-dom";

import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { dashboardVariantConfig, type DashboardVariant } from "@/lib/dashboard-config";

export function Topbar({
  variant = "admin",
}: {
  variant?: DashboardVariant;
}) {
  const { user } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const config = dashboardVariantConfig[variant];

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions");
      if (!res.ok) return;
      const data = await res.json();
      if (data.transactions) {
        const txns = data.transactions as any[];
        // Map transactions to notification items:
        // - Pending borrows/reservations
        // - Recently returned items
        const items = txns
          .filter((t) => t.status === "Pending" || t.status === "Returned")
          .map((t) => {
            const isPending = t.status === "Pending";
            const isBorrow = t.type === "Borrow";
            return {
              id: t.id,
              title: isPending
                ? isBorrow
                  ? "New borrow request"
                  : "New reservation request"
                : "Book returned",
              description: isPending
                ? `${t.studentName} requested to borrow "${t.resourceTitle}"`
                : `${t.studentName} returned "${t.resourceTitle}"`,
              timestamp: t.requestedAt || new Date().toISOString(),
              unread: isPending,
              // Raw transaction fields for the details popup
              studentName: t.studentName,
              studentId: t.studentId,
              resourceTitle: t.resourceTitle,
              isbn: t.isbn,
              status: t.status,
              type: t.type,
              requestedAt: t.requestedAt,
              dueDate: t.dueDate,
            };
          });

        // Sort by timestamp descending
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(items.slice(0, 15));
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 10000);

    // Subscribe to SSE stream for live notification triggers
    let eventSource: EventSource | undefined;
    try {
      eventSource = new EventSource("/api/activity/stream");
      eventSource.onmessage = () => {
        void fetchNotifications();
      };
    } catch (err) {
      console.error("SSE stream connection error:", err);
    }

    return () => {
      clearInterval(intervalId);
      eventSource?.close();
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const unread = notifications.some((n) => n.unread);
    if (unread) {
      setHasUnread(true);
    }
  }, [notifications]);

  useEffect(() => {
    if (notificationsOpen) {
      setHasUnread(false);
    }
  }, [notificationsOpen]);

  const notificationsCount = useMemo(() => {
    return hasUnread ? notifications.filter((n) => n.unread).length : 0;
  }, [notifications, hasUnread]);

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

  // Modal JSX constructed for portal rendering
  const detailModalContent = selectedNotification ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={() => setSelectedNotification(null)}
      />
      {/* Container */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--topbar-foreground)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[var(--accent)] uppercase">
              Notification Details
            </p>
            <h3 className="mt-1 text-lg font-black text-[var(--topbar-title-color)]">
              {selectedNotification.title}
            </h3>
          </div>
          <button
            suppressHydrationWarning
            onClick={() => setSelectedNotification(null)}
            className="rounded-lg p-1.5 text-[var(--topbar-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--topbar-foreground)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Details */}
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-4">
            <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
              Resource Title
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--topbar-title-color)]">
              {selectedNotification.resourceTitle}
            </p>
            {selectedNotification.isbn && (
              <p className="mt-1 text-[11px] font-mono text-[var(--topbar-muted)]">
                ISBN: {selectedNotification.isbn}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-3">
              <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
                Requester
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--topbar-title-color)]">
                {selectedNotification.studentName}
              </p>
              {selectedNotification.studentId && (
                <p className="mt-0.5 text-[10px] text-[var(--topbar-muted)]">
                  ID: {selectedNotification.studentId}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-3">
              <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
                Status
              </p>
              <span
                className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                  selectedNotification.status === "Pending"
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : selectedNotification.status === "Returned"
                    ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {selectedNotification.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-3">
              <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
                Request Date
              </p>
              <p className="mt-1 text-xs text-[var(--topbar-title-color)]">
                {new Date(selectedNotification.timestamp).toLocaleDateString()}
              </p>
              <p className="text-[10px] text-[var(--topbar-muted)]">
                {new Date(selectedNotification.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-3">
              <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
                Activity Type
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--topbar-title-color)]">
                {selectedNotification.type}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex justify-between gap-3">
          <button
            suppressHydrationWarning
            onClick={() => {
              setSelectedNotification(null);
              setNotificationsOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--background-muted)] px-5 py-2 text-xs font-bold text-[var(--topbar-title-color)] hover:bg-[var(--surface-hover)] active:scale-95 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <button
            suppressHydrationWarning
            onClick={() => setSelectedNotification(null)}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-bold text-[#0b1c2c] shadow-lg shadow-[var(--accent)]/10 hover:brightness-110 active:scale-95 transition"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <header className="sticky top-0 z-20 mb-8 flex items-center justify-between gap-4 rounded-[12px] border border-[var(--line)] bg-[var(--topbar-bg)] px-6 py-4 text-[var(--topbar-foreground)] shadow-sm transition-colors duration-300 ease-out backdrop-blur-md">
      <div className="pl-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--topbar-muted)]">
          {config.label}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <svg className="h-5 w-5 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
          </svg>
          <h2 className="text-2xl font-bold tracking-[0.12em] text-[var(--topbar-title-color)]">
            {config.title}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          suppressHydrationWarning
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--line)] bg-transparent text-[var(--topbar-foreground)] transition-all duration-300 ease-out hover:bg-[var(--surface-hover)]"
          aria-label="Toggle appearance"
          onClick={toggleTheme}
          title="Toggle appearance"
        >
          {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div ref={panelRef} className="relative">
          <button
            type="button"
            suppressHydrationWarning
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--line)] bg-transparent text-[var(--topbar-foreground)] transition-all duration-300 ease-out hover:bg-[var(--surface-hover)]"
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((current) => !current)}
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {notificationsCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-semibold text-[var(--background)]">
                {notificationsCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div className="absolute right-0 z-30 mt-3 w-80 rounded-[24px] border border-[var(--line)] bg-[var(--card-bg)] p-4 shadow-2xl backdrop-blur-md transition-all duration-300">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--topbar-title-color)]">Notifications</p>
                <button
                  type="button"
                  suppressHydrationWarning
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--topbar-muted)] transition hover:text-[var(--topbar-title-color)]"
                  onClick={() => setNotificationsOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedNotification(item);
                      setNotificationsOpen(false);
                    }}
                    className="w-full text-left rounded-2xl border border-[var(--line)] bg-[var(--background-muted)] p-3 transition hover:bg-[var(--surface-hover)]"
                  >
                    <p className="text-sm font-semibold text-[var(--topbar-title-color)] flex items-center justify-between">
                      <span>{item.title}</span>
                      {item.unread && (
                        <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--topbar-muted)]">
                      {item.description}
                    </p>
                  </button>
                ))}
                {notifications.length === 0 && (
                  <div className="py-8 text-center text-xs text-[var(--topbar-muted)]">
                    <Bell className="mx-auto mb-2 h-6 w-6 opacity-30" />
                    No new notifications
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Render detailed modal inside a Portal to body to secure screen centering and backdrop blur */}
      {mounted && typeof document !== "undefined" && selectedNotification
        ? createPortal(detailModalContent, document.body)
        : null}
    </header>
  );
}

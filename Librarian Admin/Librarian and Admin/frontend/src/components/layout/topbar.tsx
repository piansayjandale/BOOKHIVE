"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Bell, AlertTriangle, Search, Sun, Moon, X, ArrowLeft, ExternalLink, CheckCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";

import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { dashboardVariantConfig, type DashboardVariant } from "@/lib/dashboard-config";
import dashboardSocket from "@/lib/socket";
import { subscribeToActivity } from "@/lib/live";

export function Topbar({
  variant = "admin",
}: {
  variant?: DashboardVariant;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [declineComment, setDeclineComment] = useState("");
  const [isDecliningWithComment, setIsDecliningWithComment] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const config = dashboardVariantConfig[variant];

  const [clearedAt, setClearedAt] = useState<number>(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bookhive_notifications_cleared_at");
      if (saved) {
        setClearedAt(parseInt(saved, 10));
      }
      try {
        const savedRead = localStorage.getItem("bookhive_librarian_read_notifications");
        if (savedRead) {
          setReadIds(new Set(JSON.parse(savedRead)));
        }
      } catch (e) {
        console.warn("Failed to load read notifications from storage:", e);
      }
    }
  }, []);

  const handleClearAll = () => {
    const now = Date.now();
    setClearedAt(now);
    if (typeof window !== "undefined") {
      localStorage.setItem("bookhive_notifications_cleared_at", now.toString());
    }
    setNotifications([]);
  };

  const handleNotificationItemClick = (item: any) => {
    const rawId = item.id.replace("due-today-", "");
    
    // 1. Mark clicked notification as read in active client store & persist
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      next.add(rawId);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("bookhive_librarian_read_notifications", JSON.stringify(Array.from(next)));
        } catch (e) {
          console.warn("Failed to persist read notifications:", e);
        }
      }
      return next;
    });

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id || n.id === rawId || n.id === `due-today-${rawId}`
          ? { ...n, unread: false, is_read: true }
          : n
      )
    );

    // 2. Open detail/approval modal
    setSelectedNotification({ ...item, unread: false, is_read: true });
    setNotificationsOpen(false);

    // 3. Dispatch client-side custom event for row focus & deep-linking
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("highlight-transaction", { detail: { id: rawId } })
      );
    }

    // 4. Check if active route is /transactions; if not, trigger client-side navigation
    const targetPath = `${config.basePath}/transactions`;
    if (pathname !== targetPath && !pathname.endsWith("/transactions")) {
      router.push(`${targetPath}?highlight=${rawId}`);
    }
  };

  const handleCloseModal = () => {
    setSelectedNotification(null);
    setIsDecliningWithComment(false);
    setDeclineComment("");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions?status=All");
      if (!res.ok) {
        throw new Error(`Transactions fetch failed with HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.transactions) {
        const txns = data.transactions as any[];
        
        const isToday = (dateStr?: string) => {
          if (!dateStr) return false;
          const d = new Date(dateStr);
          const today = new Date();
          return (
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear()
          );
        };

        // Saved read IDs from storage
        let storedReadIds: Set<string> = new Set();
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("bookhive_librarian_read_notifications");
            if (raw) storedReadIds = new Set(JSON.parse(raw));
          } catch (e) {}
        }

        // Map transactions to notification items:
        // - Pending borrows/reservations
        // - Cancelled reservations
        // - Recently returned items
        // - Borrowed items due today
        const items = txns
          .filter(
            (t) =>
              t.status === "Pending" ||
              t.status === "Cancelled" ||
              t.status === "Returned" ||
              (t.status === "Approved" && t.type === "Borrow" && isToday(t.dueDate))
          )
          .map((t) => {
            const isPending = t.status === "Pending";
            const isCancelled = t.status === "Cancelled";
            const isReturned = t.status === "Returned";
            const isDueToday = t.status === "Approved" && t.type === "Borrow" && isToday(t.dueDate);
            const itemId = isDueToday ? `due-today-${t.id}` : t.id;
            
            let title = "NOTIFICATION";
            let description = "";
            let unread = false;

            if (isPending) {
              const isBorrow = t.type === "Borrow" || t.type === "Borrowing";
              title = isBorrow ? "NEW BORROW REQUEST" : "NEW RESERVATION REQUEST";
              description = isBorrow
                ? `${t.studentName} requested to borrow "${t.resourceTitle}"`
                : `${t.studentName} requested to reserve "${t.resourceTitle}"`;
              unread = !storedReadIds.has(itemId) && !storedReadIds.has(t.id);
            } else if (isCancelled) {
              title = "RESERVATION CANCELLED";
              description = `Student ${t.studentName} cancelled reservation for "${t.resourceTitle}"`;
              unread = !storedReadIds.has(itemId) && !storedReadIds.has(t.id);
            } else if (isReturned) {
              title = "BOOK RETURNED";
              description = `${t.studentName} returned "${t.resourceTitle}"`;
              unread = false;
            } else if (isDueToday) {
              title = "BOOK DUE TODAY";
              description = `"${t.resourceTitle}" borrowed by ${t.studentName} is due today.`;
              unread = !storedReadIds.has(itemId) && !storedReadIds.has(t.id);
            }

            const is_read = storedReadIds.has(itemId) || storedReadIds.has(t.id) || !unread;

            return {
              id: itemId,
              title,
              description,
              timestamp: isDueToday ? t.dueDate : (t.requestedAt || new Date().toISOString()),
              unread,
              is_read,
              // Raw transaction fields for the details popup
              studentName: t.studentName,
              studentId: t.studentId,
              resourceTitle: t.resourceTitle,
              isbn: t.isbn,
              status: t.status,
              type: t.type,
              requestedAt: t.requestedAt,
              dueDate: t.dueDate,
              studentIdImage: t.studentIdImage,
            };
          });

        // Sort by timestamp descending
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Filter out items older than clearedAt timestamp
        const clearedTime = typeof window !== "undefined"
          ? parseInt(localStorage.getItem("bookhive_notifications_cleared_at") || "0", 10)
          : 0;

        const visibleItems = clearedTime > 0
          ? items.filter((item) => new Date(item.timestamp).getTime() > clearedTime)
          : items;

        setNotifications(visibleItems.slice(0, 15));
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Failed to fetch notifications:", err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  // Real-time notification handler (instantly prepends incoming socket payloads)
  const handleRealtimeNotification = useCallback((data: any) => {
    if (!data) return;

    // Check if cleared
    const clearedTime = typeof window !== "undefined"
      ? parseInt(localStorage.getItem("bookhive_notifications_cleared_at") || "0", 10)
      : 0;
    const nowTime = Date.now();
    if (clearedTime > 0 && nowTime <= clearedTime) return;

    const rawId = data.id || `notif-${Date.now()}`;
    const isCancel = data.isCancelled || data.eventName === "reservation:cancelled" || data.status === "Cancelled";
    const isBorrow = !isCancel && (data.type === "Borrow" || data.type === "Borrowing" || data.action !== "Reservation");

    let title = "NEW BORROW REQUEST";
    let description = `${data.studentName || "Student"} requested to borrow "${data.resourceTitle || data.title || "Book"}"`;

    if (isCancel) {
      title = "RESERVATION CANCELLED";
      description = `Student ${data.studentName || "Student"} cancelled reservation for "${data.resourceTitle || data.title || "Book"}"`;
    } else if (!isBorrow) {
      title = "NEW RESERVATION REQUEST";
      description = `${data.studentName || "Student"} requested to reserve "${data.resourceTitle || data.title || "Book"}"`;
    }

    // Check if previously read
    let isRead = false;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("bookhive_librarian_read_notifications");
        if (raw) {
          const set = new Set(JSON.parse(raw));
          isRead = set.has(rawId);
        }
      } catch (e) {}
    }

    const newItem = {
      id: rawId,
      title,
      description,
      timestamp: data.requestedAt || new Date().toISOString(),
      unread: !isRead,
      is_read: isRead,
      studentName: data.studentName,
      studentId: data.studentId,
      resourceTitle: data.resourceTitle || data.title,
      isbn: data.isbn,
      status: isCancel ? "Cancelled" : (data.status || "Pending"),
      type: data.type || (isBorrow ? "Borrow" : "Reservation"),
      requestedAt: data.requestedAt || new Date().toISOString(),
      dueDate: data.dueDate,
      studentIdImage: data.studentIdImage,
    };

    setNotifications((prev) => {
      // Remove any existing copy with the same ID and prepend the newest at the top
      const filtered = prev.filter((item) => item.id !== rawId && item.id !== `due-today-${rawId}`);
      return [newItem, ...filtered].slice(0, 15);
    });

    // Schedule background synchronization to keep server and cache consistent
    setTimeout(() => {
      void fetchNotifications();
    }, 1200);
  }, [fetchNotifications]);

  useEffect(() => {
    // Initial fetch
    void fetchNotifications();

    // Resilient Polling with Exponential Backoff & Page Visibility API
    let timeoutId: any = null;
    let currentInterval = 6000;
    const baseInterval = 6000;
    const maxInterval = 30000;
    let isRunning = true;

    const poll = async () => {
      if (!isRunning) return;
      if (typeof document !== "undefined" && document.hidden) {
        // Tab is inactive, postpone polling until visible
        return;
      }

      const success = await fetchNotifications();
      if (success) {
        currentInterval = baseInterval;
      } else {
        currentInterval = Math.min(currentInterval * 1.5, maxInterval);
      }

      if (isRunning && (!document.hidden || typeof document === "undefined")) {
        timeoutId = setTimeout(poll, currentInterval);
      }
    };

    timeoutId = setTimeout(poll, currentInterval);

    // Page Visibility listener to pause/resume polling cleanly
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timeoutId) clearTimeout(timeoutId);
      } else {
        // Immediate sync when librarian returns to the tab
        currentInterval = baseInterval;
        void fetchNotifications();
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(poll, currentInterval);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // Real-time socket listeners
    const unsubscribeSocket = dashboardSocket.subscribeToBorrowRequest((data) => {
      handleRealtimeNotification(data);
    });

    const unsubscribeCancelSocket = dashboardSocket.subscribeToCancelRequest((data) => {
      handleRealtimeNotification(data);
    });

    const unsubscribeNotificationSocket = dashboardSocket.subscribeToNotification((data) => {
      handleRealtimeNotification(data);
    });

    // Real-time activity listener
    const unsubscribeActivity = subscribeToActivity(() => {
      void fetchNotifications();
    });

    // Subscribe to SSE stream for live notification triggers
    let eventSource: EventSource | undefined;
    try {
      eventSource = new EventSource("/api/activity/stream");
      eventSource.onmessage = () => {
        void fetchNotifications();
      };
    } catch (err) {
      console.warn("SSE stream connection error:", err instanceof Error ? err.message : String(err));
    }

    return () => {
      isRunning = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      unsubscribeSocket();
      unsubscribeCancelSocket();
      unsubscribeNotificationSocket();
      unsubscribeActivity();
      eventSource?.close();
    };
  }, [fetchNotifications, handleRealtimeNotification]);

  // Derive unread count strictly from items where unread is true and not yet read
  const notificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read && n.unread).length;
  }, [notifications]);

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

  const handleDecide = async (id: string, nextStatus: "Approved" | "Declined", comment?: string) => {
    setIsDeciding(true);
    // Optimistically remove item from local notifications state
    setNotifications((prev) =>
      prev.filter((n) => n.id !== id && n.id !== `due-today-${id}`)
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("transaction-updated", { detail: { id, status: nextStatus } })
      );
    }
    handleCloseModal();

    try {
      const rawId = id.replace("due-today-", "");
      const res = await fetch(`/api/transactions/${rawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, comment: comment || null }),
      });
      if (!res.ok) {
        console.error("Failed to update transaction status:", await res.text());
      }
    } catch (err) {
      console.error("Error updating transaction status:", err instanceof Error ? err.message : String(err));
    } finally {
      await fetchNotifications();
      setIsDeciding(false);
    }
  };

  // Modal JSX constructed for portal rendering
  const detailModalContent = selectedNotification ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleCloseModal}
      />
      {/* Container */}
      <div className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--topbar-foreground)]">
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
            onClick={handleCloseModal}
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

          {selectedNotification.studentIdImage && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-4">
              <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase mb-2">
                Uploaded ID Picture / Attachment
              </p>
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-[var(--line)] bg-black/20">
                <img
                  src={selectedNotification.studentIdImage}
                  alt="Student ID Preview"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          )}

          {isDecliningWithComment && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
              <label className="text-[10px] font-bold tracking-wider text-red-400 uppercase">
                Decline Reason / Comment
              </label>
              <textarea
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                placeholder="Enter comment for the student explaining why the request is declined..."
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--background-muted)] p-2.5 text-xs text-[var(--topbar-foreground)] focus:border-red-500 focus:outline-none min-h-[70px] resize-none placeholder:text-slate-500"
                required
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex justify-between gap-3">
          <button
            suppressHydrationWarning
            disabled={isDeciding}
            onClick={handleCloseModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--background-muted)] px-5 py-2 text-xs font-bold text-[var(--topbar-title-color)] hover:bg-[var(--surface-hover)] active:scale-95 transition disabled:opacity-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          {selectedNotification.status === "Pending" ? (
            isDecliningWithComment ? (
              <div className="flex gap-2">
                <button
                  suppressHydrationWarning
                  disabled={isDeciding}
                  onClick={() => {
                    setIsDecliningWithComment(false);
                    setDeclineComment("");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--background-muted)] px-4 py-2 text-xs font-bold text-[var(--topbar-title-color)] hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  suppressHydrationWarning
                  disabled={isDeciding || !declineComment.trim()}
                  onClick={() => handleDecide(selectedNotification.id, "Declined", declineComment)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/30 transition disabled:opacity-50"
                >
                  Confirm Decline
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  suppressHydrationWarning
                  disabled={isDeciding}
                  onClick={() => setIsDecliningWithComment(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 hover:border-red-500/50 active:scale-95 transition disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  suppressHydrationWarning
                  disabled={isDeciding}
                  onClick={() => handleDecide(selectedNotification.id, "Approved")}
                  className="rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-bold text-[#0b1c2c] shadow-lg shadow-[var(--accent)]/10 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            )
          ) : (
            <button
              suppressHydrationWarning
              disabled={isDeciding}
              onClick={handleCloseModal}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-bold text-[#0b1c2c] shadow-lg shadow-[var(--accent)]/10 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              Close Details
            </button>
          )}
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

        {variant !== "technical" && user?.role !== "Technical Librarian" && (
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
              <div className="absolute right-0 z-30 mt-3 w-88 rounded-[24px] border border-[var(--line)] bg-[var(--card-bg)] p-4 shadow-2xl backdrop-blur-md transition-all duration-300">
                {/* Header with Clear All and Close */}
                <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <p className="text-sm font-bold text-[var(--topbar-title-color)]">Notifications</p>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <>
                        <button
                          type="button"
                          suppressHydrationWarning
                          className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)] hover:underline transition"
                          onClick={handleClearAll}
                          title="Clear all notifications"
                        >
                          Clear All
                        </button>
                        <span className="text-xs text-[var(--topbar-muted)]">|</span>
                      </>
                    )}
                    <button
                      type="button"
                      suppressHydrationWarning
                      className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--topbar-muted)] transition hover:text-[var(--topbar-title-color)]"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      CLOSE
                    </button>
                  </div>
                </div>

                {/* Notifications Cards Container */}
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {notifications.map((item) => {
                    const isRead = item.is_read || !item.unread;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNotificationItemClick(item)}
                        className={`group relative flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 focus:outline-none ${
                          isRead
                            ? "border-[var(--line)]/50 bg-[var(--background-muted)]/40 opacity-60 hover:opacity-90 hover:bg-[var(--surface-hover)]"
                            : "border-[var(--line)] bg-[var(--background-muted)] shadow-md hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] hover:shadow-lg hover:shadow-[var(--accent)]/5"
                        }`}
                      >
                        {/* Left title column with vertical bar */}
                        <div className="flex flex-shrink-0 items-center gap-2 max-w-[110px]">
                          <span
                            className={`text-[11px] font-extrabold uppercase leading-snug tracking-tight ${
                              isRead
                                ? "text-[var(--topbar-muted)]"
                                : "text-[var(--topbar-title-color)]"
                            }`}
                          >
                            {item.title}
                          </span>
                          <span
                            className={`h-7 w-1 rounded-full flex-shrink-0 ${
                              isRead ? "bg-slate-600/50" : "bg-[var(--accent)]"
                            }`}
                          />
                        </div>

                        {/* Right description column */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs leading-relaxed transition-colors ${
                              isRead
                                ? "text-[var(--topbar-muted)]"
                                : "text-[var(--topbar-foreground)] group-hover:text-white"
                            }`}
                          >
                            {item.description}
                          </p>
                        </div>

                        {!isRead && (
                          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)]" />
                        )}
                      </button>
                    );
                  })}


                  {notifications.length === 0 && (
                    <div className="py-8 text-center text-xs text-[var(--topbar-muted)]">
                      <Bell className="mx-auto mb-2 h-6 w-6 opacity-30" />
                      No new notifications
                    </div>
                  )}
                </div>

                {/* Footer with Full View link */}
                <div className="mt-3 pt-3 border-t border-[var(--line)]">
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => {
                      setNotificationsOpen(false);
                      router.push(`${config.basePath}/transactions`);
                    }}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--accent)] transition-all duration-200 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/20 active:scale-95"
                  >
                    <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    <span>View All Notifications</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Render detailed modal inside a Portal to body to secure screen centering and backdrop blur */}
      {mounted && typeof document !== "undefined" && selectedNotification
        ? createPortal(detailModalContent, document.body)
        : null}
    </header>
  );
}

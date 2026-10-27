"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Bell, AlertTriangle, Search, Sun, Moon, X, ArrowLeft, ExternalLink, CheckCheck, BookOpen, User, Calendar, Info, ZoomIn } from "lucide-react";
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
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);


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
    const rawId = (item.transactionId || item.id || "").replace("due-today-", "");
    
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

    // 2. Open detail view modal showing full transaction details
    setSelectedNotification({ ...item, unread: false, is_read: true });
    setNotificationsOpen(false);

    // 3. Dispatch client-side custom event for row focus & deep-linking
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("highlight-transaction", { detail: { id: rawId } })
      );
    }
  };

  const handleCloseModal = () => {
    setSelectedNotification(null);
    setEnlargedImage(null);
  };

  const handleOpenInTransactions = () => {
    if (!selectedNotification) return;
    const rawId = (selectedNotification.transactionId || selectedNotification.id || "").replace("due-today-", "");
    handleCloseModal();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("highlight-transaction", { detail: { id: rawId } })
      );
    }
    const targetPath =
      config.basePath === "/admin" || config.basePath === "/super-admin"
        ? `${config.basePath}/transactions`
        : "/librarian/transactions";
    router.push(`${targetPath}?highlight=${rawId}`);
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
              title = isBorrow ? "NEW BORROW REQUEST" : "NEW RESERVATION RECORD";
              description = isBorrow
                ? `${t.studentName} requested to borrow "${t.resourceTitle}"`
                : `${t.studentName} is waitlisted for "${t.resourceTitle}" (1st-come, 1st-served)`;
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
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            return {
              id: itemId,
              transactionId: t.id,
              title,
              description,
              timestamp: isDueToday ? todayStart.toISOString() : (t.requestedAt || new Date().toISOString()),
              unread,
              is_read,
              // Comprehensive transaction fields for detail viewing
              studentName: t.studentName || "N/A",
              studentId: t.studentId || "N/A",
              userCourse: t.userCourse || t.course || "N/A",
              userDepartment: t.userDepartment || t.department || "N/A",
              resourceTitle: t.resourceTitle || "Untitled Book",
              author: t.author || t.resourceAuthor || "Not specified",
              isbn: t.isbn || "N/A",
              bookDepartment: t.bookDepartment || t.department || "Circulation",
              status: t.status,
              type: t.type || "Borrow",
              requestedAt: t.requestedAt,
              dueDate: t.dueDate,
              decidedAt: t.decidedAt,
              decidedBy: t.decidedBy,
              pickedUpAt: t.pickedUpAt,
              studentIdImage: t.studentIdImage,
              comment: t.comment,
              queuePosition: t.queuePosition,
            };
          });

        // Priority sort: Actionable pending requests (3) > Due today (2) > Other (1), then newest timestamp
        const getPriority = (item: any) => {
          if (item.status === "Pending") return 3;
          if (item.id?.startsWith("due-today-")) return 2;
          return 1;
        };

        items.sort((a, b) => {
          const pDiff = getPriority(b) - getPriority(a);
          if (pDiff !== 0) return pDiff;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        // Filter out items older than clearedAt timestamp
        const clearedTime = typeof window !== "undefined"
          ? parseInt(localStorage.getItem("bookhive_notifications_cleared_at") || "0", 10)
          : 0;

        const visibleItems = clearedTime > 0
          ? items.filter((item) => item.status === "Pending" || new Date(item.timestamp).getTime() > clearedTime)
          : items;

        // Deduplicate notifications by unique item ID so keys are strictly unique
        const uniqueItemsMap = new Map<string, any>();
        for (const item of visibleItems) {
          if (!uniqueItemsMap.has(item.id)) {
            uniqueItemsMap.set(item.id, item);
          }
        }
        const uniqueItems = Array.from(uniqueItemsMap.values());

        setNotifications(uniqueItems.slice(0, 15));
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
      transactionId: data.id || rawId,
      title,
      description,
      timestamp: data.requestedAt || new Date().toISOString(),
      unread: !isRead,
      is_read: isRead,
      studentName: data.studentName || "N/A",
      studentId: data.studentId || "N/A",
      userCourse: data.userCourse || data.course || "N/A",
      userDepartment: data.userDepartment || data.department || "N/A",
      resourceTitle: data.resourceTitle || data.title || "Untitled Book",
      author: data.author || data.resourceAuthor || "Not specified",
      isbn: data.isbn || "N/A",
      bookDepartment: data.bookDepartment || data.department || "Circulation",
      status: isCancel ? "Cancelled" : (data.status || "Pending"),
      type: data.type || (isBorrow ? "Borrow" : "Reservation"),
      requestedAt: data.requestedAt || new Date().toISOString(),
      dueDate: data.dueDate,
      decidedAt: data.decidedAt,
      decidedBy: data.decidedBy,
      pickedUpAt: data.pickedUpAt,
      studentIdImage: data.studentIdImage,
      comment: data.comment,
      queuePosition: data.queuePosition,
    };

    setNotifications((prev) => {
      // Remove any existing copy with the same ID and sort with priority
      const filtered = prev.filter((item) => item.id !== rawId && item.id !== `due-today-${rawId}`);
      const combined = [newItem, ...filtered];
      const getPriority = (item: any) => {
        if (item.status === "Pending") return 3;
        if (item.id?.startsWith("due-today-")) return 2;
        return 1;
      };
      combined.sort((a, b) => {
        const pDiff = getPriority(b) - getPriority(a);
        if (pDiff !== 0) return pDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      // Deduplicate combined list by unique item ID
      const uniqueCombinedMap = new Map<string, any>();
      for (const item of combined) {
        if (!uniqueCombinedMap.has(item.id)) {
          uniqueCombinedMap.set(item.id, item);
        }
      }
      return Array.from(uniqueCombinedMap.values()).slice(0, 15);
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

  // Modal JSX for viewing all transaction details (Notifications are view-only; Accept/Decline is in Transactions)
  const detailModalContent = selectedNotification ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-backdrop bg-slate-950/60 backdrop-blur-md"
        onClick={handleCloseModal}
      />
      {/* Container */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--topbar-foreground)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-[var(--accent)] border border-[var(--accent)]/30">
                Notification Details
              </span>
              {(() => {
                const rawStatus = String(selectedNotification.status || "").toLowerCase();
                const isCancelled = rawStatus === "cancelled" || selectedNotification.title?.toUpperCase().includes("CANCELLED");
                const isDeclined = rawStatus === "declined";
                const isPending = rawStatus === "pending";
                const isReturned = rawStatus === "returned";
                const isWaitlisted = selectedNotification.type === "Reservation" && !isCancelled && !isDeclined && selectedNotification.status !== "Approved";

                if (isCancelled) {
                  return (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase border border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400"
                      style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#dc2626", borderColor: "rgba(239, 68, 68, 0.4)" }}
                    >
                      Cancelled
                    </span>
                  );
                }
                if (isDeclined) {
                  return (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase border border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400"
                      style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#dc2626", borderColor: "rgba(239, 68, 68, 0.4)" }}
                    >
                      Declined
                    </span>
                  );
                }
                if (isWaitlisted) {
                  return (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-purple-500/15 text-purple-400 border border-purple-500/30">
                      Waitlisted in Queue
                    </span>
                  );
                }
                if (isPending) {
                  return (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-500 border border-amber-500/30">
                      Pending
                    </span>
                  );
                }
                if (isReturned) {
                  return (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30">
                      Returned
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {selectedNotification.status || "Approved"}
                  </span>
                );
              })()}
            </div>
            <h3 className="mt-2 text-lg font-black text-[var(--topbar-title-color)]">
              {selectedNotification.title}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--topbar-muted)]">
              {selectedNotification.description}
            </p>
          </div>
          <button
            suppressHydrationWarning
            onClick={handleCloseModal}
            className="rounded-lg p-1.5 text-[var(--topbar-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--topbar-foreground)] transition"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="mt-5 space-y-4">
          {/* Informational Notification Banner - High Contrast Vibrant Blue */}
          <div
            className="rounded-xl border border-blue-200 bg-blue-50/90 dark:border-blue-500/30 dark:bg-blue-950/40 p-3.5 flex items-start gap-3 shadow-xs"
            style={{ borderColor: "rgba(59, 130, 246, 0.35)", backgroundColor: "rgba(239, 246, 255, 0.95)" }}
          >
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" style={{ color: "#2563eb" }} />
            <div className="text-xs font-medium leading-relaxed" style={{ color: "#1d4ed8" }}>
              <span className="font-bold" style={{ color: "#1e40af" }}>Notification Overview: </span>
              This alert is for viewing only. To accept, decline, or process circulation requests, proceed to the Transactions module.
            </div>
          </div>

          {/* Book / Resource Section */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
              <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
                Book / Resource Details
              </p>
            </div>
            <p className="text-sm font-bold text-[var(--topbar-title-color)]">
              {selectedNotification.resourceTitle || "Untitled Resource"}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Author</span>
                <span className="font-medium text-[var(--topbar-title-color)]">{selectedNotification.author || "Not specified"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">ISBN</span>
                <span className="font-mono text-[var(--topbar-title-color)]">{selectedNotification.isbn || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Library Section</span>
                <span className="font-medium text-[var(--topbar-title-color)]">{selectedNotification.bookDepartment || "Circulation"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Activity Type</span>
                <span className="font-medium text-[var(--topbar-title-color)]">{selectedNotification.type || "Borrow"}</span>
              </div>
            </div>
          </div>

          {/* Student Requester Section */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-3.5 w-3.5 text-[var(--accent)]" />
              <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
                Student Requester Information
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Student Name</span>
                <span className="font-bold text-[var(--topbar-title-color)]">{selectedNotification.studentName || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Student ID Number</span>
                <span className="font-mono font-medium text-[var(--topbar-title-color)]">{selectedNotification.studentId || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Course / Program</span>
                <span className="font-medium text-[var(--topbar-title-color)]">{selectedNotification.userCourse || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">College / Department</span>
                <span className="font-medium text-[var(--topbar-title-color)]">{selectedNotification.userDepartment || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Transaction Metadata & Dates */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" />
              <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
                Transaction Schedule & Timeline
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Date Requested</span>
                <span className="font-medium text-[var(--topbar-title-color)]">
                  {selectedNotification.requestedAt || selectedNotification.timestamp
                    ? new Date(selectedNotification.requestedAt || selectedNotification.timestamp).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Due Date</span>
                <span className="font-medium text-[var(--topbar-title-color)]">
                  {selectedNotification.dueDate
                    ? new Date(selectedNotification.dueDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : selectedNotification.status === "Pending"
                    ? "Assigned upon approval (7 days)"
                    : "Not applicable"}
                </span>
              </div>
              {selectedNotification.transactionId && (
                <div className="col-span-2">
                  <span className="text-[10px] text-[var(--topbar-muted)] uppercase block">Reference Transaction ID</span>
                  <span className="font-mono text-[11px] text-[var(--topbar-muted)] break-all">{selectedNotification.transactionId}</span>
                </div>
              )}
              {selectedNotification.comment && (
                <div className="col-span-2 rounded-lg border border-[var(--line)] bg-[var(--card-bg)] p-2.5">
                  <span className="text-[10px] font-bold text-[var(--topbar-muted)] uppercase block">Remarks / Notes</span>
                  <span className="text-xs text-[var(--topbar-title-color)] mt-0.5 block">{selectedNotification.comment}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reservation Queue Notice if applicable */}
          {selectedNotification.type === "Reservation" && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 flex items-start gap-3">
              <span className="text-purple-400 text-base">ℹ️</span>
              <div>
                <p className="text-xs font-bold text-purple-300">
                  1st-Come, 1st-Served Reservation
                  {selectedNotification.queuePosition ? ` (Position #${selectedNotification.queuePosition})` : ""}
                </p>
                <p className="text-[11px] text-purple-200/80 mt-0.5 leading-relaxed">
                  Reservations operate automatically on a 1st-come, 1st-served queue. When an active borrowed copy is checked in, the system alerts the student to claim the item.
                </p>
              </div>
            </div>
          )}

          {/* Uploaded ID Preview */}
          {selectedNotification.studentIdImage && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--background-muted)] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold tracking-wider text-[var(--topbar-muted)] uppercase">
                  Uploaded ID Picture / Attachment
                </p>
                <button
                  type="button"
                  onClick={() => setEnlargedImage(selectedNotification.studentIdImage)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer active:scale-95 transition"
                  title="View full size attachment"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                  <span>View Full Size</span>
                </button>
              </div>
              <div
                className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-[var(--line)] bg-slate-100 dark:bg-slate-800/60 cursor-pointer transition-all duration-200 hover:border-[var(--accent)] hover:shadow-md"
                onClick={() => setEnlargedImage(selectedNotification.studentIdImage)}
                title="Click to view full size"
              >
                <img
                  src={selectedNotification.studentIdImage}
                  alt="Student ID Preview"
                  className="h-full w-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setEnlargedImage(selectedNotification.studentIdImage)}
                className="w-full mt-2.5 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--card-bg)] py-2 text-xs font-bold text-[var(--topbar-title-color)] hover:bg-[var(--surface-hover)] active:scale-95 transition cursor-pointer shadow-xs"
              >
                <ZoomIn className="h-4 w-4 text-[var(--accent)]" />
                <span>Click to enlarge</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <button
            suppressHydrationWarning
            onClick={handleCloseModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--background-muted)] px-5 py-2.5 text-xs font-bold text-[var(--topbar-title-color)] hover:bg-[var(--surface-hover)] active:scale-95 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Close
          </button>
          <button
            suppressHydrationWarning
            onClick={handleOpenInTransactions}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-xs font-bold text-[#0b1c2c] shadow-lg shadow-[var(--accent)]/15 hover:brightness-110 active:scale-95 transition"
          >
            <span>Open in Transactions</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const enlargedImageModal = enlargedImage ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 modal-backdrop backdrop-blur-md"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
        onClick={() => setEnlargedImage(null)}
      />
      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-white/20 bg-slate-900 shadow-2xl text-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Uploaded Student ID / Document Preview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={enlargedImage}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
              title="Open full image in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open in New Tab</span>
            </a>
            <button
              onClick={() => setEnlargedImage(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/40 min-h-[300px]">
          <img
            src={enlargedImage}
            alt="Uploaded Student ID Full Preview"
            className="max-h-[75vh] w-auto max-w-full object-contain mx-auto rounded-lg shadow-lg"
          />
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Click Close or click outside to dismiss.</p>
          <button
            onClick={() => setEnlargedImage(null)}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold text-white hover:bg-white/20 active:scale-95 transition cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  ) : null;


  return (
    <header className="sticky top-0 z-40 mb-8 flex items-center justify-between gap-4 rounded-[12px] border border-[var(--line)] bg-[var(--topbar-bg)] px-6 py-4 text-[var(--topbar-foreground)] shadow-sm transition-colors duration-300 ease-out backdrop-blur-md">
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
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-black text-black shadow-xs" style={{ color: "#000000" }}>
                {notificationsCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div className="absolute right-0 z-50 mt-3 w-88 rounded-[24px] border border-[var(--line)] bg-[var(--card-bg)] p-4 shadow-2xl backdrop-blur-md transition-all duration-300">
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
                {notifications.map((item, index) => {
                  const isRead = item.is_read || !item.unread;
                  return (
                    <button
                      key={`notif-${item.id}-${index}`}
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
                    const dest = config.basePath === "/admin" || config.basePath === "/super-admin"
                      ? `${config.basePath}/transactions`
                      : "/librarian/transactions";
                    router.push(dest);
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
      </div>

      {/* Render detailed modal inside a Portal to body to secure screen centering and backdrop blur */}
      {mounted && typeof document !== "undefined" && selectedNotification
        ? createPortal(detailModalContent, document.body)
        : null}
      {mounted && typeof document !== "undefined" && enlargedImage
        ? createPortal(enlargedImageModal, document.body)
        : null}
    </header>
  );
}

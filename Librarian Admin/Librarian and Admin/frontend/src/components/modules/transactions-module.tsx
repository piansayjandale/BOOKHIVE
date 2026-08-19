"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  BookMarked,
  Check,
  ChevronDown,
  Clock,
  Inbox,
  RefreshCcw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import dashboardSocket from "@/lib/socket";
import { useNotice } from "@/components/providers/notice-provider";
import type {
  TransactionRecord,
  TransactionStatus,
  TransactionType,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { StudentLibraryCardModal } from "@/components/modals/student-library-card-modal";

/* ── Constants ───────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<string, string> = {
  Pending:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Declined:  "bg-red-500/15 text-red-300 border-red-500/30",
  Returned:  "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Cancelled: "bg-red-500/10 text-red-400 border border-red-500/20",
};

const TYPE_STYLE: Record<string, string> = {
  Borrow:      "text-[#FCD400]",
  Return:      "text-sky-400",
  Reservation: "text-violet-400",
};

interface FilterOption {
  value: string;
  label: string;
  dotColor: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: "All",          label: "All",          dotColor: "bg-slate-400" },
  { value: "Pending",      label: "Pending",      dotColor: "bg-amber-400" },
  { value: "Approved",     label: "Approved",     dotColor: "bg-emerald-400" },
  { value: "Declined",     label: "Declined",     dotColor: "bg-red-400" },
  { value: "Returned",     label: "Returned",     dotColor: "bg-sky-400" },
  { value: "Reservations", label: "Reservations", dotColor: "bg-violet-400" },
  { value: "Cancelled",    label: "Cancelled",    dotColor: "bg-rose-500" },
];

type SortKey = "studentName" | "resourceTitle" | "requestedAt";

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${STATUS_STYLE[status] ?? "text-slate-400 border-white/10 bg-white/5"}`}
    >
      {status}
    </span>
  );
}

/* ── Strict Predicate Helpers for Type & Status Boundary Isolation ───────── */

export const isBorrowRecord = (t: TransactionRecord): boolean => {
  const typeStr = (t.type || (t as any).action || "").toLowerCase();
  return typeStr === "borrow" || typeStr === "return";
};

export const isReservationRecord = (t: TransactionRecord): boolean => {
  const typeStr = (t.type || (t as any).action || "").toLowerCase();
  return typeStr === "reservation";
};

export const isPendingRequest = (t: TransactionRecord): boolean => {
  return t.status === "Pending";
};

export const isApprovedBorrow = (t: TransactionRecord): boolean => {
  return t.status === "Approved" && isBorrowRecord(t);
};

export const isDeclinedRecord = (t: TransactionRecord): boolean => {
  return t.status === "Declined";
};

export const isReturnedBorrow = (t: TransactionRecord): boolean => {
  return t.status === "Returned" && isBorrowRecord(t);
};

export const isActiveReservation = (t: TransactionRecord): boolean => {
  return isReservationRecord(t) && t.status !== "Cancelled";
};

export const isCancelledRecord = (t: TransactionRecord): boolean => {
  return t.status === "Cancelled";
};

/* ── Custom Dark Mode Status Filter Dropdown ─────────────────────────────── */

function StatusFilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => FILTER_OPTIONS.find((o) => o.value === value) ?? FILTER_OPTIONS[0],
    [value]
  );

  // Click outside to dismiss popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(FILTER_OPTIONS.findIndex((o) => o.value === value));
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % FILTER_OPTIONS.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + FILTER_OPTIONS.length) % FILTER_OPTIONS.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < FILTER_OPTIONS.length) {
        onChange(FILTER_OPTIONS[focusedIndex].value);
        setIsOpen(false);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative min-w-[150px]" ref={containerRef}>
      {/* Trigger Button */}
      <button
        suppressHydrationWarning
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-[#0F1D29] px-3.5 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none ${
          isOpen
            ? "border-[#FCD400]/70 ring-2 ring-[#FCD400]/20 text-white shadow-lg shadow-black/40"
            : "border-white/10 text-slate-200 hover:border-white/20 hover:bg-[#152E47]/70"
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <SlidersHorizontal className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate">{selectedOption.label}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#FCD400]" : ""
          }`}
        />
      </button>

      {/* Floating Dark-Mode Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute right-0 top-full z-50 mt-2 w-full min-w-[175px] rounded-xl border border-slate-700/60 bg-[#131d2a] p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {FILTER_OPTIONS.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;

            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-[#152E47] text-[#FCD400] font-semibold"
                    : isFocused
                    ? "bg-slate-700/50 text-white"
                    : "text-slate-300 hover:bg-slate-700/40 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 rounded-full ${opt.dotColor}`}
                  />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#FCD400]" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function TransactionsModule() {
  const searchParams = useSearchParams();
  const { notify } = useNotice();

  // 1. Master persistent state for all transactions (Single Source of Truth)
  const [allTransactions, setAllTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. Local table filtering & sorting state (Primary Status & Category Filter)
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);

  // 3. Live notification alert state
  const [liveAlert, setLiveAlert] = useState<{
    studentName: string;
    title: string;
    type?: "borrow" | "cancel";
  } | null>(null);

  // 4. Interactive Student Library Card Modal State
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<{
    name: string;
    studentId: string;
    department?: string;
    course?: string;
    qrCode?: string;
  } | null>(null);

  // Deep-linking highlight parameter from URL
  useEffect(() => {
    const highlightParam = searchParams.get("highlight") || searchParams.get("id");
    if (highlightParam) {
      setHighlightedId(highlightParam);
    }
  }, [searchParams]);

  // Listen for custom highlight events dispatched from notifications overlay
  useEffect(() => {
    const handleHighlight = (e: any) => {
      if (e.detail?.id) {
        setHighlightedId(e.detail.id);
      }
    };
    window.addEventListener("highlight-transaction", handleHighlight);
    return () => window.removeEventListener("highlight-transaction", handleHighlight);
  }, []);

  /* ── Master Data Fetching (Always fetches full global dataset) ────────── */

  const loadAllTransactions = useCallback(async () => {
    try {
      // Always request the comprehensive list (status=All) to maintain global counters
      const res = await fetch("/api/transactions?status=All&type=All");
      if (!res.ok) {
        throw new Error(`Failed to load transactions: HTTP ${res.status}`);
      }
      const payload = await res.json();
      const list: TransactionRecord[] = Array.isArray(payload?.transactions)
        ? payload.transactions
        : Array.isArray(payload)
        ? payload
        : [];

      startTransition(() => {
        setAllTransactions(list);
        setIsLoading(false);
      });
      return true;
    } catch (err) {
      console.warn("Failed to fetch transactions:", err);
      return false;
    }
  }, []);

  /* ── Global Decoupled Summary Metrics (5 Metric Cards) ────────────────── */

  // These counters are derived strictly from the master allTransactions array.
  // They are completely decoupled from local search/status filters and maintain strict boundary isolation.
  const globalCounts = useMemo(() => {
    const list = Array.isArray(allTransactions) ? allTransactions : [];
    return {
      pending:      list.filter(isPendingRequest).length,
      approved:     list.filter(isApprovedBorrow).length,
      declined:     list.filter(isDeclinedRecord).length,
      returned:     list.filter(isReturnedBorrow).length,
      reservations: list.filter(isActiveReservation).length,
      cancelled:    list.filter(isCancelledRecord).length,
      total:        list.length,
    };
  }, [allTransactions]);

  /* ── Derived Filtered Table Dataset (Strict Boundary Isolation) ──────── */

  // Local table view is computed dynamically in-memory with strict queue segregation.
  const filteredTransactions = useMemo(() => {
    const list = Array.isArray(allTransactions) ? allTransactions : [];
    let result = list;

    // 1. Strict Status & Type Boundary Filtering
    switch (status) {
      case "Pending":
        result = result.filter(isPendingRequest);
        break;
      case "Approved":
        // Strictly approved borrows only (excludes reservations)
        result = result.filter(isApprovedBorrow);
        break;
      case "Declined":
        result = result.filter(isDeclinedRecord);
        break;
      case "Returned":
        // Strictly returned borrows only (excludes reservations)
        result = result.filter(isReturnedBorrow);
        break;
      case "Reservations":
        // Strictly active / queued reservation records
        result = result.filter(isActiveReservation);
        break;
      case "Cancelled":
        result = result.filter(isCancelledRecord);
        break;
      case "All":
      default:
        result = list;
        break;
    }

    // 2. Search Query Filter
    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      result = result.filter(
        (t) =>
          (t.studentName || "").toLowerCase().includes(q) ||
          (t.studentId || "").toLowerCase().includes(q) ||
          (t.resourceTitle || "").toLowerCase().includes(q) ||
          (t.isbn || "").toLowerCase().includes(q)
      );
    }

    // 3. Sorting
    if (sortBy) {
      result = [...result].sort((a, b) => {
        const av = a[sortBy];
        const bv = b[sortBy];
        if (sortBy === "requestedAt") {
          const timeA = new Date((av as string) || 0).getTime();
          const timeB = new Date((bv as string) || 0).getTime();
          return sortDir === "asc" ? timeA - timeB : timeB - timeA;
        }
        const strA = String(av ?? "");
        const strB = String(bv ?? "");
        return sortDir === "asc"
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA);
      });
    }

    return result;
  }, [allTransactions, status, deferredSearch, sortBy, sortDir]);

  /* ── Real-Time Synchronization & Polling Lifecycle ────────────────────── */

  useEffect(() => {
    // Initial fetch
    void loadAllTransactions();

    // 1. Real-time WebSocket Listeners
    const unsubscribeBorrow = dashboardSocket.subscribeToBorrowRequest((data: any) => {
      if (data) {
        setLiveAlert({
          studentName: data.studentName || "Student",
          title: data.resourceTitle || data.title || "Book",
          type: "borrow",
        });

        // Optimistically ingest or update new incoming item in master dataset
        setAllTransactions((prev) => {
          const rawId = data.id || `txn-${Date.now()}`;
          const existing = prev.find((t) => t.id === rawId || t.id === data.id);
          const isReservation = (data.type || data.action) === "Reservation";
          const newTxn: TransactionRecord = {
            id: rawId,
            studentName: data.studentName || "Student",
            studentId: data.studentId || "N/A",
            resourceTitle: data.resourceTitle || data.title || "Book",
            isbn: data.isbn || "N/A",
            type: data.type || (isReservation ? "Reservation" : "Borrow"),
            status: data.status || "Pending",
            requestedAt: data.requestedAt || new Date().toISOString(),
            dueDate: data.dueDate,
            department: data.department || "Circulation",
            durationDays: data.durationDays || 7,
          };

          if (existing) {
            return prev.map((t) => (t.id === rawId || t.id === data.id ? { ...t, ...newTxn } : t));
          }
          return [newTxn, ...prev];
        });

        setTimeout(() => setLiveAlert(null), 6000);
        void loadAllTransactions();
      }
    });

    const unsubscribeCancel = dashboardSocket.subscribeToCancelRequest((data: any) => {
      if (data) {
        setLiveAlert({
          studentName: data.studentName || "Student",
          title: data.resourceTitle || data.title || "Book",
          type: "cancel",
        });

        setAllTransactions((prev) =>
          prev.map((t) =>
            t.id === data.id || t.id === data.transactionId ? { ...t, status: "Cancelled" } : t
          )
        );

        setTimeout(() => setLiveAlert(null), 6000);
        void loadAllTransactions();
      }
    });

    const unsubscribeNotification = dashboardSocket.subscribeToNotification((data: any) => {
      if (data?.id) {
        setAllTransactions((prev) =>
          prev.map((t) => (t.id === data.id ? { ...t, status: data.status || t.status } : t))
        );
      }
      void loadAllTransactions();
    });

    // 2. Optimized Polling with Page Visibility API & Exponential Backoff
    let timeoutId: any = null;
    let currentInterval = 6000;
    const baseInterval = 6000;
    const maxInterval = 30000;
    let isRunning = true;

    const poll = async () => {
      if (!isRunning) return;
      if (typeof document !== "undefined" && document.hidden) {
        return; // Paused while tab is inactive
      }

      const success = await loadAllTransactions();
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

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timeoutId) clearTimeout(timeoutId);
      } else {
        currentInterval = baseInterval;
        void loadAllTransactions();
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(poll, currentInterval);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isRunning = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      unsubscribeBorrow();
      unsubscribeCancel();
      unsubscribeNotification();
    };
  }, [loadAllTransactions]);

  /* ── Sorting ─────────────────────────────────────────────────────────── */

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  // Highlight scroll effect
  useEffect(() => {
    if (highlightedId) {
      const el = document.getElementById(`txn-row-${highlightedId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      const timer = setTimeout(() => {
        setHighlightedId(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [highlightedId, filteredTransactions]);

  /* ── Optimistic Action Handlers ───────────────────────────────────────── */

  /**
   * Optimistic Return Workflow
   * Immediately transitions approved borrow to returned state, evicts row from
   * the Approved queue, synchronizes metrics (Approved -1, Returned +1), and sends background PATCH.
   */
  const handleReturnBook = useCallback(
    async (id: string) => {
      // 1. Snapshot previous state for rollback on network failure
      const previousTransactions = allTransactions;
      const targetTxn = allTransactions.find((t) => t.id === id);
      const now = new Date().toISOString();

      // 2. Instant Optimistic State Mutation
      startTransition(() => {
        setAllTransactions((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: "Returned" as TransactionStatus,
                  type: "Borrow" as TransactionType,
                  returnedAt: now,
                  updatedAt: now,
                }
              : t
          )
        );
      });

      // 3. Dispatch global sync event for topbar notification badge
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("transaction-updated", { detail: { id, status: "Returned" } })
        );
      }

      notify(
        `Item "${targetTxn?.resourceTitle || "Book"}" successfully marked as returned.`,
        "success"
      );

      // 4. Background Network Mutation
      try {
        const res = await fetch(`/api/transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Returned",
            type: "Borrow",
            returnedAt: now,
          }),
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.error("Failed to process return, rolling back:", err);
        // Rollback state upon failure
        startTransition(() => {
          setAllTransactions(previousTransactions);
        });
        notify(
          `Failed to update return status for "${targetTxn?.resourceTitle || "Book"}". Changes reverted.`,
          "error"
        );
      } finally {
        // Background reconcile
        await loadAllTransactions();
      }
    },
    [allTransactions, notify, loadAllTransactions]
  );

  /**
   * General Status Handler (Approve / Decline)
   */
  const handleUpdateStatus = useCallback(
    async (id: string, nextStatus: TransactionStatus) => {
      const previousTransactions = allTransactions;
      const targetTxn = allTransactions.find((t) => t.id === id);

      startTransition(() => {
        setAllTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
        );
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("transaction-updated", { detail: { id, status: nextStatus } })
        );
      }

      notify(
        `Transaction for "${targetTxn?.resourceTitle || "Item"}" marked as ${nextStatus.toLowerCase()}.`,
        "success"
      );

      try {
        const res = await fetch(`/api/transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.error(`Failed to update status to ${nextStatus}, rolling back:`, err);
        startTransition(() => {
          setAllTransactions(previousTransactions);
        });
        notify(`Failed to update status to ${nextStatus}. Changes reverted.`, "error");
      } finally {
        await loadAllTransactions();
      }
    },
    [allTransactions, notify, loadAllTransactions]
  );

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col gap-6 px-1">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">
            Librarian · Transactions
          </p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">
            Circulation Queue
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Track borrows, returns, and reservations — approve or decline in real time.
          </p>
        </div>
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => {
            void loadAllTransactions();
          }}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Live Alert Banner ───────────────────────────────────────── */}
      {liveAlert && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 shadow-lg animate-pulse ${
            liveAlert.type === "cancel"
              ? "bg-red-500/20 border border-red-500/40 text-red-200"
              : "bg-amber-500/20 border border-amber-500/40 text-amber-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-3 w-3 rounded-full animate-ping ${
                liveAlert.type === "cancel" ? "bg-red-400" : "bg-amber-400"
              }`}
            />
            <div>
              <p className="text-sm font-bold text-white">
                {liveAlert.type === "cancel"
                  ? `Reservation Cancelled by ${liveAlert.studentName}`
                  : `Live Borrow/Reservation Request from ${liveAlert.studentName}!`}
              </p>
              <p className="text-xs opacity-90">
                Resource: <span className="font-semibold text-white">{liveAlert.title}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLiveAlert(null)}
            className="rounded-lg p-1 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Global Decoupled Summary Metric Cards (5 Responsive Cards) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: "Pending",
            value: globalCounts.pending,
            color: "#FBBF24",
            icon: Clock,
            filterKey: "Pending",
          },
          {
            label: "Approved",
            value: globalCounts.approved,
            color: "#6EE7B7",
            icon: Check,
            filterKey: "Approved",
          },
          {
            label: "Declined",
            value: globalCounts.declined,
            color: "#FCA5A5",
            icon: X,
            filterKey: "Declined",
          },
          {
            label: "Returned",
            value: globalCounts.returned,
            color: "#7DD3FC",
            icon: RefreshCcw,
            filterKey: "Returned",
          },
          {
            label: "Reservations",
            value: globalCounts.reservations,
            color: "#C084FC",
            icon: BookMarked,
            filterKey: "Reservations",
          },
        ].map((stat) => {
          const isSelected = status === stat.filterKey;

          return (
            <div
              key={stat.label}
              onClick={() => {
                setStatus((current) => (current === stat.filterKey ? "All" : stat.filterKey));
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setStatus((current) => (current === stat.filterKey ? "All" : stat.filterKey));
                }
              }}
              className={`group cursor-pointer rounded-2xl border bg-[#152E47]/60 px-4 py-3.5 sm:px-5 sm:py-4 backdrop-blur transition-all duration-200 hover:border-white/20 hover:bg-[#152E47]/80 ${
                isSelected
                  ? "ring-2 ring-[#FCD400]/50 border-white/20 shadow-lg shadow-black/20"
                  : "border-white/8"
              }`}
              style={{ borderLeftColor: stat.color, borderLeftWidth: 4 }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase group-hover:text-slate-200 transition-colors truncate">
                  {stat.label}
                </p>
                <stat.icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </div>
              <p className="mt-1 text-2xl font-black text-white">
                {stat.value.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Search / Filter Bar (Custom Dark Mode Dropdown) ───────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
            placeholder="Search student, title, ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Custom Dark-Mode Popover Select Menu */}
        <StatusFilterDropdown
          value={status}
          onChange={(newStatus) => setStatus(newStatus)}
        />
      </div>

      {/* ── Table Container ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur">
        <div className="overflow-auto h-full">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-[#152E47]/60 sticky top-0 z-10 backdrop-blur">
                {[
                  { key: "studentName" as SortKey, label: "Student" },
                  { key: "resourceTitle" as SortKey, label: "Resource" },
                  { key: null, label: "Type" },
                  { key: null, label: "Status" },
                  { key: "requestedAt" as SortKey, label: "Requested" },
                  { key: null, label: "Actions" },
                ].map((col) => (
                  <th
                    key={col.label}
                    className="px-5 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap"
                  >
                    {col.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key!)}
                        className="flex items-center gap-1.5 hover:text-[#FCD400] transition-colors"
                      >
                        {col.label}
                        <ArrowDownUp className="h-3 w-3 opacity-40" />
                        <span className="text-[#FCD400]">{sortIndicator(col.key!)}</span>
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((txn) => (
                <tr
                  key={txn.id}
                  id={`txn-row-${txn.id}`}
                  className={`border-b border-white/5 transition-all duration-500 hover:bg-white/[0.03] ${
                    highlightedId === txn.id
                      ? "bg-[#FCD400]/20 border-l-4 border-l-[#FCD400] shadow-[0_0_15px_rgba(252,212,0,0.2)]"
                      : ""
                  }`}
                >
                  {/* Student */}
                  <td className="px-5 py-3.5 max-w-[200px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStudentForCard({
                          name: txn.studentName,
                          studentId: txn.studentId,
                          department: txn.department,
                          course: (txn as any).course || txn.department || "General Program",
                          qrCode: (txn as any).qrCode || `e1a1-${txn.studentId || "default"}`,
                        })
                      }
                      className="group text-left block w-full rounded-lg p-1.5 -m-1.5 transition-all duration-200 hover:bg-[#FCD400]/10 hover:border hover:border-[#FCD400]/30 focus:outline-none focus:ring-1 focus:ring-[#FCD400] cursor-pointer"
                      title={`Click to view Library Card for ${txn.studentName}`}
                    >
                      <div className="font-semibold text-white leading-snug line-clamp-1 group-hover:text-[#FCD400] transition-colors flex items-center gap-1">
                        <span>{txn.studentName}</span>
                        <span className="text-[9px] text-[#FCD400] opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                          ↗
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono group-hover:text-slate-200">
                        {txn.studentId}
                      </div>
                      {txn.department ? (
                        <div className="text-[10px] text-slate-500 mt-0.5 group-hover:text-slate-400 line-clamp-1">
                          {txn.department}
                        </div>
                      ) : null}
                    </button>
                  </td>

                  {/* Resource */}
                  <td className="px-5 py-3.5 max-w-[260px]">
                    <div className="font-semibold text-white leading-snug line-clamp-1">
                      {txn.resourceTitle}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                      {txn.isbn}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={`text-xs font-semibold ${TYPE_STYLE[txn.type] ?? "text-slate-400"}`}>
                      {txn.type}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <StatusBadge status={txn.status} />
                  </td>

                  {/* Requested */}
                  <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                    {formatDateTime(txn.requestedAt)}
                    {txn.dueDate && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Due: {formatDateTime(txn.dueDate)}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      {txn.status === "Pending" && (
                        <>
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => void handleUpdateStatus(txn.id, "Approved")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition active:scale-95"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => void handleUpdateStatus(txn.id, "Declined")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:border-red-500/50 transition active:scale-95"
                          >
                            <X className="h-3.5 w-3.5" />
                            Decline
                          </button>
                        </>
                      )}
                      {txn.status === "Approved" && (
                        <button
                          suppressHydrationWarning
                          type="button"
                          onClick={() => void handleReturnBook(txn.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50 transition active:scale-95"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Returned
                        </button>
                      )}
                      {(txn.status === "Returned" || txn.status === "Declined") && (
                        <span className="inline-flex items-center px-2 text-[11px] text-slate-500 italic">
                          Closed
                        </span>
                      )}
                      {txn.status === "Cancelled" && (
                        <span className="inline-flex items-center px-2 text-[11px] text-red-400/80 italic font-semibold">
                          Cancelled
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-500">
                    <Inbox className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    {isLoading ? "Loading transactions…" : "No transactions match the selected filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2">
        <span>
          Showing {filteredTransactions.length.toLocaleString()} of {allTransactions.length.toLocaleString()} transaction{allTransactions.length !== 1 ? "s" : ""}
          {status !== "All" && ` · Filter: ${status}`}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Real-time synchronized
        </span>
      </div>

      {/* ── Interactive Student Library Card Modal ─────────────────── */}
      <StudentLibraryCardModal
        open={selectedStudentForCard !== null}
        onClose={() => setSelectedStudentForCard(null)}
        student={selectedStudentForCard}
        transactions={allTransactions}
      />
    </div>
  );
}


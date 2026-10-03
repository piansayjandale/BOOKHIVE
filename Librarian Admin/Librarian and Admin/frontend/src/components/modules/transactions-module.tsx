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
import { useTheme } from "@/components/providers/theme-provider";
import type {
  TransactionRecord,
  TransactionStatus,
  TransactionType,
} from "@/lib/types";
import { formatDateTime, cn } from "@/lib/utils";
import { StudentLibraryCardModal } from "@/components/modals/student-library-card-modal";

/* ── Constants ───────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<string, string> = {
  Pending:    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Waitlisted: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  Approved:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Borrow:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Borrowed:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Declined:   "bg-red-500/15 text-red-300 border-red-500/30",
  Returned:   "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Cancelled:  "bg-red-500/10 text-red-400 border border-red-500/20",
};

interface FilterOption {
  value: string;
  label: string;
  dotColor: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: "All",          label: "All",          dotColor: "bg-slate-400" },
  { value: "Pending",      label: "Pending",      dotColor: "bg-amber-500" },
  { value: "Approved",     label: "Approved",     dotColor: "bg-emerald-500" },
  { value: "Declined",     label: "Declined",     dotColor: "bg-rose-500" },
  { value: "Returned",     label: "Returned",     dotColor: "bg-sky-500" },
  { value: "Reservations", label: "Reservations", dotColor: "bg-purple-500" },
  { value: "Cancelled",    label: "Cancelled",    dotColor: "bg-rose-600" },
];

type SortKey = "studentName" | "resourceTitle" | "requestedAt";

/* ── Sub-components ──────────────────────────────────────────────────────── */

function TypeBadge({ type, isLight }: { type: string; isLight: boolean }) {
  const t = (type || "").toLowerCase();
  if (isLight) {
    if (t === "borrow") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Borrow
        </span>
      );
    }
    if (t === "return") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-sky-600">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          Return
        </span>
      );
    }
    if (t === "reservation") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-purple-600">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          Reservation
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
        {type}
      </span>
    );
  }

  // Dark mode
  if (t === "borrow") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Borrow
      </span>
    );
  }
  if (t === "return") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        Return
      </span>
    );
  }
  if (t === "reservation") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
        <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
        Reservation
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
      {type}
    </span>
  );
}

function StatusBadge({ status, isLight }: { status: string; isLight: boolean }) {
  if (isLight) {
    switch (status) {
      case "Approved":
      case "Borrow":
      case "Borrowed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {status}
          </span>
        );
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Pending
          </span>
        );
      case "Waitlisted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-purple-600">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Waitlisted
          </span>
        );
      case "Declined":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-rose-600">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Declined
          </span>
        );
      case "Returned":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-sky-600">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Returned
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-rose-600">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
            {status}
          </span>
        );
    }
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
        STATUS_STYLE[status] ?? "text-slate-400 border-white/10 bg-white/5"
      }`}
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

export const isPendingBorrow = (t: TransactionRecord): boolean => {
  return t.status === "Pending" && isBorrowRecord(t);
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

/* ── Custom Status Filter Dropdown ───────────────────────────────────────── */

function StatusFilterDropdown({
  value,
  onChange,
  isLight,
}: {
  value: string;
  onChange: (val: string) => void;
  isLight: boolean;
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
    <div className="relative min-w-[160px]" ref={containerRef}>
      {/* Trigger Button */}
      <button
        suppressHydrationWarning
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none cursor-pointer",
          isLight
            ? isOpen
              ? "border border-[#0274BB] bg-white ring-2 ring-[#0274BB]/20 text-[#0274BB] shadow-sm"
              : "border border-[#0274BB]/20 bg-white text-[#0274BB] hover:border-[#0274BB]/40 shadow-xs"
            : isOpen
            ? "border-[#FCD400]/70 bg-[#0F1D29] ring-2 ring-[#FCD400]/20 text-white shadow-lg shadow-black/40"
            : "border-white/10 bg-[#0F1D29] text-slate-200 hover:border-white/20 hover:bg-[#152E47]/70"
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          <SlidersHorizontal className={cn("h-4 w-4 flex-shrink-0", isLight ? "text-[#0274BB]" : "text-slate-400")} />
          <span className="truncate">{selectedOption.label}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-transform duration-200",
            isLight
              ? isOpen ? "rotate-180 text-[#0274BB]" : "text-[#0274BB]"
              : isOpen ? "rotate-180 text-[#FCD400]" : "text-slate-400"
          )}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-full min-w-[190px] rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150",
            isLight
              ? "border border-[#0274BB]/15 bg-white shadow-xl shadow-[#0274BB]/5 ring-1 ring-slate-900/5"
              : "border border-slate-700/60 bg-[#131d2a]"
          )}
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
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all",
                  isLight
                    ? isSelected
                      ? "bg-[#FFF300] text-[#0274BB] font-black border border-[#ebd000] shadow-xs"
                      : isFocused
                      ? "bg-sky-50 text-[#0274BB]"
                      : "text-slate-700 hover:bg-slate-50 hover:text-[#0274BB]"
                    : isSelected
                    ? "bg-[#152E47] text-[#FCD400] font-semibold"
                    : isFocused
                    ? "bg-slate-700/50 text-white"
                    : "text-slate-300 hover:bg-slate-700/40 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full shadow-xs", opt.dotColor)}
                  />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className={cn("h-4 w-4", isLight ? "text-[#0274BB]" : "text-[#FCD400]")} />}
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
  const { theme } = useTheme();
  const isLight = theme === "light";

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

  // 3. Interactive Student Library Card Modal State
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
      pending:      list.filter(isPendingBorrow).length,
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
        // Strictly pending borrow requests only (excludes waitlisted reservations)
        result = result.filter(isPendingBorrow);
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
        const isReservation = (data.type || data.action) === "Reservation";
        const title = data.resourceTitle || data.title || "Book";
        const student = data.studentName || "A student";

        notify(
          `${student} submitted a ${isReservation ? "reservation hold" : "borrow request"} for "${title}".`,
          "info"
        );

        // Optimistically ingest or update new incoming item in master dataset
        setAllTransactions((prev) => {
          const rawId = data.id || `txn-${Date.now()}`;
          const existing = prev.find((t) => t.id === rawId || t.id === data.id);
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

        void loadAllTransactions();
      }
    });

    const unsubscribeReturn = dashboardSocket.subscribeToReturn((data: any) => {
      if (data?.id || data?.transactionId) {
        const rawId = data.id || data.transactionId;
        const now = data.returnedAt || data.decidedAt || new Date().toISOString();

        startTransition(() => {
          setAllTransactions((prev) =>
            prev.map((t) =>
              t.id === rawId
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

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("transaction-updated", { detail: { id: rawId, status: "Returned" } })
          );
        }

        notify(
          `Item "${data.resourceTitle || data.title || "Book"}" marked as Returned in real-time.`,
          "success"
        );

        void loadAllTransactions();
      }
    });

    const unsubscribeCancel = dashboardSocket.subscribeToCancelRequest((data: any) => {
      if (data) {
        setAllTransactions((prev) =>
          prev.map((t) =>
            t.id === data.id || t.id === data.transactionId ? { ...t, status: "Cancelled" } : t
          )
        );

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
      unsubscribeReturn();
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

      // 3. Dispatch global sync event for topbar notification badge and real-time socket broadcast
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("transaction-updated", { detail: { id, status: "Returned" } })
        );
      }

      dashboardSocket.publishBookReturned({
        id,
        transactionId: id,
        status: "Returned",
        type: "Borrow",
        resourceTitle: targetTxn?.resourceTitle || "Book",
        studentId: targetTxn?.studentId,
        studentName: targetTxn?.studentName,
        returnedAt: now,
      });

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
          <p className={cn("text-[11px] font-bold tracking-[0.2em] uppercase", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
            Librarian · Transactions
          </p>
          <h1 className={cn("mt-1 text-2xl font-black tracking-tight", isLight ? "text-[#0274BB]" : "text-white")}>
            Circulation Queue
          </h1>
          <p className={cn("mt-0.5 text-sm", isLight ? "text-slate-600" : "text-slate-400")}>
            Track borrows, returns, and reservations — approve or decline in real time.
          </p>
        </div>
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => {
            void loadAllTransactions();
          }}
          className={cn(
            "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition shadow-sm active:scale-95 cursor-pointer",
            isLight
              ? "bg-[#FFF300] text-[#0274BB] border border-[#ebd000] hover:bg-[#ebd000]"
              : "bg-[#FCD400] text-[#0b1c2c] shadow-[#FCD400]/20 hover:brightness-110"
          )}
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

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
            color: "#10B981",
            icon: Check,
            filterKey: "Approved",
          },
          {
            label: "Declined",
            value: globalCounts.declined,
            color: "#EF4444",
            icon: X,
            filterKey: "Declined",
          },
          {
            label: "Returned",
            value: globalCounts.returned,
            color: "#0274BB",
            icon: RefreshCcw,
            filterKey: "Returned",
          },
          {
            label: "Reservations",
            value: globalCounts.reservations,
            color: "#8B5CF6",
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
              className={cn(
                "group cursor-pointer rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4 backdrop-blur transition-all duration-200 hover:-translate-y-0.5",
                isLight
                  ? isSelected
                    ? "border-2 border-[#0274BB] bg-white ring-2 ring-[#0274BB]/20 shadow-md"
                    : "border border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/30 hover:shadow-md"
                  : isSelected
                  ? "bg-[#152E47]/80 ring-2 ring-[#FCD400]/50 border-white/20 shadow-lg shadow-black/20"
                  : "bg-[#152E47]/60 border-white/8 hover:border-white/20 hover:bg-[#152E47]/80"
              )}
              style={{ borderLeftColor: stat.color, borderLeftWidth: 4 }}
            >
              <div className="flex items-center justify-between">
                <p className={cn("text-[10px] font-bold tracking-[0.16em] uppercase transition-colors truncate", isLight ? "text-slate-600 group-hover:text-[#0274BB]" : "text-slate-400 group-hover:text-slate-200")}>
                  {stat.label}
                </p>
                <stat.icon className={cn("h-3.5 w-3.5 flex-shrink-0 transition-colors", isLight ? "text-slate-400 group-hover:text-[#0274BB]" : "text-slate-500 group-hover:text-slate-300")} />
              </div>
              <p className={cn("mt-1 text-2xl font-black", isLight ? "text-[#0274BB]" : "text-white")}>
                {stat.value.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Search & filter ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isLight ? "text-slate-400" : "text-slate-500")} />
          <input
            suppressHydrationWarning
            className={cn(
              "w-full rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium transition-all focus:outline-none",
              isLight
                ? "border border-[#0274BB]/20 bg-white text-[#0274BB] placeholder:text-slate-400 focus:border-[#0274BB] focus:ring-1 focus:ring-[#0274BB]"
                : "border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:ring-0"
            )}
            placeholder="Search student, title, ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Custom Popover Select Menu */}
        <StatusFilterDropdown
          value={status}
          onChange={(newStatus) => setStatus(newStatus)}
          isLight={isLight}
        />
      </div>

      {/* ── Table Container ─────────────────────────────────────────── */}
      <div className={cn(
        "flex-1 overflow-hidden rounded-2xl backdrop-blur transition-all",
        isLight
          ? "border border-[#0274BB]/15 bg-white shadow-sm"
          : "border border-white/8 bg-[#0F1D29]/80"
      )}>
        <div className="overflow-auto h-full">
          <table className="min-w-full text-sm">
            <thead>
              <tr className={cn(
                "sticky top-0 z-10 backdrop-blur",
                isLight
                  ? "border-b border-[#0274BB]/15 bg-[#F0F7FC] text-[#0274BB]"
                  : "border-b border-white/8 bg-[#152E47]/60 text-slate-400"
              )}>
                {[
                  { key: "studentName" as SortKey, label: "STUDENT" },
                  { key: "resourceTitle" as SortKey, label: "RESOURCE" },
                  { key: null, label: "TYPE" },
                  { key: null, label: "STATUS" },
                  { key: "requestedAt" as SortKey, label: "REQUESTED" },
                  { key: null, label: "ACTIONS" },
                ].map((col) => (
                  <th
                    key={col.label}
                    className={cn(
                      "px-5 py-3.5 text-left text-[11px] font-bold tracking-[0.12em] uppercase whitespace-nowrap",
                      isLight ? "text-[#0274BB]" : "text-slate-400"
                    )}
                  >
                    {col.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key!)}
                        className={cn(
                          "flex items-center gap-1.5 transition-colors cursor-pointer",
                          isLight ? "text-[#0274BB] hover:opacity-80" : "text-slate-400 hover:text-[#FCD400]"
                        )}
                      >
                        <span>{col.label}</span>
                        <ArrowDownUp className={cn("h-3 w-3", isLight ? "text-[#0274BB]/60" : "opacity-40")} />
                        <span className={isLight ? "text-[#0274BB] font-black" : "text-[#FCD400]"}>{sortIndicator(col.key!)}</span>
                      </button>
                    ) : (
                      <span>{col.label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isLight ? "divide-y divide-slate-100" : "divide-y divide-white/5"}>
              {filteredTransactions.map((txn) => (
                <tr
                  key={txn.id}
                  id={`txn-row-${txn.id}`}
                  className={cn(
                    "transition-colors",
                    isLight
                      ? "hover:bg-[#0274BB]/[0.03]"
                      : "hover:bg-white/[0.03]",
                    highlightedId === txn.id
                      ? isLight
                        ? "bg-[#FFF300]/20 border-l-4 border-l-[#0274BB]"
                        : "bg-[#FCD400]/20 border-l-4 border-l-[#FCD400] shadow-[0_0_15px_rgba(252,212,0,0.2)]"
                      : ""
                  )}
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
                          course: (txn as any).course || txn.department || "BS in Information Technology",
                          qrCode: (txn as any).qrCode || `e1a1-${txn.studentId || "default"}`,
                        })
                      }
                      className={cn(
                        "group text-left block w-full rounded-lg p-1.5 -m-1.5 transition-all duration-200 focus:outline-none cursor-pointer",
                        isLight
                          ? "hover:bg-blue-50/80 focus:ring-1 focus:ring-[#0274BB]"
                          : "hover:bg-[#FCD400]/10 hover:border hover:border-[#FCD400]/30 focus:ring-1 focus:ring-[#FCD400]"
                      )}
                      title={`Click to view Library Card for ${txn.studentName}`}
                    >
                      <div className={cn(
                        "font-semibold leading-snug line-clamp-1 transition-colors flex items-center gap-1",
                        isLight ? "text-[#0274BB] group-hover:underline" : "text-white group-hover:text-[#FCD400]"
                      )}>
                        <span>{txn.studentName}</span>
                        <span className={cn("text-[9px] opacity-0 group-hover:opacity-100 transition-opacity font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                          ↗
                        </span>
                      </div>
                      <div className={cn("text-xs mt-0.5 font-mono", isLight ? "text-slate-500 font-medium" : "text-slate-400 group-hover:text-slate-200")}>
                        {txn.studentId}
                      </div>
                      {txn.department ? (
                        <div className={cn("text-[10px] mt-0.5 line-clamp-1 font-medium", isLight ? "text-slate-400" : "text-slate-500 group-hover:text-slate-400")}>
                          {txn.department}
                        </div>
                      ) : null}
                    </button>
                  </td>

                  {/* Resource */}
                  <td className="px-5 py-3.5 max-w-[260px]">
                    <div className={cn(
                      "font-semibold leading-snug line-clamp-1 transition-colors",
                      isLight ? "text-[#0274BB] hover:underline cursor-pointer" : "text-white hover:text-[#FCD400]"
                    )}>
                      {txn.resourceTitle}
                    </div>
                    <div className={cn("text-xs mt-0.5 font-mono", isLight ? "text-slate-500 font-medium" : "text-slate-500")}>
                      {txn.isbn}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <TypeBadge type={txn.type} isLight={isLight} />
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <StatusBadge status={txn.type === "Reservation" && txn.status === "Pending" ? "Waitlisted" : txn.status} isLight={isLight} />
                  </td>

                  {/* Requested */}
                  <td className={cn("px-5 py-3.5 text-xs whitespace-nowrap", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>
                    {formatDateTime(txn.requestedAt)}
                    {txn.type !== "Reservation" && txn.dueDate && (
                      <div className={cn("text-[10px] mt-0.5 font-medium", isLight ? "text-slate-400" : "text-slate-500")}>
                        Due: {formatDateTime(txn.dueDate)}
                      </div>
                    )}
                    {txn.type === "Reservation" && (
                      <div className={cn("text-[10px] mt-0.5 font-semibold", isLight ? "text-purple-600" : "text-violet-400/80")}>
                        Waitlist Hold
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex gap-2 items-center">
                      {txn.type === "Reservation" ? (
                        <>
                          {txn.status === "Cancelled" ? (
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium",
                              isLight ? "border border-rose-500/20 bg-rose-500/10 text-rose-600" : "text-red-400/80 italic font-semibold"
                            )}>
                              Cancelled
                            </span>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
                              isLight
                                ? "border border-purple-500/30 bg-purple-500/10 text-purple-600"
                                : "border border-violet-500/30 bg-violet-500/10 text-violet-300"
                            )}>
                              <BookMarked className="h-3.5 w-3.5" />
                              Waitlisted in Queue
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {txn.status === "Pending" && (
                            <>
                              <button
                                suppressHydrationWarning
                                type="button"
                                onClick={() => void handleUpdateStatus(txn.id, "Approved")}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer",
                                  isLight
                                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                                )}
                              >
                                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                Approve
                              </button>
                              <button
                                suppressHydrationWarning
                                type="button"
                                onClick={() => void handleUpdateStatus(txn.id, "Declined")}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer",
                                  isLight
                                    ? "border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:border-rose-500/50"
                                    : "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                                )}
                              >
                                <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                Decline
                              </button>
                            </>
                          )}
                          {txn.status === "Approved" && (
                            <button
                              suppressHydrationWarning
                              type="button"
                              onClick={() => void handleReturnBook(txn.id)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer",
                                isLight
                                  ? "border border-sky-500/30 bg-sky-500/10 text-[#0274BB] hover:bg-sky-500/20 hover:border-sky-500/50"
                                  : "border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50"
                              )}
                            >
                              <RefreshCcw className="h-3.5 w-3.5 stroke-[2.5]" />
                              Returned
                            </button>
                          )}
                          {(txn.status === "Returned" || txn.status === "Declined") && (
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium",
                              isLight ? "border border-slate-200 bg-slate-100/80 text-slate-500" : "text-slate-500 italic"
                            )}>
                              Closed
                            </span>
                          )}
                          {txn.status === "Cancelled" && (
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium",
                              isLight ? "border border-rose-500/20 bg-rose-500/10 text-rose-600" : "text-red-400/80 italic font-semibold"
                            )}>
                              Cancelled
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className={cn("py-20 text-center font-medium", isLight ? "text-slate-500" : "text-slate-500")}>
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
      <div className={cn("flex items-center justify-between text-xs pb-2 font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
        <span>
          Showing {filteredTransactions.length.toLocaleString()} of {allTransactions.length.toLocaleString()} transaction{allTransactions.length !== 1 ? "s" : ""}
          {status !== "All" && ` · Filter: ${status}`}
        </span>
        <span className="flex items-center gap-1.5 text-[10px]">
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


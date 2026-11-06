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
  AlertTriangle,
  ArrowDownUp,
  BookMarked,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Inbox,
  RefreshCcw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  ZoomIn,
} from "lucide-react";

import dashboardSocket from "@/lib/socket";
import { useNotice } from "@/components/providers/notice-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useSession } from "@/components/providers/session-provider";
import type {
  TransactionRecord,
  TransactionStatus,
  TransactionType,
} from "@/lib/types";
import { formatDateTime, formatDate, getTodayString, cn, formatCourseShortcut, isDueToReturn, isDateOverdue, parseDateOnly } from "@/lib/utils";
import { StudentLibraryCardModal } from "@/components/modals/student-library-card-modal";
import { BookDetailModal, type BookDetailPayload } from "@/components/ui/book-detail-modal";
import { BookCoverImage } from "@/components/ui/book-cover-image";

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
  { value: "Due",          label: "Due to Return",dotColor: "bg-red-500" },
  { value: "Returned",     label: "Returned",     dotColor: "bg-sky-500" },
  { value: "Reservations", label: "Reservations", dotColor: "bg-purple-500" },
  { value: "Cancelled",    label: "Cancelled",    dotColor: "bg-rose-600" },
];

type SortKey = "studentName" | "resourceTitle" | "requestedAt";

/**
 * Explicit Resource Property Resolver
 * Explicitly binds to resource/book title attributes (never student/patron fields)
 */
function resolveResourceTitle(
  tx?: Partial<TransactionRecord> | null,
  fallback = "Resource"
): string {
  return (
    tx?.resourceTitle ||
    (tx as any)?.bookTitle ||
    (tx as any)?.title ||
    (tx as any)?.resource?.title ||
    fallback
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function TypeBadge({ type, isLight }: { type: string; isLight: boolean }) {
  const t = (type || "").toLowerCase();
  if (isLight) {
    if (t === "borrow") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Borrow
        </span>
      );
    }
    if (t === "return") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-sky-700">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          Return
        </span>
      );
    }
    if (t === "reservation") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-purple-700">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Reservation
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs sm:text-[13px] font-bold text-slate-800">
        {type}
      </span>
    );
  }

  // Dark mode
  if (t === "borrow") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-emerald-300">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        Borrow
      </span>
    );
  }
  if (t === "return") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs sm:text-[13px] font-bold text-sky-300">
        <span className="h-2 w-2 rounded-full bg-sky-400" />
        Return
      </span>
    );
  }
  if (t === "reservation") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs sm:text-[13px] font-bold text-violet-300">
        <span className="h-2 w-2 rounded-full bg-violet-400" />
        Reservation
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs sm:text-[13px] font-bold text-slate-200">
      {type}
    </span>
  );
}

function StatusBadge({
  status,
  isLight,
  dueDate,
}: {
  status: string;
  isLight: boolean;
  dueDate?: string | null;
}) {
  const isDue = Boolean(dueDate && isDueToReturn(dueDate));
  const isOverdue = Boolean(dueDate && isDateOverdue(dueDate));

  if (isLight) {
    switch (status) {
      case "Approved":
      case "Borrow":
      case "Borrowed":
        if (isDue) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {isOverdue ? "Borrowed (Overdue)" : "Borrowed (Due to Return)"}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {status}
          </span>
        );
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Pending
          </span>
        );
      case "Waitlisted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-purple-700">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            Waitlisted
          </span>
        );
      case "Declined":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Declined
          </span>
        );
      case "Returned":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-sky-700">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Returned
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs sm:text-[13px] font-bold text-slate-800">
            {status}
          </span>
        );
    }
  }

  // Dark mode
  if (isDue && (status === "Approved" || status === "Borrow" || status === "Borrowed")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide text-red-300">
        <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
        {isOverdue ? "Borrowed (Overdue)" : "Borrowed (Due to Return)"}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide ${
        STATUS_STYLE[status] ?? "text-slate-300 border-white/10 bg-white/5"
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
  return t.status === "Cancelled" || t.status === "Declined";
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
          "filter-dropdown-btn flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm sm:text-base font-bold transition-all duration-200 focus:outline-none cursor-pointer border",
          isLight
            ? isOpen
              ? "border-[#0274BB] bg-white ring-2 ring-[#0274BB]/20 text-[#0274BB] shadow-sm"
              : "border-[#0274BB]/20 bg-white text-[#0274BB] hover:border-[#0274BB]/40 shadow-xs"
            : isOpen
            ? "border-[#FCD400]/70 bg-[#0F1D29] ring-2 ring-[#FCD400]/20 text-white shadow-lg shadow-black/40"
            : "border-white/10 bg-[#0F1D29] text-slate-200 hover:border-white/20 hover:bg-[#152E47]/70"
        )}
        style={{
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: isLight
            ? isOpen
              ? "#0274BB"
              : "rgba(2, 116, 187, 0.25)"
            : isOpen
            ? "rgba(252, 212, 0, 0.7)"
            : "rgba(255, 255, 255, 0.12)",
        }}
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
                  "flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all",
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

function formatPickupCountdown(expiresAt?: string | null, requestedAt?: string | null): string {
  let targetTime: number | null = null;
  if (expiresAt) {
    targetTime = new Date(expiresAt).getTime();
  } else if (requestedAt) {
    targetTime = new Date(requestedAt).getTime() + 24 * 60 * 60 * 1000;
  }

  if (!targetTime || isNaN(targetTime)) {
    return "1-day limit";
  }

  const diff = targetTime - Date.now();
  if (diff <= 0) {
    return "1-day limit expired";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m pickup limit`;
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function TransactionsModule() {
  const searchParams = useSearchParams();
  const { notify } = useNotice();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { user, refreshUser } = useSession();

  // Revalidate fresh user permissions from database on mount
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const canTransactionDropdown =
    user?.role?.toUpperCase().includes("ADMIN") ||
    ((user?.permissions as any)?.transactionDropdown !== false &&
     (user?.permissions as any)?.catalogDropdown !== false &&
     (user?.permissions as any)?.dropdown !== false);

  // Librarian Approval Stats & Dropdown State
  const [librarianApprovalStats, setLibrarianApprovalStats] = useState<
    Array<{ id: string; name: string; subRole?: string; approvedCount: number; todayApprovedCount: number }>
  >([]);
  const [personalApprovalCount, setPersonalApprovalCount] = useState<number>(0);
  const [personalTodayApprovalCount, setPersonalTodayApprovalCount] = useState<number>(0);
  const [isApprovalDropdownOpen, setIsApprovalDropdownOpen] = useState(false);
  const [approvalStatTimeframe, setApprovalStatTimeframe] = useState<"all" | "today">("today");
  const approvalDropdownRef = useRef<HTMLDivElement | null>(null);

  const fetchLibrarianApprovalStats = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions/daily-count");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.librarians)) {
          setLibrarianApprovalStats(data.librarians);
          const myStat = user?.name
            ? data.librarians.find(
                (l: any) =>
                  (user.id && l.id === user.id) ||
                  (l.name && user.name && l.name.toLowerCase().includes(user.name.toLowerCase())) ||
                  (user.name && l.name && user.name.toLowerCase().includes(l.name.toLowerCase()))
              )
            : null;

          if (myStat) {
            setPersonalTodayApprovalCount(myStat.todayApprovedCount || 0);
            setPersonalApprovalCount(myStat.approvedCount || 0);
          } else {
            setPersonalTodayApprovalCount(data.personalTodayCount ?? data.count ?? 0);
            setPersonalApprovalCount(data.personalTotalCount ?? 0);
          }
        }
      }
    } catch {
      // resilience fallback
    }
  }, [user?.id, user?.name]);

  useEffect(() => {
    void fetchLibrarianApprovalStats();
  }, [fetchLibrarianApprovalStats]);

  useEffect(() => {
    if (!isApprovalDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (approvalDropdownRef.current && !approvalDropdownRef.current.contains(e.target as Node)) {
        setIsApprovalDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsApprovalDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isApprovalDropdownOpen]);

  // 1. Master persistent state for all transactions (Single Source of Truth)
  const [allTransactions, setAllTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. Local table filtering & sorting state (Primary Status & Category Filter)
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isDateFilterActive, setIsDateFilterActive] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);

  // Exclusive Circulation Librarian Privileges Check
  const isCirculationLibrarian = useMemo(() => {
    if (!user) return false;
    const role = (user.role || "").toLowerCase();
    const subRole = (user.subRole || "").toLowerCase();
    const name = (user.name || "").toLowerCase();

    // Circulation Librarian or Administrator with full privileges
    if (role.includes("admin")) return true;
    if (subRole.includes("circulation") || role.includes("circulation")) return true;
    if (name.includes("jan dale")) return true;
    return false;
  }, [user]);

  // Circulation toggle: "all" vs "distributed" (exclusive to Circulation Librarian)
  const [circulationToggle, setCirculationToggle] = useState<"all" | "distributed">("all");

  // Non-circulation librarians are strictly restricted to distributed transactions
  const effectiveScope: "all" | "distributed" = isCirculationLibrarian ? circulationToggle : "distributed";

  // Helper: check if a transaction was distributed to or handled by the target librarian
  const isDistributedToUser = useCallback((txn: TransactionRecord, targetUser: any) => {
    if (!targetUser) return false;
    const targetId = String(targetUser.id || "");
    const targetName = (targetUser.name || "").trim().toLowerCase();

    const assignedId = txn.assignedTo ? String(txn.assignedTo) : "";
    const assignedName = (txn.assignedLibrarianName || "").trim().toLowerCase();
    const decidedId = (txn as any).decidedBy ? String((txn as any).decidedBy) : "";
    const approvedName = (txn.approvedByName || "").trim().toLowerCase();

    const matchesId = Boolean(targetId && (assignedId === targetId || decidedId === targetId));
    const matchesName = Boolean(
      targetName &&
      (
        assignedName === targetName ||
        approvedName === targetName ||
        (assignedName && targetName.includes(assignedName)) ||
        (assignedName && assignedName.includes(targetName)) ||
        (approvedName && targetName.includes(approvedName)) ||
        (approvedName && approvedName.includes(targetName))
      )
    );

    return matchesId || matchesName;
  }, []);

  // Compute transactions distributed to the current librarian
  const distributedTransactionsCount = useMemo(() => {
    if (!user) return 0;
    const rawList = Array.isArray(allTransactions) ? allTransactions : [];
    return rawList.filter((t) => isDistributedToUser(t, user)).length;
  }, [allTransactions, user, isDistributedToUser]);

  // Scoped transaction set based on role and active toggle
  const scopedTransactions = useMemo(() => {
    const rawList = Array.isArray(allTransactions) ? allTransactions : [];
    const seen = new Set<string>();
    const list: TransactionRecord[] = [];
    for (const t of rawList) {
      if (t.id && !seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    }

    if (effectiveScope === "distributed") {
      return list.filter((t) => isDistributedToUser(t, user));
    }

    return list;
  }, [allTransactions, effectiveScope, user, isDistributedToUser]);

  // 3. Interactive Student Library Card Modal State
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<{
    name: string;
    studentId: string;
    department?: string;
    course?: string;
    qrCode?: string;
  } | null>(null);

  // 4. Interactive Book Detail Modal State
  const [selectedBookForModal, setSelectedBookForModal] = useState<BookDetailPayload | null>(null);

  // 5. Interactive Confirmation Pop-up Page State (replaces window.confirm)
  const [confirmModalData, setConfirmModalData] = useState<{
    id: string;
    nextStatus: "Approved" | "Declined";
    transaction: TransactionRecord;
  } | null>(null);
  const [declineComment, setDeclineComment] = useState("");
  const [enlargedModalImage, setEnlargedModalImage] = useState<string | null>(null);

  // Auto-fetch full student ID image on-demand if missing from transaction summary
  useEffect(() => {
    if (!confirmModalData?.transaction) return;
    const tx = confirmModalData.transaction;
    const existingImg = tx.studentIdImage || (tx as any).student_id_image;
    if (!existingImg) {
      let isMounted = true;
      fetch(`/api/transactions/${tx.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted || !data?.transaction) return;
          const fullImg = data.transaction.studentIdImage || data.transaction.student_id_image;
          if (fullImg) {
            setConfirmModalData((prev) => {
              if (!prev || prev.transaction.id !== tx.id) return prev;
              return {
                ...prev,
                transaction: {
                  ...prev.transaction,
                  studentIdImage: fullImg,
                },
              };
            });
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [confirmModalData?.transaction?.id]);

  const handleOpenBookModal = async (txn: TransactionRecord) => {
    // 1. Initial immediate payload so modal opens with zero delay
    const initialPayload: BookDetailPayload = {
      id: (txn as any).bookId || txn.id,
      title: txn.resourceTitle || "Book",
      author: (txn as any).author || "Library Catalog",
      isbn: txn.isbn || "",
      department: txn.department || "Circulation",
      availability: txn.status === "Approved" ? "Unavailable" : "Available",
      copies: 1,
    };
    setSelectedBookForModal(initialPayload);

    // 2. Fetch complete book record asynchronously from catalog / records API
    try {
      const searchTerm = txn.isbn || txn.resourceTitle;
      if (searchTerm) {
        const res = await fetch(`/api/records?search=${encodeURIComponent(searchTerm)}`);
        if (res.ok) {
          const data = await res.json();
          const books = Array.isArray(data.books) ? data.books : [];
          const clean = (s?: string) => (s ? String(s).replace(/[-\s]/g, "").toLowerCase().trim() : "");
          const found = books.find((b: any) => 
            (txn.isbn && b.isbn && clean(b.isbn) === clean(txn.isbn)) ||
            (b.title && b.title.toLowerCase().trim() === txn.resourceTitle?.toLowerCase().trim())
          ) || books[0];

          if (found) {
            setSelectedBookForModal({
              id: found.id || initialPayload.id,
              title: found.title || initialPayload.title,
              author: found.author || initialPayload.author,
              isbn: found.isbn || initialPayload.isbn,
              department: found.department || initialPayload.department,
              shelfLocation: found.shelfLocation || found.shelf,
              callNumber: found.callNumber || found.shelfLocation,
              genres: found.genres,
              category: found.category,
              availability: found.availability || initialPayload.availability,
              publicationDate: found.publishedDate || found.publicationDate,
              publishedDate: found.publishedDate,
              volume: found.volume,
              edition: found.edition,
              summary: found.summary,
              copies: found.copies || 1,
              accessionNumber: found.accessionNumber,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch full book details for modal:", err);
    }
  };

  // Deep-linking highlight parameter from URL
  useEffect(() => {
    const highlightParam = searchParams.get("highlight") || searchParams.get("id");
    if (highlightParam) {
      setHighlightedId(highlightParam);
    }
  }, [searchParams]);

  // Ensure selected date is automatically set to today on mount, with filter inactive so all transactions show initially
  useEffect(() => {
    setSelectedDate("");
    setIsDateFilterActive(false);
  }, []);

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

  // Escape key handler for confirmation pop-up modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && confirmModalData) {
        setConfirmModalData(null);
    setDeclineComment("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModalData]);

  /* ── Master Data Fetching & Optimistic Merge Protection ──────────────── */

  // Tracks transactions currently undergoing optimistic mutations to protect them from stale re-fetch overwrites
  const inFlightMutationsRef = useRef<Set<string>>(new Set());

  // Debounce timer for loadAllTransactions to coalesce rapid socket events into a single safe refresh
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadAllTransactions = useCallback(async () => {
    void fetchLibrarianApprovalStats();
    try {
      // Always request the comprehensive list (status=All) to maintain global counters
      const res = await fetch("/api/transactions?status=All&type=All");
      if (!res.ok) {
        throw new Error(`Failed to load transactions: HTTP ${res.status}`);
      }
      const payload = await res.json();
      const rawList = Array.isArray(payload?.transactions)
        ? payload.transactions
        : Array.isArray(payload)
        ? payload
        : [];
      const list: TransactionRecord[] = rawList
        .map((row: any) => ({
          ...row,
          studentName: row.studentName || row.student_name || "Student",
          studentId: row.studentId || row.student_id || "N/A",
          resourceTitle: row.resourceTitle || row.resource_title || row.title || "Book",
          isbn: row.isbn || "N/A",
          type: (String(row.type || "").toLowerCase() === "reservation" ? "Reservation" : "Borrow") as TransactionType,
          studentIdImage: row.studentIdImage || row.student_id_image || null,
          pickedUpAt: row.pickedUpAt || row.picked_up_at || null,
          isPickedUp: Boolean(row.pickedUpAt || row.picked_up_at || row.isPickedUp),
        }))
        .filter(
          (row: TransactionRecord) =>
            !(
              (row.studentName === "Student" || !row.studentName) &&
              (row.studentId === "N/A" || !row.studentId) &&
              (row.resourceTitle === "Book" || !row.resourceTitle)
            )
        );

      startTransition(() => {
        setAllTransactions((prev) => {
          if (!prev || prev.length === 0) return list;

          const prevMap = new Map(prev.map((p) => [p.id, p]));
          const serverIdSet = new Set(list.map((s) => s.id));

          const merged = list.map((serverItem) => {
            const localItem =
              prevMap.get(serverItem.id) ||
              (inFlightMutationsRef.current.size > 0
                ? prev.find(
                    (p) =>
                      inFlightMutationsRef.current.has(p.id) &&
                      ((p.isbn && serverItem.isbn && p.isbn === serverItem.isbn) ||
                        (p.resourceTitle &&
                          serverItem.resourceTitle &&
                          p.resourceTitle.toLowerCase().trim() ===
                            serverItem.resourceTitle.toLowerCase().trim())) &&
                      (p.studentId === serverItem.studentId ||
                        p.studentName === serverItem.studentName)
                  )
                : null);

            if (!localItem) return serverItem;

            // 1. If this item has an in-flight mutation in progress, strictly preserve its optimistic state
            if (
              inFlightMutationsRef.current.has(localItem.id) ||
              inFlightMutationsRef.current.has(serverItem.id)
            ) {
              return {
                ...serverItem,
                status: localItem.status,
                type: localItem.type,
                pickedUpAt: localItem.pickedUpAt,
                isPickedUp: localItem.isPickedUp,
                dueDate: localItem.dueDate,
                availableAt: localItem.availableAt,
                expiresAt: localItem.expiresAt,
                comment: localItem.comment || serverItem.comment,
                updatedAt: localItem.updatedAt,
              };
            }

            // 2. If this item was recently mutated locally (within 4 seconds), prevent stale database read lag from reverting it
            const localUpdateTime = localItem.updatedAt
              ? new Date(localItem.updatedAt).getTime()
              : 0;
            const isRecentlyMutated = Date.now() - localUpdateTime < 4000;
            if (isRecentlyMutated) {
              const serverPromotedToBorrow =
                localItem.type === "Reservation" && serverItem.type === "Borrow";
              return {
                ...serverItem,
                status: localItem.status,
                type: serverPromotedToBorrow ? "Borrow" : localItem.type,
                pickedUpAt: localItem.pickedUpAt || serverItem.pickedUpAt,
                isPickedUp: localItem.isPickedUp || serverItem.isPickedUp,
                dueDate: serverPromotedToBorrow
                  ? serverItem.dueDate || localItem.dueDate
                  : localItem.dueDate || serverItem.dueDate,
                availableAt: serverPromotedToBorrow
                  ? serverItem.availableAt || localItem.availableAt
                  : localItem.availableAt || serverItem.availableAt,
                expiresAt: serverPromotedToBorrow
                  ? serverItem.expiresAt || localItem.expiresAt
                  : localItem.expiresAt || serverItem.expiresAt,
                updatedAt: localItem.updatedAt,
              };
            }

            return serverItem;
          });

          // Also keep any local temporary items that are in-flight and not yet reflected in list
          const pendingLocals = prev.filter(
            (p) =>
              inFlightMutationsRef.current.has(p.id) &&
              !serverIdSet.has(p.id) &&
              !list.some(
                (s) =>
                  ((s.isbn && p.isbn && s.isbn === p.isbn) ||
                    (s.resourceTitle &&
                      p.resourceTitle &&
                      s.resourceTitle.toLowerCase().trim() ===
                        p.resourceTitle.toLowerCase().trim())) &&
                  (s.studentId === p.studentId || s.studentName === p.studentName)
              )
          );

          // Strictly deduplicate by ID to guarantee unique React keys
          const uniqueMap = new Map<string, TransactionRecord>();
          for (const item of [...pendingLocals, ...merged]) {
            if (item && item.id) {
              const existing = uniqueMap.get(item.id);
              if (!existing) {
                uniqueMap.set(item.id, item);
              } else {
                uniqueMap.set(item.id, { ...existing, ...item });
              }
            }
          }

          return Array.from(uniqueMap.values());
        });
        setIsLoading(false);
      });
      return true;
    } catch (err) {
      console.warn("Failed to fetch transactions:", err);
      return false;
    }
  }, [fetchLibrarianApprovalStats]);

  const scheduleReloadTransactions = useCallback((delay = 400) => {
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
    }
    reloadTimeoutRef.current = setTimeout(() => {
      void loadAllTransactions();
    }, delay);
  }, [loadAllTransactions]);

  /* ── Global Decoupled Summary Metrics (5 Metric Cards) ────────────────── */

  // These counters are derived from the active scopedTransactions (All for circulation librarian, Distributed for others).
  // They are completely decoupled from local search/status filters and maintain strict boundary isolation.
  const globalCounts = useMemo(() => {
    const list = scopedTransactions;
    return {
      pending:      list.filter((t) => t.status === "Pending").length,
      approved:     list.filter((t) => t.status === "Approved").length,
      declined:     list.filter(isDeclinedRecord).length,
      returned:     list.filter(isReturnedBorrow).length,
      reservations: list.filter(isActiveReservation).length,
      cancelled:    list.filter(isCancelledRecord).length,
      total:        list.length,
    };
  }, [scopedTransactions]);

  /* ── Derived Filtered Table Dataset (Strict Boundary Isolation) ──────── */

  // Local table view is computed dynamically in-memory with strict queue segregation.
  const filteredTransactions = useMemo(() => {
    let result = scopedTransactions;

    // 1. Strict Status & Type Boundary Filtering
    switch (status) {
      case "Pending":
        // All pending borrow and reservation requests awaiting librarian decision
        result = result.filter((t) => t.status === "Pending");
        break;
      case "Approved":
        // All approved transactions
        result = result.filter((t) => t.status === "Approved");
        break;
      case "Due":
        // Strictly active borrows where book is due to return or overdue
        result = result.filter(
          (t) =>
            Boolean(t.dueDate && isDueToReturn(t.dueDate)) &&
            t.status !== "Returned" &&
            t.status !== "Declined" &&
            t.status !== "Cancelled"
        );
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
        result = scopedTransactions;
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
          (t.isbn || "").toLowerCase().includes(q) ||
          (t.department || "").toLowerCase().includes(q) ||
          formatCourseShortcut(t.department || (t as any).course || (t as any).userDepartment).toLowerCase().includes(q)
      );
    }

        // 3. Date Filter: If a date is picked, show all transactions created or requested on that specific date
    if (selectedDate) {
      const selParsed = parseDateOnly(selectedDate);
      if (selParsed) {
        result = result.filter((t) => {
          const candidateDates = [
            t.requestedAt,
            (t as any).createdAt,
            (t as any).requested_at,
            (t as any).created_at,
            (t as any).borrowDate,
            (t as any).borrow_date,
            (t as any).date,
          ];
          return candidateDates.some((c) => {
            if (!c) return false;
            const p = parseDateOnly(c);
            if (!p) return false;
            return p.year === selParsed.year && p.month === selParsed.month && p.day === selParsed.day;
          });
        });
      }
    }

    // 4. Sorting
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
  }, [scopedTransactions, status, deferredSearch, isDateFilterActive, selectedDate, sortBy, sortDir]);

  /* ── Real-Time Synchronization & Polling Lifecycle ────────────────────── */

  useEffect(() => {
    // Initial fetch
    void loadAllTransactions();

    // 1. Real-time WebSocket Listeners
    const unsubscribeBorrow = dashboardSocket.subscribeToBorrowRequest((rawData: any) => {
      if (rawData) {
        const data =
          rawData?.payload && typeof rawData.payload === "object"
            ? { ...rawData, ...rawData.payload }
            : rawData;

        const hasRealStudent =
          Boolean(data?.studentName && data.studentName !== "Student") ||
          Boolean(data?.studentId && data.studentId !== "N/A");
        const hasRealBook =
          Boolean(data?.resourceTitle && data.resourceTitle !== "Book") ||
          Boolean(data?.title && data.title !== "Book") ||
          Boolean(data?.isbn && data.isbn !== "N/A");

        // Ignore malformed/wrapped ghost socket events that lack student and book details
        if (!hasRealStudent && !hasRealBook) {
          scheduleReloadTransactions(400);
          return;
        }

        const rawTypeStr = String(data.type || data.action || "Borrow").toLowerCase();
        const isReservation = rawTypeStr === "reservation" || rawTypeStr === "reserve";
        const normalizedType: TransactionType = isReservation ? "Reservation" : "Borrow";
        const title = data.resourceTitle || data.title || "Book";
        const student = data.studentName || "A student";

        const isDistributedToMe = isDistributedToUser(data as any, user);
        if (isCirculationLibrarian || isDistributedToMe) {
          notify(
            `${student} submitted a ${isReservation ? "reservation hold" : "borrow request"} for "${title}".`,
            "info"
          );
        }

        // Optimistically ingest or update new incoming item in master dataset
        setAllTransactions((prev) => {
          const rawId = data.transactionId || data.id || `txn-${Date.now()}`;
          const existing = prev.find(
            (t) =>
              t.id === rawId ||
              t.id === data.id ||
              t.id === data.transactionId ||
              (((data.isbn && data.isbn !== "N/A" && t.isbn === data.isbn) ||
                (title && t.resourceTitle?.toLowerCase().trim() === title.toLowerCase().trim())) &&
                (t.studentId === data.studentId || t.studentName === data.studentName))
          );
          // If an item for this book/student is already in the dataset and is not Pending (e.g. already Approved/Returned),
          // DO NOT recreate a duplicate Pending item!
          if (existing && existing.status !== "Pending") {
            return prev;
          }
          const isExistingUuid = Boolean(
            existing?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing.id)
          );
          const isIncomingUuid = Boolean(
            rawId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rawId))
          );
          const resolvedId = isIncomingUuid ? String(rawId) : isExistingUuid ? existing!.id : String(rawId);

          const newTxn: TransactionRecord = {
            id: resolvedId,
            studentName:
              (data.studentName && data.studentName !== "Student" ? data.studentName : null) ||
              existing?.studentName ||
              "Student",
            studentId:
              (data.studentId && data.studentId !== "N/A" ? data.studentId : null) ||
              existing?.studentId ||
              "N/A",
            resourceTitle:
              (data.resourceTitle && data.resourceTitle !== "Book" ? data.resourceTitle : null) ||
              (data.title && data.title !== "Book" ? data.title : null) ||
              existing?.resourceTitle ||
              "Book",
            isbn:
              (data.isbn && data.isbn !== "N/A" ? data.isbn : null) ||
              existing?.isbn ||
              "N/A",
            type: normalizedType,
            status: data.status || existing?.status || "Pending",
            requestedAt: data.requestedAt || existing?.requestedAt || new Date().toISOString(),
            dueDate: data.dueDate || existing?.dueDate,
            department: data.department || existing?.department || "Circulation",
            durationDays: data.durationDays || existing?.durationDays || 7,
            queuePosition: data.queuePosition ?? existing?.queuePosition,
            availableAt: data.availableAt ?? existing?.availableAt,
            expiresAt: data.expiresAt ?? existing?.expiresAt,
            pickedUpAt: data.pickedUpAt || existing?.pickedUpAt || null,
            isPickedUp: Boolean(data.isPickedUp || existing?.isPickedUp),
            studentIdImage: data.studentIdImage || data.student_id_image || existing?.studentIdImage || null,
          };

          if (existing) {
            return prev.map((t) =>
              t.id === existing.id || t.id === rawId || t.id === data.id ? { ...t, ...newTxn } : t
            );
          }
          return [newTxn, ...prev];
        });

        scheduleReloadTransactions(600);
      }
    });

    const unsubscribeReturn = dashboardSocket.subscribeToReturn((data: any) => {
      if (data?.id || data?.transactionId) {
        const rawId = data.id || data.transactionId;
        const now = data.returnedAt || data.decidedAt || new Date().toISOString();
        const bookTitle = data.resourceTitle || data.title || "";
        const promotedTx = data.promotedTransaction;

        startTransition(() => {
          setAllTransactions((prev) => {
            let hasPromotedLocally = false;
            return prev.map((t) => {
              if (t.id === rawId || t.id === data.id || t.id === data.transactionId) {
                return {
                  ...t,
                  status: "Returned" as TransactionStatus,
                  type: "Borrow" as TransactionType,
                  returnedAt: now,
                  updatedAt: now,
                };
              }

              const isTargetPromoted = promotedTx && String(t.id) === String(promotedTx.id);
              const isMatchByBook =
                !hasPromotedLocally &&
                t.type === "Reservation" &&
                t.status === "Approved" &&
                ((t.isbn && (t.isbn === data.isbn || t.isbn === promotedTx?.isbn)) ||
                 (bookTitle && t.resourceTitle && t.resourceTitle.toLowerCase().trim() === bookTitle.toLowerCase().trim()));

              if (isTargetPromoted || isMatchByBook) {
                hasPromotedLocally = true;
                return {
                  ...t,
                  ...(promotedTx || {}),
                  id: promotedTx?.id || t.id,
                  studentName: promotedTx?.studentName || t.studentName,
                  studentId: promotedTx?.studentId || t.studentId,
                  resourceTitle: promotedTx?.resourceTitle || t.resourceTitle,
                  type: "Borrow" as TransactionType,
                  status: "Approved" as TransactionStatus,
                  availableAt: now,
                  expiresAt: promotedTx?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  dueDate: promotedTx?.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  pickedUpAt: null,
                  isPickedUp: false,
                  comment: "Automatically converted from reservation to active borrow upon previous copy return. 24-hour pickup window started.",
                  updatedAt: now,
                };
              }

              return t;
            });
          });
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("transaction-updated", { detail: { id: rawId, status: "Returned" } })
          );
        }

        const isDistributedToMe = isDistributedToUser(data as any, user);
        if (isCirculationLibrarian || isDistributedToMe) {
          notify(
            `Item "${data.resourceTitle || data.title || "Book"}" marked as Returned in real-time.`,
            "success"
          );
        }

        scheduleReloadTransactions(600);
      }
    });

    const unsubscribeCancel = dashboardSocket.subscribeToCancelRequest((data: any) => {
      if (data) {
        setAllTransactions((prev) =>
          prev.map((t) =>
            t.id === data.id || t.id === data.transactionId ? { ...t, status: "Cancelled", updatedAt: new Date().toISOString() } : t
          )
        );

        scheduleReloadTransactions(600);
      }
    });

    const unsubscribeNotification = dashboardSocket.subscribeToNotification((data: any) => {
      if (data?.id || data?.transactionId || data?.isbn || data?.studentId) {
        const rawId = data.id || data.transactionId;
        const now = new Date().toISOString();
        setAllTransactions((prev) =>
          prev.map((t) => {
            const isMatch =
              (rawId && (t.id === rawId || t.id === data.id || t.id === data.transactionId)) ||
              (Boolean(t.isbn && data.isbn && t.isbn === data.isbn) &&
               Boolean(t.studentId === data.studentId || t.studentName === data.studentName));
            if (!isMatch) return t;

            const isPicked = Boolean(data.isPickedUp || data.pickedUpAt);
            return {
              ...t,
              status: isPicked ? "Approved" : ((data.status as TransactionStatus) || t.status),
              pickedUpAt: data.pickedUpAt ?? (isPicked ? now : t.pickedUpAt),
              isPickedUp: Boolean(isPicked || t.isPickedUp),
              dueDate: data.dueDate || t.dueDate,
              updatedAt: data.updatedAt || now,
            };
          })
        );
      }
      scheduleReloadTransactions(300);
    });

    const unsubscribeUserMutation = dashboardSocket.subscribeToUserMutation(() => {
      scheduleReloadTransactions(100);
      fetchLibrarianApprovalStats();
    });

    const handlePermissionsUpdated = () => {
      scheduleReloadTransactions(100);
      fetchLibrarianApprovalStats();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("permissions:updated", handlePermissionsUpdated);
      window.addEventListener("transaction:updated", handlePermissionsUpdated);
      window.addEventListener("user:updated", handlePermissionsUpdated);
    }

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
      // If there are in-flight user mutations, postpone polling to prevent overwriting optimistic state
      if (inFlightMutationsRef.current.size > 0) {
        timeoutId = setTimeout(poll, currentInterval);
        return;
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
        scheduleReloadTransactions(200);
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
      if (typeof window !== "undefined") {
        window.removeEventListener("permissions:updated", handlePermissionsUpdated);
        window.removeEventListener("transaction:updated", handlePermissionsUpdated);
        window.removeEventListener("user:updated", handlePermissionsUpdated);
      }
      unsubscribeBorrow();
      unsubscribeReturn();
      unsubscribeCancel();
      unsubscribeNotification();
      unsubscribeUserMutation();
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
    async (id: string, record?: TransactionRecord) => {
      // 1. Snapshot previous state for rollback on network failure
      const previousTransactions = allTransactions;
      const targetTxn = record || allTransactions.find((t) => t.id === id);
      const resourceTitle = resolveResourceTitle(targetTxn, "Book");
      const now = new Date().toISOString();

      // Protect this transaction from being overwritten during in-flight network request
      inFlightMutationsRef.current.add(id);
      if (targetTxn?.id) inFlightMutationsRef.current.add(targetTxn.id);

      // 2. Instant Optimistic State Mutation
      startTransition(() => {
        setAllTransactions((prev) =>
          prev.map((t) =>
            t.id === id || (targetTxn && t.id === targetTxn.id)
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
        `Return for resource "${resourceTitle}" completed successfully.`,
        "success"
      );

      // 4. Authoritative Network Mutation
      try {
        let res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Returned",
            type: "Borrow",
            returnedAt: now,
            resourceTitle,
            isbn: targetTxn?.isbn,
            studentId: targetTxn?.studentId,
            studentName: targetTxn?.studentName,
            approverId: user?.id,
            approverName: user?.name || "Jan Dale B. Piansay",
            approverRole: (user as any)?.subRole || (user as any)?.role || "Circulation Librarian",
          }),
        });

        // Resilience: If 404, lookup matching transaction and retry with authoritative ID
        if (res.status === 404) {
          const refreshRes = await fetch("/api/transactions?status=All&type=All");
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const rawList = Array.isArray(data?.transactions) ? data.transactions : Array.isArray(data) ? data : [];
            const matched = rawList.find(
              (t: any) =>
                ((targetTxn?.isbn && t.isbn === targetTxn.isbn) ||
                 (resourceTitle && t.resourceTitle?.toLowerCase().trim() === resourceTitle.toLowerCase().trim())) &&
                (t.studentId === targetTxn?.studentId || t.studentName === targetTxn?.studentName)
            );
            if (matched && matched.id && matched.id !== id) {
              res = await fetch(`/api/transactions/${encodeURIComponent(matched.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: "Returned",
                  type: "Borrow",
                  returnedAt: now,
                  resourceTitle: matched.resourceTitle,
                  isbn: matched.isbn,
                  studentId: matched.studentId,
                  studentName: matched.studentName,
                  approverId: user?.id,
                  approverName: user?.name || "Jan Dale B. Piansay",
                  approverRole: (user as any)?.subRole || (user as any)?.role || "Circulation Librarian",
                }),
              });
            }
          }
        }

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        const serverTx = data?.transaction;
        const promotedTx = data?.promotedTransaction;

        startTransition(() => {
          setAllTransactions((prev) => {
            let hasPromotedLocally = false;
            return prev.map((t) => {
              // 1. Update the returned book record
              if (t.id === id || (serverTx?.id && t.id === serverTx.id)) {
                return {
                  ...t,
                  ...serverTx,
                  id: serverTx?.id || id,
                  studentName:
                    (serverTx?.studentName && serverTx.studentName !== "Student" ? serverTx.studentName : null) ||
                    serverTx?.student_name ||
                    t.studentName,
                  studentId:
                    (serverTx?.studentId && serverTx.studentId !== "N/A" ? serverTx.studentId : null) ||
                    serverTx?.student_id ||
                    t.studentId,
                  resourceTitle:
                    (serverTx?.resourceTitle && serverTx.resourceTitle !== "Book" ? serverTx.resourceTitle : null) ||
                    serverTx?.resource_title ||
                    t.resourceTitle,
                  isbn:
                    (serverTx?.isbn && serverTx.isbn !== "N/A" ? serverTx.isbn : null) ||
                    t.isbn,
                  status: "Returned" as TransactionStatus,
                  type: "Borrow" as TransactionType,
                  returnedAt: now,
                  updatedAt: now,
                };
              }

              // 2. Automatically transform the first waitlisted reservation for this book into an active Borrow
              const isTargetPromoted = promotedTx && (String(t.id) === String(promotedTx.id));
              const isMatchByBook =
                !hasPromotedLocally &&
                t.type === "Reservation" &&
                t.status === "Approved" &&
                ((t.isbn && (t.isbn === targetTxn?.isbn || t.isbn === serverTx?.isbn)) ||
                 (t.resourceTitle && t.resourceTitle.toLowerCase().trim() === resourceTitle.toLowerCase().trim()));

              if (isTargetPromoted || isMatchByBook) {
                hasPromotedLocally = true;
                return {
                  ...t,
                  ...(promotedTx || {}),
                  id: promotedTx?.id || t.id,
                  studentName: promotedTx?.studentName || t.studentName,
                  studentId: promotedTx?.studentId || t.studentId,
                  resourceTitle: promotedTx?.resourceTitle || t.resourceTitle,
                  type: "Borrow" as TransactionType,
                  status: "Approved" as TransactionStatus,
                  availableAt: now,
                  expiresAt: promotedTx?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  dueDate: promotedTx?.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  pickedUpAt: null,
                  isPickedUp: false,
                  comment: "Automatically converted from reservation to active borrow upon previous copy return. 24-hour pickup window started.",
                  updatedAt: now,
                };
              }

              return t;
            });
          });
        });

        if (promotedTx) {
          notify(
            `Book "${resourceTitle}" returned! Waitlisted reservation for ${promotedTx.studentName} has automatically transformed into an active Borrow! Ready for pickup.`,
            "success"
          );
        }

        // Publish WebSocket event ONLY after successful server commitment
        dashboardSocket.publishBookReturned({
          id: serverTx?.id || id,
          transactionId: serverTx?.id || id,
          status: "Returned",
          type: "Borrow",
          resourceTitle,
          studentId: targetTxn?.studentId,
          studentName: targetTxn?.studentName,
          promotedTransaction: promotedTx,
          returnedAt: now,
        });
      } catch (err) {
        console.error("Failed to process return, rolling back:", err);
        // Rollback state upon failure
        startTransition(() => {
          setAllTransactions(previousTransactions);
        });
        notify(
          `Failed to process return for resource "${resourceTitle}". Changes reverted.`,
          "error"
        );
      } finally {
        inFlightMutationsRef.current.delete(id);
        if (targetTxn?.id) inFlightMutationsRef.current.delete(targetTxn.id);
        scheduleReloadTransactions(800);
      }
    },
    [allTransactions, notify, scheduleReloadTransactions]
  );

  /**
   * General Status Handler (Approve / Decline)
   */
  const handleUpdateStatus = useCallback(
    async (id: string, nextStatus: TransactionStatus, comment?: string, record?: TransactionRecord) => {
      const previousTransactions = allTransactions;
      const targetTxn = record || allTransactions.find((t) => t.id === id);

      // Protect transaction from stale query overwrites while mutation is running
      inFlightMutationsRef.current.add(id);
      if (targetTxn?.id) inFlightMutationsRef.current.add(targetTxn.id);

      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      startTransition(() => {
        setAllTransactions((prev) =>
          prev.map((t) => (t.id === id || (targetTxn && t.id === targetTxn.id) ? {
            ...t,
            status: nextStatus,
            availableAt: nextStatus === "Approved" && t.type !== "Reservation" ? (t.availableAt || now) : t.availableAt,
            expiresAt: nextStatus === "Approved" && t.type !== "Reservation" ? (t.expiresAt || expiresAt) : t.expiresAt,
            pickedUpAt: nextStatus === "Approved" ? (t.pickedUpAt ?? null) : t.pickedUpAt,
            isPickedUp: nextStatus === "Approved" ? Boolean(t.isPickedUp) : t.isPickedUp,
            approvedByName: user?.name || t.approvedByName || "Librarian",
            approvedByRole: (user as any)?.subRole || user?.role || t.approvedByRole || "Librarian",
            comment: comment || t.comment,
            updatedAt: now,
          } : t))
        );
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("transaction-updated", { detail: { id, status: nextStatus } })
        );
      }

      const resourceTitle = resolveResourceTitle(targetTxn, "Resource");
      const actionLabel =
        nextStatus === "Approved"
          ? "Approval"
          : nextStatus === "Declined"
          ? "Decline"
          : `${nextStatus} update`;

      notify(
        `${actionLabel} for resource "${resourceTitle}" completed successfully.`,
        "success"
      );

      try {
        let res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            comment,
            resourceTitle,
            isbn: targetTxn?.isbn,
            studentId: targetTxn?.studentId,
            studentName: targetTxn?.studentName,
            type: targetTxn?.type,
            approverId: user?.id,
            approverName: user?.name || "Jan Dale B. Piansay",
            approverRole: (user as any)?.subRole || (user as any)?.role || "Circulation Librarian",
          }),
        });

        // Resilience: If 404, the local ID might be a temporary socket ID.
        // Reload transactions to find the authoritative DB transaction matching this record and retry.
        if (res.status === 404) {
          console.warn(`Transaction ${id} returned 404. Attempting lookup with refreshed transactions...`);
          const refreshRes = await fetch("/api/transactions?status=All&type=All");
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const rawList = Array.isArray(data?.transactions) ? data.transactions : Array.isArray(data) ? data : [];
            const matched = rawList.find(
              (t: any) =>
                (t.status === "Pending" || t.status === nextStatus) &&
                ((targetTxn?.isbn && t.isbn === targetTxn.isbn) ||
                 (resourceTitle && t.resourceTitle?.toLowerCase().trim() === resourceTitle.toLowerCase().trim())) &&
                (t.studentId === targetTxn?.studentId || t.studentName === targetTxn?.studentName)
            );
            if (matched && matched.id && matched.id !== id) {
              res = await fetch(`/api/transactions/${encodeURIComponent(matched.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: nextStatus,
                  comment,
                  resourceTitle: matched.resourceTitle,
                  isbn: matched.isbn,
                  studentId: matched.studentId,
                  studentName: matched.studentName,
                  type: matched.type,
                  approverId: user?.id,
                  approverName: user?.name || "Jan Dale B. Piansay",
                  approverRole: (user as any)?.subRole || (user as any)?.role || "Circulation Librarian",
                }),
              });
            }
          }
        }

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        const serverTx = data?.transaction?.transaction || data?.transaction || data;
        const finalId = serverTx?.id || id;
        startTransition(() => {
          setAllTransactions((prev) =>
            prev.map((t) =>
              t.id === id || (targetTxn && t.id === targetTxn.id) || (serverTx?.id && t.id === serverTx.id)
                ? {
                    ...t,
                    ...(serverTx && typeof serverTx === "object" ? serverTx : {}),
                    id: finalId,
                    studentName:
                      (serverTx?.studentName && serverTx.studentName !== "Student" ? serverTx.studentName : null) ||
                      serverTx?.student_name ||
                      t.studentName,
                    studentId:
                      (serverTx?.studentId && serverTx.studentId !== "N/A" ? serverTx.studentId : null) ||
                      serverTx?.student_id ||
                      t.studentId,
                    resourceTitle:
                      (serverTx?.resourceTitle && serverTx.resourceTitle !== "Book" ? serverTx.resourceTitle : null) ||
                      serverTx?.resource_title ||
                      t.resourceTitle,
                    isbn:
                      (serverTx?.isbn && serverTx.isbn !== "N/A" ? serverTx.isbn : null) ||
                      t.isbn,
                    type:
                      String(serverTx?.type || t.type || "").toLowerCase() === "reservation"
                        ? "Reservation"
                        : "Borrow",
                    status: serverTx?.status || nextStatus,
                    availableAt: serverTx?.availableAt ?? serverTx?.available_at ?? t.availableAt,
                    expiresAt: serverTx?.expiresAt ?? serverTx?.expires_at ?? t.expiresAt,
                    dueDate: serverTx?.dueDate || serverTx?.due_date || t.dueDate,
                    comment: serverTx?.comment ?? comment ?? t.comment,
                    updatedAt: now,
                  }
                : t
            )
          );
        });

        try {
          dashboardSocket.publishTransactionDecided({
            id: serverTx?.id || id,
            status: nextStatus,
            comment: serverTx?.comment || comment,
            resourceTitle,
            isbn: targetTxn?.isbn,
            studentId: targetTxn?.studentId,
            studentName: targetTxn?.studentName,
            type: targetTxn?.type || (nextStatus === "Approved" ? "Borrow" : undefined),
            dueDate: serverTx?.dueDate || (nextStatus === "Approved" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined),
          });
        } catch (sockErr) {
          console.warn("Failed to emit socket transaction:decided:", sockErr);
        }
      } catch (err) {
        console.error(`Failed to update status to ${nextStatus}, rolling back:`, err);
        startTransition(() => {
          setAllTransactions(previousTransactions);
        });
        notify(`Failed to process ${actionLabel.toLowerCase()} for resource "${resourceTitle}". Changes reverted.`, "error");
      } finally {
        inFlightMutationsRef.current.delete(id);
        if (targetTxn?.id) inFlightMutationsRef.current.delete(targetTxn.id);
        scheduleReloadTransactions(800);
      }
    },
    [allTransactions, notify, scheduleReloadTransactions]
  );

  const handleConfirmDecision = async () => {
    if (!confirmModalData) return;
    const { id, nextStatus, transaction } = confirmModalData;
    const comment = nextStatus === "Declined" && declineComment.trim() ? declineComment.trim() : undefined;
    setConfirmModalData(null);
    setDeclineComment("");
    await handleUpdateStatus(id, nextStatus, comment, transaction);
  };

  /**
   * Convert Reservation directly to Approved Borrow
   */
  const handleConvertToBorrow = useCallback(
    async (id: string, record?: TransactionRecord) => {
      const previousTransactions = allTransactions;
      const targetTxn = record || allTransactions.find((t) => t.id === id);
      const resourceTitle = resolveResourceTitle(targetTxn, "Resource");
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      inFlightMutationsRef.current.add(id);
      if (targetTxn?.id) inFlightMutationsRef.current.add(targetTxn.id);

      startTransition(() => {
        setAllTransactions((prev) =>
          prev.map((t) =>
            t.id === id || (targetTxn && t.id === targetTxn.id)
              ? {
                  ...t,
                  type: "Borrow" as TransactionType,
                  status: "Approved" as TransactionStatus,
                  dueDate,
                  availableAt: now,
                  expiresAt,
                  pickedUpAt: null,
                  isPickedUp: false,
                  updatedAt: now,
                }
              : t
          )
        );
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("transaction-updated", { detail: { id, status: "Approved", type: "Borrow" } })
        );
      }

      notify(
        `Reservation conversion for resource "${resourceTitle}" completed successfully.`,
        "success"
      );

      try {
        let res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "Borrow",
            status: "Approved",
            dueDate,
            resourceTitle,
            isbn: targetTxn?.isbn,
            studentId: targetTxn?.studentId,
            studentName: targetTxn?.studentName,
            approverId: user?.id,
            approverName: user?.name || "Jan Dale B. Piansay",
            approverRole: (user as any)?.subRole || (user as any)?.role || "Circulation Librarian",
          }),
        });

        // Resilience: If 404, lookup matching transaction and retry with authoritative ID
        if (res.status === 404) {
          const refreshRes = await fetch("/api/transactions?status=All&type=All");
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const rawList = Array.isArray(data?.transactions) ? data.transactions : Array.isArray(data) ? data : [];
            const matched = rawList.find(
              (t: any) =>
                ((targetTxn?.isbn && t.isbn === targetTxn.isbn) ||
                 (resourceTitle && t.resourceTitle?.toLowerCase().trim() === resourceTitle.toLowerCase().trim())) &&
                (t.studentId === targetTxn?.studentId || t.studentName === targetTxn?.studentName)
            );
            if (matched && matched.id && matched.id !== id) {
              res = await fetch(`/api/transactions/${encodeURIComponent(matched.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "Borrow",
                  status: "Approved",
                  dueDate,
                  resourceTitle: matched.resourceTitle,
                  isbn: matched.isbn,
                  studentId: matched.studentId,
                  studentName: matched.studentName,
                  approverId: user?.id,
                  approverName: user?.name || "Jan Dale B. Piansay",
                  approverRole: (user as any)?.subRole || (user as any)?.role || "Circulation Librarian",
                }),
              });
            }
          }
        }

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        const serverTx = data?.transaction;
        if (serverTx?.id) {
          startTransition(() => {
            setAllTransactions((prev) =>
              prev.map((t) =>
                t.id === id || t.id === serverTx.id
                  ? {
                      ...t,
                      ...serverTx,
                      id: serverTx.id,
                      studentName:
                        (serverTx.studentName && serverTx.studentName !== "Student" ? serverTx.studentName : null) ||
                        serverTx.student_name ||
                        t.studentName,
                      studentId:
                        (serverTx.studentId && serverTx.studentId !== "N/A" ? serverTx.studentId : null) ||
                        serverTx.student_id ||
                        t.studentId,
                      resourceTitle:
                        (serverTx.resourceTitle && serverTx.resourceTitle !== "Book" ? serverTx.resourceTitle : null) ||
                        serverTx.resource_title ||
                        t.resourceTitle,
                      isbn:
                        (serverTx.isbn && serverTx.isbn !== "N/A" ? serverTx.isbn : null) ||
                        t.isbn,
                      type: "Borrow" as TransactionType,
                      status: "Approved" as TransactionStatus,
                      updatedAt: now,
                    }
                  : t
              )
            );
          });
        }

        try {
          dashboardSocket.publishTransactionDecided({
            id: serverTx?.id || id,
            status: "Approved",
            type: "Borrow",
            resourceTitle,
            isbn: targetTxn?.isbn,
            studentId: targetTxn?.studentId,
            studentName: targetTxn?.studentName,
            dueDate,
          });
        } catch (sockErr) {
          console.warn("Failed to emit socket transaction:decided on convert:", sockErr);
        }
      } catch (err) {
        console.error("Failed to convert reservation to borrow, rolling back:", err);
        startTransition(() => {
          setAllTransactions(previousTransactions);
        });
        notify(`Failed to convert reservation for resource "${resourceTitle}". Changes reverted.`, "error");
      } finally {
        inFlightMutationsRef.current.delete(id);
        if (targetTxn?.id) inFlightMutationsRef.current.delete(targetTxn.id);
        scheduleReloadTransactions(800);
      }
    },
    [allTransactions, notify, scheduleReloadTransactions]
  );

  /**
   * Pickup Workflow
   * Records book collection by student, transitions borrow status to Picked Up,
   * activates 7-day borrow period, changes action button to Returned, and alerts student in real time.
   */
  const handlePickupBook = useCallback(
    async (id: string, record?: TransactionRecord) => {
      const previousTransactions = allTransactions;
      const targetTxn = record || allTransactions.find((t) => t.id === id);
      const resourceTitle = resolveResourceTitle(record || targetTxn, "Book");
      const now = new Date().toISOString();
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      inFlightMutationsRef.current.add(id);
      if (targetTxn?.id) inFlightMutationsRef.current.add(targetTxn.id);

      startTransition(() => {
        setAllTransactions((prev) =>
          prev.map((t) =>
            t.id === id || (targetTxn && t.id === targetTxn.id)
              ? {
                  ...t,
                  pickedUpAt: now,
                  isPickedUp: true,
                  dueDate,
                  updatedAt: now,
                }
              : t
          )
        );
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("transaction-updated", {
            detail: { id, status: "Approved", isPickedUp: true, pickedUpAt: now },
          })
        );
      }

      notify(
        `Pickup for resource "${resourceTitle}" completed successfully.`,
        "success"
      );

      try {
        let res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pickup",
            pickedUp: true,
            pickedUpAt: now,
            dueDate,
            resourceTitle,
            isbn: targetTxn?.isbn,
            studentId: targetTxn?.studentId,
            studentName: targetTxn?.studentName,
            approverId: user?.id,
            approverName: user?.name || "Jan Dale B. Piansay",
            approverRole: (user as any)?.subRole || (user as any)?.role || "Circulation Librarian",
          }),
        });

        // Resilience: If 404, lookup matching transaction and retry with authoritative ID
        if (res.status === 404) {
          const refreshRes = await fetch("/api/transactions?status=All&type=All");
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const rawList = Array.isArray(data?.transactions) ? data.transactions : Array.isArray(data) ? data : [];
            const matched = rawList.find(
              (t: any) =>
                ((targetTxn?.isbn && t.isbn === targetTxn.isbn) ||
                 (resourceTitle && t.resourceTitle?.toLowerCase().trim() === resourceTitle.toLowerCase().trim())) &&
                (t.studentId === targetTxn?.studentId || t.studentName === targetTxn?.studentName)
            );
            if (matched && matched.id && matched.id !== id) {
              res = await fetch(`/api/transactions/${encodeURIComponent(matched.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "pickup",
                  pickedUp: true,
                  pickedUpAt: now,
                  dueDate,
                  resourceTitle: matched.resourceTitle,
                  isbn: matched.isbn,
                  studentId: matched.studentId,
                  studentName: matched.studentName,
                  approverId: user?.id,
                  approverName: user?.name || "Jan Dale B. Piansay",
                  approverRole: (user as any)?.subRole || (user as any)?.role || "Circulation Librarian",
                }),
              });
            }
          }
        }

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        const serverTx = data?.transaction;
        if (serverTx?.id) {
          startTransition(() => {
            setAllTransactions((prev) =>
              prev.map((t) =>
                t.id === id || t.id === serverTx.id
                  ? {
                      ...t,
                      ...serverTx,
                      id: serverTx.id,
                      pickedUpAt: serverTx.pickedUpAt || serverTx.picked_up_at || now,
                      isPickedUp: true,
                      dueDate: serverTx.dueDate || dueDate,
                      updatedAt: now,
                    }
                  : t
              )
            );
          });
        }

        // Publish WebSocket event ONLY after successful server commitment
        dashboardSocket.publishBookPickedUp({
          id: serverTx?.id || id,
          transactionId: serverTx?.id || id,
          status: "Approved",
          type: "Borrow",
          resourceTitle,
          studentId: targetTxn?.studentId,
          studentName: targetTxn?.studentName,
          pickedUpAt: now,
          isPickedUp: true,
          dueDate,
        });
      } catch (err) {
        console.error("Failed to mark pickup, rolling back:", err);
        startTransition(() => {
          setAllTransactions(previousTransactions);
        });
        notify(
          `Failed to record pickup for resource "${resourceTitle}". Changes reverted.`,
          "error"
        );
      } finally {
        inFlightMutationsRef.current.delete(id);
        if (targetTxn?.id) inFlightMutationsRef.current.delete(targetTxn.id);
        scheduleReloadTransactions(800);
      }
    },
    [allTransactions, notify, scheduleReloadTransactions]
  );

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-5 px-1">
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
        <div className="flex items-center gap-3">
          {/* Number counter before the refresh button with Dropdown */}
          <div className="relative" ref={approvalDropdownRef}>
            <div
              onClick={() => {
                if (canTransactionDropdown) {
                  setIsApprovalDropdownOpen((prev) => !prev);
                  void fetchLibrarianApprovalStats();
                }
              }}
              role={canTransactionDropdown ? "button" : undefined}
              aria-haspopup={canTransactionDropdown ? "true" : undefined}
              aria-expanded={canTransactionDropdown ? isApprovalDropdownOpen : undefined}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl border text-xs font-bold shadow-2xs transition-all select-none",
                canTransactionDropdown ? "cursor-pointer" : "cursor-default",
                isLight
                  ? canTransactionDropdown
                    ? "bg-emerald-50/90 border-emerald-300 text-emerald-800 hover:bg-emerald-100/90 hover:border-emerald-400"
                    : "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                  : canTransactionDropdown
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              )}
              title={
                canTransactionDropdown
                  ? `Click to view approvals by librarians. Your approvals: ${personalTodayApprovalCount} today (${personalApprovalCount} all-time)`
                  : `Your approvals: ${personalTodayApprovalCount} today (${personalApprovalCount} all-time)`
              }
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                {approvalStatTimeframe === "today" ? personalTodayApprovalCount : personalApprovalCount}
              </span>
              <span className="hidden sm:inline font-bold">
                {approvalStatTimeframe === "today"
                  ? (personalTodayApprovalCount === 1 ? "Approved Today" : "Approved Today")
                  : (personalApprovalCount === 1 ? "Approved Total" : "Approved Total")}
              </span>
              <span className="sm:hidden font-bold">
                {approvalStatTimeframe === "today" ? "Today" : "Total"}
              </span>

              {/* Extended Dropdown Indicator: only shown if dropdown restriction is lifted */}
              {canTransactionDropdown && (
                <>
                  <span
                    className={cn(
                      "h-3.5 w-[1px] ml-0.5 shrink-0",
                      isLight ? "bg-emerald-300/80" : "bg-emerald-500/30"
                    )}
                  />
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      isLight ? "text-emerald-700" : "text-emerald-300",
                      isApprovalDropdownOpen && "rotate-180"
                    )}
                  />
                </>
              )}
            </div>

            {/* Dropdown Menu specifically for Librarian Approval Stats - only if permission granted */}
            {canTransactionDropdown && isApprovalDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute right-0 top-full mt-2 w-84 sm:w-96 rounded-2xl border shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl",
                  isLight
                    ? "bg-white/98 border-slate-200 shadow-slate-300/60 text-slate-800"
                    : "bg-[#0b1626]/98 border-white/10 shadow-black/90 text-white"
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-inherit">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg border shadow-2xs",
                        isLight
                          ? "bg-emerald-100/90 border-emerald-300 text-emerald-800"
                          : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider leading-none">
                        Approved by Librarian
                      </h4>
                      <p
                        className={cn(
                          "text-[10px] mt-1 font-semibold leading-none",
                          isLight ? "text-slate-500" : "text-slate-400"
                        )}
                      >
                        {librarianApprovalStats.length}{" "}
                        {librarianApprovalStats.length === 1
                          ? "librarian with active access"
                          : "librarians with active access"}
                      </p>
                    </div>
                  </div>

                  {/* Filter Toggle: All Time vs Today */}
                  <div
                    className={cn(
                      "flex items-center rounded-xl p-0.5 border shadow-2xs",
                      isLight
                        ? "bg-slate-100 border-slate-200/90"
                        : "bg-white/5 border-white/10"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setApprovalStatTimeframe("all")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider transition-all cursor-pointer select-none",
                        approvalStatTimeframe === "all"
                          ? isLight
                            ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                            : "bg-[#0274BB] text-white shadow-xs"
                          : isLight
                          ? "text-slate-500 hover:text-slate-800"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      ALL TIME
                    </button>
                    <button
                      type="button"
                      onClick={() => setApprovalStatTimeframe("today")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider transition-all cursor-pointer select-none",
                        approvalStatTimeframe === "today"
                          ? isLight
                            ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                            : "bg-emerald-600 text-white shadow-xs"
                          : isLight
                          ? "text-slate-500 hover:text-slate-800"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      TODAY
                    </button>
                  </div>
                </div>

                {/* Librarian List */}
                <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
                  {librarianApprovalStats.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No librarian accounts found.
                    </div>
                  ) : (
                    librarianApprovalStats.map((lib) => {
                      const count =
                        approvalStatTimeframe === "today" ? lib.todayApprovedCount : lib.approvedCount;
                      const initial = (lib.name || "L").charAt(0).toUpperCase();

                      return (
                        <div
                          key={lib.id || lib.name}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-xl border transition-all",
                            isLight
                              ? "bg-slate-50/70 border-slate-200/70 hover:bg-slate-100/80 hover:border-slate-300"
                              : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            {/* Avatar icon matching BookHive standard */}
                            <div className="sidebar-profile-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF300] text-xs font-black text-[#0274BB] shadow-xs">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-xs font-bold truncate leading-tight",
                                  isLight ? "text-slate-900" : "text-white"
                                )}
                                title={lib.name}
                              >
                                {lib.name}
                              </p>
                              <p
                                className={cn(
                                  "text-[10px] truncate leading-tight mt-0.5",
                                  isLight ? "text-sky-700 font-semibold" : "text-sky-300 font-medium"
                                )}
                              >
                                {lib.subRole || "Librarian"}
                              </p>
                            </div>
                          </div>

                          {/* Number Counter Badge Beside Name */}
                          <div className="flex flex-col items-end shrink-0 pl-1">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black border tabular-nums shadow-2xs",
                                count > 0
                                  ? isLight
                                    ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                                    : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                                  : isLight
                                  ? "bg-slate-100 border-slate-200 text-slate-500"
                                  : "bg-white/5 border-white/10 text-slate-400"
                              )}
                              title={`${count} approvals ${approvalStatTimeframe === "today" ? "today" : "in total"}`}
                            >
                              <CheckCircle2 className="h-3 w-3 shrink-0 opacity-80" />
                              <span>{count}</span>
                            </span>
                            <span
                              className={cn(
                                "text-[9px] mt-0.5 font-medium",
                                isLight ? "text-slate-400" : "text-slate-500"
                              )}
                            >
                              {approvalStatTimeframe === "today"
                                ? `${lib.approvedCount} total`
                                : lib.todayApprovedCount > 0
                                ? `+${lib.todayApprovedCount} today`
                                : "approvals"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Note */}
                <div
                  className={cn(
                    "mt-3 pt-2.5 border-t border-inherit flex items-center justify-between text-[10px] font-medium",
                    isLight ? "text-slate-400" : "text-slate-500"
                  )}
                >
                  <span>Librarian Approvals Overview</span>
                  <span>All Active Librarians</span>
                </div>
              </div>
            )}
          </div>

          <button
            suppressHydrationWarning
            type="button"
            onClick={() => {
              void refreshUser();
              void loadAllTransactions();
              void fetchLibrarianApprovalStats();
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
            label: "Cancelled",
            value: globalCounts.cancelled,
            color: "#EF4444",
            icon: X,
            filterKey: "Cancelled",
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
                <p className={cn("text-xs font-extrabold tracking-[0.12em] uppercase transition-colors truncate", isLight ? "text-slate-700 group-hover:text-[#0274BB]" : "text-slate-300 group-hover:text-slate-100")}>
                  {stat.label}
                </p>
                <stat.icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", isLight ? "text-slate-500 group-hover:text-[#0274BB]" : "text-slate-400 group-hover:text-slate-200")} />
              </div>
              <p className={cn("mt-1 text-2xl sm:text-3xl font-black", isLight ? "text-[#0274BB]" : "text-white")}>
                {stat.value.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Search & filter ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={cn("pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2", isLight ? "text-slate-500" : "text-slate-400")} />
          <input
            suppressHydrationWarning
            className={cn(
              "w-full rounded-xl py-2.5 pl-11 pr-4 text-base font-medium transition-all focus:outline-none",
              isLight
                ? "border border-[#0274BB]/20 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#0274BB] focus:ring-1 focus:ring-[#0274BB]"
                : "border border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus:border-[#FCD400]/50 focus:ring-0"
            )}
            placeholder="Search student, title, ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Date Selector between searchbar and all */}
        <div className="relative min-w-[170px]">
          <div
            className={cn(
              "relative flex items-center rounded-xl border transition-all duration-200",
              isLight
                ? isDateFilterActive
                  ? "border-[#0274BB] bg-white ring-2 ring-[#0274BB]/20 shadow-sm"
                  : "border-[#0274BB]/20 bg-white hover:border-[#0274BB]/40 shadow-xs"
                : isDateFilterActive
                ? "border-[#FCD400]/70 bg-[#0F1D29] ring-2 ring-[#FCD400]/20 shadow-lg shadow-black/40"
                : "border-white/10 bg-[#0F1D29] hover:border-white/20 hover:bg-[#152E47]/70"
            )}
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: isLight
                ? isDateFilterActive
                  ? "#0274BB"
                  : "rgba(2, 116, 187, 0.25)"
                : isDateFilterActive
                ? "rgba(252, 212, 0, 0.7)"
                : "rgba(255, 255, 255, 0.12)",
            }}
          >
            <Calendar
              className={cn(
                "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
                isLight
                  ? isDateFilterActive ? "text-[#0274BB]" : "text-slate-500"
                  : isDateFilterActive ? "text-[#FCD400]" : "text-slate-400"
              )}
            />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value || "";
                setSelectedDate(val);
                setIsDateFilterActive(Boolean(val));
              }}
              title={selectedDate ? `Filtered by ${selectedDate}` : "Filter transactions by date"}
              className={cn(
                "date-selector-input w-full rounded-xl py-2.5 pl-10 pr-9 text-xs sm:text-sm font-bold transition-all focus:outline-none cursor-pointer bg-transparent",
                isLight
                  ? "[color-scheme:light] text-slate-800"
                  : "[color-scheme:dark] text-white"
              )}
            />
            {Boolean(selectedDate) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDate("");
                  setIsDateFilterActive(false);
                }}
                className={cn(
                  "absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors cursor-pointer z-20",
                  isLight
                    ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                )}
                title="Show all transactions (clear date filter)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Popover Select Menu */}
        <StatusFilterDropdown
          value={status}
          onChange={(newStatus) => setStatus(newStatus)}
          isLight={isLight}
        />

        {/* Circulation Librarian Exclusive Toggle: All vs Distributed */}
        {isCirculationLibrarian && (
          <div className={cn(
            "flex items-center rounded-xl p-1 border transition-all shrink-0",
            isLight ? "bg-slate-100/80 border-slate-200/90" : "bg-[#0F1D29] border-white/10"
          )}>
            <button
              type="button"
              onClick={() => setCirculationToggle("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                circulationToggle === "all"
                  ? isLight
                    ? "bg-white text-[#0274BB] shadow-xs"
                    : "bg-[#152E47] text-[#FCD400] shadow-xs"
                  : isLight
                  ? "text-slate-600 hover:text-slate-900"
                  : "text-slate-400 hover:text-white"
              )}
              title="View all transactions across the entire library system"
            >
              <span>All</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                circulationToggle === "all"
                  ? isLight ? "bg-blue-100 text-[#0274BB]" : "bg-white/15 text-[#FCD400]"
                  : isLight ? "bg-slate-200/70 text-slate-700" : "bg-white/10 text-slate-300"
              )}>
                {allTransactions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCirculationToggle("distributed")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                circulationToggle === "distributed"
                  ? isLight
                    ? "bg-white text-[#0274BB] shadow-xs"
                    : "bg-[#152E47] text-[#FCD400] shadow-xs"
                  : isLight
                  ? "text-slate-600 hover:text-slate-900"
                  : "text-slate-400 hover:text-white"
              )}
              title="Go to the distributed queue assigned to you"
            >
              <span>Distributed</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                circulationToggle === "distributed"
                  ? isLight ? "bg-blue-100 text-[#0274BB]" : "bg-white/15 text-[#FCD400]"
                  : isLight ? "bg-slate-200/70 text-slate-700" : "bg-white/10 text-slate-300"
              )}>
                {distributedTransactionsCount}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Table Container (Sized to show 8 students comfortably) ───── */}
      <div className={cn(
        "overflow-hidden rounded-2xl backdrop-blur transition-all",
        isLight
          ? "border border-[#0274BB]/15 bg-white shadow-sm"
          : "border border-white/8 bg-[#0F1D29]/80"
      )}>
        <div className="overflow-x-auto overflow-y-auto min-h-[520px] max-h-[720px] scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-700">
          <table className="w-full min-w-full text-base">
            <thead>
              <tr className={cn(
                "sticky top-0 z-10 backdrop-blur",
                isLight
                  ? "border-b border-[#0274BB]/15 bg-[#F0F7FC] text-[#0274BB]"
                  : "border-b border-white/8 bg-[#152E47]/60 text-slate-300"
              )}>
                {[
                  { key: "studentName" as SortKey, label: "STUDENT", minW: "min-w-[220px]" },
                  { key: "resourceTitle" as SortKey, label: "RESOURCE", minW: "min-w-[280px]" },
                  { key: null, label: "TYPE", minW: "min-w-[110px]" },
                  { key: null, label: "STATUS", minW: "min-w-[190px]" },
                  { key: "requestedAt" as SortKey, label: "REQUESTED", minW: "min-w-[170px]" },
                  { key: null, label: "ACTIONS", minW: "min-w-[210px]" },
                ].map((col) => (
                  <th
                    key={col.label}
                    className={cn(
                      "px-5 py-4 text-left text-xs sm:text-[13px] font-extrabold tracking-[0.14em] uppercase whitespace-nowrap",
                      col.minW,
                      isLight ? "text-[#0274BB]" : "text-slate-300"
                    )}
                  >
                    {col.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key!)}
                        className={cn(
                          "flex items-center gap-1.5 transition-colors cursor-pointer",
                          isLight ? "text-[#0274BB] hover:opacity-80" : "text-slate-300 hover:text-[#FCD400]"
                        )}
                      >
                        <span>{col.label}</span>
                        <ArrowDownUp className={cn("h-3.5 w-3.5", isLight ? "text-[#0274BB]/80" : "opacity-60")} />
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
              {filteredTransactions.map((txn, index) => (
                <tr
                  key={`${txn.id}-${txn.requestedAt || index}`}
                  id={`txn-row-${txn.id}`}
                  className={cn(
                    "transition-colors align-middle",
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
                  <td className="px-5 py-3.5 align-middle min-w-[220px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStudentForCard({
                          name: txn.studentName,
                          studentId: txn.studentId,
                          department: txn.department,
                          course: (txn as any).course || txn.department || "BSIT",
                          qrCode: (txn as any).qrCode || `e1a1-${txn.studentId || "default"}`,
                        })
                      }
                      className={cn(
                        "table-stack-btn group text-left flex !flex flex-col !flex-col items-start !items-start justify-start w-full rounded-lg p-1 -m-1 transition-all duration-200 focus:outline-none cursor-pointer",
                        isLight
                          ? "hover:bg-blue-50/80 focus:ring-1 focus:ring-[#0274BB]"
                          : "hover:bg-[#FCD400]/10 hover:border hover:border-[#FCD400]/30 focus:ring-1 focus:ring-[#FCD400]"
                      )}
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", textAlign: "left" }}
                      title={`Click to view Library Card for ${txn.studentName}`}
                    >
                      {/* Name: Fully horizontal on a single straight line */}
                      <div className={cn(
                        "text-[15px] sm:text-base font-bold leading-snug transition-colors flex items-center gap-1.5 w-full text-left",
                        isLight ? "text-[#0274BB] group-hover:underline" : "text-white group-hover:text-[#FCD400]"
                      )}>
                        <span className="whitespace-nowrap font-bold text-left">{txn.studentName || "Student"}</span>
                        <span className={cn("text-[11px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                          ↗
                        </span>
                      </div>

                      {/* ID and Course: Bellow the student name, vertically aligned straight */}
                      <div className="flex items-center gap-2 mt-1 w-full text-left">
                        <span className={cn("text-xs sm:text-sm font-semibold font-mono tracking-tight shrink-0", isLight ? "text-slate-600" : "text-slate-300 group-hover:text-slate-100")}>
                          {txn.studentId}
                        </span>
                        {(txn.department || (txn as any).course || (txn as any).userDepartment) ? (
                          <span className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] sm:text-xs font-black tracking-wide uppercase shrink-0 shadow-2xs",
                            isLight
                              ? "bg-blue-50 text-[#0274BB] border border-blue-200/90"
                              : "bg-white/10 text-[#FCD400] border border-white/10"
                          )}>
                            {formatCourseShortcut(txn.department || (txn as any).course || (txn as any).userDepartment)}
                          </span>
                        ) : null}
                      </div>

                      {/* Decided Sign-off (Approved or Declined) */}
                      {txn.status !== "Pending" && txn.approvedByName ? (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] leading-tight flex-wrap">
                          <span className={isLight ? "text-slate-500 font-medium" : "text-slate-400 font-medium"}>
                            {txn.status === "Declined" || txn.status === "Cancelled" ? "Declined by:" : "Approved by:"}
                          </span>
                          <span className={cn(
                            "font-bold",
                            txn.status === "Declined" || txn.status === "Cancelled"
                              ? isLight ? "text-rose-600" : "text-rose-400"
                              : isLight ? "text-emerald-700" : "text-emerald-400"
                          )}>
                            {txn.approvedByName}
                          </span>
                          {txn.approvedByRole ? (
                            <span className={cn("text-[10px] font-medium", isLight ? "text-[#0274BB]" : "text-[#38BDF8]")}>
                              ({txn.approvedByRole})
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  </td>

                  {/* Resource */}
                  <td className="px-5 py-3.5 align-middle min-w-[320px]">
                    <button
                      type="button"
                      onClick={() => handleOpenBookModal(txn)}
                      className={cn(
                        "group text-left flex items-center gap-3.5 w-full rounded-lg p-1 -m-1 transition-all duration-200 focus:outline-none cursor-pointer",
                        isLight
                          ? "hover:bg-blue-50/80 focus:ring-1 focus:ring-[#0274BB]"
                          : "hover:bg-[#FCD400]/10 hover:border hover:border-[#FCD400]/30 focus:ring-1 focus:ring-[#FCD400]"
                      )}
                      title={`Click to view Book Details for ${txn.resourceTitle}`}
                    >
                      <BookCoverImage
                        book={{ title: txn.resourceTitle, isbn: txn.isbn, department: txn.department }}
                        size="sm"
                      />
                      <div className="flex flex-col items-start justify-start min-w-0 flex-1 text-left">
                        {/* Book Title */}
                        <div className={cn(
                          "text-[15px] sm:text-base font-bold leading-snug transition-colors flex items-center gap-1.5 w-full text-left",
                          isLight ? "text-slate-900 group-hover:text-[#0274BB] group-hover:underline" : "text-white group-hover:text-[#FCD400]"
                        )}>
                          <span className="whitespace-normal break-words font-bold text-left">{txn.resourceTitle}</span>
                          <span className={cn("text-[11px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                            ↗
                          </span>
                        </div>

                        {/* ISBN below the book title */}
                        {txn.isbn && (
                          <div className={cn(
                            "text-xs sm:text-sm mt-1 font-mono font-medium transition-colors w-full text-left",
                            isLight ? "text-slate-500 font-semibold group-hover:text-slate-800" : "text-slate-400 group-hover:text-slate-200"
                          )}>
                            {txn.isbn}
                          </div>
                        )}
                      </div>
                    </button>
                  </td>

                  {/* Type */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <TypeBadge type={txn.type} isLight={isLight} />
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {txn.type === "Reservation" ? (
                      txn.status === "Pending" ? (
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide",
                          isLight
                            ? "border-amber-500/30 bg-amber-500/15 text-amber-700"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-300"
                        )}>
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          Pending Reservation (Que #{txn.queuePosition || 1})
                        </span>
                      ) : txn.status === "Approved" ? (
                        (txn.availableAt || txn.available === "true" || txn.available === true) ? (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide",
                            isLight
                              ? "border-purple-500/30 bg-purple-500/15 text-purple-700"
                              : "border-violet-500/30 bg-violet-500/15 text-violet-300"
                          )}>
                            <span className="h-2 w-2 rounded-full bg-purple-400" />
                            Ready to Borrow (Copy Available)
                          </span>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide",
                            isLight
                              ? "border-purple-500/30 bg-purple-500/15 text-purple-700"
                              : "border-violet-500/30 bg-violet-500/15 text-violet-300"
                          )}>
                            <span className="h-2 w-2 rounded-full bg-purple-400" />
                            Approved Reservation (Que #{txn.queuePosition || 1})
                          </span>
                        )
                      ) : (
                        <StatusBadge status={txn.status} isLight={isLight} />
                      )
                    ) : txn.status === "Approved" ? (
                      txn.pickedUpAt ? (
                        (() => {
                          const isDue = Boolean(txn.dueDate && isDueToReturn(txn.dueDate));
                          const isOverdue = Boolean(txn.dueDate && isDateOverdue(txn.dueDate));

                          if (isDue) {
                            return (
                              <span className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide",
                                isLight
                                  ? "border-red-500/30 bg-red-500/15 text-red-700"
                                  : "border-red-500/30 bg-red-500/15 text-red-300"
                              )}>
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                {isOverdue ? "Borrowed (Overdue)" : "Borrowed (Due to Return)"}
                              </span>
                            );
                          }

                          return (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide",
                              isLight
                                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700"
                                : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                            )}>
                              <span className="h-2 w-2 rounded-full bg-emerald-400" />
                              Borrowed (Picked Up)
                            </span>
                          );
                        })()
                      ) : (
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:text-[13px] font-bold tracking-wide",
                          isLight
                            ? "border-sky-500/30 bg-sky-500/15 text-[#0274BB]"
                            : "border-sky-500/30 bg-sky-500/15 text-sky-300"
                        )}>
                          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                          Ready for Pickup (1 Day)
                        </span>
                      )
                    ) : (
                      <StatusBadge status={txn.status} isLight={isLight} dueDate={txn.dueDate} />
                    )}
                  </td>

                  {/* Requested */}
                  <td className={cn("px-5 py-4 whitespace-nowrap", isLight ? "text-slate-800" : "text-slate-200")}>
                    <div className="text-sm sm:text-[14px] font-bold">
                      {formatDateTime(txn.requestedAt)}
                    </div>
                    {txn.type !== "Reservation" && txn.dueDate && (
                      <div className={cn(
                        "text-xs sm:text-[12.5px] mt-1 font-semibold flex items-center gap-1",
                        txn.status !== "Returned" && isDueToReturn(txn.dueDate)
                          ? isLight
                            ? "text-red-600 font-bold"
                            : "text-red-400 font-bold"
                          : isLight
                            ? "text-slate-700"
                            : "text-amber-300"
                      )}>
                        <span className={txn.status !== "Returned" && isDueToReturn(txn.dueDate) ? (isLight ? "text-red-500 font-medium" : "text-red-300 font-medium") : (isLight ? "text-slate-500 font-medium" : "text-slate-400")}>Due:</span>
                        <span className="font-bold">{formatDateTime(txn.dueDate)}</span>
                      </div>
                    )}
                    {txn.type === "Reservation" && (
                      <div className={cn("text-xs mt-1 font-bold", isLight ? "text-amber-800" : "text-amber-300")}>
                        1st-Come, 1st-Served Queue
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 whitespace-nowrap min-w-[210px]">
                    <div className="flex gap-2 items-center flex-nowrap">
                      {txn.status === "Pending" ? (
                        <>
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => {
                              setDeclineComment("");
                              setConfirmModalData({ id: txn.id, nextStatus: "Approved", transaction: txn });
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer",
                              isLight
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                                : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                            )}
                          >
                            <Check className="h-4 w-4 stroke-[2.5]" />
                            Approve
                          </button>
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => {
                              setDeclineComment("");
                              setConfirmModalData({ id: txn.id, nextStatus: "Declined", transaction: txn });
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer",
                              isLight
                                ? "border border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 hover:border-rose-500/50"
                                : "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                            )}
                          >
                            <X className="h-4 w-4 stroke-[2.5]" />
                            Decline
                          </button>
                        </>
                      ) : txn.type === "Reservation" && txn.status === "Approved" ? (
                        (txn.availableAt || txn.available === "true" || txn.available === true) ? (
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => void handleConvertToBorrow(txn.id, txn)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer",
                              isLight
                                ? "border border-purple-500/30 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 hover:border-purple-500/50"
                                : "border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/50"
                            )}
                          >
                            <Check className="h-4 w-4 stroke-[2.5]" />
                            Turn into Borrow
                          </button>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold",
                            isLight
                              ? "border border-purple-500/30 bg-purple-500/10 text-purple-700"
                              : "border-purple-500/30 bg-purple-500/10 text-purple-300"
                          )}>
                            <BookMarked className="h-4 w-4" />
                            Que #{txn.queuePosition || 1} in Line
                          </span>
                        )
                      ) : txn.status === "Approved" ? (
                        !txn.pickedUpAt ? (
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              suppressHydrationWarning
                              type="button"
                              onClick={() => void handlePickupBook(txn.id, txn)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer bg-[#0274BB] hover:bg-[#02629E] text-white shadow-sm"
                            >
                              <Check className="h-4 w-4 stroke-[2.5]" />
                              Pickup
                            </button>
                            <span className={cn(
                              "inline-flex items-center gap-1 text-xs font-semibold pl-0.5",
                              isLight ? "text-sky-700" : "text-sky-400"
                            )}>
                              <Clock className="h-3 w-3" />
                              {formatPickupCountdown(txn.expiresAt, txn.requestedAt)}
                            </span>
                          </div>
                        ) : (
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => void handleReturnBook(txn.id, txn)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer",
                              isLight
                                ? "border border-sky-500/30 bg-sky-500/10 text-[#0274BB] hover:bg-sky-500/20 hover:border-sky-500/50"
                                : "border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50"
                            )}
                          >
                            <RefreshCcw className="h-4 w-4 stroke-[2.5]" />
                            Returned
                          </button>
                        )
                      ) : (txn.status === "Returned" || txn.status === "Declined") ? (
                        <span className={cn(
                          "inline-flex items-center px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold",
                          isLight ? "border border-slate-200 bg-slate-100/80 text-slate-600" : "text-slate-400 italic"
                        )}>
                          Closed
                        </span>
                      ) : txn.status === "Cancelled" ? (
                        <span className={cn(
                          "inline-flex items-center px-3 py-1 rounded-lg text-xs sm:text-sm font-bold",
                          isLight ? "border border-rose-500/20 bg-rose-500/10 text-rose-700" : "text-red-400 italic font-bold"
                        )}>
                          Cancelled
                        </span>
                      ) : null}
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
          Showing {filteredTransactions.length.toLocaleString()} of {scopedTransactions.length.toLocaleString()} transaction{scopedTransactions.length !== 1 ? "s" : ""}
          {status !== "All" && ` · Filter: ${status}`}
          {isDateFilterActive && selectedDate && ` · Date: ${formatDate(selectedDate)}`}
          {isCirculationLibrarian && ` · View: ${circulationToggle === "all" ? "All Queue" : "Distributed"}`}
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

      {/* ── Interactive Book Detail Modal ────────────────────────────── */}
      <BookDetailModal
        open={selectedBookForModal !== null}
        book={selectedBookForModal}
        onClose={() => setSelectedBookForModal(null)}
      />

      {/* ── Interactive Confirmation Pop-up Page (Replaces native browser alert) ── */}
      {confirmModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <div
            className={cn(
              "fixed inset-0 modal-backdrop backdrop-blur-md transition-opacity animate-in fade-in duration-200",
              isLight ? "bg-slate-900/40" : "bg-black/80"
            )}
            onClick={() => setConfirmModalData(null)}
          />

          {/* Modal Card */}
          <div
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative w-full max-w-lg rounded-2xl p-6 shadow-2xl transition-all z-10 flex flex-col gap-5 animate-in zoom-in-95 duration-200",
              isLight
                ? "border-2 border-slate-200 bg-white text-slate-800 shadow-slate-300/60"
                : "border border-[#263650] bg-[#111A2E] text-slate-100 shadow-black/80"
            )}
          >
            {/* Header */}
            <div className={cn("flex items-start justify-between pb-3 border-b", isLight ? "border-slate-200" : "border-slate-800")}>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl",
                    confirmModalData.nextStatus === "Approved"
                      ? isLight
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : isLight
                      ? "bg-rose-50 text-rose-600 border border-rose-200"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  )}
                >
                  {confirmModalData.nextStatus === "Approved" ? (
                    <CheckCircle2 className="h-6 w-6 stroke-[2.2]" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 stroke-[2.2]" />
                  )}
                </div>
                <div>
                  <h3 className={cn("text-lg font-black tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                    {confirmModalData.nextStatus === "Approved"
                      ? "Approve Circulation Request"
                      : "Decline Circulation Request"}
                  </h3>
                  <p className={cn("text-xs font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
                    {confirmModalData.nextStatus === "Approved"
                      ? "Review transaction details before confirming approval."
                      : "Please confirm declining this transaction request."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmModalData(null)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer",
                  isLight
                    ? "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    : "border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                )}
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Transaction Overview Card */}
            <div
              className={cn(
                "rounded-xl p-4 flex flex-col gap-3 text-xs sm:text-sm border",
                isLight ? "bg-slate-50/80 border-slate-200" : "bg-[#162238] border-[#223553]"
              )}
            >
              {/* Resource Title & Type */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <BookMarked className={cn("h-4 w-4 shrink-0 mt-0.5", isLight ? "text-[#0274BB]" : "text-[#FCD400]")} />
                  <div>
                    <span className={cn("font-bold block text-sm", isLight ? "text-slate-900" : "text-white")}>
                      {confirmModalData.transaction.resourceTitle || "Book"}
                    </span>
                    <span className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                      ISBN: {confirmModalData.transaction.isbn || "N/A"}
                    </span>
                  </div>
                </div>
                <TypeBadge type={confirmModalData.transaction.type} isLight={isLight} />
              </div>

              {/* Student Details */}
              <div className={cn("pt-2 border-t flex items-center justify-between", isLight ? "border-slate-200" : "border-slate-800")}>
                <div>
                  <span className={cn("text-xs block font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>
                    Student / Patron
                  </span>
                  <span className={cn("font-bold", isLight ? "text-slate-800" : "text-slate-200")}>
                    {confirmModalData.transaction.studentName || "Student"}
                  </span>
                </div>
                <div className="text-right">
                  <span className={cn("text-xs block font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>
                    Student ID
                  </span>
                  <span className={cn("font-bold font-mono", isLight ? "text-slate-800" : "text-slate-200")}>
                    {confirmModalData.transaction.studentId || "N/A"}
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className={cn("pt-2 border-t grid grid-cols-2 gap-2 text-xs", isLight ? "border-slate-200" : "border-slate-800")}>
                <div>
                  <span className={cn("block font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>
                    Requested On:
                  </span>
                  <span className="font-bold">{formatDateTime(confirmModalData.transaction.requestedAt)}</span>
                </div>
                {confirmModalData.nextStatus === "Approved" && (
                  <div>
                    <span className={cn("block font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>
                      Pickup Window:
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">24-Hour Hold Limit</span>
                  </div>
                )}
              </div>

              {/* Student ID / Attachment Photo Preview */}
              <div className={cn("pt-2.5 border-t flex flex-col gap-2", isLight ? "border-slate-200" : "border-slate-800")}>
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Student ID Picture / Attachment
                  </span>
                  {Boolean(confirmModalData.transaction.studentIdImage || (confirmModalData.transaction as any).student_id_image) ? (
                    <button
                      type="button"
                      onClick={() => setEnlargedModalImage(confirmModalData.transaction.studentIdImage || (confirmModalData.transaction as any).student_id_image)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer"
                    >
                      <ZoomIn className="h-3 w-3" />
                      <span>Photo Attached • View Large</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">
                      No Photo Attached
                    </span>
                  )}
                </div>

                {Boolean(confirmModalData.transaction.studentIdImage || (confirmModalData.transaction as any).student_id_image) ? (
                  <div
                    onClick={() => setEnlargedModalImage(confirmModalData.transaction.studentIdImage || (confirmModalData.transaction as any).student_id_image)}
                    className="group relative aspect-[16/9] w-full max-h-52 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-black/10 flex items-center justify-center shadow-inner cursor-pointer hover:border-emerald-500/50 transition"
                    title="Click to view full size ID"
                  >
                    <img
                      src={confirmModalData.transaction.studentIdImage || (confirmModalData.transaction as any).student_id_image}
                      alt="Student ID Verification"
                      className="h-full w-full object-contain transition group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                      <ZoomIn className="h-4 w-4" />
                      <span>Click to enlarge</span>
                    </div>
                  </div>
                ) : (
                  <div className={cn("h-20 w-full rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 text-xs", isLight ? "border-slate-300 bg-slate-100/50 text-slate-400" : "border-slate-700 bg-white/5 text-slate-500")}>
                    <AlertTriangle className="h-4 w-4 opacity-40 text-amber-500" />
                    <span>No student ID image uploaded for this request</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reason / Remarks for Declining (only intended for decline) */}
            {confirmModalData.nextStatus === "Declined" && (
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-bold", isLight ? "text-slate-700" : "text-slate-300")}>
                  Reason for Decline{" "}
                  <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={declineComment}
                  onChange={(e) => setDeclineComment(e.target.value)}
                  placeholder="e.g., Book currently undergoing binding repair, hold quota exceeded..."
                  rows={3}
                  className={cn(
                    "w-full rounded-xl p-3 text-xs sm:text-sm border transition focus:outline-none focus:ring-2",
                    isLight
                      ? "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#0274BB] focus:ring-[#0274BB]/20"
                      : "bg-[#0c1424] border-slate-700 text-white placeholder-slate-500 focus:border-[#FCD400] focus:ring-[#FCD400]/20"
                  )}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalData(null)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer active:scale-95",
                  isLight
                    ? "border-slate-200 text-slate-700 hover:bg-slate-100"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"
                )}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDecision}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer active:scale-95 inline-flex items-center gap-2 text-white shadow-md",
                  confirmModalData.nextStatus === "Approved"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                )}
              >
                {confirmModalData.nextStatus === "Approved" ? (
                  <>
                    <Check className="h-4 w-4 stroke-[3]" />
                    Confirm Approval
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 stroke-[3]" />
                    Confirm Decline
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size ID Image Enlargement Lightbox */}
      {enlargedModalImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setEnlargedModalImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEnlargedModalImage(null)}
              className="absolute top-3 right-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/90 cursor-pointer transition active:scale-95 shadow-md"
              aria-label="Close enlarged preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={enlargedModalImage}
              alt="Enlarged Student ID"
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}


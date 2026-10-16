"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Clock3, Info, Tag, X, BookOpen, ChevronDown, ChevronUp, Calendar, Layers, Bookmark, Sparkles } from "lucide-react";

import { generateApaCitation, formatDate, cn } from "@/lib/utils";
import type { BookAvailability, BookRecord } from "@/lib/types";
import { generateAccessionNumber } from "@/lib/catalog/call-number";
import { useTheme } from "@/components/providers/theme-provider";

export interface BorrowHistoryEntry {
  id?: string;
  bookId?: string;
  bookTitle?: string;
  isbn?: string;
  borrowDate?: string;
  borrowerName?: string;
  studentName?: string;
  studentId?: string;
  requestedAt?: string;
  date?: string;
  dueDate?: string;
  status?: string;
  type?: string;
}

export interface BookDetailPayload {
  id: string;
  title: string;
  author: string;
  isbn: string;
  department: string;
  shelfLocation?: string;
  callNumber?: string;
  genres?: string;
  category?: string;
  availability?: BookAvailability | string;
  publicationDate?: string;
  publishedDate?: string;
  volume?: string;
  edition?: string;
  summary?: string;
  relevance?: number;
  copies?: number;
  accessionNumber?: string;
  borrowHistory?: BorrowHistoryEntry[];
}

export type NormalizedStatus = "Available" | "Reserved" | "Unavailable";

export function normalizeStatus(rawStatus?: string | null): NormalizedStatus {
  if (!rawStatus) return "Available";
  const s = rawStatus.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "available" || s === "instock" || s === "in_stock") {
    return "Available";
  }
  if (s === "reserved" || s === "pending" || s === "hold" || s === "onhold") {
    return "Reserved";
  }
  if (
    s === "unavailable" ||
    s === "notavailable" ||
    s === "limited" ||
    s === "borrowed" ||
    s === "checkedout" ||
    s === "onloan" ||
    s === "lost" ||
    s === "archived"
  ) {
    return "Unavailable";
  }
  return "Available";
}

export function computeBookCopyStats(
  book: BookDetailPayload | null | undefined,
  borrowHistory: BorrowHistoryEntry[] = []
) {
  const totalCopies = Math.max(1, Number(book?.copies) || 1);
  const baseStatus = normalizeStatus(book?.availability);

  const isBorrowType = (t?: string) => !t || t.toLowerCase() === "borrow";
  const isReservationType = (t?: string) => t?.toLowerCase() === "reservation" || t?.toLowerCase() === "reserve";

  // Active loans: type is Borrow (or generic checkout) and status is active (not returned/declined/cancelled)
  const activeLoans = borrowHistory.filter((tx) => {
    const st = (tx.status || "").toLowerCase();
    if (st === "returned" || st === "declined" || st === "cancelled" || st === "completed") {
      return false;
    }
    if (!isBorrowType(tx.type)) {
      return false;
    }
    return (
      st === "approved" ||
      st === "borrowed" ||
      st === "on loan" ||
      st === "onloan" ||
      st === "active" ||
      st === "pending"
    );
  });

  // Active reservations: type is Reservation / Reserve and status is active (Pending, Approved, Reserved, Upcoming)
  const activeReservations = borrowHistory.filter((tx) => {
    const st = (tx.status || "").toLowerCase();
    if (st === "returned" || st === "declined" || st === "cancelled" || st === "completed") {
      return false;
    }
    if (!isReservationType(tx.type)) {
      return false;
    }
    return (
      st === "pending" ||
      st === "approved" ||
      st === "reserved" ||
      st === "upcoming" ||
      st === "active"
    );
  });

  let unavailableCopies = Math.min(totalCopies, activeLoans.length);
  let reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), activeReservations.length);
  let availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);

  let status: NormalizedStatus = "Available";

  if (borrowHistory.length > 0) {
    if (availableCopies > 0) {
      status = "Available";
    } else if (reservedCopies > 0 || activeReservations.length > 0) {
      status = "Reserved";
    } else {
      status = "Unavailable";
    }
  } else {
    // If book object already has explicit dynamic copy stats from the backend API
    const bAny = book as any;
    if (bAny?.availableCopies !== undefined || bAny?.borrowedCount !== undefined || bAny?.reservedCount !== undefined) {
      const bBorrow = Number(bAny?.borrowedCount ?? 0);
      const bRes = Number(bAny?.reservedCount ?? 0);
      unavailableCopies = Math.min(totalCopies, bBorrow);
      reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), bRes);
      availableCopies = bAny?.availableCopies !== undefined
        ? Math.min(totalCopies, Math.max(0, Number(bAny.availableCopies)))
        : Math.max(0, totalCopies - unavailableCopies - reservedCopies);
      status = availableCopies > 0 ? "Available" : (reservedCopies > 0 ? "Reserved" : "Unavailable");
    } else {
      // Fallback to base book availability when no active transaction entries exist
      status = baseStatus;
      if (status === "Unavailable") {
        unavailableCopies = totalCopies;
        availableCopies = 0;
        reservedCopies = 0;
      } else if (status === "Reserved") {
        reservedCopies = Math.min(1, totalCopies);
        availableCopies = Math.max(0, totalCopies - reservedCopies);
        unavailableCopies = 0;
      } else {
        availableCopies = totalCopies;
        reservedCopies = 0;
        unavailableCopies = 0;
      }
    }
  }

  return {
    totalCopies,
    availableCopies,
    reservedCopies,
    unavailableCopies,
    status,
  };
}

function formatBorrowDate(dateStr?: string): string {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  if (s === "Pending" || s === "Returned" || s === "Cancelled") return s;
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) {
      // If already formatted like YYYY-MM-DD or MM/DD/YYYY, return as is
      return s;
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return s;
  }
}

function isMatchingBook(tx: any, currentBook: BookDetailPayload | null | undefined): boolean {
  if (!tx || !currentBook) return false;

  // Direct ID matching
  if (tx.bookId && currentBook.id && String(tx.bookId) === String(currentBook.id)) return true;
  if (tx.id && currentBook.id && String(tx.id) === String(currentBook.id)) return true;

  // ISBN matching
  const cleanIsbn = (str?: string) => (str ? String(str).replace(/[-\s]/g, "").trim() : "");
  const txIsbn = cleanIsbn(tx.isbn);
  const bookIsbn = cleanIsbn(currentBook.isbn);
  if (txIsbn && bookIsbn && txIsbn === bookIsbn) return true;

  // Title matching
  const cleanTitle = (str?: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const currentTitleClean = cleanTitle(currentBook.title);
  const txTitle = tx.resourceTitle || tx.bookTitle || tx.title;
  const txTitleClean = cleanTitle(txTitle);

  if (currentTitleClean && txTitleClean) {
    if (currentTitleClean === txTitleClean) return true;
    if (currentTitleClean.length >= 4 && txTitleClean.length >= 4) {
      if (currentTitleClean.includes(txTitleClean) || txTitleClean.includes(currentTitleClean)) {
        return true;
      }
    }
  }

  return false;
}

function isApprovedOrActiveRecord(st?: string, tp?: string): boolean {
  const s = (st || "").toLowerCase();
  if (s === "pending" || s === "declined" || s === "cancelled" || s === "waitlisted") {
    return false;
  }
  return (
    s === "approved" ||
    s === "picked up" ||
    s === "pickedup" ||
    s === "on loan" ||
    s === "onloan" ||
    s === "completed" ||
    s === "returned" ||
    s === "active"
  );
}

function resolveBorrowerName(tx: any, defaultStudentName?: string): string {
  const name =
    tx.borrowerName ||
    tx.borrower_name ||
    tx.studentName ||
    tx.student_name ||
    tx.studentFullName ||
    tx.userName ||
    tx.user_name ||
    tx.userFullName ||
    tx.user?.name ||
    tx.user?.fullName ||
    tx.name;

  if (name && String(name).trim() && String(name).trim() !== "undefined") {
    return String(name).trim();
  }

  const sid = tx.studentId || tx.student_id;
  if (sid) {
    return `Student (${sid})`;
  }

  return defaultStudentName || "Student Borrower";
}

function resolveBorrowDate(tx: any): string {
  const rawDate =
    tx.borrowDate ||
    tx.borrow_date ||
    tx.pickupDate ||
    tx.picked_up_at ||
    tx.pickedUpAt ||
    tx.requestedAt ||
    tx.requested_at ||
    tx.decidedAt ||
    tx.decided_at ||
    tx.date ||
    tx.createdAt ||
    tx.created_at;

  return formatBorrowDate(rawDate);
}

const TOTAL_BOOK_CARD_ROWS = 12;

const availabilityClasses = (availability?: BookAvailability | string, isLight: boolean = false) => {
  const normalized = normalizeStatus(availability);
  if (normalized === "Available") {
    return isLight
      ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.35)]";
  }

  if (normalized === "Reserved") {
    return isLight
      ? "bg-amber-50 text-amber-800 border-amber-300 shadow-xs"
      : "bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.35)]";
  }

  return isLight
    ? "bg-rose-50 text-rose-800 border-rose-300 shadow-xs"
    : "bg-rose-500/20 text-rose-300 border-rose-400/40 shadow-[0_0_20px_rgba(244,63,94,0.35)]";
};

export function BookDetailModal({
  open,
  book,
  onClose,
}: {
  open: boolean;
  book: BookDetailPayload | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [copied, setCopied] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [borrowHistory, setBorrowHistory] = useState<BorrowHistoryEntry[]>([]);

  useEffect(() => {
    setIsSummaryExpanded(false);
  }, [book?.id, open]);

  useEffect(() => {
    if (!open || !book) {
      setBorrowHistory([]);
      return;
    }

    let isMounted = true;

    async function loadAllTransactions() {
      const allTxMap = new Map<string, BorrowHistoryEntry>();

      // 1. Explicit prop history
      if (book?.borrowHistory && Array.isArray(book.borrowHistory)) {
        book.borrowHistory.forEach((entry, idx) => {
          if (isMatchingBook(entry, book) && isApprovedOrActiveRecord(entry.status, entry.type)) {
            allTxMap.set(entry.id || `prop-${idx}`, {
              id: entry.id || `prop-${idx}`,
              borrowDate: resolveBorrowDate(entry),
              borrowerName: resolveBorrowerName(entry),
              status: entry.status || "Approved",
              type: entry.type || "Borrow",
            });
          }
        });
      }

      // 2. Fetch from backend / fallback API endpoints
      try {
        const [resTx, resAdminTx] = await Promise.allSettled([
          fetch("/api/transactions"),
          fetch("/api/admin/transactions"),
        ]);

        if (resTx.status === "fulfilled" && resTx.value.ok) {
          const data = await resTx.value.json();
          const list: any[] = Array.isArray(data.transactions) ? data.transactions : (Array.isArray(data) ? data : []);
          list.forEach((t) => {
            if (isMatchingBook(t, book) && isApprovedOrActiveRecord(t.status, t.type)) {
              allTxMap.set(t.id || `api-${t.isbn || t.resourceTitle}`, {
                id: t.id,
                borrowDate: resolveBorrowDate(t),
                borrowerName: resolveBorrowerName(t),
                status: t.status,
                type: t.type,
              });
            }
          });
        }

        if (resAdminTx.status === "fulfilled" && resAdminTx.value.ok) {
          const data = await resAdminTx.value.json();
          const list: any[] = Array.isArray(data.transactions)
            ? data.transactions
            : Array.isArray(data)
            ? data
            : [];
          list.forEach((t) => {
            if (isMatchingBook(t, book) && isApprovedOrActiveRecord(t.status, t.type)) {
              allTxMap.set(t.id || `admin-${t.isbn || t.resourceTitle}`, {
                id: t.id,
                borrowDate: resolveBorrowDate(t),
                borrowerName: resolveBorrowerName(t),
                status: t.status,
                type: t.type,
              });
            }
          });
        }
      } catch (err) {
        console.warn("Could not fetch remote transactions:", err);
      }

      // 3. Check client-side storage (localStorage) for student transactions & profile
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          let storedProfileName = "Jan Dale B. Piansay";
          const profileStr =
            window.localStorage.getItem("STUDENT_PROFILE") ||
            window.localStorage.getItem("bookhive_user");
          if (profileStr) {
            try {
              const parsedProfile = JSON.parse(profileStr);
              storedProfileName =
                parsedProfile.fullName || parsedProfile.name || storedProfileName;
            } catch {}
          }

          // Check student reservations cache
          const resStr = window.localStorage.getItem("STUDENT_RESERVATIONS");
          if (resStr) {
            const parsedRes: any[] = JSON.parse(resStr);
            if (Array.isArray(parsedRes)) {
              parsedRes.forEach((r, idx) => {
                if (isMatchingBook(r, book) && isApprovedOrActiveRecord(r.status, r.action || r.type)) {
                  allTxMap.set(r.id || `local-res-${idx}`, {
                    id: r.id || `local-res-${idx}`,
                    borrowDate: resolveBorrowDate(r),
                    borrowerName: resolveBorrowerName(r, storedProfileName),
                    status: r.status || "Approved",
                    type: r.action === "Reserve" ? "Reservation" : "Borrow",
                  });
                }
              });
            }
          }

          // Check student history cache
          const histStr = window.localStorage.getItem("STUDENT_HISTORY");
          if (histStr) {
            const parsedHist: any[] = JSON.parse(histStr);
            if (Array.isArray(parsedHist)) {
              parsedHist.forEach((h, idx) => {
                if (isMatchingBook(h, book) && isApprovedOrActiveRecord(h.status, h.action || h.type)) {
                  allTxMap.set(h.id || `local-hist-${idx}`, {
                    id: h.id || `local-hist-${idx}`,
                    borrowDate: resolveBorrowDate(h),
                    borrowerName: resolveBorrowerName(h, storedProfileName),
                    status: h.status || "Completed",
                    type: h.action === "Reserve" ? "Reservation" : "Borrow",
                  });
                }
              });
            }
          }

          // Check generic bookhive_transactions
          const genStr = window.localStorage.getItem("bookhive_transactions");
          if (genStr) {
            const parsedGen: any[] = JSON.parse(genStr);
            if (Array.isArray(parsedGen)) {
              parsedGen.forEach((g, idx) => {
                if (isMatchingBook(g, book) && isApprovedOrActiveRecord(g.status, g.type)) {
                  allTxMap.set(g.id || `local-gen-${idx}`, {
                    id: g.id || `local-gen-${idx}`,
                    borrowDate: resolveBorrowDate(g),
                    borrowerName: resolveBorrowerName(g, storedProfileName),
                    status: g.status,
                    type: g.type,
                  });
                }
              });
            }
          }
        } catch (storageErr) {
          console.warn("Could not read local storage transactions:", storageErr);
        }
      }

      if (isMounted) {
        setBorrowHistory(Array.from(allTxMap.values()));
      }
    }

    void loadAllTransactions();

    const handleTxUpdate = () => {
      void loadAllTransactions();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("transaction-updated", handleTxUpdate);
      window.addEventListener("storage", handleTxUpdate);
    }

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("transaction-updated", handleTxUpdate);
        window.removeEventListener("storage", handleTxUpdate);
      }
    };
  }, [book?.id, book?.isbn, book?.title, book?.borrowHistory, open]);

  if (!open || !book) {
    return null;
  }

  const citation = generateApaCitation(book as BookRecord);
  const copyStats = computeBookCopyStats(book, borrowHistory);
  const percentAvailable = Math.round((copyStats.availableCopies / (copyStats.totalCopies || 1)) * 100);
  const percentReserved = Math.round((copyStats.reservedCopies / (copyStats.totalCopies || 1)) * 100);
  const percentUnavailable = Math.max(0, 100 - percentAvailable - percentReserved);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy citation:", err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop bg-slate-950/60 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn(
            "w-full max-w-lg overflow-hidden rounded-[28px] transition-colors",
            isLight
              ? "border-2 border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-900/15"
              : "border border-white/[0.08] bg-[#0E1B28]/95 backdrop-blur-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85)] text-white"
          )}
        >
          {/* Header */}
          <div className={cn("relative px-6 py-5 border-b", isLight ? "border-slate-200 bg-white" : "border-white/[0.06] bg-transparent")}>
            <div className="flex items-center justify-between gap-4">
              <span className={cn("text-[10px] font-black uppercase tracking-[0.25em]", isLight ? "text-[#0274BB]" : "text-[#FFD600]")}>
                BOOK ARCHIVE DETAILS
              </span>
              <button
                type="button"
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:scale-105 active:scale-95 cursor-pointer",
                  isLight
                    ? "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white hover:border-white/20"
                )}
                onClick={onClose}
                aria-label="Close book details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1 text-left">
                <h2 className={cn("text-xl font-bold tracking-tight leading-tight line-clamp-2", isLight ? "text-slate-900" : "text-white")}>
                  {book.title}
                </h2>
                <p className={cn("mt-1 text-xs font-semibold", isLight ? "text-slate-600" : "text-white/50")}>
                  By {book.author}
                </p>
                {typeof book.relevance === "number" && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider rounded px-1.5 py-0.5 border",
                      isLight
                        ? "bg-[#0274BB]/10 text-[#0274BB] border-[#0274BB]/25"
                        : "bg-[#FFD600]/10 text-[#FFD600] border-[#FFD600]/20"
                    )}>
                      AI Match Score
                    </span>
                    <span className={cn("text-xs font-black", isLight ? "text-slate-800" : "text-white/90")}>
                      {book.relevance}% Relevance
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 self-start sm:self-center">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black tracking-widest uppercase",
                    availabilityClasses(copyStats.status, isLight)
                  )}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
                  {copyStats.status}
                </span>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className={cn(
            "space-y-4 sm:space-y-5 px-6 py-5 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin",
            isLight
              ? "scrollbar-thumb-slate-300 scrollbar-track-transparent text-slate-800"
              : "scrollbar-thumb-white/10 scrollbar-track-transparent text-white"
          )}>
            {/* Dedicated Copy Inventory & Availability Section */}
            <div className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              isLight
                ? "border-2 border-slate-200 bg-gradient-to-br from-[#F4F9FF] via-[#EBF3FC] to-[#E3EFFB] text-slate-900 shadow-sm"
                : "border border-[#FFD600]/20 bg-gradient-to-br from-[#152E47]/70 to-[#0F1D29]/90 text-white shadow-lg"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg",
                    isLight ? "bg-[#0274BB]/15 text-[#0274BB]" : "bg-[#FFD600]/15 text-[#FFD600]"
                  )}>
                    <BookOpen className="h-3.5 w-3.5" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    isLight ? "text-[#0274BB]" : "text-[#FFD600]"
                  )}>
                    COPY INVENTORY & AVAILABILITY
                  </span>
                </div>
                <span className={cn(
                  "text-xs font-mono font-bold",
                  isLight ? "text-slate-800" : "text-white/90"
                )}>
                  {copyStats.availableCopies} of {copyStats.totalCopies} Available
                </span>
              </div>

              {/* 4-metric copy breakdown cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className={cn(
                  "rounded-xl border p-2 text-center transition-colors",
                  isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-black/25"
                )}>
                  <p className={cn("text-[8px] font-bold uppercase tracking-wider", isLight ? "text-slate-600" : "text-slate-400")}>Total Physical</p>
                  <p className={cn("mt-0.5 text-base font-black", isLight ? "text-slate-900" : "text-white")}>{copyStats.totalCopies}</p>
                  <p className={cn("text-[9px]", isLight ? "text-slate-500 font-medium" : "text-slate-500")}>In System</p>
                </div>

                <div className={cn(
                  "rounded-xl border p-2 text-center transition-colors",
                  isLight ? "border-emerald-300 bg-emerald-50 shadow-xs" : "border-emerald-500/20 bg-emerald-500/5"
                )}>
                  <p className={cn("text-[8px] font-bold uppercase tracking-wider", isLight ? "text-emerald-800" : "text-emerald-400")}>Available</p>
                  <p className={cn("mt-0.5 text-base font-black", isLight ? "text-emerald-700" : "text-emerald-300")}>{copyStats.availableCopies}</p>
                  <p className={cn("text-[9px] font-medium", isLight ? "text-emerald-700/80" : "text-emerald-400/70")}>For Checkout</p>
                </div>

                <div className={cn(
                  "rounded-xl border p-2 text-center transition-colors",
                  isLight ? "border-amber-300 bg-amber-50 shadow-xs" : "border-amber-500/20 bg-amber-500/5"
                )}>
                  <p className={cn("text-[8px] font-bold uppercase tracking-wider", isLight ? "text-amber-800" : "text-amber-400")}>Reserved</p>
                  <p className={cn("mt-0.5 text-base font-black", isLight ? "text-amber-700" : "text-amber-300")}>{copyStats.reservedCopies}</p>
                  <p className={cn("text-[9px] font-medium", isLight ? "text-amber-700/80" : "text-amber-400/70")}>Pending Holds</p>
                </div>

                <div className={cn(
                  "rounded-xl border p-2 text-center transition-colors",
                  isLight ? "border-rose-300 bg-rose-50 shadow-xs" : "border-rose-500/20 bg-rose-500/5"
                )}>
                  <p className={cn("text-[8px] font-bold uppercase tracking-wider", isLight ? "text-rose-800" : "text-rose-400")}>On Loan</p>
                  <p className={cn("mt-0.5 text-base font-black", isLight ? "text-rose-700" : "text-rose-300")}>{copyStats.unavailableCopies}</p>
                  <p className={cn("text-[9px] font-medium", isLight ? "text-rose-700/80" : "text-rose-400/70")}>Borrowed</p>
                </div>
              </div>

              {/* Allocation bar */}
              <div className="mt-3 space-y-1">
                <div className={cn("flex justify-between text-[9px] font-semibold", isLight ? "text-slate-600" : "text-slate-400 font-medium")}>
                  <span>Stock Allocation</span>
                  <span>{percentAvailable}% In Circulation Ready</span>
                </div>
                <div className={cn(
                  "h-1.5 w-full rounded-full overflow-hidden flex border",
                  isLight ? "bg-slate-200 border-slate-300" : "bg-white/5 border-white/5"
                )}>
                  {copyStats.availableCopies > 0 && (
                    <div
                      className="bg-emerald-500 transition-all duration-300"
                      style={{ width: `${percentAvailable}%` }}
                    />
                  )}
                  {copyStats.reservedCopies > 0 && (
                    <div
                      className="bg-amber-500 transition-all duration-300"
                      style={{ width: `${percentReserved}%` }}
                    />
                  )}
                  {copyStats.unavailableCopies > 0 && (
                    <div
                      className="bg-rose-500 transition-all duration-300"
                      style={{ width: `${percentUnavailable}%` }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Visual Relevance Meter (if applicable) */}
            {typeof book.relevance === "number" && (
              <div className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                isLight
                  ? "border-blue-200 bg-blue-50/60"
                  : "border-[#FFD600]/20 bg-gradient-to-r from-[#FFD600]/5 to-transparent"
              )}>
                <div className={cn(
                  "flex items-center justify-between text-[9px] uppercase font-black tracking-widest mb-2",
                  isLight ? "text-[#0274BB]" : "text-[#FFD600]"
                )}>
                  <span>SEMANTIC MATCH STRENGTH</span>
                  <span className={cn("text-xs font-black", isLight ? "text-slate-900" : "text-white")}>
                    {book.relevance}%
                  </span>
                </div>
                <div className={cn(
                  "h-2 w-full rounded-full overflow-hidden border",
                  isLight ? "bg-slate-200 border-slate-300" : "bg-white/[0.04] border-white/[0.02]"
                )}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${book.relevance}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      isLight
                        ? "bg-gradient-to-r from-[#0274BB] to-blue-500 shadow-[0_0_12px_rgba(2,116,187,0.3)]"
                        : "bg-gradient-to-r from-[#FFD600] to-amber-400 shadow-[0_0_12px_rgba(255,214,0,0.4)]"
                    )}
                  />
                </div>
              </div>
            )}

            {/* Standard Key-Value Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="ISBN" value={book.isbn} icon={Tag} isMono isLight={isLight} />
              <Detail label="Department" value={book.department} icon={Info} isLight={isLight} />
              <Detail label="Genre" value={book.genres || book.category || "General Collection"} icon={Tag} isLight={isLight} />
              <Detail
                label="Call Number"
                value={book.callNumber || book.shelfLocation || "Unavailable"}
                icon={Clock3}
                isMono
                isLight={isLight}
              />
              <Detail
                label="Pub. Date"
                value={book.publicationDate || book.publishedDate ? formatDate(book.publicationDate || book.publishedDate || "") : "—"}
                icon={Calendar}
                isLight={isLight}
              />
              <Detail
                label="Accession No."
                value={book.accessionNumber || generateAccessionNumber({
                  title: book.title,
                  isbn: book.isbn,
                  publicationDate: book.publicationDate || book.publishedDate,
                  department: book.department,
                  copies: book.copies,
                })}
                icon={Sparkles}
                isMono
                isLight={isLight}
              />
              <Detail
                label="Volume"
                value={book.volume || "Single Volume / None"}
                icon={Layers}
                isLight={isLight}
              />
              <Detail
                label="Edition"
                value={book.edition || "Single Edition / None"}
                icon={Bookmark}
                isLight={isLight}
              />
              <Detail
                label="Copies In System"
                value={String(copyStats.totalCopies)}
                icon={Copy}
                isLight={isLight}
              />
            </div>

            {/* Book Card (Physical Library Checkout Card) */}
            <div className={cn(
              "rounded-2xl border-2 overflow-hidden shadow-sm text-left transition-colors",
              isLight
                ? "border-slate-300 bg-white"
                : "border-white/10 bg-[#1a2332] shadow-xl"
            )}>
              {/* Header: Centered titled BOOK CARD */}
              <div className={cn(
                "border-b-2 py-2.5 sm:py-3 text-center",
                isLight ? "border-slate-300 bg-[#F0F7FF] text-[#0274BB]" : "border-white/15 bg-white/[0.02] text-white"
              )}>
                <h3 className="text-sm sm:text-base font-black tracking-wider uppercase">
                  BOOK CARD
                </h3>
              </div>

              {/* Subheader: Title of Book */}
              <div className={cn(
                "border-b-2 px-4 py-2 text-xs sm:text-sm font-bold flex items-center gap-1.5 min-w-0",
                isLight ? "border-slate-300 bg-slate-50 text-slate-700" : "border-white/15 bg-white/[0.01] text-white"
              )}>
                <span className={cn("shrink-0", isLight ? "text-slate-600 font-bold" : "text-slate-300")}>Title of Book:</span>
                <span className={cn("truncate font-extrabold", isLight ? "text-slate-900" : "text-white")}>{book.title}</span>
              </div>

              {/* Column Headers */}
              <div className={cn(
                "flex border-b-2 text-xs font-bold",
                isLight ? "border-slate-300 bg-[#F0F7FF] text-[#0274BB]" : "border-white/15 bg-white/[0.03] text-slate-200"
              )}>
                <div className={cn(
                  "w-[120px] sm:w-[140px] shrink-0 px-3.5 py-2 border-r-2",
                  isLight ? "border-slate-300 font-extrabold" : "border-white/15"
                )}>
                  Borrow Date:
                </div>
                <div className={cn("flex-1 min-w-0 px-3.5 py-2", isLight ? "font-extrabold" : "")}>
                  Borrower’s Name:
                </div>
              </div>

              {/* Fixed 12 Rows Table with crisp border lines */}
              <div className={cn(
                "divide-y",
                isLight ? "divide-slate-300 bg-white" : "divide-white/10"
              )}>
                {Array.from({ length: Math.max(TOTAL_BOOK_CARD_ROWS, borrowHistory.length) }).map((_, idx) => {
                  const entry = borrowHistory[idx];
                  const borrowDateFormatted = entry?.borrowDate ? formatBorrowDate(entry.borrowDate) : "";
                  const borrowerName = entry?.borrowerName || "";

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex min-h-[30px] sm:min-h-[32px] items-stretch text-xs transition-colors border-b last:border-b-0",
                        isLight
                          ? "border-slate-300 hover:bg-sky-50/60"
                          : "border-white/10 hover:bg-white/[0.02]"
                      )}
                    >
                      <div className={cn(
                        "w-[120px] sm:w-[140px] shrink-0 px-3.5 py-1.5 font-mono text-[11px] sm:text-xs truncate flex items-center border-r-2",
                        isLight ? "border-slate-300 text-slate-800 font-bold" : "border-white/10 text-slate-300"
                      )}>
                        {borrowDateFormatted ? borrowDateFormatted : <span className="opacity-0 select-none">&nbsp;</span>}
                      </div>
                      <div className={cn(
                        "flex-1 min-w-0 px-3.5 py-1.5 text-xs truncate flex items-center",
                        isLight ? "text-slate-900 font-semibold" : "text-slate-200 font-medium"
                      )}>
                        {borrowerName ? borrowerName : <span className="opacity-0 select-none">&nbsp;</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Description with Truncation (3-4 lines + See More/Less toggle) */}
            <div className={cn(
              "rounded-2xl border p-4 sm:p-5 text-left transition-all",
              isLight
                ? "border-2 border-slate-200 bg-slate-50/80 text-slate-800"
                : "border border-white/[0.05] bg-white/[0.02] text-white"
            )}>
              <div className="flex items-center justify-between mb-2">
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-[0.25em]",
                  isLight ? "text-[#0274BB]" : "text-[#FFD600]/80"
                )}>
                  Summary Description
                </p>
              </div>
              <div className="relative">
                <p
                  className={cn(
                    "text-xs leading-relaxed transition-all duration-200",
                    isLight ? "text-slate-700" : "text-white/70",
                    !isSummaryExpanded ? "line-clamp-3 sm:line-clamp-4" : ""
                  )}
                >
                  {book.summary || "No summary available for this title."}
                </p>
                {book.summary && book.summary.trim().length > 140 && (
                  <button
                    type="button"
                    onClick={() => setIsSummaryExpanded((prev) => !prev)}
                    className={cn(
                      "mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold tracking-wide transition-colors focus:outline-none rounded px-1 -ml-1 py-0.5 select-none cursor-pointer",
                      isLight ? "text-[#0274BB] hover:text-[#02568B]" : "text-[#FFD600] hover:text-[#FFE55C]"
                    )}
                  >
                    <span>{isSummaryExpanded ? "See Less" : "See More"}</span>
                    {isSummaryExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* APA Scholarly Citation Box */}
            <div className={cn(
              "rounded-2xl border p-5 relative overflow-hidden group transition-colors",
              isLight
                ? "border-2 border-slate-200 bg-gradient-to-br from-[#F4F9FF] to-white"
                : "border border-white/[0.05] bg-[#14293E]/30"
            )}>
              {!isLight && (
                <div className="absolute -right-20 -bottom-20 w-32 h-32 rounded-full bg-[#FFD600]/5 blur-3xl group-hover:bg-[#FFD600]/8 transition-all duration-500" />
              )}
              
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-[0.25em]",
                  isLight ? "text-[#0274BB]" : "text-[#FFD600]"
                )}>
                  APA SCHOLARLY CITATION
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-black tracking-widest uppercase transition active:scale-95 cursor-pointer",
                    isLight
                      ? "bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-xs"
                      : "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      COPIED
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      COPY TEXT
                    </>
                  )}
                </button>
              </div>
              <p className={cn(
                "text-xs font-medium leading-relaxed font-mono p-4 rounded-xl border select-all text-left relative z-10 break-words",
                isLight
                  ? "bg-white border-2 border-slate-200 text-slate-800 shadow-xs"
                  : "bg-black/25 border border-white/5 text-white/85"
              )}>
                {citation}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Detail({
  label,
  value,
  icon: Icon,
  isMono = false,
  isLight = false,
}: {
  label: string;
  value: string;
  icon: typeof Info;
  isMono?: boolean;
  isLight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
        isLight
          ? "border-2 border-slate-200 bg-slate-50/80 shadow-xs"
          : "border-white/[0.04] bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border",
          isLight
            ? "bg-blue-50 text-[#0274BB] border-blue-200"
            : "bg-[#FFD600]/10 text-[#FFD600] border-[#FFD600]/15"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className={cn("text-[9px] font-black uppercase tracking-wider", isLight ? "text-slate-500" : "text-white/40")}>
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-xs font-bold",
            isLight ? "text-slate-900" : "text-white/95",
            isMono ? "font-mono" : ""
          )}
        >
          {value || "Unavailable"}
        </p>
      </div>
    </div>
  );
}

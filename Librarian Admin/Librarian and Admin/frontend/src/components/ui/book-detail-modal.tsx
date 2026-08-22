"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Clock3, Info, Tag, X, BookOpen, ChevronDown, ChevronUp } from "lucide-react";

import { generateApaCitation } from "@/lib/utils";
import type { BookAvailability, BookRecord } from "@/lib/types";

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
  genres?: string;
  availability?: BookAvailability | string;
  publicationDate?: string;
  summary?: string;
  relevance?: number;
  copies?: number;
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

  // Active loans: status is Approved / Borrowed / On Loan / Active or type Borrow and not returned/declined
  const activeLoans = borrowHistory.filter((tx) => {
    const st = (tx.status || "").toLowerCase();
    if (st === "returned" || st === "declined" || st === "cancelled" || st === "completed") {
      return false;
    }
    return (
      st === "approved" ||
      st === "borrowed" ||
      st === "on loan" ||
      st === "onloan" ||
      st === "active" ||
      (tx.type?.toLowerCase() === "borrow" && st !== "pending")
    );
  });

  // Active reservations: Pending or Reserved holds
  const activeReservations = borrowHistory.filter((tx) => {
    const st = (tx.status || "").toLowerCase();
    if (st === "returned" || st === "declined" || st === "cancelled" || st === "completed" || st === "approved") {
      return false;
    }
    return st === "pending" || st === "reserved" || st === "upcoming" || tx.type?.toLowerCase() === "reservation";
  });

  let unavailableCopies = activeLoans.length;
  let reservedCopies = activeReservations.length;
  let availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);

  let status: NormalizedStatus = "Available";

  if (activeLoans.length > 0 || activeReservations.length > 0) {
    if (unavailableCopies >= totalCopies || availableCopies === 0) {
      status = unavailableCopies > 0 ? "Unavailable" : "Reserved";
    } else if (reservedCopies > 0 && availableCopies <= reservedCopies) {
      status = "Reserved";
    } else if (activeLoans.length > 0 && totalCopies === 1) {
      status = "Unavailable";
    } else {
      status = "Available";
    }
  } else {
    // Fallback to base book availability when no active transaction entries exist
    status = baseStatus;
    if (status === "Unavailable") {
      unavailableCopies = totalCopies;
      availableCopies = 0;
      reservedCopies = 0;
    } else if (status === "Reserved") {
      reservedCopies = 1;
      availableCopies = Math.max(0, totalCopies - 1);
      unavailableCopies = 0;
    } else {
      availableCopies = totalCopies;
      reservedCopies = 0;
      unavailableCopies = 0;
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

function resolveBorrowerName(tx: any, defaultStudentName?: string): string {
  return (
    tx.borrowerName ||
    tx.studentName ||
    tx.studentFullName ||
    tx.userName ||
    tx.userFullName ||
    tx.user_name ||
    tx.name ||
    (tx.studentId ? `Student (${tx.studentId})` : defaultStudentName || "Student")
  );
}

function resolveBorrowDate(tx: any): string {
  const rawDate =
    tx.borrowDate ||
    tx.pickupDate ||
    tx.requestedAt ||
    tx.date ||
    tx.createdAt ||
    tx.requested_at ||
    tx.created_at;

  return formatBorrowDate(rawDate);
}

const TOTAL_BOOK_CARD_ROWS = 12;

const availabilityClasses = (availability?: BookAvailability | string) => {
  const normalized = normalizeStatus(availability);
  if (normalized === "Available") {
    return "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.35)]";
  }

  if (normalized === "Reserved") {
    return "bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.35)]";
  }

  return "bg-rose-500/20 text-rose-300 border-rose-400/40 shadow-[0_0_20px_rgba(244,63,94,0.35)]";
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
          if (isMatchingBook(entry, book)) {
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
            if (isMatchingBook(t, book)) {
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
            if (isMatchingBook(t, book)) {
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
                if (isMatchingBook(r, book)) {
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
                if (isMatchingBook(h, book)) {
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
                if (isMatchingBook(g, book)) {
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

    return () => {
      isMounted = false;
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0E1B28]/95 backdrop-blur-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85)] text-white"
        >
          {/* Header */}
          <div className="relative border-b border-white/[0.06] px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFD600]">
                BOOK ARCHIVE DETAILS
              </span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:bg-white/5 hover:text-white hover:border-white/20 hover:scale-105 active:scale-95"
                onClick={onClose}
                aria-label="Close book details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1 text-left">
                <h2 className="text-xl font-bold tracking-tight text-white leading-tight line-clamp-2">{book.title}</h2>
                <p className="mt-1 text-xs font-semibold text-white/50">By {book.author}</p>
                {typeof book.relevance === "number" && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#FFD600] bg-[#FFD600]/10 border border-[#FFD600]/20 rounded px-1.5 py-0.5">
                      AI Match Score
                    </span>
                    <span className="text-xs font-black text-white/90">
                      {book.relevance}% Relevance
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 self-start sm:self-center">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black tracking-widest uppercase ${availabilityClasses(
                    copyStats.status,
                  )}`}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
                  {copyStats.status}
                </span>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="space-y-4 sm:space-y-5 px-6 py-5 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Dedicated Copy Inventory & Availability Section */}
            <div className="rounded-2xl border border-[#FFD600]/20 bg-gradient-to-br from-[#152E47]/70 to-[#0F1D29]/90 p-4 shadow-lg text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FFD600]/15 text-[#FFD600]">
                    <BookOpen className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD600]">
                    COPY INVENTORY & AVAILABILITY
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-white/90">
                  {copyStats.availableCopies} of {copyStats.totalCopies} Available
                </span>
              </div>

              {/* 3-metric copy breakdown cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/5 bg-black/25 p-2.5 text-center">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Total Physical</p>
                  <p className="mt-0.5 text-base font-black text-white">{copyStats.totalCopies}</p>
                  <p className="text-[9px] text-slate-500">In System</p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-center">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-400">Available</p>
                  <p className="mt-0.5 text-base font-black text-emerald-300">{copyStats.availableCopies}</p>
                  <p className="text-[9px] text-emerald-400/70">For Checkout</p>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-center">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-amber-400">Reserved / Loan</p>
                  <p className="mt-0.5 text-base font-black text-amber-300">{copyStats.reservedCopies + copyStats.unavailableCopies}</p>
                  <p className="text-[9px] text-amber-400/70">Active Holds</p>
                </div>
              </div>

              {/* Allocation bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>Stock Allocation</span>
                  <span>{percentAvailable}% In Circulation Ready</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden flex border border-white/5">
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
              <div className="rounded-2xl border border-[#FFD600]/20 bg-gradient-to-r from-[#FFD600]/5 to-transparent p-4 text-left">
                <div className="flex items-center justify-between text-[9px] uppercase font-black tracking-widest text-[#FFD600] mb-2">
                  <span>SEMANTIC MATCH STRENGTH</span>
                  <span className="text-xs font-black text-white">
                    {book.relevance}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/[0.04] overflow-hidden border border-white/[0.02]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${book.relevance}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-[#FFD600] to-amber-400 shadow-[0_0_12px_rgba(255,214,0,0.4)]"
                  />
                </div>
              </div>
            )}

            {/* Standard Key-Value Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="ISBN" value={book.isbn} icon={Tag} isMono />
              <Detail label="Department" value={book.department} icon={Info} />
              <Detail label="Shelf Location" value={book.shelfLocation || "Unavailable"} icon={Clock3} />
              <Detail label="Genre" value={book.genres || "General collection"} icon={Tag} />
            </div>

            {/* Book Card (Physical Library Checkout Card) */}
            <div className="rounded-2xl border border-white/10 bg-[#1a2332] overflow-hidden shadow-xl text-left">
              {/* Header: Centered titled BOOK CARD */}
              <div className="border-b border-white/15 bg-white/[0.02] py-2.5 sm:py-3 text-center">
                <h3 className="text-sm sm:text-base font-black tracking-wider text-white uppercase">
                  BOOK CARD
                </h3>
              </div>

              {/* Subheader: Title of Book */}
              <div className="border-b border-white/15 bg-white/[0.01] px-4 py-2 text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-slate-300">Title of Book:</span>
                <span className="truncate text-white font-extrabold">{book.title}</span>
              </div>

              {/* Column Headers */}
              <div className="flex border-b border-white/15 bg-white/[0.03] text-xs font-bold text-slate-200">
                <div className="w-[120px] sm:w-[140px] shrink-0 px-3.5 py-2 border-r border-white/15">
                  Borrow Date:
                </div>
                <div className="flex-1 min-w-0 px-3.5 py-2">
                  Borrower’s Name:
                </div>
              </div>

              {/* Fixed 12 Rows Table */}
              <div className="divide-y divide-white/10">
                {Array.from({ length: Math.max(TOTAL_BOOK_CARD_ROWS, borrowHistory.length) }).map((_, idx) => {
                  const entry = borrowHistory[idx];
                  const borrowDateFormatted = entry?.borrowDate ? formatBorrowDate(entry.borrowDate) : "";
                  const borrowerName = entry?.borrowerName || "";

                  return (
                    <div
                      key={idx}
                      className="flex min-h-[26px] sm:min-h-[28px] items-center text-xs transition-colors hover:bg-white/[0.02]"
                    >
                      <div className="w-[120px] sm:w-[140px] shrink-0 px-3.5 py-1 font-mono text-[11px] sm:text-xs text-slate-300 border-r border-white/10 truncate">
                        {borrowDateFormatted ? borrowDateFormatted : <span className="opacity-0 select-none">-</span>}
                      </div>
                      <div className="flex-1 min-w-0 px-3.5 py-1 text-xs text-slate-200 font-medium truncate">
                        {borrowerName ? borrowerName : <span className="opacity-0 select-none">-</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Description with Truncation (3-4 lines + See More/Less toggle) */}
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 sm:p-5 text-left transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFD600]/80">
                  Summary Description
                </p>
              </div>
              <div className="relative">
                <p
                  className={`text-xs leading-relaxed text-white/70 transition-all duration-200 ${
                    !isSummaryExpanded ? "line-clamp-3 sm:line-clamp-4" : ""
                  }`}
                >
                  {book.summary || "No summary available for this title."}
                </p>
                {book.summary && book.summary.trim().length > 140 && (
                  <button
                    type="button"
                    onClick={() => setIsSummaryExpanded((prev) => !prev)}
                    className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-[#FFD600] hover:text-[#FFE55C] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FFD600]/50 rounded px-1 -ml-1 py-0.5 select-none cursor-pointer"
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
            <div className="rounded-2xl border border-white/[0.05] bg-[#14293E]/30 p-5 relative overflow-hidden group">
              <div className="absolute -right-20 -bottom-20 w-32 h-32 rounded-full bg-[#FFD600]/5 blur-3xl group-hover:bg-[#FFD600]/8 transition-all duration-500" />
              
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFD600]">
                  APA SCHOLARLY CITATION
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-1.5 text-[9px] font-black tracking-widest uppercase text-white/80 transition active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
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
              <p className="text-xs font-medium text-white/85 leading-relaxed font-mono bg-black/25 p-4 rounded-xl border border-white/5 select-all text-left relative z-10 break-words">
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
}: {
  label: string;
  value: string;
  icon: typeof Info;
  isMono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFD600]/10 text-[#FFD600] border border-[#FFD600]/15">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[9px] font-black uppercase tracking-wider text-white/40">{label}</p>
        <p className={`mt-0.5 truncate text-xs font-bold text-white/95 ${isMono ? "font-mono" : ""}`}>
          {value || "Unavailable"}
        </p>
      </div>
    </div>
  );
}

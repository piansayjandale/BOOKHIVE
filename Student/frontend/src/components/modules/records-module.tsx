"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Info,
  Library,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";

import { useRouter } from "next/navigation";
import type { BookRecord, Department } from "@/lib/types";

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

export function computeBookCopyStats(book: BookRecord | { copies?: number; availability?: string } | null | undefined) {
  const status = normalizeStatus(book?.availability);
  const totalCopies = Math.max(1, Number(book?.copies) || 1);

  let availableCopies = totalCopies;
  let reservedCopies = 0;
  let unavailableCopies = 0;

  if (status === "Unavailable") {
    availableCopies = 0;
    reservedCopies = 0;
    unavailableCopies = totalCopies;
  } else if (status === "Reserved") {
    reservedCopies = 1;
    availableCopies = Math.max(0, totalCopies - 1);
    unavailableCopies = 0;
  } else {
    availableCopies = totalCopies;
    reservedCopies = 0;
    unavailableCopies = 0;
  }

  return {
    totalCopies,
    availableCopies,
    reservedCopies,
    unavailableCopies,
    status,
  };
}

const departmentOptions: Array<Department | "All"> = [
  "All",
  "Circulation",
  "General Reference",
  "Filipiniana",
  "Reserve",
  "Periodical",
  "Special Collections",
];

const DEPT_COLORS: Record<string, string> = {
  "Circulation":         "#6EE7B7",
  "General Reference":  "#93C5FD",
  "Filipiniana":        "#FDE68A",
  "Reserve":            "#FCA5A5",
  "Periodical":         "#C4B5FD",
  "Special Collections":"#F9A8D4",
  "All":                "#94A3B8",
};

const emptyBookForm = {
  title: "",
  author: "",
  isbn: "",
  publicationDate: "2025-01-01",
  department: "Circulation" as Department,
  shelfLocation: "",
  summary: "",
  availability: "Available" as BookRecord["availability"],
  genres: "",
  copies: 1,
};

function AvailBadge({ status }: { status: BookRecord["availability"] | "Unavailable" | string }) {
  const normalized = normalizeStatus(status);
  const map: Record<NormalizedStatus, { badge: string; dot: string }> = {
    Available: {
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      dot: "bg-emerald-400",
    },
    Reserved: {
      badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      dot: "bg-amber-400",
    },
    Unavailable: {
      badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      dot: "bg-rose-400",
    },
  };
  const config = map[normalized];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${config.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {normalized}
    </span>
  );
}

export function RecordsModule() {
  const router = useRouter();
  const [books, setBooks]           = useState<BookRecord[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [search, setSearch]         = useState("");
  const [department, setDepartment] = useState<Department | "All">("All");
  const [page, setPage]             = useState(1);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(emptyBookForm);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<BookRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookRecord | null>(null);

  const [dashboardSummary, setDashboardSummary] = useState<{
    totalBooks: number;
    activeBorrowedBooks: number;
    pendingRequests: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchSummary() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.summary) {
          setDashboardSummary({
            totalBooks: data.summary.totalBooks || 0,
            activeBorrowedBooks: data.summary.activeBorrowedBooks || 0,
            pendingRequests: data.summary.pendingRequests || 0,
          });
        }
      } catch {
        // ignore
      }
    }
    void fetchSummary();
    return () => { isMounted = false; };
  }, []);

  const deferredSearch = useDeferredValue(search);
  const pageSize = 60;

  const loadBooks = useCallback(async () => {
    const params = new URLSearchParams({
      search: deferredSearch,
      department,
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await fetch(`/api/records?${params}`);
    if (!res.ok) return;
    const payload = (await res.json()) as { books: BookRecord[]; total: number };
    startTransition(() => {
      setBooks(payload.books);
      setTotalBooks(payload.total);
    });
  }, [deferredSearch, department, page]);

  useEffect(() => { void loadBooks(); }, [loadBooks]);

  useEffect(() => {
    if (!search.trim()) {
      setSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          search: search,
          department,
          page: "1",
          pageSize: "5",
        });
        const res = await fetch(`/api/records?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.books) {
          setSuggestions(data.books);
        }
      } catch (err) {
        console.error("Suggestions load error:", err);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [search, department]);

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      const container = document.getElementById("search-autocomplete-container");
      if (container && !container.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  // Alphabetical grouping by first letter of title
  const groupedRows = useMemo(() => {
    const sorted = [...books].sort((a, b) => a.title.localeCompare(b.title));
    const rows: Array<{ type: "letter"; letter: string } | { type: "book"; book: BookRecord }> = [];
    let current = "";
    for (const book of sorted) {
      const letter = book.title[0]?.toUpperCase() ?? "#";
      if (letter !== current) {
        current = letter;
        rows.push({ type: "letter", letter });
      }
      rows.push({ type: "book", book });
    }
    return rows;
  }, [books]);

  const totalPages = Math.max(1, Math.ceil(totalBooks / pageSize));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        availability: normalizeStatus(form.availability),
      }),
    });
    setForm(emptyBookForm);
    setShowModal(false);
    await loadBooks();
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    router.push("/admin/book-management?tab=archived");
  }

  // Inventory Summary Metrics (accurate client synchronization)
  const stats = useMemo(() => {
    if ((search.trim() !== "" || department !== "All") && totalBooks <= books.length && books.length > 0) {
      let totalCopies = 0;
      let availCopies = 0;
      let resCopies = 0;
      let unavailCopies = 0;
      let availRecords = 0;
      let resRecords = 0;
      let unavailRecords = 0;

      for (const b of books) {
        const c = computeBookCopyStats(b);
        totalCopies += c.totalCopies;
        availCopies += c.availableCopies;
        resCopies += c.reservedCopies;
        unavailCopies += c.unavailableCopies;

        if (c.status === "Available") availRecords++;
        else if (c.status === "Reserved") resRecords++;
        else unavailRecords++;
      }

      return {
        total: totalBooks,
        totalCopies: totalCopies || totalBooks,
        available: availRecords,
        reserved: resRecords,
        unavailable: unavailRecords,
        availableCopies: availCopies,
        reservedCopies: resCopies,
        unavailableCopies: unavailCopies,
      };
    }

    const unavailable = dashboardSummary?.activeBorrowedBooks ?? books.filter(b => normalizeStatus(b.availability) === "Unavailable").length;
    const reserved = dashboardSummary?.pendingRequests ?? books.filter(b => normalizeStatus(b.availability) === "Reserved").length;
    const safeUnavailable = Math.min(totalBooks, unavailable);
    const safeReserved = Math.min(Math.max(0, totalBooks - safeUnavailable), reserved);
    const available = Math.max(0, totalBooks - safeUnavailable - safeReserved);

    const avgCopies = books.length > 0
      ? books.reduce((acc, b) => acc + (Math.max(1, Number(b.copies) || 1)), 0) / books.length
      : 1;
    const totalCopies = Math.round(totalBooks * avgCopies);

    return {
      total: totalBooks,
      totalCopies: Math.max(totalBooks, totalCopies),
      available,
      reserved: safeReserved,
      unavailable: safeUnavailable,
    };
  }, [books, totalBooks, search, department, dashboardSummary]);

  return (
    <div className="flex h-full flex-col gap-6 px-1">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">Librarian · Records</p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">Catalog Inventory</h1>
          <p className="mt-0.5 text-sm text-slate-400">Browse, search and manage the shared book catalog.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          suppressHydrationWarning
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Book
        </button>
      </div>

      {/* ── Stat pills / Inventory Summary Metric Cards ─────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "TOTAL RECORDS",
            value: stats.total.toLocaleString(),
            sublabel: `${(stats.totalCopies ?? stats.total).toLocaleString()} Total Copies`,
            color: "#FCD400",
          },
          {
            label: "AVAILABLE",
            value: stats.available.toLocaleString(),
            sublabel: "Ready for Checkout",
            color: "#6EE7B7",
          },
          {
            label: "RESERVED",
            value: stats.reserved.toLocaleString(),
            sublabel: "On Hold / Pending",
            color: "#FCD34D",
          },
          {
            label: "UNAVAILABLE",
            value: stats.unavailable.toLocaleString(),
            sublabel: "Borrowed / On Loan",
            color: "#FCA5A5",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/8 bg-[#152E47]/60 px-5 py-4 backdrop-blur transition-all duration-200 hover:bg-[#152E47]/80"
            style={{ borderLeftColor: stat.color, borderLeftWidth: 4 }}
          >
            <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">{stat.label}</p>
            <p className="mt-1 text-2xl font-black text-white">{stat.value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">{stat.sublabel}</p>
          </div>
        ))}
      </div>

      {/* ── Search & filter ────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]" id="search-autocomplete-container">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
            placeholder="Search title, author, ISBN…"
            value={search}
            onChange={e => { setPage(1); setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-30 mt-1.5 rounded-xl border border-white/8 bg-[#0F1D29]/95 p-2 shadow-2xl backdrop-blur-md">
              <div className="space-y-1">
                {suggestions.map((book) => (
                  <button
                    key={`suggestion-${book.id}`}
                    onClick={() => {
                      setSearch(book.title);
                      setShowSuggestions(false);
                    }}
                    className="w-full flex items-center justify-between rounded-lg p-2 text-left hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-white line-clamp-1">{book.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{book.author}</p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                      {book.isbn}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            suppressHydrationWarning
            className="rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-8 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none"
            value={department}
            onChange={e => { setPage(1); setDepartment(e.target.value as Department | "All"); }}
          >
            {departmentOptions.map(d => <option key={d} value={d} className="bg-[#0F1D29]">{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur">
        <div className="overflow-auto h-full">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-20 bg-[#0F1D29]/95 backdrop-blur border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Book / Author</th>
                <th className="px-5 py-3 text-left">Department</th>
                <th className="px-5 py-3 text-left">ISBN</th>
                <th className="px-5 py-3 text-left">Shelf Location</th>
                <th className="px-5 py-3 text-left">Copy Tracking</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row, i) => {
                if (row.type === "letter") {
                  return (
                    <tr key={`letter-${row.letter}-${i}`} className="border-t border-b border-white/5 bg-white/[0.01]">
                      <td colSpan={7} className="px-5 py-2.5 text-center">
                        <span className="text-[11px] font-black tracking-[0.25em] text-[#FCD400] uppercase">
                          — {row.letter} —
                        </span>
                      </td>
                    </tr>
                  );
                }
                const book = row.book;
                const copyStats = computeBookCopyStats(book);
                const deptColor = DEPT_COLORS[book.department] ?? "#94A3B8";
                return (
                  <tr
                    key={book.id}
                    className="border-b border-white/5 transition hover:bg-white/[0.04] cursor-pointer group"
                    onClick={() => setSelectedBookDetails(book)}
                  >
                    <td className="px-5 py-3.5 max-w-[260px]">
                      <div className="font-semibold text-white leading-snug line-clamp-1 group-hover:text-[#FCD400] transition-colors">{book.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{book.author}</div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: deptColor }}>
                        <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: deptColor }} />
                        {book.department}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{book.isbn}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-300">
                      {book.shelfLocation ? (
                        <span>{book.shelfLocation}</span>
                      ) : (
                        <span className="text-slate-500 italic">Unavailable</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-white">{copyStats.availableCopies}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-300">{copyStats.totalCopies}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">Available</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <AvailBadge status={copyStats.status} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(book.id); }}
                        suppressHydrationWarning
                        className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-1.5 text-orange-400 hover:bg-orange-500/15 hover:border-orange-500/30 transition active:scale-95"
                        title="Archive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {groupedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-500">
                    <Library className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2">
        <span>{totalBooks.toLocaleString()} records · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            suppressHydrationWarning
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold disabled:opacity-30 hover:bg-white/10 transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            suppressHydrationWarning
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold disabled:opacity-30 hover:bg-white/10 transition"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Add Book Modal ─────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/12 bg-[#0F1D29] shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD400]/15">
                  <BookOpen className="h-4 w-4 text-[#FCD400]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#FCD400] uppercase">Catalog</p>
                  <h2 className="text-base font-black text-white">Add New Book</h2>
                </div>
              </div>
              <button
                suppressHydrationWarning
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Title</span>
                <input suppressHydrationWarning required className="modal-input" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Author</span>
                  <input suppressHydrationWarning required className="modal-input" value={form.author}
                    onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">ISBN</span>
                  <input suppressHydrationWarning className="modal-input" value={form.isbn}
                    onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Pub. Date</span>
                  <input suppressHydrationWarning type="date" className="modal-input" value={form.publicationDate}
                    onChange={e => setForm(f => ({ ...f, publicationDate: e.target.value }))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Department</span>
                  <select suppressHydrationWarning className="modal-input" value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))}>
                    {departmentOptions.filter(d => d !== "All").map(d => (
                      <option key={d} value={d} className="bg-[#0F1D29]">{d}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Status</span>
                  <select suppressHydrationWarning className="modal-input" value={form.availability}
                    onChange={e => setForm(f => ({ ...f, availability: e.target.value as BookRecord["availability"] }))}>
                    {["Available", "Reserved", "Unavailable"].map(s => (
                      <option key={s} value={s} className="bg-[#0F1D29]">{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Shelf Location</span>
                <input suppressHydrationWarning className="modal-input" value={form.shelfLocation}
                  onChange={e => setForm(f => ({ ...f, shelfLocation: e.target.value }))} />
              </label>

              <div className="grid grid-cols-3 gap-4">
                <label className="grid gap-1.5 col-span-2">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Genre</span>
                  <input
                    suppressHydrationWarning
                    className="modal-input"
                    value={form.genres}
                    onChange={(e) => setForm((f) => ({ ...f, genres: e.target.value }))}
                    placeholder="e.g. Science Fiction, Tech"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Copies</span>
                  <input
                    suppressHydrationWarning
                    type="number"
                    min={1}
                    className="modal-input"
                    value={form.copies}
                    onChange={(e) => setForm((f) => ({ ...f, copies: parseInt(e.target.value) || 1 }))}
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Summary</span>
                <textarea suppressHydrationWarning rows={3} className="modal-input resize-none" value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
              </label>

              <div className="flex justify-end gap-3 pt-1">
                <button suppressHydrationWarning type="button" onClick={() => setShowModal(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition">
                  Cancel
                </button>
                <button suppressHydrationWarning type="submit" disabled={submitting}
                  className="rounded-xl bg-[#FCD400] px-6 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 hover:brightness-110 disabled:opacity-60 transition">
                  {submitting ? "Saving…" : "Add Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inline styles for modal inputs ─────────────────── */}
      <style>{`
        .modal-input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.05);
          padding: 8px 12px;
          font-size: 13px;
          color: #fff;
          outline: none;
          transition: border-color 0.15s;
        }
        .modal-input:focus {
          border-color: rgba(252,212,0,0.5);
        }
        .modal-input option {
          background: #0F1D29;
        }
      `}</style>

      {/* ── Book Details Modal ("Book Archive Details") ─────── */}
      {selectedBookDetails && (() => {
        const modalCopyStats = computeBookCopyStats(selectedBookDetails);
        const percentAvailable = Math.round((modalCopyStats.availableCopies / (modalCopyStats.totalCopies || 1)) * 100);
        const percentReserved = Math.round((modalCopyStats.reservedCopies / (modalCopyStats.totalCopies || 1)) * 100);
        const percentUnavailable = Math.max(0, 100 - percentAvailable - percentReserved);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedBookDetails(null)}
            />

            {/* Panel */}
            <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/12 bg-[#0A1624] shadow-2xl shadow-black/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/8 px-8 py-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#14283F] to-transparent opacity-30" />
                <div className="relative z-10">
                  <p className="text-[10px] font-bold tracking-[0.25em] text-[#FCD400] uppercase mb-2">Book Archive Details</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{selectedBookDetails.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">By {selectedBookDetails.author}</p>
                  <div className="mt-3">
                    <AvailBadge status={modalCopyStats.status} />
                  </div>
                </div>
                <button
                  suppressHydrationWarning
                  onClick={() => setSelectedBookDetails(null)}
                  className="relative z-10 rounded-lg p-2 text-slate-400 hover:bg-white/8 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-8 grid gap-6 max-h-[70vh] overflow-y-auto">
                {/* Dedicated Copy Inventory & Availability Section */}
                <div className="rounded-2xl border border-[#FCD400]/20 bg-gradient-to-br from-[#152E47]/70 to-[#0F1D29]/90 p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FCD400]/15 text-[#FCD400]">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <h3 className="text-xs font-black tracking-widest text-[#FCD400] uppercase">
                        Copy Inventory & Availability
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {modalCopyStats.availableCopies} of {modalCopyStats.totalCopies} Available
                    </span>
                  </div>

                  {/* 3-metric copy breakdown cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white/8 bg-black/25 p-3 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Physical</p>
                      <p className="mt-1 text-lg font-black text-white">{modalCopyStats.totalCopies}</p>
                      <p className="text-[10px] text-slate-500">In System</p>
                    </div>

                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Available</p>
                      <p className="mt-1 text-lg font-black text-emerald-300">{modalCopyStats.availableCopies}</p>
                      <p className="text-[10px] text-emerald-400/70">For Checkout</p>
                    </div>

                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Reserved / Loan</p>
                      <p className="mt-1 text-lg font-black text-amber-300">{modalCopyStats.reservedCopies + modalCopyStats.unavailableCopies}</p>
                      <p className="text-[10px] text-amber-400/70">Active Holds</p>
                    </div>
                  </div>

                  {/* Visual availability progress bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>Stock Allocation</span>
                      <span>{percentAvailable}% In Circulation Ready</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden flex border border-white/5">
                      {modalCopyStats.availableCopies > 0 && (
                        <div
                          className="bg-emerald-500 transition-all duration-300"
                          style={{ width: `${percentAvailable}%` }}
                          title={`Available: ${modalCopyStats.availableCopies}`}
                        />
                      )}
                      {modalCopyStats.reservedCopies > 0 && (
                        <div
                          className="bg-amber-500 transition-all duration-300"
                          style={{ width: `${percentReserved}%` }}
                          title={`Reserved: ${modalCopyStats.reservedCopies}`}
                        />
                      )}
                      {modalCopyStats.unavailableCopies > 0 && (
                        <div
                          className="bg-rose-500 transition-all duration-300"
                          style={{ width: `${percentUnavailable}%` }}
                          title={`Unavailable: ${modalCopyStats.unavailableCopies}`}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD600]/10 text-[#FFD600]">
                      <Tag className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">ISBN</p>
                      <p className="text-sm font-bold text-white font-mono">{selectedBookDetails.isbn}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD600]/10 text-[#FFD600]">
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Department</p>
                      <p className="text-sm font-bold text-white">{selectedBookDetails.department}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD600]/10 text-[#FFD600]">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Shelf Location</p>
                      <p className="text-sm font-bold text-white">{selectedBookDetails.shelfLocation || "Unavailable"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD600]/10 text-[#FFD600]">
                      <Tag className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Genre</p>
                      <p className="text-sm font-bold text-white">{selectedBookDetails.genres || "Not specified"}</p>
                    </div>
                  </div>
                </div>

                {/* Citation */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-bold tracking-widest text-[#FCD400] uppercase">APA Scholarly Citation</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const text = `${selectedBookDetails.author}. (n.d.). ${selectedBookDetails.title}. STI West Negros University Library.`;
                        void navigator.clipboard.writeText(text);
                        alert("Citation copied to clipboard!");
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      COPY TEXT
                    </button>
                  </div>
                  <div className="rounded-lg bg-black/40 p-4 font-mono text-sm leading-relaxed text-slate-300 select-all">
                    {selectedBookDetails.author}. (n.d.). {selectedBookDetails.title}. STI West Negros University Library.
                  </div>
                </div>

                {/* Summary */}
                {selectedBookDetails.summary && (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                    <h3 className="mb-3 text-[11px] font-bold tracking-widest text-slate-500 uppercase">Summary Description</h3>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {selectedBookDetails.summary}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Scrollbar style indication */}
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#FCD400]/80 rounded-l" />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

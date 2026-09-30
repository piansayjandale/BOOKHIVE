"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Layers,
  Tag,
  Bookmark,
  CheckCircle2,
  Copy,
  Check,
  LayoutGrid,
  ListFilter,
  RefreshCcw,
  Sparkles,
  Library,
  Clock,
  X,
  MapPin,
  Barcode,
  Share2,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { AdminModal, AdminPageHeader } from "@/components/admin/shared";
import { useTheme } from "@/components/providers/theme-provider";
import { requestJson } from "@/lib/admin/client";
import type { AdminBookRecord, AdminBooksPayload } from "@/lib/admin/types";
import { cn, formatDate } from "@/lib/utils";

const DEPARTMENTS = [
  { name: "All", label: "All Holdings", count: "48,074" },
  { name: "Circulation", label: "Circulation", count: "46,602" },
  { name: "General Reference", label: "General Reference", count: "954" },
  { name: "Filipiniana", label: "Filipiniana", count: "65" },
  { name: "Reserve", label: "Reserve", count: "189" },
  { name: "Periodical", label: "Periodical", count: "264" },
  { name: "Special Collections", label: "Special Collections", count: "62" },
];

function AvailabilityBadge({ availability, isLight }: { availability?: string; isLight?: boolean }) {
  const isAvail = availability === "Available" || !availability;
  const isReserved = availability === "Reserved";

  if (isAvail) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm",
          isLight
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-500/5"
            : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-emerald-500/10"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isLight ? "bg-emerald-500" : "bg-emerald-400")} />
        Available
      </span>
    );
  }

  if (isReserved) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm",
          isLight
            ? "border-sky-200 bg-sky-50 text-sky-700 shadow-sky-500/5"
            : "border-sky-500/40 bg-sky-500/15 text-sky-300 shadow-sky-500/10"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", isLight ? "bg-sky-500" : "bg-sky-400")} />
        Reserved
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        isLight
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-amber-500/40 bg-amber-500/15 text-amber-300"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", isLight ? "bg-amber-500" : "bg-amber-400")} />
      {availability}
    </span>
  );
}

function DepartmentBadge({ department, isLight }: { department: string; isLight?: boolean }) {
  const darkStyles: Record<string, string> = {
    Circulation: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    "General Reference": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Filipiniana: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    Reserve: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    Periodical: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    "Special Collections": "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  };

  const lightStyles: Record<string, string> = {
    Circulation: "bg-amber-50 text-amber-800 border-amber-200",
    "General Reference": "bg-emerald-50 text-emerald-800 border-emerald-200",
    Filipiniana: "bg-purple-50 text-purple-800 border-purple-200",
    Reserve: "bg-sky-50 text-sky-800 border-sky-200",
    Periodical: "bg-rose-50 text-rose-800 border-rose-200",
    "Special Collections": "bg-indigo-50 text-indigo-800 border-indigo-200",
  };

  const currentStyle = isLight
    ? lightStyles[department] || "bg-slate-100 text-slate-700 border-slate-200"
    : darkStyles[department] || "bg-slate-500/15 text-slate-300 border-slate-500/30";

  return (
    <span className={cn("inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", currentStyle)}>
      {department}
    </span>
  );
}

export function CatalogPage() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [payload, setPayload] = useState<AdminBooksPayload | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedBook, setSelectedBook] = useState<AdminBookRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedModalCitation, setCopiedModalCitation] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const deferredSearch = useDeferredValue(search);

  const loadBooks = useCallback(async () => {
    setRefreshing(true);
    try {
      const statusParam = status === "All" ? "Active" : status;
      const nextPayload = await requestJson<AdminBooksPayload>(
        `/api/admin/books?search=${encodeURIComponent(deferredSearch)}&department=${encodeURIComponent(department)}&status=${encodeURIComponent(statusParam)}&page=${page}&pageSize=${pageSize}`,
      );
      startTransition(() => setPayload(nextPayload));
    } catch (err) {
      console.error("Failed to load catalog books:", err);
    } finally {
      setRefreshing(false);
    }
  }, [deferredSearch, department, page, pageSize, status]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  const booksList = payload?.books ?? [];
  const totalItems = payload?.total ?? 0;
  const totalPages = payload ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;

  // Extract unique categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    booksList.forEach((b) => {
      if (b.category && b.category.trim()) set.add(b.category.trim());
    });
    return Array.from(set);
  }, [booksList]);

  const filteredBooks = useMemo(() => {
    if (category === "All") return booksList;
    return booksList.filter((b) => b.category === category);
  }, [booksList, category]);

  function handleCopyCitation(book: AdminBookRecord, event?: React.MouseEvent) {
    if (event) event.stopPropagation();
    const citationText = book.apaCitation || `${book.author} (${book.publishedDate ? book.publishedDate.slice(0, 4) : "n.d."}). ${book.title}. BookHive Institutional Catalog.`;
    void navigator.clipboard.writeText(citationText);
    setCopiedId(book.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCopyModalCitation() {
    if (!selectedBook) return;
    const citationText = selectedBook.apaCitation || `${selectedBook.author} (${selectedBook.publishedDate ? selectedBook.publishedDate.slice(0, 4) : "n.d."}). ${selectedBook.title}. BookHive Institutional Catalog.`;
    void navigator.clipboard.writeText(citationText);
    setCopiedModalCitation(true);
    setTimeout(() => setCopiedModalCitation(false), 2000);
  }

  const isFiltering = search.trim() !== "" || department !== "All" || status !== "All" || category !== "All";

  function handleResetFilters() {
    setSearch("");
    setDepartment("All");
    setStatus("All");
    setCategory("All");
    setPage(1);
  }

  return (
    <div className={cn("space-y-6 transition-colors", isLight ? "text-slate-800" : "text-slate-100")}>
      {/* ── Top Header ─────────────────────────────────────────── */}
      <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b pb-5 transition-colors", isLight ? "border-slate-200" : "border-white/5")}>
        <div>
          <div className="flex items-center gap-2.5">
            <p className={cn("text-[11px] font-extrabold tracking-[0.22em] uppercase", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
              Admin · Catalog & Collection
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-xs",
                isLight
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isLight ? "bg-emerald-500" : "bg-emerald-400")} />
              Central Repository Active (48,074 Volumes)
            </span>
          </div>
          <h1 className={cn("mt-2 text-3xl font-black tracking-tight sm:text-4xl", isLight ? "text-slate-900" : "text-white")}>
            Resource Catalog
          </h1>
          <p className={cn("mt-1 max-w-3xl text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
            Comprehensive inventory search, shelf availability, category browsing, and academic citations across all institutional library holdings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle: Showcase Cards vs Dense Table */}
          <div
            className={cn(
              "flex items-center rounded-xl border p-0.5 text-xs font-semibold shadow-xs transition-colors",
              isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B1726]"
            )}
          >
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer font-bold",
                viewMode === "cards"
                  ? isLight
                    ? "bg-[#FFF300] text-[#0274BB] shadow-sm"
                    : "bg-[#FCD400] text-[#0B1A2C] shadow-sm"
                  : isLight
                    ? "text-slate-500 hover:text-[#0274BB] hover:bg-slate-50"
                    : "text-slate-400 hover:text-white"
              )}
              title="Interactive Book Showcase"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Showcase
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer font-bold",
                viewMode === "table"
                  ? isLight
                    ? "bg-[#FFF300] text-[#0274BB] shadow-sm"
                    : "bg-[#FCD400] text-[#0B1A2C] shadow-sm"
                  : isLight
                    ? "text-slate-500 hover:text-[#0274BB] hover:bg-slate-50"
                    : "text-slate-400 hover:text-white"
              )}
              title="Dense Inventory Table"
            >
              <ListFilter className="h-3.5 w-3.5" />
              Table
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadBooks()}
            disabled={refreshing}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50",
              isLight
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-[#0274BB]"
                : "border-white/10 bg-[#122335] text-slate-200 hover:bg-[#19324d] hover:text-white"
            )}
            title="Refresh repository"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && (isLight ? "animate-spin text-[#0274BB]" : "animate-spin text-[#FCD400]"))} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Top 4 KPI Telemetry Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Volumes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "relative overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur transition-all",
            isLight
              ? "border-slate-200/90 bg-white shadow-slate-200/50"
              : "border-white/10 bg-[#0F1D29]/90 shadow-lg"
          )}
          style={{ borderLeftColor: isLight ? "#0274BB" : "#FCD400", borderLeftWidth: 4 }}
        >
          <div className="flex items-center justify-between">
            <p className={cn("text-[11px] font-bold tracking-wider uppercase", isLight ? "text-slate-500" : "text-slate-400")}>Total Volumes</p>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", isLight ? "bg-[#FFF300] text-[#0274BB]" : "bg-[#FCD400]/15 text-[#FCD400]")}>
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <p className={cn("mt-2 font-mono text-3xl font-black", isLight ? "text-slate-900" : "text-white")}>48,074</p>
          <p className={cn("mt-1 text-[11px]", isLight ? "text-slate-500" : "text-slate-400")}>Institutional catalog records in DB</p>
        </motion.div>

        {/* Available on Shelf */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className={cn(
            "relative overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur transition-all",
            isLight
              ? "border-slate-200/90 bg-white shadow-slate-200/50"
              : "border-white/10 bg-[#0F1D29]/90 shadow-lg"
          )}
          style={{ borderLeftColor: "#10B981", borderLeftWidth: 4 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className={cn("text-[11px] font-bold tracking-wider uppercase", isLight ? "text-emerald-700" : "text-emerald-400")}>Shelf Ready</p>
            </div>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", isLight ? "bg-emerald-50 text-emerald-600" : "bg-emerald-500/15 text-emerald-400")}>
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className={cn("mt-2 font-mono text-3xl font-black", isLight ? "text-slate-900" : "text-white")}>46,602</p>
          <p className={cn("mt-1 text-[11px]", isLight ? "text-slate-500" : "text-slate-400")}>96.9% open-stack availability</p>
        </motion.div>

        {/* Active Circulation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={cn(
            "relative overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur transition-all",
            isLight
              ? "border-slate-200/90 bg-white shadow-slate-200/50"
              : "border-white/10 bg-[#0F1D29]/90 shadow-lg"
          )}
          style={{ borderLeftColor: "#38BDF8", borderLeftWidth: 4 }}
        >
          <div className="flex items-center justify-between">
            <p className={cn("text-[11px] font-bold tracking-wider uppercase", isLight ? "text-sky-700" : "text-sky-400")}>Active Circulation</p>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", isLight ? "bg-sky-50 text-sky-600" : "bg-sky-500/15 text-sky-400")}>
              <Bookmark className="h-4 w-4" />
            </div>
          </div>
          <p className={cn("mt-2 font-mono text-3xl font-black", isLight ? "text-slate-900" : "text-white")}>1,472</p>
          <p className={cn("mt-1 text-[11px]", isLight ? "text-slate-500" : "text-slate-400")}>Loans, reservations & reserves</p>
        </motion.div>

        {/* Academic Sections */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className={cn(
            "relative overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur transition-all",
            isLight
              ? "border-slate-200/90 bg-white shadow-slate-200/50"
              : "border-white/10 bg-[#0F1D29]/90 shadow-lg"
          )}
          style={{ borderLeftColor: "#A855F7", borderLeftWidth: 4 }}
        >
          <div className="flex items-center justify-between">
            <p className={cn("text-[11px] font-bold tracking-wider uppercase", isLight ? "text-purple-700" : "text-purple-400")}>Library Branches</p>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", isLight ? "bg-purple-50 text-purple-600" : "bg-purple-500/15 text-purple-400")}>
              <Library className="h-4 w-4" />
            </div>
          </div>
          <p className={cn("mt-2 font-mono text-3xl font-black", isLight ? "text-slate-900" : "text-white")}>6 Sections</p>
          <p className={cn("mt-1 text-[11px]", isLight ? "text-slate-500" : "text-slate-400")}>Circulation, Reference, Filipiniana...</p>
        </motion.div>
      </div>

      {/* ── Main Catalog Panel ─────────────────────────────────────── */}
      <div
        className={cn(
          "rounded-2xl border p-6 flex flex-col gap-6 transition-all",
          isLight
            ? "border-slate-200 bg-white shadow-sm"
            : "border-white/10 bg-[#0F1D29]/95 shadow-2xl backdrop-blur"
        )}
      >
        {/* Department Quick Filter Scroller */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={cn("text-[11px] font-bold tracking-wider uppercase", isLight ? "text-slate-700" : "text-slate-400")}>
              🏛️ Academic Sections & Shelf Stacks
            </span>
            {isFiltering && (
              <button
                type="button"
                onClick={handleResetFilters}
                className={cn("flex items-center gap-1 text-[11px] font-bold hover:underline cursor-pointer", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}
              >
                <X className="h-3 w-3" /> Reset Filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
            {DEPARTMENTS.map((dept) => {
              const isSelected = department === dept.name;
              return (
                <button
                  key={dept.name}
                  type="button"
                  onClick={() => {
                    setDepartment(dept.name);
                    setPage(1);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer",
                    isSelected
                      ? isLight
                        ? "bg-[#FFF300] text-[#0274BB] border border-[#FFF300] shadow-sm font-black scale-102"
                        : "bg-[#FCD400] text-[#0B1A2C] shadow-md shadow-[#FCD400]/20 font-black scale-102"
                      : isLight
                        ? "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-[#0274BB] hover:border-slate-300 shadow-xs"
                        : "border border-white/8 bg-[#0B1726]/70 text-slate-300 hover:bg-[#122335] hover:text-white hover:border-white/20"
                  )}
                >
                  <span>{dept.label}</span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-mono",
                      isSelected
                        ? isLight
                          ? "bg-[#0274BB]/15 text-[#0274BB] font-bold"
                          : "bg-[#0B1A2C]/20 text-[#0B1A2C]"
                        : isLight
                          ? "bg-slate-200/80 text-slate-600"
                          : "bg-white/10 text-slate-400"
                    )}
                  >
                    {dept.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search and Secondary Filters Bar */}
        <div
          className={cn(
            "grid gap-3 lg:grid-cols-12 items-center p-3 rounded-2xl border transition-all",
            isLight
              ? "bg-slate-50/80 border-slate-200"
              : "bg-[#0B1726]/60 border-white/5"
          )}
        >
          {/* Search Bar */}
          <div className="relative lg:col-span-5">
            <Search className={cn("absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2", isLight ? "text-slate-400" : "text-slate-400")} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, author, ISBN, or classification..."
              className={cn(
                "w-full rounded-xl border py-2.5 pl-10 pr-9 text-xs transition focus:outline-none",
                isLight
                  ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#0274BB] focus:ring-1 focus:ring-[#0274BB]/30"
                  : "border-white/10 bg-[#0F1D29] text-white placeholder:text-slate-500 focus:border-[#FCD400] focus:ring-1 focus:ring-[#FCD400]/40"
              )}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className={cn("absolute right-3 top-1/2 -translate-y-1/2 transition", isLight ? "text-slate-400 hover:text-slate-700" : "text-slate-500 hover:text-white")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Availability Filter */}
          <div className="lg:col-span-3">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className={cn(
                "w-full rounded-xl border py-2.5 px-3 text-xs transition cursor-pointer focus:outline-none",
                isLight
                  ? "border-slate-200 bg-white text-slate-800 shadow-sm focus:border-[#0274BB]"
                  : "border-white/10 bg-[#0F1D29] text-white focus:border-[#FCD400]"
              )}
            >
              <option value="All" className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>All Availability (All)</option>
              <option value="Active" className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>🟢 Available & Active</option>
              <option value="Archived" className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>⚪ Archived Titles</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={cn(
                "w-full rounded-xl border py-2.5 px-3 text-xs transition cursor-pointer focus:outline-none",
                isLight
                  ? "border-slate-200 bg-white text-slate-800 shadow-sm focus:border-[#0274BB]"
                  : "border-white/10 bg-[#0F1D29] text-white focus:border-[#FCD400]"
              )}
            >
              <option value="All" className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>All Categories ({categories.length || "Auto"})</option>
              {categories.map((c) => (
                <option key={c} value={c} className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Page Size Selector */}
          <div className="lg:col-span-1 flex justify-end">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className={cn(
                "rounded-xl border py-2.5 px-2 text-xs transition cursor-pointer focus:outline-none",
                isLight
                  ? "border-slate-200 bg-white text-slate-800 shadow-sm focus:border-[#0274BB]"
                  : "border-white/10 bg-[#0F1D29] text-white focus:border-[#FCD400]"
              )}
              title="Items per page"
            >
              <option value={12} className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>12</option>
              <option value={24} className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>24</option>
              <option value={48} className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>48</option>
            </select>
          </div>
        </div>

        {/* ── Content View ────────────────────────────────────────── */}
        {filteredBooks.length === 0 ? (
          /* Empty State */
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border border-dashed p-16 text-center transition-all",
              isLight ? "border-slate-200 bg-slate-50/50" : "border-white/10 bg-white/[0.01]"
            )}
          >
            <div
              className={cn(
                "relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner",
                isLight ? "bg-slate-100 text-slate-500" : "bg-[#122335] text-slate-400"
              )}
            >
              <Inbox className="h-6 w-6" />
              <span className={cn("absolute -top-1 -right-1 h-3 w-3 rounded-full animate-ping", isLight ? "bg-[#0274BB]" : "bg-[#FCD400]")} />
            </div>
            <h3 className={cn("text-base font-bold", isLight ? "text-slate-900" : "text-white")}>No catalog titles match your query</h3>
            <p className={cn("mt-1 max-w-sm text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
              {isFiltering
                ? "Try adjusting your search criteria, section filters, or clear classification tags."
                : "No catalog books found in the database."}
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={handleResetFilters}
                className={cn(
                  "mt-4 rounded-xl border px-4 py-2 text-xs font-bold transition cursor-pointer",
                  isLight
                    ? "border-slate-200 bg-white text-[#0274BB] hover:bg-slate-50 shadow-sm"
                    : "border-white/10 bg-[#122335] text-[#FCD400] hover:bg-[#18324e]"
                )}
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : viewMode === "cards" ? (
          /* ── View 1: Showcase Cards Grid ────────────────────────── */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {filteredBooks.map((book, idx) => {
                const isCopied = copiedId === book.id;

                return (
                  <motion.div
                    key={book.id || `book-${idx}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: (idx % 12) * 0.02 }}
                    className={cn(
                      "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300",
                      isLight
                        ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/35 hover:bg-slate-50/40 hover:shadow-md hover:shadow-[#0274BB]/5"
                        : "border-white/10 bg-[#0B1726]/85 shadow-lg backdrop-blur hover:border-[#FCD400]/40 hover:bg-[#122335]/90 hover:shadow-2xl hover:shadow-[#FCD400]/5"
                    )}
                  >
                    <div>
                      {/* Card Top Row: Badges */}
                      <div className={cn("flex items-center justify-between gap-2 border-b pb-3", isLight ? "border-slate-100" : "border-white/5")}>
                        <DepartmentBadge department={book.department} isLight={isLight} />
                        <AvailabilityBadge availability={book.availability} isLight={isLight} />
                      </div>

                      {/* Title & Author */}
                      <div className="mt-3.5">
                        <h3
                          className={cn(
                            "font-bold text-base tracking-tight leading-snug line-clamp-2 transition-colors cursor-pointer",
                            isLight
                              ? "text-slate-900 group-hover:text-[#0274BB]"
                              : "text-white group-hover:text-[#FCD400]"
                          )}
                          onClick={() => setSelectedBook(book)}
                          title={book.title}
                        >
                          {book.title}
                        </h3>
                        <p className={cn("mt-1 text-xs line-clamp-1", isLight ? "text-slate-500" : "text-slate-300")}>
                          by <span className={cn("font-semibold", isLight ? "text-slate-800" : "text-slate-200")}>{book.author}</span>
                          {book.publishedDate && (
                            <span className="text-slate-400"> · {book.publishedDate.slice(0, 4)}</span>
                          )}
                        </p>
                      </div>

                      {/* Metadata Chips Grid */}
                      <div className="mt-3.5 grid grid-cols-2 gap-2 text-[11px]">
                        {/* Shelf Location */}
                        <div
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
                            isLight
                              ? "border-slate-200/80 bg-slate-50/80 text-slate-700"
                              : "border-white/5 bg-white/[0.03] text-slate-200"
                          )}
                        >
                          <MapPin className={cn("h-3.5 w-3.5 shrink-0", isLight ? "text-[#0274BB]" : "text-[#FCD400]")} />
                          <span className={cn("font-mono truncate", isLight ? "text-slate-700" : "text-slate-200")} title={book.shelfLocation}>
                            {book.shelfLocation || "Stack Section"}
                          </span>
                        </div>

                        {/* Category */}
                        <div
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
                            isLight
                              ? "border-slate-200/80 bg-slate-50/80 text-slate-700"
                              : "border-white/5 bg-white/[0.03] text-slate-200"
                          )}
                        >
                          <Tag className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                          <span className={cn("truncate", isLight ? "text-slate-700" : "text-slate-200")} title={book.category || "General"}>
                            {book.category || "General"}
                          </span>
                        </div>
                      </div>

                      {/* Inventory Details & ISBN */}
                      <div
                        className={cn(
                          "mt-3 flex items-center justify-between text-[11px] border-t pt-3",
                          isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${Number(book.copies || 1) > 2 ? "bg-emerald-500" : "bg-amber-500"}`} />
                          <span className={cn("font-bold", isLight ? "text-slate-900" : "text-white")}>{book.copies ?? 1}</span>
                          <span>{Number(book.copies || 1) === 1 ? "Copy in Stacks" : "Copies in Stacks"}</span>
                        </div>

                        <div className={cn("flex items-center gap-1 font-mono text-[10px]", isLight ? "text-slate-500" : "text-slate-400")} title={book.isbn}>
                          <Barcode className={cn("h-3 w-3", isLight ? "text-slate-400" : "text-slate-500")} />
                          <span>{book.isbn ? `${book.isbn.slice(0, 7)}...` : "No ISBN"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className={cn("mt-4 flex items-center gap-2 border-t pt-3", isLight ? "border-slate-100" : "border-white/5")}>
                      <button
                        type="button"
                        onClick={() => setSelectedBook(book)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 px-3 text-xs font-bold transition active:scale-95 cursor-pointer",
                          isLight
                            ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-[#FFF300] hover:text-[#0274BB] hover:border-[#FFF300] shadow-xs"
                            : "border-white/10 bg-white/5 text-slate-200 hover:bg-[#FCD400] hover:text-[#0B1A2C] hover:border-[#FCD400]"
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect Details
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyCitation(book, e)}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-xl border py-2 px-3 text-xs font-semibold transition cursor-pointer",
                          isCopied
                            ? isLight
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                            : isLight
                              ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-[#0274BB] shadow-xs"
                              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                        )}
                        title="Copy APA Citation"
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{isCopied ? "Copied" : "Cite"}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* ── View 2: Dense Table View ────────────────────────────── */
          <div
            className={cn(
              "overflow-hidden rounded-xl border shadow-sm",
              isLight
                ? "border-slate-200 bg-white"
                : "border-white/10 bg-[#0B1726]/80 shadow-md"
            )}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wider",
                    isLight
                      ? "bg-slate-50 text-slate-700 border-b border-slate-200"
                      : "bg-[#122335] text-slate-300"
                  )}
                >
                  <tr>
                    <th className="px-5 py-3.5">Book Details</th>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Call Number</th>
                    <th className="px-5 py-3.5">Availability</th>
                    <th className="px-5 py-3.5">Copies</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y", isLight ? "divide-slate-100" : "divide-white/5")}>
                  {filteredBooks.map((book, idx) => {
                    const isCopied = copiedId === book.id;
                    return (
                      <tr
                        key={book.id || `b-${idx}`}
                        className={cn("transition group", isLight ? "hover:bg-slate-50/80" : "hover:bg-white/[0.04]")}
                      >
                        <td className="px-5 py-3.5 max-w-[280px]">
                          <div
                            className={cn(
                              "font-bold text-sm truncate transition-colors cursor-pointer",
                              isLight
                                ? "text-slate-900 group-hover:text-[#0274BB]"
                                : "text-white group-hover:text-[#FCD400]"
                            )}
                            onClick={() => setSelectedBook(book)}
                            title={book.title}
                          >
                            {book.title}
                          </div>
                          <div className={cn("mt-0.5 text-xs truncate", isLight ? "text-slate-500" : "text-slate-400")}>
                            {book.author} · ISBN: <span className={cn("font-mono", isLight ? "text-slate-700" : "text-slate-300")}>{book.isbn}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <DepartmentBadge department={book.department} isLight={isLight} />
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
                              isLight
                                ? "border-slate-200 bg-slate-50 text-slate-700"
                                : "border-white/5 bg-white/5 text-slate-200"
                            )}
                          >
                            <Tag className="h-3 w-3 text-sky-500" />
                            {book.category || "General"}
                          </span>
                        </td>
                        <td className={cn("px-5 py-3.5 whitespace-nowrap font-mono font-semibold", isLight ? "text-slate-700" : "text-slate-300")}>
                          {book.shelfLocation || "Stack Section"}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <AvailabilityBadge availability={book.availability} isLight={isLight} />
                        </td>
                        <td className={cn("px-5 py-3.5 whitespace-nowrap font-bold", isLight ? "text-slate-900" : "text-white")}>
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${Number(book.copies || 1) > 2 ? "bg-emerald-500" : "bg-amber-500"}`} />
                            <span>{book.copies ?? 1}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopyCitation(book, e)}
                              className={cn(
                                "rounded-lg border p-1.5 transition cursor-pointer",
                                isCopied
                                  ? isLight
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                                  : isLight
                                    ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-[#0274BB]"
                                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                              )}
                              title="Copy Citation"
                            >
                              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedBook(book)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                                isLight
                                  ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-[#FFF300] hover:text-[#0274BB] hover:border-[#FFF300]"
                                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-[#FCD400] hover:text-[#0B1A2C] hover:border-[#FCD400]"
                              )}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Modern Pagination Controls ───────────────────────────── */}
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-4 border-t pt-4 text-xs transition-colors",
            isLight ? "border-slate-200 text-slate-500" : "border-white/8 text-slate-400"
          )}
        >
          <div>
            Showing <strong className={cn("font-mono", isLight ? "text-slate-900 font-bold" : "text-white")}>{filteredBooks.length}</strong> of{" "}
            <strong className={cn("font-mono", isLight ? "text-slate-900 font-bold" : "text-white")}>{totalItems.toLocaleString()}</strong> catalog resources
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer",
                isLight
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-[#0274BB] shadow-xs"
                  : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title="First Page"
            >
              First
            </button>

            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer",
                isLight
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-[#0274BB] shadow-xs"
                  : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>

            <span className={cn("px-2 font-bold font-mono", isLight ? "text-slate-900" : "text-white")}>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer",
                isLight
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-[#0274BB] shadow-xs"
                  : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer",
                isLight
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-[#0274BB] shadow-xs"
                  : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title="Last Page"
            >
              Last
            </button>
          </div>
        </div>
      </div>

      {/* ── Book Details Modal ─────────────────────────────────────── */}
      {selectedBook && (
        <AdminModal
          open={!!selectedBook}
          onClose={() => setSelectedBook(null)}
          title="Catalog Resource Details"
          description={`Metadata, shelf stacks, and citation details for ${selectedBook.title}`}
        >
          <div className={cn("space-y-5 text-sm", isLight ? "text-slate-700" : "text-slate-200")}>
            {/* Modal Book Header */}
            <div
              className={cn(
                "rounded-2xl border p-5 shadow-sm",
                isLight
                  ? "border-slate-200 bg-slate-50/70"
                  : "border-white/10 bg-[#0B1726]/90 shadow-lg"
              )}
            >
              <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b pb-3", isLight ? "border-slate-200" : "border-white/5")}>
                <div className="flex items-center gap-2">
                  <DepartmentBadge department={selectedBook.department} isLight={isLight} />
                  <AvailabilityBadge availability={selectedBook.availability} isLight={isLight} />
                </div>
                <span className={cn("font-mono text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                  ID: {selectedBook.id ? selectedBook.id.slice(0, 12) : "REC-CATALOG"}
                </span>
              </div>

              <h2 className={cn("mt-3 text-xl font-bold tracking-tight leading-snug", isLight ? "text-slate-900" : "text-white")}>
                {selectedBook.title}
              </h2>
              <p className={cn("mt-1 text-sm", isLight ? "text-slate-600" : "text-slate-300")}>
                Authored by <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>{selectedBook.author}</span>
                {selectedBook.publishedDate && (
                  <span className="text-slate-400"> · Published {formatDate(selectedBook.publishedDate)}</span>
                )}
              </p>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className={cn("rounded-xl border p-3", isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-[#0B1726]/60")}>
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isLight ? "text-slate-500" : "text-slate-400")}>ISBN</span>
                <p className={cn("font-mono font-bold mt-1 text-xs truncate select-all", isLight ? "text-amber-700" : "text-amber-300")} title={selectedBook.isbn}>
                  {selectedBook.isbn}
                </p>
              </div>

              <div className={cn("rounded-xl border p-3", isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-[#0B1726]/60")}>
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isLight ? "text-slate-500" : "text-slate-400")}>Call Number / Shelf</span>
                <p className={cn("font-mono font-bold mt-1 text-xs truncate", isLight ? "text-slate-900" : "text-white")} title={selectedBook.shelfLocation}>
                  {selectedBook.shelfLocation || "Stack Section"}
                </p>
              </div>

              <div className={cn("rounded-xl border p-3", isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-[#0B1726]/60")}>
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isLight ? "text-slate-500" : "text-slate-400")}>Copies Available</span>
                <p className={cn("font-black mt-1 text-sm", isLight ? "text-slate-900" : "text-white")}>
                  {selectedBook.copies ?? 1} <span className={cn("text-xs font-normal", isLight ? "text-slate-500" : "text-slate-400")}>Physical Copies</span>
                </p>
              </div>

              <div className={cn("rounded-xl border p-3", isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-[#0B1726]/60")}>
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isLight ? "text-slate-500" : "text-slate-400")}>Classification</span>
                <p className={cn("font-semibold mt-1 text-xs", isLight ? "text-slate-900" : "text-white")}>
                  {selectedBook.category || "General Academic"}
                </p>
              </div>

              <div className={cn("rounded-xl border p-3", isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-[#0B1726]/60")}>
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isLight ? "text-slate-500" : "text-slate-400")}>Total Borrows</span>
                <p className={cn("font-black mt-1 text-sm", isLight ? "text-slate-900" : "text-white")}>
                  {selectedBook.borrowCount ?? 0} <span className={cn("text-xs font-normal", isLight ? "text-slate-500" : "text-slate-400")}>Times Loaned</span>
                </p>
              </div>

              <div className={cn("rounded-xl border p-3", isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-[#0B1726]/60")}>
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isLight ? "text-slate-500" : "text-slate-400")}>Department</span>
                <p className={cn("font-semibold mt-1 text-xs", isLight ? "text-slate-900" : "text-white")}>
                  {selectedBook.department}
                </p>
              </div>
            </div>

            {/* Summary / Abstract */}
            {selectedBook.summary && (
              <div className={cn("rounded-xl border p-4", isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-[#0B1726]/60")}>
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isLight ? "text-slate-500" : "text-slate-400")}>
                  Summary & Academic Scope
                </span>
                <p className={cn("mt-1.5 text-xs leading-relaxed max-h-40 overflow-y-auto", isLight ? "text-slate-700" : "text-slate-300")}>
                  {selectedBook.summary}
                </p>
              </div>
            )}

            {/* APA Academic Citation */}
            <div className={cn("rounded-xl border p-4", isLight ? "border-slate-200 bg-slate-50/80" : "border-white/5 bg-[#0B1726]/90")}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isLight ? "text-slate-500" : "text-slate-400")}>
                  Formatted APA Academic Citation
                </span>
                <button
                  type="button"
                  onClick={handleCopyModalCitation}
                  className={cn("flex items-center gap-1 text-xs font-bold hover:underline cursor-pointer", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}
                >
                  {copiedModalCitation ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Citation</span>
                    </>
                  )}
                </button>
              </div>
              <p
                className={cn(
                  "text-xs font-mono p-3 rounded-lg border select-all leading-relaxed",
                  isLight ? "bg-white text-slate-800 border-slate-200 shadow-inner" : "bg-[#08111B] text-slate-300 border-white/5"
                )}
              >
                {selectedBook.apaCitation ||
                  `${selectedBook.author} (${selectedBook.publishedDate ? selectedBook.publishedDate.slice(0, 4) : "n.d."}). ${selectedBook.title}. BookHive Institutional Catalog.`}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                className={cn(
                  "rounded-xl px-6 py-2.5 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer",
                  isLight
                    ? "bg-[#FFF300] text-[#0274BB] border border-[#FFF300] hover:brightness-105"
                    : "bg-[#FCD400] text-[#0B1A2C] shadow-lg shadow-[#FCD400]/20 hover:brightness-110"
                )}
              >
                Done
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

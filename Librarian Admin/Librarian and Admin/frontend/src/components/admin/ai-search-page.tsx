"use client";

import { motion } from "framer-motion";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Sparkles,
  Filter,
  Paperclip,
  User,
  BookOpen,
  Trash2,
  X,
  ArrowRight,
  CheckCircle2,
  History,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminPageHeader, AdminSection } from "@/components/admin/shared";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import { DepartmentBadge } from "@/components/ui/department-badge";
import { requestJson } from "@/lib/admin/client";
import type { PromptSearchPayload, PromptSearchLog } from "@/lib/admin/types";
import { formatDateTime, cn } from "@/lib/utils";

function getAvatarGradient(name: string) {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    "from-amber-400 to-orange-500 text-slate-950",
    "from-emerald-400 to-teal-500 text-slate-950",
    "from-sky-400 to-blue-500 text-white",
    "from-indigo-400 to-purple-500 text-white",
    "from-pink-400 to-rose-500 text-white",
    "from-violet-400 to-fuchsia-500 text-white",
  ];
  return gradients[hash % gradients.length];
}

const DEPT_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  All: { text: "text-amber-800 bg-amber-50 border-amber-200", bg: "bg-amber-50", border: "border-amber-200" },
  "Computer Science": { text: "text-cyan-800 bg-cyan-50 border-cyan-200", bg: "bg-cyan-50", border: "border-cyan-200" },
  Engineering: { text: "text-indigo-800 bg-indigo-50 border-indigo-200", bg: "bg-indigo-50", border: "border-indigo-200" },
  Education: { text: "text-emerald-800 bg-emerald-50 border-emerald-200", bg: "bg-emerald-50", border: "border-emerald-200" },
  "Business & Accountancy": { text: "text-rose-800 bg-rose-50 border-rose-200", bg: "bg-rose-50", border: "border-rose-200" },
  Arts: { text: "text-purple-800 bg-purple-50 border-purple-200", bg: "bg-purple-50", border: "border-purple-200" },
};

const getDeptConfig = (dept: string) => DEPT_CONFIG[dept] ?? DEPT_CONFIG.All;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 18,
    },
  },
};

export function AiSearchPage() {
  const { notify } = useNotice();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [department, setDepartment] = useState(
    () => searchParams.get("department") ?? "All",
  );
  const [isPrefixFilter, setIsPrefixFilter] = useState(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam !== null) {
      return filterParam === "1" || filterParam === "true";
    }
    return true; // Default to Filter: ON just like in Student app
  });
  const [files, setFiles] = useState<File[]>([]);
  const [payload, setPayload] = useState<PromptSearchPayload | null>(null);
  const [logs, setLogs] = useState<PromptSearchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [resultsViewMode, setResultsViewMode] = useState<"list" | "table">("list");
  const [isFocused, setIsFocused] = useState(false);
  const PAGE_SIZE = 6;
  const autoSearchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void requestJson<{ logs: PromptSearchLog[] }>("/api/admin/prompt-search").then((response) => {
      setLogs(response.logs);
    });
  }, []);

  async function executeSearch(
    searchQuery: string,
    searchDepartment: string,
    updateUrl = true,
    overrideMode?: boolean,
  ) {
    if (!searchQuery.trim()) {
      return;
    }

    const activeMode = overrideMode !== undefined ? overrideMode : isPrefixFilter;
    const cleanSearchKey = `${searchQuery.trim()}::${searchDepartment}::${activeMode ? "filter" : "ai"}`;
    autoSearchKeyRef.current = cleanSearchKey;

    setLoading(true);
    setCurrentPage(1);

    try {
      const formData = new FormData();
      formData.set("query", searchQuery);
      formData.set("department", searchDepartment);
      formData.set("mode", activeMode ? "prefix" : "ai");

      if (!activeMode) {
        for (const file of files) {
          formData.append("files", file);
        }
      }

      const response = await requestJson<PromptSearchPayload>("/api/admin/prompt-search", {
        method: "POST",
        body: formData,
      });

      startTransition(() => {
        setPayload(response);
        setLogs(response.logs);
      });

      if (updateUrl) {
        router.replace(
          `${pathname}?query=${encodeURIComponent(searchQuery)}&department=${encodeURIComponent(
            searchDepartment,
          )}&filter=${activeMode ? "1" : "0"}`,
          { scroll: false },
        );
      }

      notify(
        activeMode ? "Prefix filter search completed." : "AI prompt search completed.",
        "success",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Search failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleToggleFilter(newMode: boolean) {
    setIsPrefixFilter(newMode);
    if (query.trim()) {
      void executeSearch(query, department, true, newMode);
    }
  }

  useEffect(() => {
    const queryParam = searchParams.get("query") ?? "";
    const departmentParam = searchParams.get("department") ?? "All";
    const filterParam = searchParams.get("filter");
    if (filterParam !== null) {
      setIsPrefixFilter(filterParam === "1" || filterParam === "true");
    }
    setQuery(queryParam);
    setDepartment(departmentParam);
  }, [searchParams]);

  useEffect(() => {
    const queryParam = searchParams.get("query") ?? "";
    const departmentParam = searchParams.get("department") ?? "";
    const searchDepartment = departmentParam || department;
    const filterParam = searchParams.get("filter");
    const activeFilter = filterParam !== null ? filterParam === "1" || filterParam === "true" : isPrefixFilter;
    const searchKey = queryParam ? `${queryParam}::${searchDepartment}::${activeFilter ? "filter" : "ai"}` : "";

    if (!searchKey || loading || autoSearchKeyRef.current === searchKey) {
      return;
    }

    autoSearchKeyRef.current = searchKey;

    let isMounted = true;
    const timeoutId = window.setTimeout(() => {
      if (isMounted) {
        void executeSearch(queryParam, searchDepartment, false, activeFilter);
      }
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, department]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeSearch(query, department);
  }



  const results = payload?.results ?? [];
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageCommit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setPageInput(String(currentPage));
      return;
    }
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      const target = Math.max(1, Math.min(totalPages, num));
      setCurrentPage(target);
      setPageInput(String(target));
    } else {
      setPageInput(String(currentPage));
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Catalog & AI Prompt Search"
        description="Filter the live library catalog with prefix search or run AI prompts with supporting PDF, DOCX, PPT, and image uploads."
        actions={
          <button
            type="button"
            onClick={() => router.push(pathname.includes("/librarian") ? "/librarian/history" : "/admin/history")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-white shadow-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-all cursor-pointer"
          >
            <History className="h-4 w-4 text-[#0274BB] dark:text-[#FFD600]" />
            <span>View Search History</span>
          </button>
        }
      />

      <AdminSection
        title="Prompt Search"
        description="Toggle between strict Prefix Filter search and natural language AI Prompt analysis."
      >
        <form
          className="rounded-[24px] bg-gradient-to-b from-[#14293E] to-[#0E1F30] p-6 sm:p-8 md:p-10 mb-8 shadow-xl border border-white/5 relative overflow-hidden panel-hero"
          onSubmit={handleSearch}
        >
          {/* Subtle top glow line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFD600]/25 to-transparent" />

          {/* Top Bar: Section Label & Filter Toggle (just like Student app) */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              {isPrefixFilter ? (
                <div className="flex items-center gap-2 text-[#0274BB] dark:text-[#FFD600]">
                  <Filter className="h-4 w-4" />
                  <span className="text-xs font-bold tracking-widest uppercase">
                    CATALOG PREFIX FILTER
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-purple-600 dark:text-[#FFD600]">
                  <Sparkles className="h-4 w-4 fill-current animate-pulse" />
                  <span className="text-xs font-bold tracking-widest uppercase">
                    ASK BOOKHIVE (AI PROMPT)
                  </span>
                </div>
              )}
            </div>

            {/* FILTER TOGGLE (Exact design inspired by Student app) */}
            <button
              type="button"
              onClick={() => handleToggleFilter(!isPrefixFilter)}
              className={cn(
                "flex items-center justify-between gap-3.5 px-4 py-1.5 rounded-full border transition-all duration-200 select-none cursor-pointer shadow-sm",
                isPrefixFilter
                  ? "bg-blue-50/90 border-[#0274BB] text-[#0274BB] dark:bg-amber-400/15 dark:border-[#FFD600] dark:text-[#FFD600]"
                  : "bg-purple-50/90 border-purple-300 text-purple-700 dark:bg-slate-800/80 dark:border-slate-600 dark:text-slate-300",
              )}
              title={
                isPrefixFilter
                  ? "Filter mode is ON (searches strictly by title prefix). Click to switch to AI Prompt mode."
                  : "Filter mode is OFF (AI prompts work). Click to switch to Prefix Filter mode."
              }
            >
              <div className="flex items-center gap-2">
                {isPrefixFilter ? (
                  <Filter className="h-3.5 w-3.5 text-[#0274BB] dark:text-[#FFD600]" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-slate-400" />
                )}
                <span className="text-[11px] font-extrabold tracking-wider uppercase">
                  {isPrefixFilter ? "FILTER: ON" : "FILTER: OFF"}
                </span>
              </div>

              {/* Toggle switch track + thumb */}
              <div
                className={cn(
                  "w-8 h-4 rounded-full transition-colors duration-200 relative p-0.5 flex items-center",
                  isPrefixFilter
                    ? "bg-[#0274BB] dark:bg-[#FFD600]"
                    : "bg-slate-300 dark:bg-slate-700",
                )}
              >
                <div
                  className={cn(
                    "w-3 h-3 rounded-full transition-transform duration-200 shadow-sm",
                    isPrefixFilter
                      ? "translate-x-4 bg-white dark:bg-[#0A1624]"
                      : "translate-x-0 bg-white dark:bg-slate-400",
                  )}
                />
              </div>
            </button>
          </div>

          {/* Main Heading */}
          <h1 className="mb-6 text-[28px] sm:text-[32px] md:text-[36px] font-bold tracking-tight text-white leading-tight">
            Find resources across the entire STI WNU digital ecosystem.
          </h1>

          {/* Search Box */}
          <div
            className={cn(
              "flex w-full items-center gap-3 rounded-full border px-4 py-2.5 sm:py-3 shadow-inner mb-2 transition-all duration-300",
              isFocused
                ? "border-[#FFD600] bg-[#0A1624] shadow-[0_0_20px_rgba(255,214,0,0.15)] ring-1 ring-[#FFD600]"
                : "border-white/10 bg-[#0B1724]",
            )}
          >
            {isPrefixFilter ? (
              <Search
                className={cn(
                  "h-5 w-5 ml-2 transition-colors duration-300",
                  isFocused ? "text-[#FFD600]" : "text-slate-400",
                )}
              />
            ) : (
              <Sparkles
                className={cn(
                  "h-5 w-5 ml-2 transition-colors duration-300",
                  isFocused ? "text-[#FFD600]" : "text-purple-400",
                )}
              />
            )}

            <input
              type="text"
              suppressHydrationWarning
              placeholder={
                isPrefixFilter
                  ? "Search by title prefix (e.g. B, BR, Yana)..."
                  : "Ask BookHive or search prompt/keywords..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="flex-1 bg-transparent text-[15px] text-white placeholder-slate-400 outline-none"
            />

            <div className="flex items-center gap-2">
              {/* Attachment upload: active only in AI Prompt mode */}
              <label
                className={cn(
                  "p-2 transition rounded-full",
                  !isPrefixFilter
                    ? "cursor-pointer text-slate-400 hover:text-white hover:bg-white/10"
                    : "cursor-not-allowed opacity-25 text-slate-500",
                )}
                title={
                  !isPrefixFilter
                    ? "Upload Supporting Attachment (PDF, DOCX, PPT, Image)"
                    : "Turn FILTER: OFF to attach supporting documents for AI analysis"
                }
              >
                <Paperclip className="h-5 w-5" />
                <input
                  id="prompt-upload-input"
                  type="file"
                  disabled={isPrefixFilter}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </label>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={loading}
                suppressHydrationWarning
                className="rounded-full bg-[#FFD600] disabled:bg-slate-700 disabled:text-slate-450 disabled:cursor-not-allowed disabled:scale-100 px-6 py-2.5 text-sm font-bold tracking-wide text-[#0A1624] transition hover:bg-[#FCD400]/90 shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0A1624] border-t-transparent" />
                    {isPrefixFilter ? "FILTERING..." : "ANALYZING..."}
                  </>
                ) : isPrefixFilter ? (
                  <>
                    <Search className="h-4 w-4" />
                    SEARCH
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    ANALYZE
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Mode helper hint */}
          <div className="mt-2 text-xs text-white/70 flex items-center gap-2 px-2">
            {isPrefixFilter ? (
              <span className="inline-flex items-center gap-1.5 text-sky-300 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Filter Mode is ON: Searches books strictly by title prefix & keywords. AI prompts bypassed.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-300 font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                AI Prompt Mode is ON: Ask natural language questions or attach documents to match books conceptually.
              </span>
            )}
          </div>

          {/* File list (AI Prompt mode only) */}
          {files.length > 0 && !isPrefixFilter ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={`${file.name}-${file.size}-${idx}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/80 shadow-sm backdrop-blur-md"
                >
                  <span className="max-w-[200px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles((prev) => prev.filter((_, i) => i !== idx));
                      const inputEl = document.getElementById("prompt-upload-input") as HTMLInputElement;
                      if (inputEl) inputEl.value = "";
                    }}
                    className="rounded-full p-0.5 hover:bg-white/15 text-white/40 hover:text-white transition-all flex items-center justify-center"
                    title="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              ))}
            </div>
          ) : null}
        </form>

        {/* SEARCH RESULTS SECTION (Clean Lightmode, NOT Black!) */}
        <div className="space-y-6 w-full">
          {/* Results Status Header */}
          {results.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  {isPrefixFilter ? (
                    <Filter className="h-5 w-5 text-[#0274BB] dark:text-[#FFD600]" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-[#FFD600]" />
                  )}
                  <span>Search Results</span>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                    {results.length} {results.length === 1 ? "match" : "matches"}
                  </span>
                </h2>
                {query && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Showing results for <span className="font-semibold text-slate-800 dark:text-slate-200">"{query}"</span>
                    {department !== "All" && <span> in {department}</span>}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {/* View Mode Toggle: List vs Table */}
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => setResultsViewMode("list")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer select-none",
                      resultsViewMode === "list"
                        ? "bg-white dark:bg-slate-700 text-[#0274BB] dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                    )}
                    title="Card List view"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsViewMode("table")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer select-none",
                      resultsViewMode === "table"
                        ? "bg-white dark:bg-slate-700 text-[#0274BB] dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                    )}
                    title="Dense Table view"
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    <span>Table</span>
                  </button>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border shadow-sm",
                    isPrefixFilter
                      ? "bg-blue-50 text-[#0274BB] border-blue-200 dark:bg-amber-400/10 dark:text-[#FFD600] dark:border-amber-400/30"
                      : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-400/30",
                  )}
                >
                  {isPrefixFilter ? <Filter className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                  {isPrefixFilter ? "PREFIX FILTER MODE" : "AI PROMPT MODE"}
                </span>
              </div>
            </div>
          )}

          {/* Results: Table vs List */}
          {visibleResults.length > 0 ? (
            resultsViewMode === "table" ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c182b] shadow-sm w-full">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
                      <th className="px-5 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Book Details</th>
                      <th className="px-5 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Department</th>
                      <th className="px-5 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Relevance</th>
                      <th className="px-5 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">ISBN & Language</th>
                      <th className="px-5 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Matched Reasons</th>
                      <th className="px-5 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleResults.map((result) => {
                      const relevance = result.relevance;
                      const isHigh = relevance >= 90;
                      const isMedium = relevance >= 75;

                      const relevanceBadgeClass = isHigh
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-extrabold rounded-full px-2.5 py-0.5 text-xs shadow-xs"
                        : isMedium
                        ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-extrabold rounded-full px-2.5 py-0.5 text-xs shadow-xs"
                        : "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 font-extrabold rounded-full px-2.5 py-0.5 text-xs shadow-xs";

                      return (
                        <tr
                          key={result.id}
                          onClick={() => setSelectedBook(result)}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-5 py-3.5 max-w-[280px]">
                            <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#0274BB] dark:group-hover:text-amber-300 transition-colors truncate">
                              {result.title}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                              By <span className="font-semibold text-slate-800 dark:text-slate-200">{result.author}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <DepartmentBadge department={result.department} />
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={relevanceBadgeClass}>
                              {relevance}% MATCH
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            <div>ISBN: {result.isbn}</div>
                            {result.language && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                                🌐 {result.language.toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {result.matchedBy && result.matchedBy.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {result.matchedBy.map((match) => (
                                  <span
                                    key={match}
                                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full shadow-xs"
                                  >
                                    <Sparkles className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                                    {match}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-xs italic">Catalog Match</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBook(result);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-[#FFD600] dark:hover:bg-[#FFD600] hover:text-[#0A1624] dark:hover:text-[#0A1624] hover:border-[#FFD600] transition cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 w-full">
              {visibleResults.map((result, idx) => {
                const relevance = result.relevance;
                const isHigh = relevance >= 90;
                const isMedium = relevance >= 75;

                const relevanceBadgeClass = isHigh
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-extrabold rounded-full px-3 py-1 text-xs shadow-sm"
                  : isMedium
                  ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-extrabold rounded-full px-3 py-1 text-xs shadow-sm"
                  : "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 font-extrabold rounded-full px-3 py-1 text-xs shadow-sm";

                const relevanceBarColor = isHigh
                  ? "from-emerald-500 to-teal-400"
                  : isMedium
                  ? "from-amber-500 to-yellow-400"
                  : "from-sky-500 to-cyan-400";

                return (
                  <motion.div
                    key={result.id}
                    onClick={() => setSelectedBook(result)}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.04 }}
                    whileHover={{ y: -4 }}
                    className="flex flex-col justify-between w-full text-left p-6 bg-white dark:bg-[#0c182b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-400/80 transition-all duration-200 group cursor-pointer relative"
                  >
                    <div className="space-y-4">
                      {/* Top bar with category & relevance */}
                      <div className="flex items-center justify-between gap-3 w-full">
                        <DepartmentBadge department={result.department} />
                        <span className={relevanceBadgeClass}>
                          {relevance}% MATCH
                        </span>
                      </div>

                      {/* Title & Metadata */}
                      <div>
                        <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-[#0274BB] dark:group-hover:text-amber-300 transition-colors duration-200 line-clamp-2 leading-snug text-left">
                          {result.title}
                        </h3>
                        <div className="mt-3 space-y-2 text-left">
                          <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                            By <span className="font-semibold text-slate-900 dark:text-slate-200">{result.author}</span>
                          </p>

                          <div className="flex items-center flex-wrap gap-2 text-[11px]">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-md">
                              ISBN: {result.isbn}
                            </span>
                            {result.language && (
                              <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md uppercase font-bold text-[10px]">
                                🌐 {result.language}
                              </span>
                            )}
                            {typeof result.rating === "number" && result.rating > 0 && (
                              <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-md font-bold">
                                ⭐ {result.rating.toFixed(1)}
                              </span>
                            )}
                            {result.availability && (
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-md font-semibold text-[11px] border",
                                  result.availability === "Available"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
                                )}
                              >
                                {result.availability}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Visual Relevance Meter */}
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                          <span>Relevance Meter</span>
                          <span className={isHigh ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : isMedium ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-sky-600 dark:text-sky-400 font-extrabold"}>
                            {relevance}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${relevance}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full rounded-full bg-gradient-to-r ${relevanceBarColor}`}
                          />
                        </div>
                      </div>

                      {/* Book Summary */}
                      <div className="bg-slate-50 dark:bg-slate-800/60 border-l-4 border-amber-400 p-3 rounded-r-xl text-left">
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3 italic">
                          "{result.summary || "No description available for this catalog entry."}"
                        </p>
                      </div>
                    </div>

                    {/* Matched explanation details */}
                    {result.matchedBy && result.matchedBy.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 justify-start w-full">
                        {result.matchedBy.map((match) => (
                          <span
                            key={match}
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full shadow-sm"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                            {match}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-end text-xs font-semibold text-[#0274BB] dark:text-sky-400 group-hover:underline dark:group-hover:text-amber-300">
                      <span>View Details →</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            )
          ) : payload !== null ? (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/70 dark:bg-amber-950/20 p-8 text-center text-sm text-amber-900 dark:text-amber-200 shadow-sm w-full">
              <p className="font-semibold text-base mb-1">No matching catalog records found.</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isPrefixFilter
                  ? `No books start with "${query}". Try typing fewer letters or switch FILTER to OFF to try AI Prompt matching.`
                  : "Try rephrasing your prompt or selecting a different department."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c182b] p-10 text-center shadow-sm w-full">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-3">
                {isPrefixFilter ? (
                  <Filter className="h-6 w-6 text-[#0274BB] dark:text-[#FFD600]" />
                ) : (
                  <Sparkles className="h-6 w-6 text-purple-600 dark:text-[#FFD600]" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {isPrefixFilter ? "Prefix & Title Filter Search" : "AI Prompt Search"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {isPrefixFilter
                  ? "Enter letters or title keywords above (e.g. Yana, B, Algorithm) to filter books by title prefix."
                  : "Enter a natural language prompt or upload documents above to see semantic recommendations."}
              </p>
            </div>
          )}

          {/* Pagination Controls */}
          {results.length > 0 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c182b] shadow-sm w-full">
              {/* Pagination Info */}
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 text-left">
                Showing <span className="font-bold text-slate-900 dark:text-white">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
                <span className="font-bold text-slate-900 dark:text-white">{Math.min(currentPage * PAGE_SIZE, results.length)}</span> of{" "}
                <span className="font-bold text-[#0274BB] dark:text-sky-400">{results.length}</span> matches found
              </div>

              {/* Prev, Box with page selector, Next */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-xs select-none"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pageInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setPageInput(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handlePageCommit(pageInput);
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        const nextP = Math.min(totalPages, currentPage + 1);
                        setCurrentPage(nextP);
                        setPageInput(String(nextP));
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        const prevP = Math.max(1, currentPage - 1);
                        setCurrentPage(prevP);
                        setPageInput(String(prevP));
                      }
                    }}
                    onBlur={() => handlePageCommit(pageInput)}
                    style={{
                      width: "52px",
                      minWidth: "52px",
                      maxWidth: "52px",
                      height: "32px",
                      padding: "0 4px",
                    }}
                    className="h-8 w-[52px] min-w-[52px] max-w-[52px] shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono text-xs font-bold text-slate-900 dark:text-white shadow-xs transition outline-none cursor-pointer focus:cursor-text focus:border-[#0274BB] dark:focus:border-amber-400 focus:ring-2 focus:ring-[#0274BB]/20"
                    title={`Page ${currentPage} of ${totalPages} - Click to enter page number and press Enter`}
                    aria-label="Current page number"
                  />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    / {totalPages}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-xs select-none"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </AdminSection>



      <BookDetailModal
        open={Boolean(selectedBook)}
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />
    </div>
  );
}

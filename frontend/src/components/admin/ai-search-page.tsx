"use client";

import { motion } from "framer-motion";
import { startTransition, useEffect, useRef, useState } from "react";
import { Plus, Search, Sparkles, Paperclip, User, BookOpen, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import { requestJson } from "@/lib/admin/client";
import type { PromptSearchPayload, PromptSearchLog } from "@/lib/admin/types";
import { formatDateTime, cn } from "@/lib/utils";

export function AiSearchPage() {
  const { notify } = useNotice();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [department, setDepartment] = useState(
    () => searchParams.get("department") ?? "All",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [payload, setPayload] = useState<PromptSearchPayload | null>(null);
  const [logs, setLogs] = useState<PromptSearchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;
  const autoSearchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void requestJson<{ logs: PromptSearchLog[] }>("/api/admin/prompt-search").then((response) => {
      setLogs(response.logs);
    });
  }, []);

  async function executeSearch(searchQuery: string, searchDepartment: string, updateUrl = true) {
    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);
    setCurrentPage(1);

    try {
      const formData = new FormData();
      formData.set("query", searchQuery);
      formData.set("department", searchDepartment);
      for (const file of files) {
        formData.append("files", file);
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
          `/admin/ai-prompt-search?query=${encodeURIComponent(searchQuery)}&department=${encodeURIComponent(
            searchDepartment,
          )}`,
          { scroll: false },
        );
      }

      notify("AI prompt search completed.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Search failed.", "error");
    } finally {
      setLoading(false);
    }
  }



  useEffect(() => {
    const queryParam = searchParams.get("query") ?? "";
    const departmentParam = searchParams.get("department") ?? "All";
    setQuery(queryParam);
    setDepartment(departmentParam);
  }, [searchParams]);

  useEffect(() => {
    const queryParam = searchParams.get("query") ?? "";
    const departmentParam = searchParams.get("department") ?? "";
    const searchDepartment = departmentParam || department;
    const searchKey = queryParam ? `${queryParam}::${searchDepartment}` : "";

    if (!searchKey || loading || autoSearchKeyRef.current === searchKey) {
      return;
    }

    autoSearchKeyRef.current = searchKey;

    let isMounted = true;
    const timeoutId = window.setTimeout(() => {
      if (isMounted) {
        void executeSearch(queryParam, searchDepartment, false);
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

  async function handleDeleteLog(id: string) {
    try {
      const response = await requestJson<{ success: boolean; logs: PromptSearchLog[] }>(
        `/api/admin/prompt-search?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (response.success) {
        startTransition(() => {
          setLogs(response.logs);
        });
        notify("Search log entry deleted.", "success");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to delete log entry.", "error");
    }
  }

  async function handleClearAllLogs() {
    if (!window.confirm("Are you sure you want to clear all prompt search history? This cannot be undone.")) {
      return;
    }
    try {
      const response = await requestJson<{ success: boolean; logs: PromptSearchLog[] }>(
        "/api/admin/prompt-search",
        { method: "DELETE" }
      );
      if (response.success) {
        startTransition(() => {
          setLogs([]);
        });
        notify("All search history cleared.", "success");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to clear search history.", "error");
    }
  }

  const results = payload?.results ?? [];
  const visibleResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="AI Prompt Search"
        description="Search the live library catalog with natural language prompts and supporting PDF, DOCX, PPT, and image uploads."
      />

      <AdminSection
        title="Prompt Search"
        description="Upload supporting files and inspect relevance percentages for matched books."
      >
        <form className="rounded-[24px] bg-[#14293E] p-8 md:p-10 mb-8 shadow-xl" onSubmit={handleSearch}>
          {/* Section Label */}
          <div className="flex items-center gap-2 text-[#FFD600] mb-4">
            <Sparkles className="h-4 w-4 fill-current" />
            <span className="text-xs font-bold tracking-widest uppercase">
              ASK BOOKHIVE
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="mb-8 text-[32px] font-bold tracking-tight text-white md:text-[36px]">
            Find resources across the entire STI WNU digital ecosystem.
          </h1>

          {/* AI Prompt Search Box */}
          <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-[#0B1724] px-4 py-3 shadow-inner mb-2">
            <Search className="h-5 w-5 text-slate-400 ml-2" />
            <input
              type="text"
              suppressHydrationWarning
              placeholder="Search by Title, Author, ISBN, or ask a question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-white placeholder-slate-500 outline-none"
            />
            
            <div className="flex items-center gap-2">
              <label className="cursor-pointer p-2 text-slate-400 hover:text-white transition rounded-full hover:bg-white/5" title="Upload Attachment">
                <Paperclip className="h-5 w-5" />
                <input
                  id="prompt-upload-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              
              <button
                type="submit"
                suppressHydrationWarning
                className="rounded-full bg-[#FFD600] px-6 py-2.5 text-sm font-bold tracking-wide text-[#0A1624] transition hover:bg-[#FCD400]/90 hover:scale-105 active:scale-95"
              >
                ANALYZE
              </button>
            </div>
          </div>

          {/* File list */}
          {files.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {files.map((file) => (
                <span
                  key={`${file.name}-${file.size}`}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/65"
                >
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}
        </form>

        <div className="mt-6 flex flex-col gap-8 w-full">
          {visibleResults.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 w-full">
              {visibleResults.map((result, idx) => {
                const relevance = result.relevance;
                const isHigh = relevance >= 90;
                const isMedium = relevance >= 75;
                const relevanceBadgeClass = isHigh
                  ? "border border-emerald-500/35 bg-emerald-500/10 text-emerald-400 font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.25)] rounded-full px-3 py-1 text-xs"
                  : isMedium
                  ? "border border-amber-500/35 bg-amber-500/10 text-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.25)] rounded-full px-3 py-1 text-xs"
                  : "border border-sky-500/35 bg-sky-500/10 text-sky-300 font-extrabold rounded-full px-3 py-1 text-xs";

                const relevanceBarColor = isHigh
                  ? "from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  : isMedium
                  ? "from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  : "from-sky-500 to-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]";

                return (
                  <motion.button
                    key={result.id}
                    type="button"
                    onClick={() => setSelectedBook(result)}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
                    whileHover={{ y: -6, scale: 1.015 }}
                    className="flex flex-col justify-between w-full text-left p-6 bg-gradient-to-b from-[#14283F]/70 to-[#0A1724]/90 backdrop-blur-xl rounded-[28px] border border-white/[0.07] hover:border-[#FFD600]/30 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] transition-all duration-300 group"
                  >
                    <div className="space-y-4">
                      {/* Top bar with category & relevance */}
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span className="inline-flex items-center rounded-full bg-white/5 border border-white/5 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[#FFD600] uppercase">
                          <span className="inline-block w-2 h-2 rounded-full bg-[#FFD600] mr-2 animate-pulse"></span>
                          {result.department}
                        </span>
                        <span className={relevanceBadgeClass}>
                          {relevance}% MATCH
                        </span>
                      </div>

                      {/* Title & Metadata */}
                      <div>
                        <h3 className="text-lg font-bold tracking-tight text-white group-hover:text-[#FFD600] transition-colors duration-200 line-clamp-2 leading-snug text-left">
                          {result.title}
                        </h3>
                        <div className="mt-3 space-y-2 text-left">
                          <p className="flex items-center gap-2 text-xs text-white/80">
                            <User className="h-4 w-4 text-slate-400" />
                            By <span className="font-semibold text-white/95">{result.author}</span>
                          </p>
                          <div className="flex items-center flex-wrap gap-2 text-[11px] text-white/50">
                            <span className="font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded-md">
                              ISBN: {result.isbn}
                            </span>
                            {result.language && (
                              <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider text-[9px]">
                                🌐 {result.language}
                              </span>
                            )}
                            {typeof result.rating === "number" && result.rating > 0 && (
                              <span className="inline-flex items-center gap-0.5 bg-[#FFD600]/10 border border-[#FFD600]/20 px-2 py-0.5 rounded-md text-[#FFD600] font-bold">
                                ⭐ {result.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Visual Relevance Meter */}
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-white/40">
                          <span>Relevance Meter</span>
                          <span className={isHigh ? "text-emerald-400" : isMedium ? "text-amber-400" : "text-sky-300"}>
                            {relevance}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/[0.04] overflow-hidden border border-white/[0.02]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${relevance}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full rounded-full bg-gradient-to-r ${relevanceBarColor}`}
                          />
                        </div>
                      </div>

                      {/* Book Summary */}
                      <div className="border-l-2 border-[#FFD600]/30 pl-3.5 pt-1.5 pb-1 text-left">
                        <p className="text-xs text-white/70 leading-relaxed line-clamp-3 italic">
                          "{result.summary}"
                        </p>
                      </div>
                    </div>

                    {/* Matched explanation details */}
                    {result.matchedBy && result.matchedBy.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-1.5 pt-4 border-t border-white/[0.04] justify-start w-full">
                        {result.matchedBy.map((match) => (
                          <span
                            key={match}
                            className="inline-flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full shadow-sm"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                            {match}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          ) : payload !== null ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-500/70 w-full">
              No matching records found. Try adjusting your search prompt.
            </div>
          ) : (
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--module-muted-color)] w-full">
              Enter a prompt above to see AI prompt search results here.
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-[20px] border border-white/[0.05] bg-white/[0.02] w-full">
              {/* Pagination Info */}
              <div className="text-xs font-semibold text-white/50 text-left">
                Showing <span className="text-white">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
                <span className="text-white">{Math.min(currentPage * PAGE_SIZE, results.length)}</span> of{" "}
                <span className="text-[#FFD600]">{results.length}</span> matches found
              </div>

              {/* Pagination Toggles */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10 hover:border-white/20 active:scale-95 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:active:scale-100"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: Math.ceil(results.length / PAGE_SIZE) }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const isActive = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "h-8 w-8 rounded-full text-xs font-black transition-all flex items-center justify-center",
                          isActive
                            ? "bg-[#FFD600] text-[#0A1624] shadow-[0_0_12px_rgba(255,214,0,0.35)] scale-110"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage === Math.ceil(results.length / PAGE_SIZE)}
                  onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(results.length / PAGE_SIZE), prev + 1))}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10 hover:border-white/20 active:scale-95 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:active:scale-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </AdminSection>

      <AdminSection
        title="Search History"
        description="Prompt history with actor, scope, uploaded context, and result counts."
        action={
          logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllLogs}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 shadow-sm transition-all"
            >
              <Trash2 className="h-4 w-4" />
              Clear History
            </button>
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
          {logs.map((entry) => (
            <motion.button
              key={entry.id}
              type="button"
              onClick={() => {
                setQuery(entry.query);
                setDepartment(entry.department);
                void executeSearch(entry.query, entry.department);
              }}
              whileHover={{ y: -3, scale: 1.01 }}
              className="flex flex-col justify-between p-5 bg-gradient-to-b from-[#14283F]/40 to-[#0A1724]/60 backdrop-blur-md rounded-2xl border border-white/[0.06] hover:border-[#FFD600]/30 hover:shadow-[0_12px_24px_rgba(0,0,0,0.4)] text-left transition-all group w-full"
            >
              <div className="space-y-3 w-full">
                {/* Meta Header */}
                <div className="flex items-center justify-between text-[10px] font-bold text-white/40 tracking-wider w-full">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3 text-[#FFD600]" />
                    {entry.actor}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{formatDateTime(entry.createdAt)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteLog(entry.id);
                      }}
                      className="text-white/40 hover:text-red-400 p-1 hover:bg-white/5 rounded-lg transition-all"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Search Query */}
                <p className="text-sm font-bold text-white group-hover:text-[#FFD600] transition-colors line-clamp-2 leading-relaxed">
                  "{entry.query}"
                </p>
              </div>

              {/* Badges footer */}
              <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between w-full">
                <span className="inline-flex items-center rounded-full bg-white/5 border border-white/5 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-[#FFD600] uppercase">
                  {entry.department}
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-sm">
                  <Sparkles className="h-2 w-2" />
                  {entry.matchesFound} matches
                </span>
              </div>
            </motion.button>
          ))}
          {logs.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-white/40 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              No search history entries recorded yet.
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

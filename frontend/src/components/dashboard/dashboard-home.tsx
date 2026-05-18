"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Clock3,
  FileUp,
  HardDrive,
  ShieldCheck,
  Sparkles,
  X,
  Search,
  Paperclip,
  User,
  BookOpen,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { VirtualizedList } from "@/components/ui/virtualized-list";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import { useLiveActivity } from "@/lib/hooks/use-live-activity";
import type {
  DashboardPayload,
  SearchResult,
  TransactionRecord,
  TransactionStatus,
} from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const categories = [
  "Circulation",
  "General Reference",
  "Filipiniana",
  "Reserve",
  "Periodical",
  "Special Collections",
];

export function DashboardHome() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processingQueueId, setProcessingQueueId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const PAGE_SIZE = 6;

  useEffect(() => {
    void loadDashboard();

    const refreshTimer = setInterval(() => {
      void loadDashboard();
    }, 8000);

    return () => clearInterval(refreshTimer);
  }, []);

  async function loadDashboard() {
    const response = await fetch("/api/dashboard");
    const payload = (await response.json()) as DashboardPayload;
    startTransition(() => setDashboard(payload));
  }

  function runSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!query.trim()) {
      return;
    }
    router.push(`/admin/ai-prompt-search?query=${encodeURIComponent(query)}&department=${encodeURIComponent(selectedCategory)}`);
  }

  async function updateRequestStatus(id: string, status: TransactionStatus) {
    setProcessingQueueId(id);

    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    await loadDashboard();
    setProcessingQueueId(null);
  }

  const liveActivity = useLiveActivity(dashboard?.recentActivity ?? []);

  const metricCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      {
        label: "Total Books",
        value: dashboard.metrics.totalBooks.toLocaleString(),
        detail: "Indexed catalog records across the STI WNU ecosystem",
        accent: "#4f46e5",
      },
      {
        label: "Active Users",
        value: dashboard.metrics.activeUsers.toLocaleString(),
        detail: "Authenticated users across admin, librarian, and student roles",
        accent: "#0891b2",
      },
      {
        label: "Pending Requests",
        value: dashboard.metrics.pendingRequests.toString(),
        detail: "Borrowing and reservation actions waiting for approval",
        accent: "#2563eb",
      },
      {
        label: "Overdue Items",
        value: dashboard.metrics.overdueItems.toString(),
        detail: "Approved borrowings that already passed their due date",
        accent: "#ea580c",
      },
      {
        label: "System Health",
        value: dashboard.metrics.systemHealth,
        detail: `${dashboard.metrics.storageUsedPercent}% storage used • ${dashboard.metrics.indexingStatus} indexing`,
        accent: "#10b981",
      },
    ];
  }, [dashboard]);

  const visibleResults = results ? results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : null;

  return (
    <div className="space-y-8">
      <Panel className="overflow-hidden px-6 py-8 sm:px-10 bg-[#14293E] border-none shadow-xl rounded-[24px]">
        <div className="mx-auto max-w-5xl text-left">
          <div className="flex items-center gap-2 text-[#FFD600] mb-4">
             <Sparkles className="h-4 w-4 fill-current" />
             <span className="text-xs font-bold tracking-widest uppercase">ASK BOOKHIVE</span>
          </div>
          <h1 className="mb-8 text-[32px] font-bold tracking-tight text-white md:text-[36px]">
            Find resources across the entire STI WNU digital ecosystem.
          </h1>

          <form
            className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-[#0B1724] px-4 py-3 shadow-inner mb-2"
            onSubmit={runSearch}
          >
            <Search className="h-5 w-5 text-slate-400 ml-2" />
            <input
              className="flex-1 bg-transparent text-[15px] text-white placeholder-slate-500 outline-none"
              placeholder="Search by Title, Author, ISBN, or ask a question..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            
            <div className="flex items-center gap-2">
              <label className="cursor-pointer p-2 text-slate-400 hover:text-white transition rounded-full hover:bg-white/5">
                <Paperclip className="h-5 w-5" />
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,.txt,.md,.csv,.json"
                  multiple
                  onChange={(event) => setUploadedFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-[#FFD600] px-6 py-2.5 text-sm font-bold tracking-wide text-[#0A1624] transition hover:bg-[#FCD400]/90 hover:scale-105 active:scale-95"
              >
                {searching ? "ANALYZING..." : "ANALYZE"}
              </button>
            </div>
          </form>
          {uploadedFiles.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <span
                  key={`${file.name}-${file.size}`}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/65"
                >
                  {file.name}
                </span>
              ))}
            </div>
          )}
        
          <AnimatePresence mode="wait">
            {results === null ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                className="mt-8 flex items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/12 bg-black/12 px-4 py-5 text-sm text-white/55"
              >
                <Sparkles className="h-4 w-4 text-sky-300" />
                Search results will appear here with AI match percentages.
              </motion.div>
            ) : results.length === 0 ? (
              <motion.div
                key="no-results"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                className="mt-8 flex items-center justify-center gap-3 rounded-[24px] border border-red-500/20 bg-red-500/10 px-4 py-8 text-sm text-red-400"
              >
                No matching records found. Try adjusting your search prompt.
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                className="mt-8 flex flex-col gap-8 text-left"
              >
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {visibleResults?.map((result, idx) => {
                    const relevance = result.relevance;
                    const isHigh = relevance >= 90;
                    const isMedium = relevance >= 75;
                    const relevanceBadgeClass = isHigh
                      ? "border border-emerald-500/35 bg-emerald-500/10 text-emerald-400 font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.25)] rounded-full px-2.5 py-0.5 text-[10px]"
                      : isMedium
                      ? "border border-amber-500/35 bg-amber-500/10 text-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.25)] rounded-full px-2.5 py-0.5 text-[10px]"
                      : "border border-sky-500/35 bg-sky-500/10 text-sky-300 font-extrabold rounded-full px-2.5 py-0.5 text-[10px]";

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
                        className="flex flex-col justify-between w-full text-left p-5 bg-gradient-to-b from-[#14283F]/70 to-[#0A1724]/90 backdrop-blur-xl rounded-[28px] border border-white/[0.07] hover:border-[#FFD600] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] transition-all duration-300 group"
                      >
                        <div className="space-y-4">
                          {/* Top bar with category & relevance */}
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/5 px-2.5 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#FFD600] uppercase">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFD600] mr-1.5 animate-pulse"></span>
                              {result.department}
                            </span>
                            <span className={relevanceBadgeClass}>
                              {relevance}% MATCH
                            </span>
                          </div>

                          {/* Title & Metadata */}
                          <div>
                            <h3 className="text-base font-bold tracking-tight text-white group-hover:text-[#FFD600] transition-colors duration-200 line-clamp-2 leading-snug text-left">
                              {result.title}
                            </h3>
                            <div className="mt-2 space-y-1.5 text-left">
                              <p className="flex items-center gap-1.5 text-xs text-white/80">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                By <span className="font-semibold text-white/95">{result.author}</span>
                              </p>
                              <div className="flex items-center flex-wrap gap-1.5 text-[10px] text-white/50">
                                <span className="font-mono bg-white/5 border border-white/5 px-1.5 py-0.5 rounded-md">
                                  ISBN: {result.isbn}
                                </span>
                                {result.language && (
                                  <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded-md uppercase font-bold tracking-wider text-[8px]">
                                    🌐 {result.language}
                                  </span>
                                )}
                                {typeof result.rating === "number" && result.rating > 0 && (
                                  <span className="inline-flex items-center gap-0.5 bg-[#FFD600]/10 border border-[#FFD600]/20 px-1.5 py-0.5 rounded-md text-[#FFD600] font-bold">
                                    ⭐ {result.rating.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Visual Relevance Meter */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-wider text-white/40">
                              <span>Relevance Meter</span>
                              <span className={isHigh ? "text-emerald-400" : isMedium ? "text-amber-400" : "text-sky-300"}>
                                {relevance}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden border border-white/[0.02]">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${relevance}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className={`h-full rounded-full bg-gradient-to-r ${relevanceBarColor}`}
                              />
                            </div>
                          </div>

                          {/* Book Summary */}
                          <div className="border-l border-[#FFD600]/30 pl-3 pt-1 pb-0.5 text-left">
                            <p className="text-xs text-white/70 leading-relaxed line-clamp-3 italic">
                              "{result.summary}"
                            </p>
                          </div>
                        </div>

                        {/* Matched explanation details */}
                        {result.matchedBy && result.matchedBy.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1 pt-3.5 border-t border-white/[0.04] justify-start">
                            {result.matchedBy.map((match) => (
                              <span
                                key={match}
                                className="inline-flex items-center gap-1 text-[8px] font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-sm"
                              >
                                <Sparkles className="h-2 w-2 text-emerald-400" />
                                {match}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-5">
        {metricCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
            accent={card.accent}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <BorrowQueue
          queue={dashboard?.queue ?? []}
          processingQueueId={processingQueueId}
          onUpdate={updateRequestStatus}
        />
        <div className="grid gap-6">
          <TrendingRecords trending={dashboard?.trending ?? []} />
          <LiveTerminal activity={liveActivity} />
        </div>
      </div>

      <BookDetailModal
        open={Boolean(selectedBook)}
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />
    </div>
  );
}

function BorrowQueue({
  queue,
  processingQueueId,
  onUpdate,
}: {
  queue: TransactionRecord[];
  processingQueueId: string | null;
  onUpdate: (id: string, status: TransactionStatus) => Promise<void>;
}) {
  return (
    <Panel className="overflow-hidden p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="warning">Urgent Actions</Badge>
          <h2 className="mt-4 text-2xl font-semibold text-white">Borrowing Queue</h2>
          <p className="mt-2 text-sm text-white/60">
            Incoming borrowing and reservation requests update in real time.
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">Live Feed</p>
          <p className="mt-2 text-lg font-semibold text-white">{queue.length} requests</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
              <th className="pb-3 pr-4 font-medium">Identity</th>
              <th className="pb-3 pr-4 font-medium">Resource</th>
              <th className="pb-3 pr-4 font-medium">Time Request</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((request) => (
              <tr key={request.id} className="border-b border-[rgba(2,6,23,0.06)] last:border-b-0">
                <td className="py-4 pr-4">
                  <p className="font-semibold text-white">{request.studentName}</p>
                  <p className="mt-1 text-sm text-white/55">{request.studentId}</p>
                </td>
                <td className="py-4 pr-4">
                  <p className="font-medium text-white">{request.resourceTitle}</p>
                  <p className="mt-1 text-sm text-white/55">{request.isbn}</p>
                </td>
                <td className="py-4 pr-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-sm text-white/65">
                    <Clock3 className="h-4 w-4" />
                    {formatDateTime(request.requestedAt)}
                  </div>
                </td>
                <td className="py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={processingQueueId === request.id}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/12 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                      onClick={() => void onUpdate(request.id, "Approved")}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={processingQueueId === request.id}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-400/18 bg-rose-500/12 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                      onClick={() => void onUpdate(request.id, "Declined")}
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TrendingRecords({
  trending,
}: {
  trending: DashboardPayload["trending"];
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge tone="success">Most Borrowed</Badge>
          <h2 className="mt-4 text-2xl font-semibold text-white">Trending Records</h2>
          <p className="mt-2 text-sm text-white/60">
            Ranked titles with the strongest borrowing demand this cycle.
          </p>
        </div>
        <HardDrive className="h-5 w-5 text-white/40" />
      </div>

      <div className="mt-6 space-y-3">
        {trending.map((book, index) => (
          <div
            key={book.id}
            className={cn(
              "rounded-[24px] border px-4 py-4",
              index === 0
                ? "border-sky-400/18 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(37,99,235,0.12))]"
                : "border-white/8 bg-white/4",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/20 text-lg font-semibold text-white/80">
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold text-white">{book.title}</p>
                  <p className="mt-1 text-sm text-white/55">{book.author}</p>
                </div>
              </div>
              <Badge tone={index === 0 ? "success" : "default"}>{book.borrowCount} borrows</Badge>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LiveTerminal({
  activity,
}: {
  activity: DashboardPayload["recentActivity"];
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge>Realtime Stream</Badge>
          <h2 className="mt-4 text-2xl font-semibold text-white">Live Terminal Activity</h2>
          <p className="mt-2 text-sm text-white/60">
            Book additions, approvals, reservations, and cache events with timestamps.
          </p>
        </div>
        <ShieldCheck className="h-5 w-5 text-white/40" />
      </div>

      <div className="mt-6 rounded-[24px] border border-white/8 bg-black/16 p-3">
        <VirtualizedList
          items={activity}
          height={308}
          itemHeight={72}
          renderItem={(item) => (
            <div className="flex h-[72px] items-center gap-4 border-b border-white/5 px-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  item.level === "success"
                    ? "bg-emerald-400"
                    : item.level === "warning"
                      ? "bg-amber-400"
                      : "bg-sky-400",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{item.message}</p>
                <p className="mt-1 text-xs text-white/45">{formatDateTime(item.timestamp)}</p>
              </div>
            </div>
          )}
        />
      </div>
    </Panel>
  );
}

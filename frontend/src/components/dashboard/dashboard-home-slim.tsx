"use client";

import { AnimatePresence, motion } from "framer-motion";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  History,
  Plus,
  Settings2,
  Sparkles,
  Search as SearchIcon,
  Paperclip,
} from "lucide-react";
import Link from "next/link";

import { useTheme } from "@/components/providers/theme-provider";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { dashboardVariantConfig, type DashboardVariant } from "@/lib/dashboard-config";
import type { DashboardPayload, SearchResult } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const categories = [
  "Circulation",
  "General Reference",
  "Filipiniana",
  "Reserve",
  "Periodical",
  "Special Collections",
];

const adminActions = [
  {
    label: "New Book",
    description: "Add a fresh title to the shared catalog.",
    icon: BookOpen,
    href: "/admin/book-management",
  },
  {
    label: "Approve Request",
    description: "Review new borrowing activity quickly.",
    icon: CheckCircle2,
    href: "/admin/transactions",
  },
  {
    label: "Inventory Audit",
    description: "Inspect catalog records and shelf status.",
    icon: ClipboardList,
    href: "/admin/records-catalog",
  },
  {
    label: "Open Settings",
    description: "Adjust roles, themes, and platform preferences.",
    icon: Settings2,
    href: "/admin/settings",
  },
  {
    label: "View History",
    description: "Track recent system-side activity logs.",
    icon: History,
    href: "/admin/system-monitoring",
  },
] as const;

const librarianActions = [
  {
    label: "Inspect Records",
    description: "Open catalog records and title availability.",
    icon: BookOpen,
    href: "/librarian/records",
  },
  {
    label: "Approve Requests",
    description: "Review the latest borrow and reserve queue.",
    icon: CheckCircle2,
    href: "/librarian/transactions",
  },
  {
    label: "Review Reports",
    description: "Check demand, usage, and circulation trends.",
    icon: ClipboardList,
    href: "/librarian/reports",
  },
  {
    label: "Post Alerts",
    description: "Share announcements with students and staff.",
    icon: Bell,
    href: "/librarian/announcements",
  },
  {
    label: "Audit History",
    description: "Trace the latest changes across the desk.",
    icon: History,
    href: "/librarian/history",
  },
] as const;

export function DashboardHomeSlim({ variant = "admin" }: { variant?: DashboardVariant }) {
  const config = dashboardVariantConfig[variant];
  const { theme } = useTheme();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;

  const loadDashboard = useEffectEvent(async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        const text = await response.text();
        console.error("/api/dashboard failed", response.status, text);
        return;
      }

      let payload: DashboardPayload | null = null;
      try {
        payload = (await response.json()) as DashboardPayload;
      } catch (error) {
        console.error("Invalid JSON from /api/dashboard:", error);
        return;
      }

      if (!payload) {
        return;
      }

      startTransition(() => setDashboard(payload));
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    }
  });

  useEffect(() => {
    void loadDashboard();

    const refreshTimer = setInterval(() => {
      void loadDashboard();
    }, 8000);

    return () => clearInterval(refreshTimer);
  }, []);

  const isLight = theme === "light";
  const isLibrarian = variant === "librarian";
  const quickActions = isLibrarian ? librarianActions : adminActions;
  const visibleResults = useMemo(() => {
    if (!results) return null;
    return results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [results, currentPage, PAGE_SIZE]);
  const activityPreview = useMemo(() => dashboard?.recentActivity.slice(0, 4) ?? [], [dashboard]);
  const queuePreview = useMemo(() => dashboard?.queue.slice(0, 4) ?? [], [dashboard]);
  const spotlightBook = dashboard?.trending[0] ?? null;

  const metricCards = useMemo(
    () => [
      {
        label: "Total Books",
        value: dashboard ? dashboard.metrics.totalBooks.toLocaleString() : "...",
        detail: "Catalog records from the BookHive database",
        accent: "#ffd166",
      },
      {
        label: "Active Users",
        value: dashboard ? dashboard.metrics.activeUsers.toLocaleString() : "...",
        detail: "Authenticated accounts currently tracked",
        accent: "#34d399",
      },
      {
        label: "Pending Requests",
        value: dashboard ? dashboard.metrics.pendingRequests.toString() : "...",
        detail: "Borrowing and reservation actions awaiting review",
        accent: "#38bdf8",
      },
    ],
    [dashboard],
  );

  async function runSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    setCurrentPage(1);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          department: selectedCategory,
        }),
      });
      const payload = (await response.json()) as { results: SearchResult[] };
      setResults(payload.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-[#14293E] p-8 md:p-10 mb-8 shadow-xl">
        {/* Section Label */}
        <div className="flex items-center gap-2 text-[#FFD600] mb-4">
          <Sparkles className="h-4 w-4 fill-current" />
          <span className="text-xs font-bold tracking-widest uppercase">
            {isLibrarian ? "Librarian Command Desk" : "Ask BookHive"}
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="mb-8 text-[32px] font-bold tracking-tight text-white md:text-[36px]">
          Find resources across the entire STI WNU digital ecosystem.
        </h1>

        {/* AI Prompt Search Box */}
        <form onSubmit={runSearch}>
          <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-[#0B1724] px-4 py-3 shadow-inner mb-2">
            <SearchIcon className="h-5 w-5 text-slate-400 ml-2" />
            <input
              type="text"
              suppressHydrationWarning
              placeholder="Search by title, author, ISBN, or ask a question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-white placeholder-slate-500 outline-none"
            />
            
            <div className="flex items-center gap-2">
              <label className="cursor-pointer p-2 text-slate-400 hover:text-white transition rounded-full hover:bg-white/5" title="Upload Attachment">
                <Paperclip className="h-5 w-5" />
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                  multiple
                />
              </label>
              
              <button
                type="submit"
                suppressHydrationWarning
                disabled={searching}
                className="flex items-center gap-2 rounded-full bg-[#FFD600] px-6 py-2.5 text-sm font-bold tracking-wide text-[#0A1624] transition hover:bg-[#FCD400]/90 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
              >
                {searching ? "ANALYZING..." : "ANALYZE"}
                {!searching && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </form>
      </section>

      <AnimatePresence mode="wait">
                  <motion.div
                    key={searching ? "searching" : "idle"}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={cn(
                      "mt-4 rounded-[22px] border px-4 py-3 text-sm",
                      isLight
                        ? "border-[#d7e4f6] bg-[#f4f8ff] text-[#36506f]"
                        : "border-white/10 bg-white/5 text-white/75",
                    )}
                  >
                    {searching ? (
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 animate-pulse rounded-full",
                            isLight ? "bg-[#1d4ed8]" : "bg-sky-300",
                          )}
                        />
                        <div>
                          <p className={cn("font-semibold", isLight ? "text-[#10233a]" : "text-white")}>
                            Searching the BookHive system...
                          </p>
                          <p className={cn("text-xs", isLight ? "text-[#6b7e95]" : "text-white/60")}>
                            Matching titles, authors, ISBN, and summaries to the best result set.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            isLight ? "bg-emerald-500" : "bg-emerald-300",
                          )}
                        />
                        <p>AI prompt search is ready. Type a query to inspect the best matches.</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {results !== null ? (
                  <div
                    className={cn(
                      "mt-5 rounded-[24px] border p-4",
                      isLight
                        ? "border-[#d7e3f6] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(236,244,255,0.92))]"
                        : "border-white/12 bg-white/6",
                    )}
                  >
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p
                          className={cn(
                            "text-xs font-semibold uppercase tracking-[0.18em]",
                            isLight ? "text-[#43617f]" : "text-white/70",
                          )}
                        >
                          AI Prompt Results
                        </p>
                        <p className={cn("mt-1 text-xs", isLight ? "text-[#6b7e95]" : "text-white/50")}>
                          Tap a match to open the full book details modal.
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "border-0",
                          isLight ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-white/10 text-white",
                        )}
                      >
                        {results.length} match{results.length === 1 ? "" : "es"}
                      </Badge>
                    </div>

                    {results.length === 0 && !searching ? (
                      <p className={cn("text-sm", isLight ? "text-[#48637e]" : "text-white/70")}>
                        No matches found for this query. Try adjusting your search prompt.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-8">
                        <div className="mt-4 grid gap-6 sm:grid-cols-2">
                          {visibleResults?.map((item, idx) => {
                            const relevance = item.relevance;
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
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedBook(item)}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
                                whileHover={{ y: -6, scale: 1.015 }}
                                className={cn(
                                  "group w-full overflow-hidden rounded-[28px] border p-5 text-left transition-all duration-300",
                                  isLight
                                    ? "border-[#d7e4f6]/80 bg-white hover:border-[#FFD600] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]"
                                    : "border-white/[0.07] bg-gradient-to-b from-[#14283F]/70 to-[#0A1724]/90 hover:border-[#FFD600]/30 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)]"
                                )}
                              >
                                <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-start">
                                  <div
                                    className={cn(
                                      "flex h-12 w-12 items-center justify-center rounded-2xl text-xl",
                                      isLight ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-sky-500/15 text-sky-200",
                                    )}
                                  >
                                    <BookOpen className="h-5 w-5" />
                                  </div>

                                  <div className="min-w-0">
                                    <p
                                      className={cn(
                                        "line-clamp-1 text-base font-bold tracking-tight group-hover:text-[#FFD600] transition-colors duration-200",
                                        isLight ? "text-[#10233a]" : "text-white",
                                      )}
                                    >
                                      {item.title}
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-1 text-xs",
                                        isLight ? "text-[#4b6079]/90" : "text-white/80",
                                      )}
                                    >
                                      By <span className="font-semibold text-white/90">{item.author}</span>
                                    </p>
                                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                                      <span
                                        className={cn(
                                          "rounded-md border px-2 py-0.5",
                                          isLight
                                            ? "border-[#dbe7f7] bg-[#eff6ff] text-[#43617f]"
                                            : "border-white/5 bg-white/5 text-white/60",
                                        )}
                                      >
                                        {item.department}
                                      </span>
                                      <span
                                        className={cn(
                                          "rounded-md border px-2 py-0.5",
                                          isLight
                                            ? "border-[#e6f2ff] bg-[#f8fbff] text-[#546a85]"
                                            : "border-white/5 bg-white/5 text-white/60",
                                        )}
                                      >
                                        ISBN: {item.isbn}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-2">
                                    <span className={relevanceBadgeClass}>
                                      {relevance}% MATCH
                                    </span>
                                    <Badge
                                      tone={item.availability === "Available" ? "success" : item.availability === "Limited" ? "warning" : "danger"}
                                      className="text-[9px] uppercase tracking-[0.18em]"
                                    >
                                      {item.availability}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Visual Relevance Progress Meter */}
                                <div className="mt-4 space-y-1">
                                  <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-wider text-white/40">
                                    <span>Relevance Meter</span>
                                    <span className={isHigh ? "text-emerald-400" : isMedium ? "text-amber-400" : "text-sky-300"}>
                                      {relevance}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden border border-white/[0.02]">
                                    <div
                                      className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", relevanceBarColor)}
                                      style={{ width: `${relevance}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="mt-4 border-l border-[#FFD600]/30 pl-3 pt-0.5 pb-0.5 text-left">
                                  <p className="line-clamp-2 text-xs leading-relaxed italic text-white/70">
                                    "{item.summary}"
                                  </p>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-1.5 pt-3.5 border-t border-white/[0.04]">
                                  {item.matchedBy.slice(0, 3).map((match) => (
                                    <span
                                      key={match}
                                      className="inline-flex items-center gap-1 text-[8px] font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"
                                    >
                                      <Sparkles className="h-2 w-2 text-emerald-400" />
                                      {match}
                                    </span>
                                  ))}
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>

                        {results.length > 0 && (
                          <div className={cn(
                            "mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-[20px] border w-full",
                            isLight
                              ? "border-[#dbe7f7]/80 bg-[#eff6ff]/30"
                              : "border-white/[0.05] bg-white/[0.02]"
                          )}>
                            {/* Pagination Info */}
                            <div className="text-xs font-semibold text-white/50 text-left">
                              Showing <span className={cn(isLight ? "text-[#10233a]" : "text-white")}>{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
                              <span className={cn(isLight ? "text-[#10233a]" : "text-white")}>{Math.min(currentPage * PAGE_SIZE, results.length)}</span> of{" "}
                              <span className="text-[#FFD600]">{results.length}</span> matches found
                            </div>

                            {/* Pagination Toggles */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-30 disabled:active:scale-100",
                                  isLight
                                    ? "border-[#dbe7f7] bg-white text-[#43617f] hover:bg-[#eff6ff] disabled:hover:bg-white"
                                    : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 disabled:hover:bg-white/5 disabled:hover:border-white/10"
                                )}
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
                                          : isLight
                                            ? "border-[#dbe7f7] bg-white text-[#43617f] hover:bg-[#eff6ff]"
                                            : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20"
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
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-30 disabled:active:scale-100",
                                  isLight
                                    ? "border-[#dbe7f7] bg-white text-[#43617f] hover:bg-[#eff6ff] disabled:hover:bg-white"
                                    : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 disabled:hover:bg-white/5 disabled:hover:border-white/10"
                                )}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.08)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              {isLibrarian ? "Librarian Workflow" : "Quick Actions"}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Move faster from the home page</h3>
          </div>
          <Badge tone="success">{quickActions.length} shortcuts</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={cn(
                "group rounded-[24px] border p-4 transition",
                isLight
                  ? "border-[#d5e2f6] bg-[linear-gradient(180deg,#ffffff,#f5f9ff)] shadow-[0_14px_34px_rgba(15,23,42,0.05)] hover:border-[#93c5fd] hover:bg-[#f7fbff]"
                  : "border-[var(--line)] bg-[var(--panel-strong)] hover:border-[var(--accent)] hover:bg-[var(--panel)]",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-12 w-12 items-center justify-center rounded-3xl transition",
                  isLight
                    ? "bg-[#dbeafe] text-[#1d4ed8] group-hover:bg-[#bfdbfe]"
                    : "bg-[#ffd166]/12 text-[#ffd166]",
                )}
              >
                <action.icon className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">{action.label}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <AnimatePresence mode="wait">
          {metricCards.map((card) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <MetricCard {...card} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Recent activity</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Live desk events pulled from the shared BookHive stream.
              </p>
            </div>
            <Badge>{activityPreview.length} items</Badge>
          </div>

          {activityPreview.length > 0 ? (
            <div className="mt-4 space-y-3">
              {activityPreview.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{activity.message}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(activity.timestamp)}</p>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        activity.level === "success"
                          ? "bg-emerald-400"
                          : activity.level === "warning"
                            ? "bg-amber-400"
                            : "bg-sky-400",
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 text-sm text-[var(--muted)]">
              No recent activity to display yet.
            </div>
          )}
        </Panel>

        <Panel className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Queue overview</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                The next circulation requests waiting for attention.
              </p>
            </div>
            <Badge tone="warning">{queuePreview.length} open</Badge>
          </div>

          {queuePreview.length > 0 ? (
            <div className="mt-4 space-y-3">
              {queuePreview.map((request) => (
                <div
                  key={request.id}
                  className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{request.studentName}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{request.resourceTitle}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {request.department} - {formatDateTime(request.requestedAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--warning)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--warning)]">
                      {request.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4 text-sm text-[var(--muted)]">
              No requests are waiting in the circulation queue.
            </div>
          )}

          <Link
            href={isLibrarian ? "/librarian/transactions" : "/admin/transactions"}
            className={cn(
              "mt-4 inline-flex items-center gap-2 text-sm font-semibold",
              isLight ? "text-[#1d4ed8]" : "text-[#ffd166]",
            )}
          >
            Manage circulation
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>
      </div>

      <BookDetailModal
        open={Boolean(selectedBook)}
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />
    </div>
  );
}

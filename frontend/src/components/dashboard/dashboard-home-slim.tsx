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
  "Computer Science",
  "Engineering",
  "Education",
  "Business & Accountancy",
  "Arts & Sciences",
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
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);

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
  const topResults = useMemo(() => results.slice(0, 6), [results]);
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
      <Panel className="panel-hero relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
        <div
          className={cn(
            "pointer-events-none absolute inset-0",
            isLight
              ? "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(255,255,255,0)_42%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.34),rgba(125,211,252,0)_36%)]"
              : "bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.14),rgba(125,211,252,0)_36%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.22),rgba(37,99,235,0)_32%)]",
          )}
        />

        <div className="relative mx-auto w-full max-w-full">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <Badge
                className={cn(
                  "mx-0 border-0",
                  isLight
                    ? "bg-white/80 text-[#1d4ed8] shadow-[0_10px_26px_rgba(37,99,235,0.14)]"
                    : "bg-[var(--sidebar-accent)]/10 text-[var(--sidebar-accent)]",
                )}
              >
                {isLibrarian ? "Librarian Command Desk" : "Ask BookHive"}
              </Badge>

              <h1
                className={cn(
                  "mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.7rem]",
                  isLight ? "text-[#10233a]" : "text-white",
                )}
              >
                Find resources across the entire STI WNU digital ecosystem.
              </h1>

              <p
                className={cn(
                  "mt-3 max-w-2xl text-sm leading-7 sm:text-base",
                  isLight ? "text-[#36506f]" : "text-white/70",
                )}
              >
                Search by title, author, ISBN, or ask a question...
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]",
                    isLight
                      ? "border-[#c9d8ef] bg-white/78 text-[#1e3a5f]"
                      : "border-white/10 bg-white/8 text-white/75",
                  )}
                >
                  {config.title}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs",
                    isLight
                      ? "border-[#c9d8ef] bg-[#eff6ff] text-[#36506f]"
                      : "border-white/10 bg-white/5 text-white/70",
                  )}
                >
                  {dashboard
                    ? `${dashboard.metrics.pendingRequests} pending requests`
                    : "Loading circulation summary"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs",
                    isLight
                      ? "border-[#c9d8ef] bg-[#eff6ff] text-[#36506f]"
                      : "border-white/10 bg-white/5 text-white/70",
                  )}
                >
                  {spotlightBook ? `Trending: ${spotlightBook.title}` : "Syncing collection insights"}
                </span>
              </div>

              <div
                className={cn(
                  "mt-7 rounded-[30px] border p-3 shadow-[0_24px_70px_rgba(7,18,37,0.18)] backdrop-blur-xl sm:p-4",
                  isLight
                    ? "border-[#cfdef4] bg-white/82"
                    : "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))]",
                )}
              >
                <form className="flex flex-col gap-3" onSubmit={runSearch}>
                  <div
                    className={cn(
                      "flex flex-col gap-3 rounded-[24px] border p-3 sm:flex-row sm:items-center",
                      isLight ? "border-[#d8e4f7] bg-[#f8fbff]" : "border-white/10 bg-white/5",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl cursor-pointer transition-colors",
                        isLight ? "bg-[#dbeafe] text-[#1d4ed8] hover:bg-[#bfdbfe]" : "bg-white/10 text-sky-200 hover:bg-white/20",
                      )}
                    >
                      <Plus className="h-5 w-5" />
                    </div>
                    <input
                      aria-label="Search resources"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by title, author, ISBN, or ask a question..."
                      className={cn(
                        "flex-1 bg-transparent text-sm outline-none sm:text-base",
                        isLight
                          ? "text-[#0f172a] placeholder:text-[#6b7e95]"
                          : "text-white placeholder:text-white/45",
                      )}
                    />
                    <button
                      type="submit"
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-semibold tracking-[0.18em] transition sm:px-6",
                        isLight
                          ? "bg-[#1d4ed8] text-white shadow-[0_16px_35px_rgba(29,78,216,0.28)] hover:translate-y-[-1px] hover:bg-[#1e40af]"
                          : "bg-[#0f2740] text-white hover:bg-[#123155]",
                      )}
                    >
                      {searching ? "ANALYZING..." : "ANALYZE"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          selectedCategory === category
                            ? isLight
                              ? "border-[#93c5fd] bg-[#dbeafe] text-[#1d4ed8]"
                              : "border-sky-300/35 bg-sky-300/15 text-white"
                            : isLight
                              ? "border-[#d8e4f7] bg-white/80 text-[#48637e] hover:border-[#bfdbfe] hover:bg-[#eff6ff]"
                              : "border-white/10 bg-white/5 text-white/75 hover:bg-white/12",
                        )}
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </form>

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

                {query.trim().length > 0 ? (
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
                        {topResults.length} match{topResults.length === 1 ? "" : "es"}
                      </Badge>
                    </div>

                    {topResults.length === 0 && !searching ? (
                      <p className={cn("text-sm", isLight ? "text-[#48637e]" : "text-white/70")}>
                        No matches found for this query.
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {topResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedBook(item)}
                            className={cn(
                              "group w-full overflow-hidden rounded-[28px] border px-5 py-5 text-left shadow-[0_24px_64px_rgba(7,18,37,0.12)] transition duration-300",
                              isLight
                                ? "border-[#e7edf8] bg-white hover:-translate-y-0.5 hover:border-[#93c5fd]"
                                : "border-white/10 bg-[#071822] hover:-translate-y-0.5 hover:border-sky-300/30",
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
                                    "line-clamp-1 text-base font-semibold",
                                    isLight ? "text-[#10233a]" : "text-white",
                                  )}
                                >
                                  {item.title}
                                </p>
                                <p
                                  className={cn(
                                    "mt-2 text-sm",
                                    isLight ? "text-[#4b6079]" : "text-white/70",
                                  )}
                                >
                                  {item.author}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
                                  <span
                                    className={cn(
                                      "rounded-full border px-2 py-1",
                                      isLight
                                        ? "border-[#dbe7f7] bg-[#eff6ff] text-[#43617f]"
                                        : "border-white/10 bg-white/5 text-white/60",
                                    )}
                                  >
                                    {item.department}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded-full border px-2 py-1",
                                      isLight
                                        ? "border-[#e6f2ff] bg-[#f8fbff] text-[#546a85]"
                                        : "border-white/10 bg-white/5 text-white/60",
                                    )}
                                  >
                                    ISBN: {item.isbn}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-3">
                                <Badge tone="warning" className="text-[11px] uppercase tracking-[0.18em]">
                                  {item.relevance}% Match
                                </Badge>
                                <Badge
                                  tone={item.availability === "Available" ? "success" : item.availability === "Limited" ? "warning" : "danger"}
                                  className="text-[11px] uppercase tracking-[0.18em]"
                                >
                                  {item.availability}
                                </Badge>
                              </div>
                            </div>

                            <p
                              className={cn(
                                "mt-5 line-clamp-2 text-sm leading-6",
                                isLight ? "text-[#4b6079]" : "text-white/65",
                              )}
                            >
                              {item.summary}
                            </p>

                            <div className="mt-5 flex flex-wrap gap-2">
                              {item.matchedBy.slice(0, 3).map((match) => (
                                <Badge
                                  key={match}
                                  tone="default"
                                  className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]")}
                                >
                                  {match}
                                </Badge>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      </Panel>

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

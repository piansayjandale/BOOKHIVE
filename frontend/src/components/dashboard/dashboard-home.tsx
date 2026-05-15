"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { VirtualizedList } from "@/components/ui/virtualized-list";
import { useLiveActivity } from "@/lib/hooks/use-live-activity";
import type {
  DashboardPayload,
  SearchResult,
  TransactionRecord,
  TransactionStatus,
} from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const categories = [
  "Computer Science",
  "Engineering",
  "Education",
  "Business & Accountancy",
  "Arts & Sciences",
];

export function DashboardHome() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Computer Science");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processingQueueId, setProcessingQueueId] = useState<string | null>(null);

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

  async function runSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!query.trim() && uploadedFiles.length === 0) {
      setResults([]);
      return;
    }

    setSearching(true);

    const formData = new FormData();
    formData.set("query", query);
    formData.set("department", selectedCategory);
    for (const file of uploadedFiles) {
      formData.append("files", file);
    }

    const response = await fetch("/api/search", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { results: SearchResult[] };
    startTransition(() => setResults(payload.results));
    setSearching(false);
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

  return (
    <div className="space-y-8">
      <Panel className="overflow-hidden px-6 py-8 sm:px-8 panel-hero">
        <div className="mx-auto max-w-5xl text-center">
          <Badge className="mx-auto">AI Prompt Search</Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Ask BookHive
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/65">
            Find resources across the entire STI WNU digital ecosystem using title,
            author, ISBN, natural language prompts, and uploaded academic files.
          </p>

          <form
            className="mx-auto mt-8 rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_80px_rgba(5,10,30,0.35)]"
            onSubmit={runSearch}
          >
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <input
                className="glass-input w-full rounded-[24px] px-5 py-4 text-base"
                placeholder="Search by title, author, ISBN, or describe the resource you need..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-[24px] bg-[linear-gradient(135deg,#57c3ff,#2563eb)] px-6 py-4 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.32)] transition hover:translate-y-[-1px]"
              >
                {searching ? "Matching..." : "Run AI Search"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-white/65">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2">
                <FileUp className="h-4 w-4 text-sky-300" />
                Upload docs, PDF, images, or PPT
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,.txt,.md,.csv,.json"
                  multiple
                  onChange={(event) => setUploadedFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-4 py-2 text-emerald-200">
                <BrainCircuit className="h-4 w-4" />
                Indexed semantic relevance scoring
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition",
                    selectedCategory === category
                      ? "border-sky-300/30 bg-sky-400/14 text-white"
                      : "border-white/10 bg-white/4 text-white/60 hover:bg-white/8 hover:text-white",
                  )}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {uploadedFiles.length > 0 ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {uploadedFiles.map((file) => (
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

          <AnimatePresence mode="wait">
            {results.length > 0 ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                className="mt-8 grid gap-4 text-left lg:grid-cols-3"
              >
                {results.map((result) => (
                  <Panel key={result.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                          {result.department}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{result.title}</h3>
                      </div>
                      <Badge tone="success">{result.relevance}%</Badge>
                    </div>
                    <p className="mt-2 text-sm text-white/60">
                      {result.author} • {result.isbn}
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      {result.language ?? "Unknown language"}
                      {typeof result.rating === "number" ? ` • Rated ${result.rating.toFixed(2)}` : ""}
                    </p>
                    <p className="mt-4 line-clamp-3 text-sm leading-7 text-white/62">
                      {result.summary}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {result.matchedBy.map((match) => (
                        <span
                          key={match}
                          className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-white/52"
                        >
                          {match}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 h-2 rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#60a5fa,#22d3ee)]"
                        style={{ width: `${result.relevance}%` }}
                      />
                    </div>
                  </Panel>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 flex items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/12 bg-black/12 px-4 py-5 text-sm text-white/55"
              >
                <Sparkles className="h-4 w-4 text-sky-300" />
                Search results will appear here with AI match percentages.
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

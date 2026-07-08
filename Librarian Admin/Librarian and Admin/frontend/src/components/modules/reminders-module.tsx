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
  AlertTriangle,
  BellRing,
  Check,
  Clock,
  Inbox,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";

import type { TransactionRecord, TransactionStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type TabId = "violators" | "due" | "dueToday";
type SortKey = "studentName" | "resourceTitle" | "dueDate" | "requestedAt";

/* ── Constants ───────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<string, string> = {
  Pending:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Declined: "bg-red-500/15 text-red-300 border-red-500/30",
  Returned: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

/* ── Helper Functions ────────────────────────────────────────────────────── */

function isToday(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

function isOverdue(dateStr?: string) {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due.getTime() < now.getTime();
}

function getOverdueDays(dateStr?: string) {
  if (!dateStr) return 0;
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function RemindersModule() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("violators");
  const [sortBy, setSortBy] = useState<SortKey | null>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);

  const deferredSearch = useDeferredValue(search);

  /* ── Fetching active borrows ─────────────────────────────────────────── */

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: "Approved",
        type: "Borrow",
      });
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) return;
      const payload = (await res.json()) as { transactions: TransactionRecord[] };
      startTransition(() => {
        setTransactions(payload.transactions || []);
      });
    } catch (err) {
      console.error("Failed to load reminders data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  /* ── Tab Filtering ───────────────────────────────────────────────────── */

  const filteredByTab = useMemo(() => {
    if (activeTab === "violators") {
      return transactions.filter((t) => isOverdue(t.dueDate));
    }
    if (activeTab === "dueToday") {
      return transactions.filter((t) => isToday(t.dueDate));
    }
    // "due" tab (All active return schedules)
    return transactions;
  }, [transactions, activeTab]);

  /* ── Search Filtering ────────────────────────────────────────────────── */

  const searchedAndTabbed = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return filteredByTab;
    return filteredByTab.filter(
      (t) =>
        t.studentName.toLowerCase().includes(q) ||
        t.studentId.toLowerCase().includes(q) ||
        t.resourceTitle.toLowerCase().includes(q) ||
        t.isbn.toLowerCase().includes(q)
    );
  }, [filteredByTab, deferredSearch]);

  /* ── Sorting ─────────────────────────────────────────────────────────── */

  const sorted = useMemo(() => {
    const data = [...searchedAndTabbed];
    if (!sortBy) return data;
    data.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (sortBy === "dueDate" || sortBy === "requestedAt") {
        const ad = av ? new Date(av).getTime() : 0;
        const bd = bv ? new Date(bv).getTime() : 0;
        return sortDir === "asc" ? ad - bd : bd - ad;
      }
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
    return data;
  }, [searchedAndTabbed, sortBy, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  /* ── Summary statistics ──────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const violatorsCount = transactions.filter((t) => isOverdue(t.dueDate)).length;
    const dueTodayCount = transactions.filter((t) => isToday(t.dueDate)).length;
    return {
      violators: violatorsCount,
      activeBorrows: transactions.length,
      dueToday: dueTodayCount,
    };
  }, [transactions]);

  /* ── Actions ─────────────────────────────────────────────────────────── */

  async function handleMarkAsReturned(id: string) {
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Returned" }),
      });
      if (res.ok) {
        await loadData();
      } else {
        console.error("Failed to mark book as returned:", await res.text());
      }
    } catch (err) {
      console.error("Error marking book as returned:", err);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 px-1">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">
            Librarian · Reminders
          </p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">
            Violations & Return Status
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Monitor overdue books, manage return deadlines, and view today's expected returns.
          </p>
        </div>
        <button
          suppressHydrationWarning
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Stat pills ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Active Overdue Violators",
            value: stats.violators.toLocaleString(),
            color: "#EF4444",
            icon: ShieldAlert,
          },
          {
            label: "Total Borrowed Books",
            value: stats.activeBorrows.toLocaleString(),
            color: "#6EE7B7",
            icon: Clock,
          },
          {
            label: "Return Deadlines Today",
            value: stats.dueToday.toLocaleString(),
            color: "#FCD400",
            icon: BellRing,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/8 bg-[#152E47]/60 px-5 py-4 backdrop-blur transition-all duration-300 hover:border-white/12"
            style={{ borderLeftColor: stat.color, borderLeftWidth: 4 }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">
                {stat.label}
              </p>
              <stat.icon className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Search & Tabs Bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-white/8 pb-4">
        {/* Tabs Control */}
        <div className="flex gap-2 p-1 rounded-xl bg-[#0b1c2c]/40 border border-white/5">
          {[
            { id: "violators" as TabId, label: `Violators (${stats.violators})`, icon: ShieldAlert },
            { id: "due" as TabId, label: `Due Returns (${stats.activeBorrows})`, icon: Clock },
            { id: "dueToday" as TabId, label: `Due Today (${stats.dueToday})`, icon: BellRing },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-[#FCD400] text-[#0b1c2c] shadow"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-80 max-w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-xs text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
            placeholder="Search student, book, ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table Container ────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur">
        <div className="overflow-auto h-full">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-[#152E47]/60">
                {[
                  { key: "studentName" as SortKey, label: "Student" },
                  { key: "resourceTitle" as SortKey, label: "Book Details" },
                  { key: "requestedAt" as SortKey, label: "Checkout Date" },
                  { key: "dueDate" as SortKey, label: "Due Date" },
                  activeTab === "violators"
                    ? { key: null, label: "Overdue Status" }
                    : { key: null, label: "Status" },
                  { key: null, label: "Action" },
                ].map((col) => (
                  <th
                    key={col.label}
                    className="px-5 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap"
                  >
                    {col.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key!)}
                        className="flex items-center gap-1.5 hover:text-[#FCD400] transition-colors"
                      >
                        {col.label}
                        {sortIndicator(col.key!)}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((txn) => {
                const isOverdueItem = isOverdue(txn.dueDate);
                const isDueTodayItem = isToday(txn.dueDate);
                const overdueDays = getOverdueDays(txn.dueDate);

                return (
                  <tr
                    key={txn.id}
                    className="border-b border-white/5 transition hover:bg-white/[0.02]"
                  >
                    {/* Student */}
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <div className="font-semibold text-white leading-snug line-clamp-1">
                        {txn.studentName}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                        {txn.studentId}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {txn.department}
                      </div>
                    </td>

                    {/* Resource / Book */}
                    <td className="px-5 py-3.5 max-w-[260px]">
                      <div className="font-semibold text-white leading-snug line-clamp-1">
                        {txn.resourceTitle}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">
                        ISBN: {txn.isbn}
                      </div>
                    </td>

                    {/* Checkout Date */}
                    <td className="px-5 py-3.5 text-xs text-slate-300 whitespace-nowrap">
                      {formatDate(txn.requestedAt)}
                    </td>

                    {/* Due Date */}
                    <td className="px-5 py-3.5 text-xs text-slate-300 whitespace-nowrap">
                      {txn.dueDate ? formatDate(txn.dueDate) : "N/A"}
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {activeTab === "violators" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          {overdueDays} Day{overdueDays !== 1 ? "s" : ""} Overdue
                        </span>
                      ) : isOverdueItem ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-red-400">
                          Overdue
                        </span>
                      ) : isDueTodayItem ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                          Due Today
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                          On Time
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5">
                      <button
                        suppressHydrationWarning
                        type="button"
                        onClick={() => void handleMarkAsReturned(txn.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50 transition active:scale-95"
                        title="Mark as Returned"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Return
                      </button>
                    </td>
                  </tr>
                );
              })}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-500">
                    <Inbox className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    No records found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2">
        <span>
          Showing {sorted.length} transaction{sorted.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Auto-refreshing every 10s
        </span>
      </div>
    </div>
  );
}

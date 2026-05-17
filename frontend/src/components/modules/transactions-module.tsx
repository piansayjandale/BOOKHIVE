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
  ArrowDownUp,
  BookMarked,
  Check,
  ChevronDown,
  Clock,
  Inbox,
  RefreshCcw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import type {
  DashboardPayload,
  TransactionRecord,
  TransactionStatus,
  TransactionType,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

/* ── Constants ───────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<string, string> = {
  Pending:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Declined: "bg-red-500/15 text-red-300 border-red-500/30",
  Returned: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

const TYPE_STYLE: Record<string, string> = {
  Borrow:      "text-[#FCD400]",
  Return:      "text-sky-400",
  Reservation: "text-violet-400",
};

const transactionTypes: Array<TransactionType | "All"> = [
  "All",
  "Borrow",
  "Return",
  "Reservation",
];

type SortKey = "studentName" | "resourceTitle" | "requestedAt";

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${STATUS_STYLE[status] ?? "text-slate-400 border-white/10 bg-white/5"}`}
    >
      {status}
    </span>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function TransactionsModule() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardPayload["metrics"] | null>(null);
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState<string>("All");
  const [type, setType]       = useState<TransactionType | "All">("All");
  const [sortBy, setSortBy]   = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const deferredSearch = useDeferredValue(search);

  /* ── Data fetching ───────────────────────────────────────────────────── */

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams({ search: deferredSearch, status, type });
    const res = await fetch(`/api/transactions?${params}`);
    const payload = (await res.json()) as { transactions: TransactionRecord[] };
    startTransition(() => setTransactions(payload.transactions));
  }, [deferredSearch, status, type]);

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/dashboard");
    const payload = (await res.json()) as DashboardPayload;
    startTransition(() => setDashboardMetrics(payload.metrics));
  }, []);

  useEffect(() => {
    void loadTransactions();
    void loadDashboard();
    const iv = setInterval(() => {
      void loadTransactions();
      void loadDashboard();
    }, 8000);
    return () => clearInterval(iv);
  }, [loadTransactions, loadDashboard]);

  /* ── Sorting ─────────────────────────────────────────────────────────── */

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const s = [...transactions];
    if (!sortBy) return s;
    s.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (sortBy === "requestedAt") {
        return sortDir === "asc"
          ? new Date(av as string).getTime() - new Date(bv as string).getTime()
          : new Date(bv as string).getTime() - new Date(av as string).getTime();
      }
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
    return s;
  }, [transactions, sortBy, sortDir]);

  /* ── Action handlers ─────────────────────────────────────────────────── */

  async function updateStatus(id: string, nextStatus: TransactionStatus) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadTransactions();
  }

  /* ── Derived counts ──────────────────────────────────────────────────── */

  const counts = useMemo(() => ({
    pending:  transactions.filter((t) => t.status === "Pending").length,
    approved: transactions.filter((t) => t.status === "Approved").length,
    declined: transactions.filter((t) => t.status === "Declined").length,
    returned: transactions.filter((t) => t.status === "Returned").length,
  }), [transactions]);

  const sortIndicator = (key: SortKey) =>
    sortBy === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col gap-6 px-1">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">
            Librarian · Transactions
          </p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">
            Circulation Queue
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Track borrows, returns, and reservations — approve or decline in real time.
          </p>
        </div>
        <button
          suppressHydrationWarning
          onClick={() => { void loadTransactions(); void loadDashboard(); }}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Stat pills ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Pending",  value: (dashboardMetrics?.pendingRequests ?? counts.pending).toLocaleString(),  color: "#FBBF24", icon: Clock },
          { label: "Approved", value: (dashboardMetrics?.approvedRequests ?? counts.approved).toLocaleString(), color: "#6EE7B7", icon: Check },
          { label: "Declined", value: counts.declined.toLocaleString(), color: "#FCA5A5", icon: X },
          { label: "Returned", value: (dashboardMetrics?.returnedRequests ?? counts.returned).toLocaleString(), color: "#7DD3FC", icon: RefreshCcw },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/8 bg-[#152E47]/60 px-5 py-4 backdrop-blur"
            style={{ borderLeftColor: stat.color, borderLeftWidth: 4 }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">{stat.label}</p>
              <stat.icon className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <p className="mt-1 text-2xl font-black text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Search / Filter bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
            placeholder="Search student, title, ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            suppressHydrationWarning
            className="rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-8 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["All", "Pending", "Approved", "Declined", "Returned"].map((o) => (
              <option key={o} value={o} className="bg-[#0F1D29]">{o}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <BookMarked className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            suppressHydrationWarning
            className="rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-8 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none"
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType | "All")}
          >
            {transactionTypes.map((o) => (
              <option key={o} value={o} className="bg-[#0F1D29]">{o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur">
        <div className="overflow-auto h-full">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-[#152E47]/60">
                {[
                  { key: "studentName" as SortKey, label: "Student" },
                  { key: "resourceTitle" as SortKey, label: "Resource" },
                  { key: null, label: "Type" },
                  { key: null, label: "Status" },
                  { key: "requestedAt" as SortKey, label: "Requested" },
                  { key: null, label: "Actions" },
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
                        <ArrowDownUp className="h-3 w-3 opacity-40" />
                        <span className="text-[#FCD400]">{sortIndicator(col.key!)}</span>
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-white/5 transition hover:bg-white/[0.03]"
                >
                  {/* Student */}
                  <td className="px-5 py-3.5 max-w-[200px]">
                    <div className="font-semibold text-white leading-snug line-clamp-1">
                      {txn.studentName}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono">
                      {txn.studentId}
                    </div>
                  </td>

                  {/* Resource */}
                  <td className="px-5 py-3.5 max-w-[260px]">
                    <div className="font-semibold text-white leading-snug line-clamp-1">
                      {txn.resourceTitle}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                      {txn.isbn}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={`text-xs font-semibold ${TYPE_STYLE[txn.type] ?? "text-slate-400"}`}>
                      {txn.type}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <StatusBadge status={txn.status} />
                  </td>

                  {/* Requested */}
                  <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                    {formatDateTime(txn.requestedAt)}
                    {txn.dueDate && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Due: {formatDateTime(txn.dueDate)}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      {txn.status !== "Approved" && txn.status !== "Returned" && txn.status !== "Declined" && (
                        <button
                          suppressHydrationWarning
                          type="button"
                          onClick={() => void updateStatus(txn.id, "Approved")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </button>
                      )}
                      {txn.status === "Pending" && (
                        <button
                          suppressHydrationWarning
                          type="button"
                          onClick={() => void updateStatus(txn.id, "Declined")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:border-red-500/50 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                          Decline
                        </button>
                      )}
                      {txn.status === "Approved" && (
                        <button
                          suppressHydrationWarning
                          type="button"
                          onClick={() => void updateStatus(txn.id, "Returned")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50 transition"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Returned
                        </button>
                      )}
                      {(txn.status === "Returned" || txn.status === "Declined") && (
                        <span className="inline-flex items-center px-2 text-[11px] text-slate-500 italic">
                          Closed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-500">
                    <Inbox className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    No transactions found.
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
          {sorted.length.toLocaleString()} transaction{sorted.length !== 1 ? "s" : ""}
          {status !== "All" && ` · ${status}`}
          {type !== "All" && ` · ${type}`}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Auto-refreshing every 8s
        </span>
      </div>
    </div>
  );
}

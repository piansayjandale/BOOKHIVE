"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Check, RefreshCcw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ModuleHeader } from "@/components/ui/module-header";
import { Panel } from "@/components/ui/panel";
import type {
  DashboardPayload,
  TransactionRecord,
  TransactionStatus,
  TransactionType,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const transactionTypes: Array<TransactionType | "All"> = [
  "All",
  "Borrow",
  "Return",
  "Reservation",
];
type TransactionSortKey = "studentName" | "resourceTitle" | "requestedAt";

export function TransactionsModule() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardPayload["metrics"] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [type, setType] = useState<TransactionType | "All">("All");

  const [sortBy, setSortBy] = useState<TransactionSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const deferredSearch = useDeferredValue(search);

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams({
      search: deferredSearch,
      status,
      type,
    });
    const response = await fetch(`/api/transactions?${params.toString()}`);
    const payload = (await response.json()) as { transactions: TransactionRecord[] };
    startTransition(() => setTransactions(payload.transactions));
  }, [deferredSearch, status, type]);

  const loadDashboardMetrics = useCallback(async () => {
    const response = await fetch("/api/dashboard");
    const payload = (await response.json()) as DashboardPayload;
    startTransition(() => setDashboardMetrics(payload.metrics));
  }, []);

  useEffect(() => {
    void loadTransactions();
    void loadDashboardMetrics();

    const refreshInterval = setInterval(() => {
      void loadTransactions();
      void loadDashboardMetrics();
    }, 8000);

    return () => clearInterval(refreshInterval);
  }, [loadTransactions, loadDashboardMetrics]);

  function toggleSort(key: TransactionSortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sortedTransactions = useMemo(() => {
    if (!transactions) return [] as TransactionRecord[];
    const s = [...transactions];
    if (!sortBy) return s;
    s.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (sortBy === "requestedAt") {
        const ta = new Date(av as string).getTime();
        const tb = new Date(bv as string).getTime();
        return sortDir === "asc" ? ta - tb : tb - ta;
      }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") {
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      return 0;
    });
    return s;
  }, [transactions, sortBy, sortDir]);

  async function updateStatus(id: string, nextStatus: TransactionStatus) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadTransactions();
  }

  const counts = useMemo(
    () => ({
      pending: transactions.filter((transaction) => transaction.status === "Pending").length,
      approved: transactions.filter((transaction) => transaction.status === "Approved").length,
      returned: transactions.filter((transaction) => transaction.status === "Returned").length,
    }),
    [transactions],
  );

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Transactions"
        title="Borrowing, returns, and reservations in one queue"
        description="Track every circulation request, enforce the max-book rule, and keep approval workflows responsive with real-time status changes."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Books",
            value: dashboardMetrics?.totalBooks.toLocaleString() ?? "...",
          },
          {
            label: "Active Users",
            value: dashboardMetrics?.activeUsers.toLocaleString() ?? "...",
          },
          { label: "Pending", value: dashboardMetrics?.pendingRequests.toString() ?? counts.pending.toString() },
          { label: "Approved", value: dashboardMetrics?.approvedRequests.toString() ?? counts.approved.toString() },
          { label: "Returned", value: dashboardMetrics?.returnedRequests.toString() ?? counts.returned.toString() },
          {
            label: "Total Borrows",
            value: dashboardMetrics?.totalBorrows.toLocaleString() ?? "...",
          },
          {
            label: "Reservations",
            value: dashboardMetrics?.reservationRequests.toLocaleString() ?? "...",
          },
        ].map((item) => (
          <Panel key={item.label} className="p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--module-muted-2)]">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--module-title-color)]">{item.value}
            </p>
          </Panel>
        ))}
      </div>

      <div className="mt-4">
        <Panel className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge>Live Queue</Badge>
              <h2 className="mt-3 text-lg font-semibold text-[var(--module-title-color)]">Transaction board</h2>
              <p className="mt-1 text-xs text-[var(--module-muted-color)]">
                Filter by type and status, then approve, decline, or mark returns instantly.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_160px]">
            <input
              className="control-compact"
              placeholder="Search student, title, ISBN"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="control-compact"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {["All", "Pending", "Approved", "Declined", "Returned"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="control-compact"
              value={type}
              onChange={(event) => setType(event.target.value as TransactionType | "All")}
            >
              {transactionTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 overflow-x-auto rounded-[8px] border border-[var(--line)]">
            <table className="min-w-full table-fixed">
              <thead>
                <tr className="bg-[var(--table-header-bg)] text-[10px] uppercase tracking-[0.16em] text-[var(--table-header-foreground)]">
                  <th className="px-3 py-2.5 text-left">
                    <button type="button" onClick={() => toggleSort('studentName')} className="flex items-center gap-2">
                      Identity
                      {sortBy === 'studentName' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : null}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    <button type="button" onClick={() => toggleSort('resourceTitle')} className="flex items-center gap-2">
                      Resource
                      {sortBy === 'resourceTitle' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : null}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left">Type</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-left">
                    <button type="button" onClick={() => toggleSort('requestedAt')} className="flex items-center gap-2">
                      Time Request
                      {sortBy === 'requestedAt' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : null}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--surface-hover)]">
                    <td className="px-3 py-2.5 align-top">
                      <div className="text-sm font-semibold text-[var(--module-title-color)]">{transaction.studentName}</div>
                      <div className="mt-0.5 text-xs text-[var(--module-muted-2)]">{transaction.studentId}</div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="text-sm font-medium text-[var(--module-title-color)]">{transaction.resourceTitle}</div>
                      <div className="mt-0.5 text-xs text-[var(--module-muted-2)]">{transaction.isbn}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--module-muted-color)]">{transaction.type}</td>
                    <td className="px-3 py-2.5"><Badge className="px-2.5 py-0.5 text-[10px]" tone={
                      transaction.status === 'Approved' ? 'success' : transaction.status === 'Declined' ? 'danger' : transaction.status === 'Returned' ? 'default' : 'warning'
                    }>{transaction.status}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-[var(--module-muted-color)]">{formatDateTime(transaction.requestedAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {transaction.status !== 'Approved' ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-emerald-600/20 bg-[var(--button-approve-bg)] px-2.5 text-xs font-semibold text-[var(--button-approve-fg)]"
                            onClick={() => void updateStatus(transaction.id, 'Approved')}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        ) : null}
                        {transaction.status === 'Pending' ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-rose-600/20 bg-[var(--button-decline-bg)] px-2.5 text-xs font-semibold text-[var(--button-decline-fg)]"
                            onClick={() => void updateStatus(transaction.id, 'Declined')}
                          >
                            <X className="h-3.5 w-3.5" />
                            Decline
                          </button>
                        ) : null}
                        {transaction.status === 'Approved' ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-sky-500/20 bg-sky-500/10 px-2.5 text-xs font-semibold text-sky-700"
                            onClick={() => void updateStatus(transaction.id, 'Returned')}
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Mark Returned
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

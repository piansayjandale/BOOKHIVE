"use client";

import { startTransition, useEffect, useState } from "react";
import {
  ArrowDownUp,
  Check,
  Clock,
  Inbox,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { useNotice } from "@/components/providers/notice-provider";
import { requestJson } from "@/lib/admin/client";
import type { AdminTransactionsPayload } from "@/lib/admin/types";
import type { TransactionStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

/* ── Constants ───────────────────────────────────────────────────────────── */

type TransactionTab = "borrow" | "returns" | "reservations" | "history";

const STATUS_STYLE: Record<string, string> = {
  Pending:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Declined: "bg-red-500/15 text-red-300 border-red-500/30",
  Returned: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

const TABS: Array<{ value: TransactionTab; label: string }> = [
  { value: "borrow",       label: "Borrow Requests" },
  { value: "returns",      label: "Return Records" },
  { value: "reservations", label: "Reservations" },
  { value: "history",      label: "Full History" },
];

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

/* ── Main ────────────────────────────────────────────────────────────────── */

export function TransactionsPage() {
  const { notify } = useNotice();
  const [payload, setPayload] = useState<AdminTransactionsPayload | null>(null);
  const [tab, setTab]         = useState<TransactionTab>("borrow");
  const [search, setSearch]   = useState("");

  async function loadTransactions() {
    const next = await requestJson<AdminTransactionsPayload>("/api/admin/transactions");
    startTransition(() => setPayload(next));
  }

  useEffect(() => { void loadTransactions(); }, []);

  async function updateStatus(id: string, status: TransactionStatus) {
    try {
      await requestJson(`/api/admin/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      notify(`Transaction marked ${status.toLowerCase()}.`, "success");
      await loadTransactions();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update transaction.", "error");
    }
  }

  const allRows =
    tab === "borrow"       ? payload?.borrowRequests ?? [] :
    tab === "returns"      ? payload?.returnRecords ?? [] :
    tab === "reservations" ? payload?.reservations ?? [] :
                             payload?.transactionHistory ?? [];

  const rows = search
    ? allRows.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.studentName.toLowerCase().includes(q) ||
          r.studentId.toLowerCase().includes(q) ||
          r.resourceTitle.toLowerCase().includes(q) ||
          (r.isbn ?? "").toLowerCase().includes(q)
        );
      })
    : allRows;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-6 overflow-hidden px-4 py-5 md:px-8">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">
            Administration · Transactions
          </p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">
            Transaction Workspace
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Review borrow requests, returns, and reservations.
            {payload?.allowAdminControl
              ? " Admin override is enabled."
              : " View-only — enable admin control in Settings."}
          </p>
        </div>
        <button
          suppressHydrationWarning
          onClick={() => void loadTransactions()}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Stat pills ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Pending",  value: payload?.summary?.pending ?? "…",  color: "#FBBF24", icon: Clock },
          { label: "Approved", value: payload?.summary?.approved ?? "…", color: "#6EE7B7", icon: Check },
          { label: "Declined", value: payload?.summary?.declined ?? "…", color: "#FCA5A5", icon: X },
          { label: "Returned", value: payload?.summary?.returned ?? "…", color: "#7DD3FC", icon: RefreshCcw },
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

      {/* ── Tab pills + Search ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              suppressHydrationWarning
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-xl px-4 py-2 text-xs font-bold tracking-wide transition ${
                tab === t.value
                  ? "bg-[#FCD400] text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20"
                  : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
            placeholder="Search student, title, ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur">
        <div className="overflow-auto h-full">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-[#152E47]/60">
                {["Student", "Resource", "Type", "Status", "Requested", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-white/5 transition hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3.5 max-w-[200px]">
                    <div className="font-semibold text-white leading-snug line-clamp-1">{item.studentName}</div>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono">{item.studentId}</div>
                  </td>
                  <td className="px-5 py-3.5 max-w-[260px]">
                    <div className="font-semibold text-white leading-snug line-clamp-1">{item.resourceTitle}</div>
                    {item.isbn && <div className="text-xs text-slate-500 mt-0.5 font-mono">{item.isbn}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-[#FCD400] whitespace-nowrap">
                    {item.type}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                    {formatDateTime(item.requestedAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button
                        suppressHydrationWarning
                        type="button"
                        onClick={() => void updateStatus(item.id, "Approved")}
                        disabled={!payload?.allowAdminControl}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        suppressHydrationWarning
                        type="button"
                        onClick={() => void updateStatus(item.id, "Declined")}
                        disabled={!payload?.allowAdminControl}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:border-red-500/50 transition disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <X className="h-3.5 w-3.5" />
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
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
        <span>{rows.length.toLocaleString()} record{rows.length !== 1 ? "s" : ""}</span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <ShieldCheck className="h-3 w-3" />
          {payload?.allowAdminControl ? "Admin override active" : "View-only mode"}
        </span>
      </div>
    </div>
  );
}

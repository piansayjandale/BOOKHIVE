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
import { useTheme } from "@/components/providers/theme-provider";
import { requestJson } from "@/lib/admin/client";
import type { AdminTransactionsPayload } from "@/lib/admin/types";
import type { TransactionRecord, TransactionStatus } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { StudentLibraryCardModal } from "@/components/modals/student-library-card-modal";

/* ── Constants ───────────────────────────────────────────────────────────── */

type TransactionTab = "borrow" | "returns" | "reservations" | "history";

const STATUS_STYLE: Record<string, string> = {
  Pending:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Borrow:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Borrowed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
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

function StatusBadge({ status, isLight }: { status: string; isLight?: boolean }) {
  const lightStyles: Record<string, string> = {
    Pending:  "bg-amber-50 text-amber-700 border-amber-200",
    Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Borrow:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    Borrowed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Declined: "bg-red-50 text-red-700 border-red-200",
    Returned: "bg-sky-50 text-sky-700 border-sky-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
        isLight
          ? lightStyles[status] ?? "text-slate-600 border-slate-200 bg-slate-100"
          : STATUS_STYLE[status] ?? "text-slate-400 border-white/10 bg-white/5"
      }`}
    >
      {status}
    </span>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */

export function TransactionsPage() {
  const { notify } = useNotice();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [payload, setPayload] = useState<AdminTransactionsPayload | null>(null);
  const [tab, setTab]         = useState<TransactionTab>("borrow");
  const [search, setSearch]   = useState("");
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<{
    name: string;
    studentId: string;
    department?: string;
    course?: string;
    qrCode?: string;
  } | null>(null);

  async function loadTransactions() {
    try {
      const res = await requestJson<any>("/api/admin/transactions?status=All&type=All");
      const rawList: TransactionRecord[] = Array.isArray(res?.transactions)
        ? res.transactions
        : Array.isArray(res)
        ? res
        : Array.isArray(res?.transactionHistory)
        ? res.transactionHistory
        : [];

      const borrowRequests: TransactionRecord[] = Array.isArray(res?.borrowRequests)
        ? res.borrowRequests
        : rawList.filter(
            (item) => String(item.type || (item as any).action || "").toLowerCase() === "borrow"
          );

      const returnRecords: TransactionRecord[] = Array.isArray(res?.returnRecords)
        ? res.returnRecords
        : rawList.filter(
            (item) =>
              String(item.type || (item as any).action || "").toLowerCase() === "return" ||
              item.status === "Returned"
          );

      const reservations: TransactionRecord[] = Array.isArray(res?.reservations)
        ? res.reservations
        : rawList.filter(
            (item) => String(item.type || (item as any).action || "").toLowerCase() === "reservation"
          );

      const transactionHistory: TransactionRecord[] = Array.isArray(res?.transactionHistory)
        ? res.transactionHistory
        : rawList;

      const summary = res?.summary ?? {
        pending: rawList.filter((item) => item.status === "Pending").length,
        approved: rawList.filter((item) => item.status === "Approved").length,
        declined: rawList.filter((item) => item.status === "Declined").length,
        returned: rawList.filter((item) => item.status === "Returned").length,
      };

      const normalized: AdminTransactionsPayload = {
        summary,
        borrowRequests,
        returnRecords,
        reservations,
        transactionHistory,
        allowAdminControl: res?.allowAdminControl ?? true,
      };

      startTransition(() => setPayload(normalized));
    } catch (error) {
      console.error("Failed to load transactions:", error);
      startTransition(() =>
        setPayload({
          summary: { pending: 0, approved: 0, declined: 0, returned: 0 },
          borrowRequests: [],
          returnRecords: [],
          reservations: [],
          transactionHistory: [],
          allowAdminControl: true,
        })
      );
    }
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
          (r.studentName ?? "").toLowerCase().includes(q) ||
          (r.studentId ?? "").toLowerCase().includes(q) ||
          (r.resourceTitle ?? "").toLowerCase().includes(q) ||
          (r.isbn ?? "").toLowerCase().includes(q)
        );
      })
    : allRows;

  // All transactions for the student library card modal
  const combinedHistory = payload?.transactionHistory ?? [
    ...(payload?.borrowRequests ?? []),
    ...(payload?.returnRecords ?? []),
    ...(payload?.reservations ?? []),
  ];

  return (
    <div className="flex h-full flex-col gap-6 px-1">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={cn("text-[11px] font-bold tracking-[0.2em] uppercase", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
            Admin · Circulation
          </p>
          <h1 className={cn("mt-1 text-2xl font-black tracking-tight", isLight ? "text-slate-900" : "text-white")}>
            Transaction Oversight
          </h1>
          <p className={cn("mt-0.5 text-sm", isLight ? "text-slate-600" : "text-slate-400")}>
            Real-time status overview across all active borrows, returns, and reservations.
          </p>
        </div>
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => void loadTransactions()}
          className={cn(
            "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-lg transition active:scale-95",
            isLight
              ? "bg-[#0274BB] text-white hover:bg-[#02609c] shadow-sky-500/10"
              : "bg-[#FCD400] text-[#0b1c2c] shadow-[#FCD400]/20 hover:brightness-110"
          )}
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Metric Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Borrow Requests",
            count: payload?.borrowRequests?.length ?? 0,
            color: isLight ? "text-amber-700" : "text-amber-400",
            border: isLight ? "border-amber-200" : "border-amber-500/20",
            bg: isLight ? "bg-amber-50/70" : "bg-amber-50/5",
            icon: Clock,
          },
          {
            label: "Return Records",
            count: payload?.returnRecords?.length ?? 0,
            color: isLight ? "text-sky-700" : "text-sky-400",
            border: isLight ? "border-sky-200" : "border-sky-500/20",
            bg: isLight ? "bg-sky-50/70" : "bg-sky-50/5",
            icon: RefreshCcw,
          },
          {
            label: "Reservations",
            count: payload?.reservations?.length ?? 0,
            color: isLight ? "text-violet-700" : "text-violet-400",
            border: isLight ? "border-violet-200" : "border-violet-500/20",
            bg: isLight ? "bg-violet-50/70" : "bg-violet-50/5",
            icon: SlidersHorizontal,
          },
          {
            label: "Total History",
            count: payload?.transactionHistory?.length ?? 0,
            color: isLight ? "text-slate-800" : "text-slate-300",
            border: isLight ? "border-slate-200" : "border-white/10",
            bg: isLight ? "bg-slate-50" : "bg-white/5",
            icon: ArrowDownUp,
          },
        ].map((c) => (
          <div
            key={c.label}
            className={cn("flex items-center justify-between rounded-2xl border p-4 shadow-xs", c.border, c.bg)}
          >
            <div>
              <p className={cn("text-[11px] font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>{c.label}</p>
              <p className={cn("mt-1 text-2xl font-black", c.color)}>
                {payload ? c.count.toLocaleString() : "—"}
              </p>
            </div>
            <c.icon className={cn("h-6 w-6 opacity-40", c.color)} />
          </div>
        ))}
      </div>

      {/* ── Tabs & Search Bar ────────────────────────────────────────── */}
      <div className={cn("flex flex-wrap items-center justify-between gap-4 border-b pb-4", isLight ? "border-slate-200" : "border-white/8")}>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-bold transition",
                tab === t.value
                  ? isLight
                    ? "bg-[#0274BB] text-white shadow-md shadow-sky-500/20"
                    : "bg-[#FCD400] text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20"
                  : isLight
                    ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            suppressHydrationWarning
            className={cn(
              "w-full rounded-xl py-2 pl-10 pr-4 text-sm transition focus:outline-none focus:ring-1",
              isLight
                ? "border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 shadow-xs focus:border-[#0274BB] focus:ring-[#0274BB]/30"
                : "border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:ring-0"
            )}
            placeholder="Search student, title, ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className={cn(
        "flex-1 overflow-hidden rounded-2xl border",
        isLight
          ? "border-slate-200 bg-white shadow-xs"
          : "border-white/8 bg-[#0F1D29]/80 backdrop-blur"
      )}>
        <div className="overflow-auto h-full">
          <table className="min-w-full text-sm">
            <thead>
              <tr className={cn(
                "border-b",
                isLight
                  ? "border-slate-200 bg-slate-50"
                  : "border-white/8 bg-[#152E47]/60"
              )}>
                {["Student", "Resource", "Type", "Status", "Requested", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-5 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] uppercase whitespace-nowrap",
                      isLight ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => (
                <tr
                  key={item.id ? `tx-${item.id}-${idx}` : `tx-idx-${idx}`}
                  className={cn(
                    "border-b transition",
                    isLight
                      ? "border-slate-100 hover:bg-slate-50/80"
                      : "border-white/5 hover:bg-white/[0.03]"
                  )}
                >
                  <td className="px-5 py-3.5 max-w-[200px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStudentForCard({
                          name: item.studentName,
                          studentId: item.studentId,
                          department: (item as any).department,
                          course: (item as any).course || (item as any).department || "General Program",
                          qrCode: (item as any).qrCode || `e1a1-${item.studentId || "default"}`,
                        })
                      }
                      className={cn(
                        "group text-left block w-full rounded-lg p-1.5 -m-1.5 transition-all duration-200 focus:outline-none cursor-pointer",
                        isLight
                          ? "hover:bg-sky-50 hover:border hover:border-sky-200 focus:ring-1 focus:ring-[#0274BB]"
                          : "hover:bg-[#FCD400]/10 hover:border hover:border-[#FCD400]/30 focus:ring-1 focus:ring-[#FCD400]"
                      )}
                      title={`Click to view Library Card for ${item.studentName}`}
                    >
                      <div className={cn(
                        "font-semibold leading-snug line-clamp-1 transition-colors flex items-center gap-1",
                        isLight
                          ? "text-slate-900 group-hover:text-[#0274BB]"
                          : "text-white group-hover:text-[#FCD400]"
                      )}>
                        <span>{item.studentName}</span>
                        <span className={cn(
                          "text-[9px] opacity-0 group-hover:opacity-100 transition-opacity font-bold",
                          isLight ? "text-[#0274BB]" : "text-[#FCD400]"
                        )}>
                          ↗
                        </span>
                      </div>
                      <div className={cn(
                        "text-xs mt-0.5 font-mono",
                        isLight ? "text-slate-500 group-hover:text-slate-700" : "text-slate-400 group-hover:text-slate-200"
                      )}>
                        {item.studentId}
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 max-w-[260px]">
                    <div className={cn("font-semibold leading-snug line-clamp-1", isLight ? "text-slate-900" : "text-white")}>
                      {item.resourceTitle}
                    </div>
                    {item.isbn && (
                      <div className={cn("text-xs mt-0.5 font-mono", isLight ? "text-slate-500" : "text-slate-500")}>
                        {item.isbn}
                      </div>
                    )}
                  </td>
                  <td className={cn(
                    "px-5 py-3.5 text-xs font-semibold whitespace-nowrap",
                    isLight ? "text-[#0274BB]" : "text-[#FCD400]"
                  )}>
                    {item.type}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={item.status} isLight={isLight} />
                  </td>
                  <td className={cn("px-5 py-3.5 text-xs whitespace-nowrap", isLight ? "text-slate-600" : "text-slate-400")}>
                    {formatDateTime(item.requestedAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button
                        suppressHydrationWarning
                        type="button"
                        onClick={() => void updateStatus(item.id, "Approved")}
                        disabled={!payload?.allowAdminControl}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-30 disabled:pointer-events-none",
                          isLight
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        suppressHydrationWarning
                        type="button"
                        onClick={() => void updateStatus(item.id, "Declined")}
                        disabled={!payload?.allowAdminControl}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-30 disabled:pointer-events-none",
                          isLight
                            ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400"
                            : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                        )}
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
                  <td colSpan={6} className={cn("py-20 text-center", isLight ? "text-slate-400" : "text-slate-500")}>
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
      <div className={cn("flex items-center justify-between text-xs pb-2", isLight ? "text-slate-500" : "text-slate-400")}>
        <span>{rows.length.toLocaleString()} record{rows.length !== 1 ? "s" : ""}</span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <ShieldCheck className="h-3 w-3" />
          {payload?.allowAdminControl ? "Admin override active" : "View-only mode"}
        </span>
      </div>

      {/* ── Student Library Card Modal ───────────────────────────────── */}
      <StudentLibraryCardModal
        open={selectedStudentForCard !== null}
        onClose={() => setSelectedStudentForCard(null)}
        student={selectedStudentForCard}
        transactions={combinedHistory}
      />
    </div>
  );
}

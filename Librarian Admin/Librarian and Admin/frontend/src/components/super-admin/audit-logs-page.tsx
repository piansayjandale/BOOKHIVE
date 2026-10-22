"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  History,
  Inbox,
  Layers,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  User,
} from "lucide-react";

import { AdminModal, AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { useTheme } from "@/components/providers/theme-provider";
import { requestJson } from "@/lib/admin/client";
import { cn, formatDateTime } from "@/lib/utils";

const MODULES = [
  "All",
  "System Management",
  "Records",
  "Transactions",
  "Pickups",
  "Settings",
  "Disaster Recovery",
  "Ecosystem Integration",
  "Infrastructure",
  "Announcements",
];

function getModuleBadgeStyle(moduleName: string, isLight: boolean): string {
  const norm = (moduleName || "").toLowerCase().trim();
  if (norm.includes("record") || norm.includes("catalog") || norm.includes("book")) {
    return isLight
      ? "bg-emerald-100 text-emerald-950 border-emerald-300 font-extrabold shadow-xs"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-extrabold";
  }
  if (norm.includes("transaction") || norm.includes("borrow") || norm.includes("return")) {
    return isLight
      ? "bg-blue-100 text-blue-950 border-blue-300 font-extrabold shadow-xs"
      : "bg-blue-500/20 text-blue-300 border-blue-500/40 font-extrabold";
  }
  if (norm.includes("pickup") || norm.includes("pick up") || norm.includes("circulation")) {
    return isLight
      ? "bg-amber-100 text-amber-950 border-amber-300 font-extrabold shadow-xs"
      : "bg-amber-500/20 text-amber-300 border-amber-500/40 font-extrabold";
  }
  if (norm.includes("user") || norm.includes("account") || norm.includes("system") || norm.includes("management")) {
    return isLight
      ? "bg-purple-100 text-purple-950 border-purple-300 font-extrabold shadow-xs"
      : "bg-purple-500/20 text-purple-300 border-purple-500/40 font-extrabold";
  }
  if (norm.includes("setting") || norm.includes("config")) {
    return isLight
      ? "bg-sky-100 text-sky-950 border-sky-300 font-extrabold shadow-xs"
      : "bg-sky-500/20 text-sky-300 border-sky-500/40 font-extrabold";
  }
  if (norm.includes("disaster") || norm.includes("backup") || norm.includes("prun") || norm.includes("purge")) {
    return isLight
      ? "bg-rose-100 text-rose-950 border-rose-300 font-extrabold shadow-xs"
      : "bg-rose-500/20 text-rose-300 border-rose-500/40 font-extrabold";
  }
  if (norm.includes("infra") || norm.includes("server") || norm.includes("telemetry") || norm.includes("maintenance")) {
    return isLight
      ? "bg-teal-100 text-teal-950 border-teal-300 font-extrabold shadow-xs"
      : "bg-teal-500/20 text-teal-300 border-teal-500/40 font-extrabold";
  }
  if (norm.includes("announce")) {
    return isLight
      ? "bg-yellow-100 text-yellow-950 border-yellow-300 font-extrabold shadow-xs"
      : "bg-[#FCD400]/25 text-[#FCD400] border-[#FCD400]/40 font-extrabold";
  }
  return isLight
    ? "bg-slate-200 text-slate-900 border-slate-300 font-extrabold shadow-xs"
    : "bg-white/10 text-slate-200 border-white/20 font-extrabold";
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AuditLogsPage() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [actorFilter, setActorFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString);
  const [isAutoToday, setIsAutoToday] = useState(true);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  // Automatically roll over to the next day when the date changes (e.g., past midnight or new day)
  useEffect(() => {
    const handleDayRollover = () => {
      const today = getTodayString();
      if (isAutoToday) {
        setSelectedDate((current) => (current !== today ? today : current));
      }
    };

    const interval = setInterval(handleDayRollover, 30000); // Check every 30 seconds
    window.addEventListener("focus", handleDayRollover);
    document.addEventListener("visibilitychange", handleDayRollover);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleDayRollover);
      document.removeEventListener("visibilitychange", handleDayRollover);
    };
  }, [isAutoToday]);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (moduleFilter !== "All") params.set("module", moduleFilter);
      if (actorFilter) params.set("actor", actorFilter);
      if (selectedDate) {
        const startOfDay = new Date(`${selectedDate}T00:00:00`);
        const endOfDay = new Date(`${selectedDate}T23:59:59.999`);
        params.set("from", startOfDay.toISOString());
        params.set("to", endOfDay.toISOString());
      }
      params.set("page", String(page));
      params.set("pageSize", "15");

      const res = await requestJson<{ logs: any[]; total: number }>(`/api/super-admin/audit-logs?${params.toString()}`);
      startTransition(() => {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
      });
    } catch (err) {
      console.warn("Failed to load audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search, moduleFilter, actorFilter, selectedDate, page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          eyebrow="Super Admin · Security & Governance"
          title="Audit & Security Logs"
          description="Immutable audit trails tracking administrative mutations, role updates, data prunes, and authentication security events."
        />
        <button
          type="button"
          onClick={() => void loadLogs()}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-4 py-2 text-xs font-bold text-[#0b1c2c] transition hover:brightness-110 shadow-lg shadow-[#FCD400]/20"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Logs
        </button>
      </div>

      <AdminSection
        title="Administrative Mutation Trail"
        description="Filter by actor, affected operational module, keyword, or specific date."
      >
        {/* Filters */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search action, target, or details..."
              className={cn(
                "w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border transition-all outline-none",
                isLight
                  ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#FCD400] focus:ring-2 focus:ring-[#FCD400]/25 shadow-xs"
                  : "border-white/10 bg-[#101D2D] text-white placeholder:text-slate-500 focus:border-[#FCD400] focus:ring-2 focus:ring-[#FCD400]/25"
              )}
            />
          </div>

          <div>
            <select
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(1);
              }}
              className={cn(
                "w-full px-3 py-2.5 text-sm rounded-xl border transition-all outline-none cursor-pointer font-medium",
                isLight
                  ? "border-slate-300 bg-white text-slate-900 focus:border-[#FCD400] focus:ring-2 focus:ring-[#FCD400]/25 shadow-xs"
                  : "border-white/10 bg-[#101D2D] text-white focus:border-[#FCD400] focus:ring-2 focus:ring-[#FCD400]/25"
              )}
            >
              {MODULES.map((m) => (
                <option key={m} value={m} className={isLight ? "bg-white text-slate-900" : "bg-[#101D2D] text-white"}>
                  {m === "All" ? "All Modules" : m}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by Actor name..."
              className={cn(
                "w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border transition-all outline-none",
                isLight
                  ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#FCD400] focus:ring-2 focus:ring-[#FCD400]/25 shadow-xs"
                  : "border-white/10 bg-[#101D2D] text-white placeholder:text-slate-500 focus:border-[#FCD400] focus:ring-2 focus:ring-[#FCD400]/25"
              )}
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDate(val);
                setIsAutoToday(val === getTodayString());
                setPage(1);
              }}
              className={cn(
                "w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border transition-all outline-none cursor-pointer",
                isLight
                  ? "border-slate-300 bg-white text-slate-900 shadow-xs focus:border-[#FCD400]"
                  : "border-white/10 bg-[#101D2D] text-slate-200 focus:border-[#FCD400]"
              )}
              title="Filter by date (defaults to today and updates automatically each day)"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("");
                  setIsAutoToday(false);
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition text-xs p-1 cursor-pointer"
                title="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Selected Day Active Filter Banner */}
        {selectedDate && (
          <div className={cn(
            "mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all",
            isLight
              ? "border-sky-300 bg-sky-50 text-sky-950 shadow-xs"
              : "border-sky-500/25 bg-sky-500/10 text-sky-200"
          )}>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#FCD400]" />
              <span>
                Showing logs for:{" "}
                <strong className={isLight ? "text-slate-900 font-extrabold text-sm sm:text-base" : "text-white font-extrabold text-sm sm:text-base"}>
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </strong>
                {selectedDate === getTodayString() && (
                  <span className={cn(
                    "ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border",
                    isLight
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  )}>
                    Today (Auto-advancing)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedDate !== getTodayString() && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(getTodayString());
                    setIsAutoToday(true);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer",
                    isLight
                      ? "bg-sky-200/80 text-sky-900 hover:bg-sky-300/80"
                      : "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 hover:text-white"
                  )}
                >
                  Jump to Today
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("");
                  setIsAutoToday(false);
                  setPage(1);
                }}
                className="text-xs font-bold text-[#FCD400] hover:underline transition cursor-pointer"
              >
                Clear (Show All Dates)
              </button>
            </div>
          </div>
        )}

        {/* Action cue hint */}
        <div className="mb-2.5 flex items-center justify-between text-xs font-semibold">
          <span className={cn("inline-flex items-center gap-1.5", isLight ? "text-slate-600" : "text-slate-300")}>
            <Eye className="h-3.5 w-3.5 text-[#FCD400]" /> Click on any row to view complete audit information
          </span>
        </div>

        {/* Logs Table */}
        <AdminTable>
          <table className="min-w-full text-left">
            <thead className={cn(
              "uppercase tracking-wider font-extrabold text-xs border-b",
              isLight
                ? "bg-slate-100 text-slate-700 border-slate-200"
                : "bg-[#132338] text-slate-200 border-white/5"
            )}>
              <tr>
                <th className="px-4 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Actor</th>
                <th className="px-4 py-3.5">Action</th>
                <th className="px-4 py-3.5">Target</th>
                <th className="px-4 py-3.5">Module</th>
                <th className="px-4 py-3.5">Mutation Details</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", isLight ? "divide-slate-200 text-slate-800" : "divide-white/5 text-slate-200")}>
              {logs.map((log, idx) => (
                <tr
                  key={log.id ? `log-${log.id}-${idx}` : `l-idx-${idx}`}
                  onClick={() => setSelectedLog(log)}
                  title="Click to view full audit details"
                  className={cn(
                    "cursor-pointer transition group select-none",
                    isLight
                      ? "hover:bg-amber-50/60 active:bg-amber-100/50"
                      : "hover:bg-white/[0.06] active:bg-white/[0.09]"
                  )}
                >
                  <td className="px-4 py-3.5 font-mono text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatDateTime(log.createdAt || log.created_at)}
                  </td>
                  <td className={cn("px-4 py-3.5 font-bold text-sm sm:text-base whitespace-nowrap", isLight ? "text-slate-900" : "text-white")}>
                    {log.actor}
                  </td>
                  <td className={cn("px-4 py-3.5 font-bold text-xs sm:text-sm whitespace-nowrap", isLight ? "text-amber-800" : "text-[#FCD400]")}>
                    <span className="group-hover:underline underline-offset-2">{log.action}</span>
                  </td>
                  <td className={cn("px-4 py-3.5 font-semibold text-xs sm:text-sm", isLight ? "text-slate-800" : "text-slate-200")}>
                    {log.target}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider border shadow-xs inline-block",
                      getModuleBadgeStyle(log.module, isLight)
                    )}>
                      {log.module}
                    </span>
                  </td>
                  <td className={cn("px-4 py-3.5 text-xs sm:text-sm max-w-[360px] truncate leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")} title={log.detail}>
                    {log.detail || "—"}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                    <Inbox className="mx-auto mb-2 h-7 w-7 opacity-30 text-slate-400" />
                    No audit log records found for the selected query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTable>

        {/* Pagination */}
        <div className={cn("mt-4 flex items-center justify-between border-t pt-4 text-sm font-medium", isLight ? "border-slate-200 text-slate-600" : "border-white/8 text-slate-400")}>
          <span>
            Showing <strong className={isLight ? "text-slate-900 font-bold" : "text-white font-bold"}>{logs.length}</strong> of{" "}
            <strong className={isLight ? "text-slate-900 font-bold" : "text-white font-bold"}>{total}</strong> total security logs
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-semibold transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer",
                isLight ? "border-slate-300 text-slate-700 hover:bg-slate-100" : "border-white/10 text-slate-300 hover:bg-white/5"
              )}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className={cn("px-2 font-bold", isLight ? "text-slate-900" : "text-white")}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-semibold transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer",
                isLight ? "border-slate-300 text-slate-700 hover:bg-slate-100" : "border-white/10 text-slate-300 hover:bg-white/5"
              )}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </AdminSection>

      {/* Audit Record Inspection Modal */}
      <AdminModal
        open={Boolean(selectedLog)}
        title="Audit Record Inspection"
        description="Immutable administrative and security telemetry captured by the BookHive platform core."
        onClose={() => setSelectedLog(null)}
      >
        {selectedLog && (
          <div className="space-y-6">
            {/* Top Action & Module Banner */}
            <div className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 sm:p-5",
              isLight
                ? "border-slate-200 bg-slate-50 shadow-xs"
                : "border-white/10 bg-[#101D2D]/80 shadow-inner"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl shrink-0",
                  isLight ? "bg-amber-100 text-amber-700" : "bg-[#FCD400]/15 text-[#FCD400]"
                )}>
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(
                      "font-mono text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border",
                      isLight ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-[#FCD400]/20 text-[#FCD400] border-[#FCD400]/40"
                    )}>
                      {selectedLog.action}
                    </span>
                    <span className={cn(
                      "rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider border shadow-xs inline-block",
                      getModuleBadgeStyle(selectedLog.module, isLight)
                    )}>
                      {selectedLog.module}
                    </span>
                  </div>
                  <p className={cn("text-xs font-medium mt-1.5 flex items-center gap-1.5", isLight ? "text-slate-500" : "text-slate-400")}>
                    <Clock className="h-3.5 w-3.5" />
                    Captured on: <strong className={isLight ? "text-slate-800" : "text-white"}>{formatDateTime(selectedLog.createdAt || selectedLog.created_at)}</strong>
                  </p>
                </div>
              </div>

              {selectedLog.id && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Record ID</span>
                  <p className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">#{selectedLog.id}</p>
                </div>
              )}
            </div>

            {/* Structured Property Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={cn(
                "rounded-xl border p-4 space-y-1",
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.02]"
              )}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-[#FCD400]" /> Actor Identity
                </span>
                <p className={cn("text-base font-extrabold", isLight ? "text-slate-900" : "text-white")}>
                  {selectedLog.actor || "System Automated"}
                </p>
                <p className="text-xs font-medium text-slate-500">Security subject or administrative caller</p>
              </div>

              <div className={cn(
                "rounded-xl border p-4 space-y-1",
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.02]"
              )}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-[#FCD400]" /> Affected Target
                </span>
                <p className={cn("text-base font-extrabold", isLight ? "text-slate-900" : "text-white")}>
                  {selectedLog.target || "Global Scope"}
                </p>
                <p className="text-xs font-medium text-slate-500">Mutated system entity or account record</p>
              </div>
            </div>

            {/* Mutation / Audit Details Container */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#FCD400]" /> Complete Audit & Mutation Description
                </span>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  isLight ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                )}>
                  Verified Immutable
                </span>
              </div>
              <div className={cn(
                "rounded-2xl border p-4 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words",
                isLight
                  ? "border-slate-200 bg-slate-100/90 text-slate-800 shadow-inner"
                  : "border-white/10 bg-[#0B1521] text-slate-200 shadow-inner"
              )}>
                {selectedLog.detail || "No additional descriptive payload logged for this operation."}
              </div>
            </div>

            {/* Actions / Close */}
            <div className="flex justify-end pt-2 border-t border-slate-200/60 dark:border-white/10">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-xl bg-[#FCD400] px-5 py-2.5 text-xs font-bold text-[#0b1c2c] transition hover:brightness-110 shadow-md shadow-[#FCD400]/20 cursor-pointer"
              >
                Close Audit Details
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

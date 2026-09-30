"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  Inbox,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";

import { AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import { formatDateTime } from "@/lib/utils";

const MODULES = [
  "All",
  "System Management",
  "Records",
  "Transactions",
  "Settings",
  "Disaster Recovery",
  "Ecosystem Integration",
  "Infrastructure",
  "Announcements",
];

export function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [actorFilter, setActorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (moduleFilter !== "All") params.set("module", moduleFilter);
      if (actorFilter) params.set("actor", actorFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
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
  }, [search, moduleFilter, actorFilter, fromDate, toDate, page]);

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
        description="Filter by actor, affected operational module, keyword, or date range."
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
              className="glass-input w-full pl-9 pr-3 py-2 text-xs"
            />
          </div>

          <div>
            <select
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(1);
              }}
              className="glass-input w-full px-3 py-2 text-xs"
            >
              {MODULES.map((m) => (
                <option key={m} value={m} className="bg-[#101D2D] text-white">
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
              className="glass-input w-full pl-9 pr-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="glass-input w-full px-2 py-2 text-[11px] text-slate-300"
              title="From Date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="glass-input w-full px-2 py-2 text-[11px] text-slate-300"
              title="To Date"
            />
          </div>
        </div>

        {/* Logs Table */}
        <AdminTable>
          <table className="min-w-full text-left text-xs">
            <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Mutation Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {logs.map((log, idx) => (
                <tr key={log.id ? `log-${log.id}-${idx}` : `l-idx-${idx}`} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {formatDateTime(log.createdAt || log.created_at)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{log.actor}</td>
                  <td className="px-4 py-3 text-[#FCD400] font-medium whitespace-nowrap">{log.action}</td>
                  <td className="px-4 py-3 text-slate-300 font-semibold">{log.target}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      {log.module}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-[11px] max-w-[320px] truncate" title={log.detail}>
                    {log.detail || "—"}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Inbox className="mx-auto mb-2 h-7 w-7 opacity-30 text-slate-400" />
                    No audit log records found for the selected query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTable>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4 text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{logs.length}</strong> of{" "}
            <strong className="text-white">{total}</strong> total security logs
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="px-2 font-bold text-white">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}

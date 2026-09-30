"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  Database,
  Megaphone,
  RefreshCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { VirtualizedList } from "@/components/ui/virtualized-list";
import type { HistoryEntry } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const modules = ["All", "Records", "Transactions", "Settings", "Accounts", "Announcements"] as const;

const MODULE_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string; text: string }> = {
  Records: {
    icon: Database,
    color: "#6EE7B7",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-300",
  },
  Transactions: {
    icon: ArrowDownUp,
    color: "#FCD400",
    bg: "bg-[#FCD400]/10",
    border: "border-[#FCD400]/20",
    text: "text-[#FCD400]",
  },
  Settings: {
    icon: Settings,
    color: "#FCA5A5",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-300",
  },
  Accounts: {
    icon: Users,
    color: "#C4B5FD",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    text: "text-violet-300",
  },
  Announcements: {
    icon: Megaphone,
    color: "#F9A8D4",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    text: "text-pink-300",
  },
  All: {
    icon: Activity,
    color: "#94A3B8",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    text: "text-slate-300",
  },
};

const getModuleConfig = (mod: string) => {
  return MODULE_CONFIG[mod] ?? MODULE_CONFIG.All;
};

export function HistoryModule() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState<(typeof modules)[number]>("All");
  const deferredSearch = useDeferredValue(search);

  const loadHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        search: deferredSearch,
        module,
      });
      const response = await fetch(`/api/history?${params.toString()}`);
      if (!response.ok) {
        startTransition(() => setHistory([]));
        return;
      }
      const payload = await response.json();
      const list = Array.isArray(payload?.history) ? payload.history : Array.isArray(payload) ? payload : [];
      startTransition(() => setHistory(list));
    } catch {
      startTransition(() => setHistory([]));
    }
  }, [deferredSearch, module]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const counts = useMemo(() => {
    const safeHistory = Array.isArray(history) ? history : [];
    return {
      total: safeHistory.length,
      records: safeHistory.filter((h) => h.module === "Records").length,
      transactions: safeHistory.filter((h) => h.module === "Transactions").length,
      other: safeHistory.filter((h) => h.module !== "Records" && h.module !== "Transactions").length,
    };
  }, [history]);

  return (
    <div className="flex h-full flex-col gap-6 px-1">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">
            Librarian · History
          </p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">
            Audit Trail
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Search timestamped changes across records, transactions, settings, and account administration for compliant operational reviews.
          </p>
        </div>
        <button
          suppressHydrationWarning
          onClick={() => void loadHistory()}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Stat pills ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Logs", value: counts.total.toLocaleString(), color: "#94A3B8" },
          { label: "Catalog Events", value: counts.records.toLocaleString(), color: "#6EE7B7" },
          { label: "Transactions", value: counts.transactions.toLocaleString(), color: "#FCD400" },
          { label: "Management", value: counts.other.toLocaleString(), color: "#C4B5FD" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/8 bg-[#152E47]/60 px-5 py-4 backdrop-blur"
            style={{ borderLeftColor: stat.color, borderLeftWidth: 4 }}
          >
            <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">{stat.label}</p>
            <p className="mt-1 text-2xl font-black text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Search & filter ────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
            placeholder="Search actor, action, target, or detail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            suppressHydrationWarning
            className="rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-8 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none"
            value={module}
            onChange={(e) => setModule(e.target.value as (typeof modules)[number])}
          >
            {modules.map((option) => (
              <option key={option} value={option} className="bg-[#0F1D29]">
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Logs List Panel ─────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur">
        <div className="p-3">
          <VirtualizedList
            items={history || []}
            height={660}
            itemHeight={96}
            renderItem={(entry) => {
              const cfg = getModuleConfig(entry.module);
              const IconComp = cfg.icon;
              return (
                <div className="group relative flex items-start gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors h-[96px] border-b border-white/5">
                  {/* Styled Module Icon Badge */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                    <IconComp className="h-4 w-4" />
                  </div>

                  {/* Log Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white group-hover:text-[#FCD400] transition-colors">
                          {entry.action}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                          {entry.module}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                        {formatDateTime(entry.timestamp)}
                      </span>
                    </div>

                    {/* Actor and Target */}
                    <div className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1">
                      <span className="text-slate-300">{entry.actor}</span>
                      {entry.target && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">{entry.target}</span>
                        </>
                      )}
                    </div>

                    {/* Log Details Description */}
                    <p className="mt-1 text-xs text-slate-500 line-clamp-1 leading-relaxed">
                      {entry.detail}
                    </p>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

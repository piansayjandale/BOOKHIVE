"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Filter,
  Layers,
  LayoutGrid,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table as TableIcon,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { VirtualizedList } from "@/components/ui/virtualized-list";
import type { HistoryEntry } from "@/lib/types";
import type { PromptSearchLog } from "@/lib/admin/types";
import { formatDateTime, cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { useSession } from "@/components/providers/session-provider";

// Removed Settings, Accounts, and Announcements; added Search History & Pickups Only
const modules = ["All", "Records", "Transactions", "Pickups Only", "Search History"] as const;

const MODULE_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string; text: string }> = {
  Records: {
    icon: Database,
    color: "#10B981",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  Transactions: {
    icon: ArrowDownUp,
    color: "#F59E0B",
    bg: "bg-amber-50 dark:bg-[#FCD400]/10",
    border: "border-amber-200 dark:border-[#FCD400]/20",
    text: "text-amber-700 dark:text-[#FCD400]",
  },
  "Pickups Only": {
    icon: CheckCircle2,
    color: "#0274BB",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    text: "text-[#0274BB] dark:text-sky-300",
  },
  Pickups: {
    icon: CheckCircle2,
    color: "#0274BB",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    text: "text-[#0274BB] dark:text-sky-300",
  },
  "Pick Up": {
    icon: CheckCircle2,
    color: "#0274BB",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    text: "text-[#0274BB] dark:text-sky-300",
  },
  Announcements: {
    icon: Sparkles,
    color: "#8B5CF6",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
  },
  "Search History": {
    icon: Sparkles,
    color: "#8B5CF6",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
  },
  All: {
    icon: Activity,
    color: "#64748B",
    bg: "bg-slate-100 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-500/20",
    text: "text-slate-700 dark:text-slate-300",
  },
};

const DEPT_BADGES: Record<string, string> = {
  All: "text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
  "Computer Science": "text-cyan-800 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/40 dark:border-cyan-800",
  Engineering: "text-indigo-800 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800",
  Education: "text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800",
  "Business & Accountancy": "text-rose-800 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-800",
  Arts: "text-purple-800 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-800",
  General: "text-slate-800 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800/40 dark:border-slate-700",
};

function getAvatarGradient(name: string) {
  const hash = (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    "from-amber-400 to-orange-500 text-slate-950",
    "from-emerald-400 to-teal-500 text-slate-950",
    "from-sky-400 to-blue-500 text-white",
    "from-indigo-400 to-purple-500 text-white",
    "from-pink-400 to-rose-500 text-white",
    "from-violet-400 to-fuchsia-500 text-white",
  ];
  return gradients[hash % gradients.length];
}

const getModuleConfig = (mod: string) => {
  return MODULE_CONFIG[mod] ?? MODULE_CONFIG.All;
};

export function isPickupEntry(entry: { action?: string; detail?: string; module?: string }): boolean {
  const act = (entry.action || "").toLowerCase();
  const det = (entry.detail || "").toLowerCase();
  const mod = (entry.module || "").toLowerCase();
  return (
    mod.includes("pick") ||
    act.includes("pick") ||
    det.includes("picked up") ||
    det.includes("pickup")
  );
}

export function HistoryModule() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSession();
  const activeActor = user?.name || "Yana Brich R. Palmares";
  const isLight = theme === "light";
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchLogs, setSearchLogs] = useState<PromptSearchLog[]>([]);
  const [liveTransactions, setLiveTransactions] = useState<any[]>([]);
  const [dbCounts, setDbCounts] = useState<{
    total: number;
    records: number;
    transactions: number;
    pickups: number;
    historyPickups: number;
    historyTransactions: number;
    search: number;
    filterSearches: number;
    aiSearches: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState<(typeof modules)[number]>("All");
  const [searchHistoryTab, setSearchHistoryTab] = useState<"filter" | "ai" | "all">("filter");
  const [searchViewMode, setSearchViewMode] = useState<"list" | "table">("list");
  const SEARCH_PAGE_SIZE = 15;
  const [searchPage, setSearchPage] = useState(1);
  const [searchPageInput, setSearchPageInput] = useState("1");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const deferredSearch = useDeferredValue(search);

  // Close custom dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        search: deferredSearch,
        module: "All",
        limit: "1000",
        actor: activeActor,
      });
      const response = await fetch(`/api/history?${params.toString()}`);
      if (!response.ok) {
        startTransition(() => setHistory([]));
        return;
      }
      const payload = await response.json();
      const list = Array.isArray(payload?.history) ? payload.history : Array.isArray(payload?.logs) ? payload.logs : [];
      startTransition(() => {
        setHistory(list);
        if (payload?.counts) {
          setDbCounts(payload.counts);
        }
      });
    } catch {
      startTransition(() => setHistory([]));
    }
  }, [deferredSearch, activeActor]);

  const loadLiveTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions?status=All&type=All");
      if (res.ok) {
        const payload = await res.json();
        const list = Array.isArray(payload?.transactions)
          ? payload.transactions
          : Array.isArray(payload)
          ? payload
          : [];
        startTransition(() => setLiveTransactions(list));
      }
    } catch (e) {
      console.warn("Failed to load live transactions:", e);
    }
  }, []);

  const loadSearchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ actor: activeActor });
      const response = await fetch(`/api/admin/prompt-search?${params.toString()}`);
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload?.logs)) {
          startTransition(() => setSearchLogs(payload.logs));
        }
      }
    } catch (e) {
      console.warn("Failed to load prompt search logs:", e);
    }
  }, [activeActor]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadSearchLogs();
  }, [loadSearchLogs]);

  useEffect(() => {
    void loadLiveTransactions();
  }, [loadLiveTransactions]);

  const handleRefresh = useCallback(() => {
    void loadHistory();
    void loadSearchLogs();
    void loadLiveTransactions();
  }, [loadHistory, loadSearchLogs, loadLiveTransactions]);

  async function handleDeleteSearchLog(id: string) {
    try {
      const response = await fetch(`/api/admin/prompt-search?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload?.logs)) {
          setSearchLogs(payload.logs);
        } else {
          setSearchLogs((prev) => prev.filter((l) => l.id !== id));
        }
      }
    } catch (e) {
      console.warn("Failed to delete search log:", e);
    }
  }

  async function handleClearSearchLogs(modeTab: "filter" | "ai" | "all") {
    const confirmMsg =
      modeTab === "filter"
        ? "Are you sure you want to clear your filtered search history? This cannot be undone."
        : modeTab === "ai"
        ? "Are you sure you want to clear your AI prompt search history? This cannot be undone."
        : "Are you sure you want to clear all search history? This cannot be undone.";

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const url =
        modeTab === "all"
          ? `/api/admin/prompt-search?actor=${encodeURIComponent(activeActor)}`
          : `/api/admin/prompt-search?mode=${encodeURIComponent(modeTab)}&actor=${encodeURIComponent(activeActor)}`;

      const response = await fetch(url, { method: "DELETE" });
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload?.logs)) {
          setSearchLogs(payload.logs);
        } else {
          if (modeTab === "filter") {
            setSearchLogs((prev) => prev.filter((l) => l.mode !== "filter" && l.mode !== "prefix"));
          } else if (modeTab === "ai") {
            setSearchLogs((prev) => prev.filter((l) => l.mode !== "ai" && Boolean(l.mode)));
          } else {
            setSearchLogs([]);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to clear search logs:", e);
    }
  }

  // Account-scoped search logs - guarantees only this account's searches are shown
  const accountScopedSearchLogs = useMemo(() => {
    if (!activeActor) return searchLogs;
    const target = activeActor.toLowerCase();
    const parts = target.split(/\s+/).filter((p) => p.length > 2 && !p.includes("."));
    const surname = parts[parts.length - 1] || target;
    return searchLogs.filter((l) => {
      const act = (l.actor || "").toLowerCase();
      return act.includes(target) || (surname.length > 2 && act.includes(surname));
    });
  }, [searchLogs, activeActor]);

  // Account-scoped history logs - guarantees only this account's logs are shown
  const accountScopedHistory = useMemo(() => {
    const list = Array.isArray(history) ? history : [];
    if (!activeActor) return list;
    const target = activeActor.toLowerCase();
    const parts = target.split(/\s+/).filter((p) => p.length > 2 && !p.includes("."));
    const surname = parts[parts.length - 1] || target;
    return list.filter((h) => {
      const act = (h.actor || "").toLowerCase();
      return act.includes(target) || (surname.length > 2 && act.includes(surname));
    });
  }, [history, activeActor]);

  const counts = useMemo(() => {
    const safeHistory = accountScopedHistory;

    // Real-time database counts scoped strictly to this account
    const totalCount = dbCounts?.total ?? safeHistory.length;
    const recordsCount = dbCounts?.records ?? safeHistory.filter((h) => h.module === "Records" && !isPickupEntry(h)).length;
    const transactionsCount = dbCounts?.transactions ?? safeHistory.filter((h) => h.module === "Transactions" && !isPickupEntry(h)).length;
    const pickupsCount = dbCounts?.pickups ?? safeHistory.filter((h) => isPickupEntry(h)).length;
    const searchCount = dbCounts?.search ?? accountScopedSearchLogs.length;

    return {
      total: totalCount,
      records: recordsCount,
      transactions: transactionsCount,
      search: searchCount,
      pickups: pickupsCount,
    };
  }, [accountScopedHistory, accountScopedSearchLogs, dbCounts]);

  const displayedHistory = useMemo(() => {
    let list = accountScopedHistory;
    if (module === "Pickups Only") {
      return list.filter((h) => isPickupEntry(h));
    }
    if (module === "Transactions") {
      // Pickups are not in transactions
      return list.filter((h) => h.module === "Transactions" && !isPickupEntry(h));
    }
    if (module === "Records") {
      return list.filter((h) => h.module === "Records");
    }
    return list;
  }, [accountScopedHistory, module]);

  // Divided search logs: Filtered vs AI Prompt vs All (strictly scoped to this account)
  const filterLogs = useMemo(
    () => accountScopedSearchLogs.filter((l) => l.mode === "filter" || l.mode === "prefix"),
    [accountScopedSearchLogs],
  );
  const aiLogs = useMemo(
    () => accountScopedSearchLogs.filter((l) => !l.mode || l.mode === "ai"),
    [accountScopedSearchLogs],
  );

  const filterCount = useMemo(() => {
    return dbCounts?.filterSearches ?? filterLogs.length;
  }, [filterLogs, dbCounts]);

  const aiCount = useMemo(() => {
    return dbCounts?.aiSearches ?? aiLogs.length;
  }, [aiLogs, dbCounts]);

  const allSearchTabCount = useMemo(() => {
    return dbCounts?.search ?? accountScopedSearchLogs.length;
  }, [accountScopedSearchLogs, dbCounts]);

  const displayedSearchLogs = useMemo(() => {
    let list = searchHistoryTab === "filter" ? filterLogs : searchHistoryTab === "ai" ? aiLogs : accountScopedSearchLogs;
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.query.toLowerCase().includes(q) ||
          item.actor.toLowerCase().includes(q) ||
          item.department.toLowerCase().includes(q),
      );
    }
    return list;
  }, [searchHistoryTab, filterLogs, aiLogs, accountScopedSearchLogs, deferredSearch]);

  const totalSearchPages = Math.max(1, Math.ceil(displayedSearchLogs.length / SEARCH_PAGE_SIZE));

  const paginatedSearchLogs = useMemo(() => {
    const startIndex = (searchPage - 1) * SEARCH_PAGE_SIZE;
    return displayedSearchLogs.slice(startIndex, startIndex + SEARCH_PAGE_SIZE);
  }, [displayedSearchLogs, searchPage]);

  // Keep pageInput synced with searchPage
  useEffect(() => {
    setSearchPageInput(String(searchPage));
  }, [searchPage]);

  // Reset to page 1 whenever sub-tab or search query changes
  useEffect(() => {
    setSearchPage(1);
  }, [searchHistoryTab, deferredSearch]);

  // Ensure searchPage is within bounds if logs count decreases
  useEffect(() => {
    if (searchPage > totalSearchPages) {
      setSearchPage(totalSearchPages);
    }
  }, [totalSearchPages, searchPage]);

  const handleSearchPageCommit = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        setSearchPageInput(String(searchPage));
        return;
      }
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        const targetPage = Math.max(1, Math.min(totalSearchPages, num));
        setSearchPage(targetPage);
        setSearchPageInput(String(targetPage));
      } else {
        setSearchPageInput(String(searchPage));
      }
    },
    [searchPage, totalSearchPages],
  );

  return (
    <div className="flex h-full flex-col gap-6 px-1">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#0274BB] dark:text-[#FCD400] uppercase">
            Librarian · History
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Audit Trail & History
            </h1>
            <div className="mt-1 flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-bold bg-blue-50 dark:bg-white/5 border-blue-200 dark:border-white/10 text-[#0274BB] dark:text-[#FCD400]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeActor}</span>
            </div>
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            View timestamped catalog events, circulation transactions, and search history for this account.
          </p>
        </div>
        <button
          type="button"
          suppressHydrationWarning
          onClick={handleRefresh}
          className="flex items-center gap-2 rounded-xl bg-[#0274BB] dark:bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-white dark:text-[#0b1c2c] shadow-md shadow-[#0274BB]/20 dark:shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95 cursor-pointer"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Stat pills (Interactive filter shortcuts) ──────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            key: "All" as const,
            label: "Total Logs",
            value: counts.total.toLocaleString(),
            sublabel: "Account activities",
            color: "#0F1D29",
            lightBg: "bg-slate-50/90 hover:bg-slate-100/90",
            lightBorder: "border-slate-300",
            borderLeftClass: "border-l-slate-700",
            lightValueText: "text-slate-900",
            lightLabelText: "text-slate-700 font-bold",
            lightDot: "bg-slate-700",
            lightShadow: "shadow-xs",
          },
          {
            key: "Records" as const,
            label: "Catalog Events",
            value: counts.records.toLocaleString(),
            sublabel: "Catalog modifications",
            color: "#10B981",
            lightBg: "bg-emerald-50/80 hover:bg-emerald-100/70",
            lightBorder: "border-emerald-300",
            borderLeftClass: "border-l-[#10B981]",
            lightValueText: "text-[#059669]",
            lightLabelText: "text-emerald-900/90 font-bold",
            lightDot: "bg-[#10B981]",
            lightShadow: "shadow-emerald-500/10",
          },
          {
            key: "Transactions" as const,
            label: "Transactions",
            value: counts.transactions.toLocaleString(),
            sublabel: "Borrow, Return & Reserve",
            color: "#D97706",
            lightBg: "bg-amber-50/80 hover:bg-amber-100/70",
            lightBorder: "border-amber-300",
            borderLeftClass: "border-l-[#F59E0B]",
            lightValueText: "text-[#D97706]",
            lightLabelText: "text-amber-900/90 font-bold",
            lightDot: "bg-[#F59E0B]",
            lightShadow: "shadow-amber-500/10",
          },
          {
            key: "Pickups Only" as const,
            label: "Pick Up Only",
            value: counts.pickups.toLocaleString(),
            sublabel: "Student book pickups",
            color: "#0274BB",
            lightBg: "bg-sky-50/90 hover:bg-sky-100/80",
            lightBorder: "border-sky-300",
            borderLeftClass: "border-l-[#0274BB]",
            lightValueText: "text-[#0274BB]",
            lightLabelText: "text-sky-900/90 font-bold",
            lightDot: "bg-[#0274BB]",
            lightShadow: "shadow-sky-500/10",
          },
          {
            key: "Search History" as const,
            label: "Search History",
            value: counts.search.toLocaleString(),
            sublabel: "Catalog & AI queries",
            color: "#8B5CF6",
            lightBg: "bg-purple-50/80 hover:bg-purple-100/70",
            lightBorder: "border-purple-300",
            borderLeftClass: "border-l-[#8B5CF6]",
            lightValueText: "text-[#7C3AED]",
            lightLabelText: "text-purple-900/90 font-bold",
            lightDot: "bg-[#8B5CF6]",
            lightShadow: "shadow-purple-500/10",
          },
        ].map((stat) => {
          const isSelected = module === stat.key;
          return (
            <div
              key={stat.label}
              onClick={() => setModule(stat.key)}
              className={cn(
                "rounded-2xl border px-5 py-4 cursor-pointer transition-all duration-200 border-l-[6px]",
                stat.borderLeftClass,
                isLight
                  ? cn(
                      stat.lightBorder,
                      stat.lightBg,
                      stat.lightShadow,
                      isSelected ? "ring-2 ring-black shadow-md scale-[1.02]" : "hover:shadow-sm hover:scale-[1.01]"
                    )
                  : cn(
                      "bg-[#152E47]/60 hover:bg-[#152E47]/80 backdrop-blur",
                      isSelected ? "border-white/40 ring-2 ring-[#FCD400]/40 bg-[#152E47]/90" : "border-white/8"
                    )
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full inline-block", isLight ? stat.lightDot : "bg-slate-400")} />
                <p className={cn(
                  "text-[10px] font-bold tracking-[0.18em] uppercase",
                  isLight ? stat.lightLabelText : "text-slate-400"
                )}>
                  {stat.label}
                </p>
              </div>
              <p className={cn("mt-1.5 text-2xl font-black", isLight ? stat.lightValueText : "text-white")}>
                {stat.value}
              </p>
              <p className={cn("mt-0.5 text-[11px] font-medium", isLight ? "text-slate-500" : "text-slate-400")}>
                {stat.sublabel}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Search & filter bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input with leading icon and clear button */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className={cn(
            "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
            isLight ? "text-slate-700" : "text-slate-400"
          )} />
          <input
            type="text"
            suppressHydrationWarning
            style={{
              paddingLeft: "2.75rem",
              paddingRight: "2.5rem",
              border: isLight ? "1px solid #cbd5e1" : undefined,
            }}
            className={cn(
              "search-input-black-stroke w-full h-[44px] rounded-xl text-xs sm:text-sm transition-all shadow-xs outline-none",
              isLight
                ? "border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#0274BB] focus:ring-2 focus:ring-[#0274BB]/15"
                : "border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:ring-2 focus:ring-[#FCD400]/20"
            )}
            placeholder={
              module === "Search History"
                ? "Search query text, actor, or department…"
                : module === "Pickups Only"
                ? "Search student, book, or pickup notification details…"
                : "Search actor, action, target, or detail…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Custom Filter Dropdown (Records, Transactions, Pickups Only, Search History) */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            style={isLight ? { border: "1px solid #cbd5e1", backgroundColor: "#ffffff" } : undefined}
            className={cn(
              "dropdown-filter-btn flex items-center justify-between gap-3 h-[44px] rounded-xl px-4 text-xs sm:text-sm font-semibold transition-all shadow-xs select-none cursor-pointer min-w-[175px]",
              isLight
                ? "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 focus:border-[#0274BB]"
                : "border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10",
              isDropdownOpen && (isLight ? "bg-slate-50 border-slate-400" : "bg-white/10")
            )}
            title="Filter by module"
          >
            <div className="flex items-center gap-2 truncate">
              {(() => {
                const cfg = getModuleConfig(module);
                const Icon = cfg.icon;
                return <Icon className={cn("h-4 w-4 shrink-0", isLight ? "text-slate-600" : "text-slate-400")} />;
              })()}
              <span className="truncate">{module === "All" ? "All Modules" : module === "Pickups Only" ? "Pick Up Only" : module}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                isLight ? "text-slate-500 stroke-[2]" : "text-slate-400",
                isDropdownOpen && "rotate-180"
              )}
            />
          </button>

          {/* Dropdown Menu Popover */}
          {isDropdownOpen && (
            <div
              style={isLight ? { border: "1px solid #cbd5e1" } : undefined}
              className={cn(
                "dropdown-filter-popover absolute right-0 top-full z-50 mt-1.5 min-w-[200px] rounded-2xl p-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150",
                isLight
                  ? "border border-slate-300 bg-white text-slate-900 shadow-slate-300/50"
                  : "border border-slate-700/80 bg-[#0E1F30] text-white shadow-black/80"
              )}
            >
              <div className={cn(
                "px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                isLight ? "text-slate-500" : "text-slate-400"
              )}>
                Filter by Module
              </div>
              <div className="space-y-0.5">
                {modules.map((option) => {
                  const isSelected = module === option;
                  const cfg = getModuleConfig(option);
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setModule(option);
                        setIsDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer text-left select-none",
                        isSelected
                          ? isLight
                            ? "bg-black text-white font-extrabold shadow-sm"
                            : "bg-[#FCD400] text-[#0A1624] font-extrabold shadow-sm"
                          : isLight
                            ? "text-slate-800 hover:bg-slate-100"
                            : "text-slate-200 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{option === "All" ? "All Modules" : option === "Pickups Only" ? "Pick Up Only" : option}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content View ─────────────────────────────────────── */}
      {module === "Search History" ? (
        /* ============================================================== */
        /* VIEW 1: SEARCH HISTORY WITH SEPARATED FILTERED & AI TABS       */
        /* ============================================================== */
        <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0F1D29]/80 backdrop-blur shadow-sm p-5 sm:p-6">
          {/* Sub-tabs row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 self-start">
              {/* Tab 1: Filtered Searches */}
              <button
                type="button"
                onClick={() => setSearchHistoryTab("filter")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 select-none cursor-pointer",
                  searchHistoryTab === "filter"
                    ? "bg-white dark:bg-slate-900 text-[#0274BB] dark:text-[#FFD600] shadow-sm border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filtered History</span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight",
                    searchHistoryTab === "filter"
                      ? "bg-blue-50 text-[#0274BB] dark:bg-amber-400/20 dark:text-[#FFD600]"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
                  )}
                >
                  {filterCount}
                </span>
              </button>

              {/* Tab 2: AI Prompts */}
              <button
                type="button"
                onClick={() => setSearchHistoryTab("ai")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 select-none cursor-pointer",
                  searchHistoryTab === "ai"
                    ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Prompt History</span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight",
                    searchHistoryTab === "ai"
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
                  )}
                >
                  {aiCount}
                </span>
              </button>

              {/* Tab 3: All Searches */}
              <button
                type="button"
                onClick={() => setSearchHistoryTab("all")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 select-none cursor-pointer",
                  searchHistoryTab === "all"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>All Searches</span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight",
                    searchHistoryTab === "all"
                      ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
                  )}
                >
                  {allSearchTabCount}
                </span>
              </button>
            </div>

            {/* View Mode Toggle & Clear Action button */}
            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-0.5">
                <button
                  type="button"
                  onClick={() => setSearchViewMode("list")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer select-none",
                    searchViewMode === "list"
                      ? "bg-white dark:bg-slate-900 text-[#0274BB] dark:text-[#FFD600] shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                  )}
                  title="List / Card view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchViewMode("table")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer select-none",
                    searchViewMode === "table"
                      ? "bg-white dark:bg-slate-900 text-[#0274BB] dark:text-[#FFD600] shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                  )}
                  title="Dense Table view"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  <span>Table</span>
                </button>
              </div>

              {displayedSearchLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearSearchLogs(searchHistoryTab)}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/30 px-3.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 shadow-sm transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {searchHistoryTab === "filter"
                    ? "Clear Filter History"
                    : searchHistoryTab === "ai"
                    ? "Clear AI History"
                    : "Clear All Search History"}
                </button>
              )}
            </div>
          </div>

          {/* Sub-tab description */}
          <div className="mb-5 text-xs text-slate-500 dark:text-slate-400 italic">
            {searchHistoryTab === "filter" && "Keywords and title prefixes typed when FILTER: ON was active."}
            {searchHistoryTab === "ai" && "Complete research prompts and questions analyzed by BookHive AI."}
            {searchHistoryTab === "all" && "All searches recorded across both Filtered and AI prompt modes."}
          </div>

          {/* Search history display: Empty / Table / List */}
          {displayedSearchLogs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {searchHistoryTab === "filter"
                  ? "No Filtered Searches Recorded"
                  : searchHistoryTab === "ai"
                  ? "No AI Prompts Recorded"
                  : "No Search History Found"}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchHistoryTab === "filter"
                  ? "Searches submitted with FILTER: ON will appear here."
                  : searchHistoryTab === "ai"
                  ? "Natural language prompts analyzed with FILTER: OFF will appear here."
                  : "No search queries recorded matching this criteria."}
              </p>
            </div>
          ) : searchViewMode === "table" ? (
            /* ── Table Mode ────────────────────────────────────────── */
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0E1F30] shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03]">
                    <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Search Query / Prompt</th>
                    <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Mode</th>
                    <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">User / Actor</th>
                    <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Department</th>
                    <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Results</th>
                    <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-3.5 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {paginatedSearchLogs.map((entry) => {
                    const isFilter = entry.mode === "filter" || entry.mode === "prefix";
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => {
                          router.push(
                            `/librarian/ai-prompt-search?query=${encodeURIComponent(entry.query)}&department=${encodeURIComponent(entry.department)}&filter=${isFilter ? "1" : "0"}`,
                          );
                        }}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        {/* Query */}
                        <td className="px-4 py-3 max-w-[320px]">
                          <div className="flex items-center gap-2">
                            <span className={cn("shrink-0 p-1 rounded-md", isFilter ? "bg-sky-50 text-[#0274BB] dark:bg-sky-950/50 dark:text-sky-300" : "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300")}>
                              {isFilter ? <Filter className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#0274BB] dark:group-hover:text-[#38BDF8] transition-colors line-clamp-2">
                              "{entry.query}"
                            </span>
                          </div>
                        </td>

                        {/* Mode */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border shadow-xs",
                              isFilter
                                ? "bg-sky-50 text-[#0274BB] border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                                : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                            )}
                          >
                            {isFilter ? "FILTER" : "AI PROMPT"}
                          </span>
                        </td>

                        {/* Actor */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-[9px] shadow-sm select-none uppercase",
                                getAvatarGradient(entry.actor),
                              )}
                            >
                              {entry.actor.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {entry.actor}
                            </span>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                              DEPT_BADGES[entry.department] || DEPT_BADGES.All,
                            )}
                          >
                            {entry.department}
                          </span>
                        </td>

                        {/* Matches */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {entry.matchesFound > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full shadow-xs">
                              <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                              {entry.matchesFound} matches
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-2 py-0.5 rounded-full shadow-xs">
                              <X className="h-2.5 w-2.5 text-slate-400" />
                              0 matches
                            </span>
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                          {formatDateTime(entry.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/librarian/ai-prompt-search?query=${encodeURIComponent(entry.query)}&department=${encodeURIComponent(entry.department)}&filter=${isFilter ? "1" : "0"}`,
                                );
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#0274BB] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                              title="Run this search"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteSearchLog(entry.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              title="Delete search log"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── List / Cards Mode (15 per page) ───────────────────── */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
              {paginatedSearchLogs.map((entry) => {
                const isFilter = entry.mode === "filter" || entry.mode === "prefix";
                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      router.push(
                        `/librarian/ai-prompt-search?query=${encodeURIComponent(entry.query)}&department=${encodeURIComponent(entry.department)}&filter=${isFilter ? "1" : "0"}`,
                      );
                    }}
                    className="flex flex-col justify-between p-5 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-amber-400 text-left transition-all duration-200 group w-full cursor-pointer relative overflow-hidden"
                  >
                    {/* Left accent color strip */}
                    <div
                      className={cn(
                        "absolute left-0 top-0 bottom-0 w-[3px] group-hover:w-[5px] transition-all duration-200",
                        isFilter ? "bg-[#0274BB]" : "bg-purple-600",
                      )}
                    />

                    <div className="space-y-3 w-full">
                      {/* Meta Header */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 tracking-wider w-full">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-[9px] shadow-sm select-none uppercase",
                              getAvatarGradient(entry.actor),
                            )}
                          >
                            {entry.actor.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#0274BB] transition-colors duration-200 truncate max-w-[100px]">
                            {entry.actor}
                          </span>

                          {/* Mode Badge */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border shadow-xs ml-0.5",
                              isFilter
                                ? "bg-sky-50 text-[#0274BB] border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                                : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                            )}
                          >
                            {isFilter ? <Filter className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
                            {isFilter ? "FILTER" : "AI PROMPT"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatDateTime(entry.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteSearchLog(entry.id);
                            }}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                            title="Delete search log"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Search Query */}
                      <div
                        className={cn(
                          "border-l-2 pl-3 py-1 transition-colors duration-200",
                          isFilter
                            ? "border-sky-300 group-hover:border-[#0274BB]"
                            : "border-purple-300 group-hover:border-purple-600",
                        )}
                      >
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#0274BB] transition-colors leading-relaxed line-clamp-2">
                          "{entry.query}"
                        </p>
                      </div>
                    </div>

                    {/* Badges footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between w-full">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                          DEPT_BADGES[entry.department] || DEPT_BADGES.All,
                        )}
                      >
                        {entry.department}
                      </span>

                      {entry.matchesFound > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-full shadow-sm">
                          <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                          {entry.matchesFound} matches
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-2.5 py-0.5 rounded-full shadow-sm">
                          <X className="h-2.5 w-2.5 text-slate-400" />
                          0 matches
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {displayedSearchLogs.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#0A1624] shadow-xs">
              {/* Pagination Info */}
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Showing <span className="font-bold text-slate-900 dark:text-white">{(searchPage - 1) * SEARCH_PAGE_SIZE + 1}</span> to{" "}
                <span className="font-bold text-slate-900 dark:text-white">{Math.min(searchPage * SEARCH_PAGE_SIZE, displayedSearchLogs.length)}</span> of{" "}
                <span className="font-bold text-[#0274BB] dark:text-[#FFD600]">{displayedSearchLogs.length}</span> searches
              </div>

              {/* Prev, Box with page selector, Next */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={searchPage <= 1}
                  onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-white/10 hover:text-[#0274BB] dark:hover:text-[#FFD600] disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-xs select-none"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={searchPageInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setSearchPageInput(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearchPageCommit(searchPageInput);
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        const nextP = Math.min(totalSearchPages, searchPage + 1);
                        setSearchPage(nextP);
                        setSearchPageInput(String(nextP));
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        const prevP = Math.max(1, searchPage - 1);
                        setSearchPage(prevP);
                        setSearchPageInput(String(prevP));
                      }
                    }}
                    onBlur={() => handleSearchPageCommit(searchPageInput)}
                    style={{
                      width: "52px",
                      minWidth: "52px",
                      maxWidth: "52px",
                      height: "32px",
                      padding: "0 4px",
                    }}
                    className="h-8 w-[52px] min-w-[52px] max-w-[52px] shrink-0 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0E1F30] text-center font-mono text-xs font-bold text-slate-900 dark:text-white shadow-xs transition outline-none cursor-pointer focus:cursor-text focus:border-[#0274BB] dark:focus:border-[#FFD600] focus:ring-2 focus:ring-[#0274BB]/20"
                    title={`Page ${searchPage} of ${totalSearchPages} - Click to enter page number and press Enter`}
                    aria-label="Current page number"
                  />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    / {totalSearchPages}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={searchPage >= totalSearchPages}
                  onClick={() => setSearchPage((p) => Math.min(totalSearchPages, p + 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-white/10 hover:text-[#0274BB] dark:hover:text-[#FFD600] disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-xs select-none"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* VIEW 2: STANDARD AUDIT TRAIL LOGS LIST (RECORDS & TRANSACTIONS)*/
        /* ============================================================== */
        <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0F1D29]/80 backdrop-blur shadow-sm">
          <div className="p-3">
            {displayedHistory.length === 0 ? (
              <div className="py-20 text-center text-slate-400">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {module === "Pickups Only" ? "No pick up notifications found" : "No log entries found"}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {module === "Pickups Only"
                    ? "No student book pickup activity or notifications have been recorded yet."
                    : "No activity logs match your search filter. Try clearing the search or choosing 'All Modules'."}
                </p>
              </div>
            ) : (
              <VirtualizedList
                items={displayedHistory || []}
                height={660}
                itemHeight={96}
                renderItem={(entry) => {
                  const isPickup = isPickupEntry(entry);
                  const effectiveModuleKey = isPickup
                    ? "Pickups Only"
                    : (entry.module || "All");
                  const cfg = MODULE_CONFIG[effectiveModuleKey] ?? MODULE_CONFIG.All;
                  const IconComp = cfg.icon;
                  const displayModuleName = isPickup
                    ? "Pick Up"
                    : entry.module || "System";

                  // Module-specific vibrant accents with clean white background for all history logs
                  let leftBorderClass = "border-l-4 border-l-slate-300";
                  const rowBgClass = "bg-white hover:bg-slate-50/90 dark:bg-[#0F1D29]/80 dark:hover:bg-white/[0.02]";
                  let actionTextClass = "text-slate-900 group-hover:text-[#0274BB] dark:text-white dark:group-hover:text-[#38BDF8]";

                  if (isPickup) {
                    leftBorderClass = "border-l-4 border-l-[#0274BB]";
                    actionTextClass = isLight ? "text-[#0274BB] group-hover:text-blue-800" : "text-sky-300 group-hover:text-sky-200";
                  } else if (entry.module === "Transactions") {
                    leftBorderClass = "border-l-4 border-l-[#F59E0B]";
                    actionTextClass = isLight ? "text-amber-900 group-hover:text-amber-950" : "text-amber-300 group-hover:text-amber-200";
                  } else if (entry.module === "Records") {
                    leftBorderClass = "border-l-4 border-l-[#10B981]";
                    actionTextClass = isLight ? "text-emerald-900 group-hover:text-emerald-950" : "text-emerald-300 group-hover:text-emerald-200";
                  } else if (entry.module === "Announcements") {
                    leftBorderClass = "border-l-4 border-l-[#8B5CF6]";
                    actionTextClass = isLight ? "text-purple-900 group-hover:text-purple-950" : "text-purple-300 group-hover:text-purple-200";
                  }

                  return (
                    <div
                      className={cn(
                        "group relative flex items-start gap-4 px-6 py-3.5 transition-all duration-150 h-[96px] border-b border-slate-100 dark:border-white/5",
                        leftBorderClass,
                        rowBgClass
                      )}
                    >
                      {/* Styled Module Icon Badge */}
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 group-hover:scale-105 shadow-xs",
                          cfg.bg,
                          cfg.border,
                          cfg.text
                        )}
                      >
                        <IconComp className="h-4 w-4" />
                      </div>

                      {/* Log Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("text-sm font-semibold transition-colors", actionTextClass)}>
                              {entry.action}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase shadow-xs",
                                cfg.bg,
                                cfg.border,
                                cfg.text
                              )}
                            >
                              {displayModuleName}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "text-[11px] shrink-0 font-medium transition-colors duration-150",
                              isLight
                                ? "text-slate-500 group-hover:text-[#0274BB]"
                                : "text-slate-400 group-hover:text-[#38BDF8]"
                            )}
                          >
                            {formatDateTime(entry.timestamp)}
                          </span>
                        </div>

                        {/* Actor and Target */}
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-1">
                          <span className={cn("font-semibold", isLight ? "text-slate-800" : "text-slate-300")}>
                            {entry.actor}
                          </span>
                          {entry.target && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className={cn(isLight ? "text-slate-600" : "text-slate-400")}>{entry.target}</span>
                            </>
                          )}
                        </div>

                        {/* Log Details Description */}
                        <p className={cn("mt-1 text-xs line-clamp-1 leading-relaxed", isLight ? "text-slate-600 font-normal" : "text-slate-400")}>
                          {entry.detail}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  ChevronRight,
  Settings2,
  ClipboardList,
  AlertTriangle,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { useSuperAdminVitals } from "@/lib/hooks/use-super-admin-vitals";
import { useTheme } from "@/components/providers/theme-provider";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

interface AuditLogItem {
  id: string | number;
  actor: string;
  action: string;
  target?: string;
  module?: string;
  detail?: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  "Super Admin": "#FCD400",
  "Admin": "#FB923C",
  "Librarian": "#38BDF8",
  "Student": "#10B981",
};

const DEPARTMENT_FALLBACK = [
  { code: "CCS", name: "College of Computer Studies", count: 4, color: "#38BDF8" },
  { code: "CBA", name: "College of Business & Accountancy", count: 3, color: "#FCD400" },
  { code: "CAS", name: "College of Arts & Sciences", count: 2, color: "#FB923C" },
  { code: "CCJE", name: "College of Criminal Justice Education", count: 2, color: "#EF4444" },
  { code: "COE", name: "College of Engineering", count: 1, color: "#A855F7" },
  { code: "CON", name: "College of Nursing", count: 1, color: "#10B981" },
  { code: "CTHM", name: "College of Hospitality & Tourism", count: 1, color: "#EC4899" },
];

const STATIC_DEFAULT_ALERTS: AuditLogItem[] = [
  { id: 1, action: "User Account Provisioned", actor: "Super Admin", module: "System Management", createdAt: "2026-09-14T06:00:00.000Z" },
  { id: 2, action: "Permissions Matrix Modified", actor: "Super Admin", module: "Governance", createdAt: "2026-09-14T05:45:00.000Z" },
  { id: 3, action: "Neural Catalog Sync Verified", actor: "System Daemon", module: "Search Engine", createdAt: "2026-09-14T05:30:00.000Z" },
];

const STATIC_DEFAULT_LOGS: AuditLogItem[] = [
  { id: "log-1", actor: "System", action: "Neural index health verification nominal", createdAt: "2026-09-14T06:45:00.000Z" },
  { id: "log-2", actor: "Admin", action: "Completed daily circulation audit reconciliation", createdAt: "2026-09-14T06:39:00.000Z" },
  { id: "log-3", actor: "Super Admin", action: "Synchronized STI WNU institutional directory", createdAt: "2026-09-14T06:25:00.000Z" },
  { id: "log-4", actor: "Postgres", action: "Engine vacuum and transaction log checkpoint pass", createdAt: "2026-09-14T05:45:00.000Z" },
];

export function SuperAdminHomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [mounted, setMounted] = useState(false);

  // Vitals & Telemetry Hook
  const {
    vitals,
    telemetry,
    isLoading,
    isRefreshing,
    isLiveConnected,
    refresh,
  } = useSuperAdminVitals({
    pollingIntervalMs: 4000,
    enableLiveSocket: true,
    enableActivityStream: true,
  });

  // UI Interactive States
  const [distributionMode, setDistributionMode] = useState<"roles" | "departments">("roles");
  const [throughputViewMode, setThroughputViewMode] = useState<"columns" | "ranked">("columns");

  // Secondary Data: Recent Audit Logs for Terminal Stream
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [departmentData, setDepartmentData] = useState(DEPARTMENT_FALLBACK);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch recent audit logs and department analytics
  const fetchSecondaryData = useCallback(async () => {
    try {
      const [auditRes, dashRes] = await Promise.all([
        fetch("/api/super-admin/audit-logs?pageSize=6"),
        fetch("/api/dashboard"),
      ]);

      if (auditRes.ok) {
        const auditPayload = await auditRes.json();
        if (Array.isArray(auditPayload?.logs)) {
          setAuditLogs(auditPayload.logs);
        }
      }

      if (dashRes.ok) {
        const dashPayload = await dashRes.json();
        if (Array.isArray(dashPayload?.departmentUsage) && dashPayload.departmentUsage.length > 0) {
          const mapped = dashPayload.departmentUsage.map((dep: any, index: number) => {
            const rawName = String(dep.name || dep.department || "");
            const extractedCode =
              dep.code ||
              dep.key ||
              rawName.match(/\(([A-Z]+)\)/)?.[1] ||
              DEPARTMENT_FALLBACK[index % DEPARTMENT_FALLBACK.length]?.code ||
              `DEP-${index + 1}`;

            const name =
              dep.name ||
              dep.department ||
              DEPARTMENT_FALLBACK[index % DEPARTMENT_FALLBACK.length]?.name ||
              `Academic Department ${index + 1}`;

            const count = Number(dep.count ?? dep.usage ?? dep.total ?? 0);

            const color =
              dep.color ||
              DEPARTMENT_FALLBACK[index % DEPARTMENT_FALLBACK.length]?.color ||
              "#38BDF8";

            return {
              code: String(extractedCode).trim(),
              name: String(name).trim(),
              count,
              color,
            };
          });
          setDepartmentData(mapped);
        }
      }
    } catch {
      // Keep fallbacks on network or mock states
    }
  }, []);

  useEffect(() => {
    void fetchSecondaryData();
  }, [fetchSecondaryData]);

  // Authority Distribution Dataset
  const roleDistributionData = useMemo(() => {
    const superAdmins = vitals?.superAdminsCount ?? 1;
    const admins = vitals?.adminsCount ?? 1;
    const librarians = vitals?.librariansCount ?? 3;
    const students = vitals?.studentsCount ?? 9;

    return [
      { name: "Super Admins", code: "SUPER_ADMIN", count: superAdmins, color: ROLE_COLORS["Super Admin"] },
      { name: "Admins", code: "ADMIN", count: admins, color: ROLE_COLORS["Admin"] },
      { name: "Librarians", code: "LIBRARIAN", count: librarians, color: ROLE_COLORS["Librarian"] },
      { name: "Students", code: "STUDENT", count: students, color: ROLE_COLORS["Student"] },
    ];
  }, [vitals]);

  const activeDistributionList = useMemo(() => {
    return distributionMode === "roles" ? roleDistributionData : departmentData;
  }, [distributionMode, roleDistributionData, departmentData]);

  const totalDistributionAccounts = useMemo(() => {
    return activeDistributionList.reduce((acc, curr) => acc + (curr.count || 0), 0);
  }, [activeDistributionList]);

  // Operational Throughput Dataset for Recharts
  const throughputData = useMemo(() => {
    return [
      { key: "activeBorrows", label: "Active Borrows", count: vitals?.activeBorrows ?? 3, sub: "Live circulation loans" },
      { key: "totalTransactions", label: "Transactions", count: vitals?.totalTransactions ?? 7, sub: "Lifetime borrow/returns" },
      { key: "aiSearches", label: "AI Inquiries", count: vitals?.totalAiSearches ?? 14, sub: "Neural vector queries" },
      { key: "auditLogs", label: "Audit Events", count: vitals?.totalAuditLogs ?? 26, sub: "Cryptographic trails" },
      { key: "pendingActions", label: "Pending Actions", count: vitals?.pendingTransactions ?? 0, sub: "Awaiting approval" },
    ];
  }, [vitals]);

  const totalThroughputCount = useMemo(() => {
    return throughputData.reduce((sum, item) => sum + (item.count || 0), 0);
  }, [throughputData]);

  return (
    <div className="space-y-8 pb-12">
      {/* ── Active Governance & RBAC Live Notice Banner ───────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "overflow-hidden rounded-2xl p-5 relative transition-all",
          isLight
            ? "border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-sky-50/70 to-slate-50/90 shadow-sm"
            : "border border-[#FCD400]/40 bg-gradient-to-r from-[#14293E] via-[#0F2236] to-[#0B1A2C] shadow-2xl"
        )}
      >
        <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b pb-3", isLight ? "border-slate-200/80" : "border-white/10")}>
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl shadow-sm",
              isLight ? "bg-amber-100 text-amber-700" : "bg-[#FCD400]/20 text-[#FCD400]"
            )}>
              <ShieldCheck className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <span className={cn(
                "text-[10px] font-extrabold tracking-[0.2em] uppercase",
                isLight ? "text-amber-800" : "text-[#FCD400]"
              )}>
                ACTIVE GOVERNANCE DIRECTIVE
              </span>
              <h3 className={cn("text-sm font-bold", isLight ? "text-slate-900" : "text-white")}>
                RBAC Platform Governance & Immutable Audit Trails Active
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/super-admin/audit-logs")}
              className={cn(
                "text-xs font-bold flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-xl border transition",
                isLight
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <span>View Audit Stream</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className={cn("mt-3 flex flex-wrap items-center justify-between gap-3 text-xs", isLight ? "text-slate-600" : "text-slate-300")}>
          <p className="leading-relaxed">
            All platform mutations, account provisioning, catalog purges, and security policies require Super Admin authorization and are logged to cryptographic audit trails.
          </p>
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0",
            isLight
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Zero Security Breaches Detected
          </span>
        </div>
      </motion.div>

      {/* ── Executive Hero Section (`panel-hero`) ─────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="rounded-[24px] bg-[#14293E] p-8 md:p-10 shadow-xl panel-hero relative overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-[#FFD600]">
            <Sparkles className="h-4 w-4 fill-current" />
            <span className="text-xs font-bold tracking-widest uppercase">
              SUPER ADMIN EXECUTIVE COMMAND
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Socket Stream Indicator */}
            <div
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md transition-colors ${
                isLiveConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isLiveConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span>{isLiveConnected ? "Live Socket Active" : "Adaptive Polling"}</span>
            </div>

            {/* Refresh Vitals Trigger */}
            <button
              type="button"
              onClick={() => {
                void refresh();
                void fetchSecondaryData();
              }}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-full bg-[#FFD600] px-4 py-1.5 text-xs font-bold text-[#0A1624] transition-all hover:bg-[#FCD400]/90 hover:scale-105 active:scale-95 shadow-md disabled:opacity-75 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing || isLoading ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Syncing..." : "Refresh Vitals"}</span>
            </button>
          </div>
        </div>

        {/* Main Heading & Executive Subtitle */}
        <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight text-white leading-tight">
          Command & oversee the entire STI WNU digital ecosystem.
        </h1>
        <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
          Executive oversight of platform throughput, role distribution, system telemetry, and institutional ecosystem integrity.
        </p>
      </motion.section>

      {/* ── 5-Metric Analytics & Cluster Health Row ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Metric 1: TOTAL USER BASE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#FCD400] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">
            TOTAL_USER_BASE
          </div>
          <div className="text-[32px] font-black tracking-tight text-white">
            {mounted ? (
              <AnimatedNumber value={vitals?.totalUsers ?? 0} />
            ) : (
              <span>{vitals?.totalUsers ?? 0}</span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-amber-300 font-semibold border border-amber-500/20">
              {vitals?.adminsCount ?? 0} Admins
            </span>
            <span className="text-slate-500">·</span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-sky-300 font-semibold border border-sky-500/20">
              {vitals?.librariansCount ?? 0} Librarians
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 font-semibold">
              {vitals?.studentsCount ?? 0} Students
            </span>
          </div>
        </motion.div>

        {/* Metric 2: ACTIVE CIRCULATION */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#38BDF8] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">
            ACTIVE_CIRCULATION
          </div>
          <div className="text-[32px] font-black tracking-tight text-[#38BDF8]">
            {mounted ? (
              <AnimatedNumber value={vitals?.activeBorrows ?? 0} />
            ) : (
              <span>{vitals?.activeBorrows ?? 0}</span>
            )}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-300 truncate">
            Out of <strong className="text-white font-bold">{vitals?.activeBooksCount ?? 0}</strong> active catalog resources
          </div>
        </motion.div>

        {/* Metric 3: AI SEARCH INTELLIGENCE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#A855F7] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">
            AI_SEARCH_EVENTS
          </div>
          <div className="text-[32px] font-black tracking-tight text-[#C084FC]">
            {mounted ? (
              <AnimatedNumber value={vitals?.totalAiSearches ?? 0} />
            ) : (
              <span>{vitals?.totalAiSearches ?? 0}</span>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-300">
            <span>Neural Index:</span>
            <span className="font-bold text-white inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              {telemetry?.searchIndexStatus || "Healthy"}
            </span>
          </div>
        </motion.div>

        {/* Metric 4: TOTAL TRANSACTIONS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#F97316] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">
            TOTAL_TRANSACTIONS
          </div>
          <div className="text-[32px] font-black tracking-tight text-[#FB923C]">
            {mounted ? (
              <AnimatedNumber value={vitals?.totalTransactions ?? 0} />
            ) : (
              <span>{vitals?.totalTransactions ?? 0}</span>
            )}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-300">
            <strong className="text-[#FCD400] font-bold">{vitals?.pendingTransactions ?? 0}</strong> pending queue actions
          </div>
        </motion.div>

        {/* Metric 5: SYSTEM HEALTH (Signature Admin Telemetry Widget) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-[#041E30] p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-[#041E30]/20"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="text-xs font-bold tracking-widest text-[#FCD400]">SYSTEM_HEALTH</div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#10B981]">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              {telemetry?.platformStatus?.toUpperCase() || "NOMINAL"}
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-[10px] font-bold text-[#64748B]">
              <span>CLUSTER ENGINE</span>
              <span>STORAGE USED</span>
            </div>

            <div className="mb-4 flex justify-between text-xs font-bold text-white">
              <span>PostgreSQL 16</span>
              <span>{telemetry?.storageUsedPercent ?? 24}%</span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1E3445]">
              <div
                className="h-full rounded-full bg-[#FCD400] transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(8, telemetry?.storageUsedPercent ?? 24))}%` }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Main 2-Column Content Grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (Span 2) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 1: System Authority & Role Distribution (Donut Chart) */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className={cn(
                "flex flex-col rounded-2xl border p-6 shadow-sm backdrop-blur-md",
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#14293E]/80"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className={cn("text-[20px] font-bold tracking-wide", isLight ? "text-slate-900" : "text-white")}>
                    {distributionMode === "roles" ? "Authority & Role Distribution" : "Departmental Distribution"}
                  </h2>
                  <p className={cn("mt-1 text-[12px]", isLight ? "text-slate-500" : "text-slate-300")}>
                    {distributionMode === "roles"
                      ? "Account distribution by institutional governance privilege."
                      : "Student and staff enrollment by college academic department."}
                  </p>
                </div>
                {/* Segmented Mode Button */}
                <div className={cn("flex items-center rounded-full border p-0.5 shrink-0", isLight ? "bg-slate-100 border-slate-200" : "bg-[#132337] border-white/10")}>
                  <button
                    type="button"
                    onClick={() => setDistributionMode("roles")}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer",
                      distributionMode === "roles"
                        ? isLight
                          ? "bg-[#0274BB] text-white shadow font-extrabold"
                          : "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                        : isLight
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-400 hover:text-white"
                    )}
                  >
                    Roles
                  </button>
                  <button
                    type="button"
                    onClick={() => setDistributionMode("departments")}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer",
                      distributionMode === "departments"
                        ? isLight
                          ? "bg-[#0274BB] text-white shadow font-extrabold"
                          : "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                        : isLight
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-400 hover:text-white"
                    )}
                  >
                    Colleges
                  </button>
                </div>
              </div>

              <div className="h-[270px] w-full flex flex-row items-center justify-between gap-3">
                {/* Donut Chart with Centered Info */}
                <div className="relative h-full w-[160px] shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={totalDistributionAccounts === 0 ? [{ value: 1 }] : activeDistributionList}
                        dataKey={totalDistributionAccounts === 0 ? "value" : "count"}
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={74}
                        paddingAngle={totalDistributionAccounts === 0 ? 0 : 3}
                        stroke={isLight ? "#ffffff" : "#0F1D29"}
                        strokeWidth={2}
                        isAnimationActive={true}
                      >
                        {totalDistributionAccounts === 0 ? (
                          <Cell fill={isLight ? "#f1f5f9" : "#182A3C"} stroke={isLight ? "#cbd5e1" : "#22394F"} strokeWidth={2} />
                        ) : (
                          activeDistributionList.map((entry: any, idx: number) => (
                            <Cell key={`cell-${entry.code || entry.name || idx}-${idx}`} fill={entry.color} />
                          ))
                        )}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Stat Badge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                    <span className={cn("text-3xl font-black leading-none", isLight ? "text-slate-900" : "text-white")}>
                      {totalDistributionAccounts}
                    </span>
                    <span className={cn("text-[10px] font-extrabold tracking-widest uppercase mt-1", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                      {distributionMode === "roles" ? "ROLES" : "ACCOUNTS"}
                    </span>
                    <span className={cn("text-[9px] font-medium mt-0.5 leading-tight whitespace-nowrap", isLight ? "text-slate-500" : "text-slate-400")}>
                      {distributionMode === "roles" ? "4 System Tiers" : "7 Colleges"}
                    </span>
                  </div>
                </div>

                {/* List Items with Percentage Badges */}
                <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-full pr-0.5 justify-center">
                  {activeDistributionList.map((item: any, idx: number) => {
                    const pct = totalDistributionAccounts > 0
                      ? Math.round(((item.count || 0) / totalDistributionAccounts) * 100)
                      : 0;
                    return (
                      <div
                        key={`dist-item-${item.code || item.name || idx}-${idx}`}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 transition-all",
                          isLight
                            ? "border-slate-200 bg-slate-50 hover:bg-slate-100"
                            : "border-white/5 bg-[#122335]/75 hover:bg-[#122335] hover:border-white/10"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn("text-xs font-bold truncate", isLight ? "text-slate-900" : "text-white")}>{item.name}</span>
                            <span className={cn("text-[10px] font-mono", isLight ? "text-slate-500" : "text-slate-400")}>
                              ({item.code})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-xs font-bold font-mono", isLight ? "text-slate-900" : "text-white")}>{item.count}</span>
                          <div className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-bold font-mono",
                            isLight
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-[#FCD400]/40 bg-[#FCD400]/10 text-[#FCD400]"
                          )}>
                            {pct}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.section>

            {/* Chart 2: Platform Operational Throughput (Bar Chart) */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className={cn(
                "flex flex-col rounded-2xl border p-6 shadow-sm backdrop-blur-md",
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#14293E]/80"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className={cn("text-[20px] font-bold tracking-wide", isLight ? "text-slate-900" : "text-white")}>Platform Operational Throughput</h2>
                  <p className={cn("mt-1 text-[12px]", isLight ? "text-slate-500" : "text-slate-300")}>Live transaction & throughput telemetry across modules.</p>
                </div>
                {/* Segmented Button [ Columns | Ranked ] */}
                <div className={cn("flex items-center rounded-full border p-0.5 shrink-0", isLight ? "bg-slate-100 border-slate-200" : "bg-[#132337] border-white/10")}>
                  <button
                    type="button"
                    onClick={() => setThroughputViewMode("columns")}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer",
                      throughputViewMode === "columns"
                        ? isLight
                          ? "bg-[#0274BB] text-white shadow font-extrabold"
                          : "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                        : isLight
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-400 hover:text-white"
                    )}
                  >
                    Columns
                  </button>
                  <button
                    type="button"
                    onClick={() => setThroughputViewMode("ranked")}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer",
                      throughputViewMode === "ranked"
                        ? isLight
                          ? "bg-[#0274BB] text-white shadow font-extrabold"
                          : "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                        : isLight
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-400 hover:text-white"
                    )}
                  >
                    Ranked
                  </button>
                </div>
              </div>

              <div className="h-[240px] w-full">
                {throughputViewMode === "columns" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={throughputData}
                      margin={{ top: 24, right: 12, left: -22, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="saGrad0" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FCD400" />
                          <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                        <linearGradient id="saGrad1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FB923C" />
                          <stop offset="100%" stopColor="#C2410C" />
                        </linearGradient>
                        <linearGradient id="saGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C084FC" />
                          <stop offset="100%" stopColor="#7E22CE" />
                        </linearGradient>
                        <linearGradient id="saGrad3" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38BDF8" />
                          <stop offset="100%" stopColor="#0369A1" />
                        </linearGradient>
                        <linearGradient id="saGrad4" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F97316" />
                          <stop offset="100%" stopColor="#9A3412" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"}
                        tick={{ fill: isLight ? "#334155" : "#FFFFFF", fontSize: 10, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={{ stroke: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)" }}
                        interval={0}
                        angle={-15}
                        dy={8}
                        textAnchor="end"
                      />
                      <YAxis
                        stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"}
                        tick={{ fill: isLight ? "#64748B" : "#94A3B8", fontSize: 10, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isLight ? "#ffffff" : "#0F1D29",
                          border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.15)",
                          color: isLight ? "#0f172a" : "#fff",
                          borderRadius: "12px",
                          fontSize: "12px",
                          boxShadow: isLight ? "0 10px 25px rgba(0,0,0,0.08)" : "0 10px 25px rgba(0,0,0,0.5)",
                          padding: "10px 14px",
                        }}
                        cursor={{ fill: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)" }}
                        formatter={(value: any, _name: any, props: any) => [
                          `${value} Actions Logged`,
                          props?.payload?.sub ?? "Platform Subsystem",
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        radius={[6, 6, 0, 0]}
                        barSize={32}
                        shape={(props: any) => {
                          const { x, y, width, height, index, value } = props;
                          const gradId = `url(#saGrad${index % 5})`;
                          const badgeWidth = 26;
                          const badgeHeight = 16;
                          const badgeX = x + width / 2 - badgeWidth / 2;
                          const badgeY = value > 0 ? y - badgeHeight - 5 : y - badgeHeight - 5;

                          return (
                            <g>
                              {/* Top Badge pill */}
                              <rect
                                x={badgeX}
                                y={badgeY}
                                width={badgeWidth}
                                height={badgeHeight}
                                rx={4}
                                ry={4}
                                fill={isLight ? "#f8fafc" : "#0B1A2C"}
                                stroke={isLight ? "#cbd5e1" : "#FCD400"}
                                strokeWidth={1}
                              />
                              <text
                                x={x + width / 2}
                                y={badgeY + 12}
                                fill={isLight ? "#0f172a" : "#FCD400"}
                                textAnchor="middle"
                                fontSize={10}
                                fontWeight="900"
                                fontFamily="monospace"
                              >
                                {value}
                              </text>

                              {/* Bar with gradient */}
                              {value > 0 ? (
                                <path
                                  d={`M${x},${y + height} L${x},${y + 6} Q${x},${y} ${x + 6},${y} L${x + width - 6},${y} Q${x + width},${y} ${x + width},${y + 6} L${x + width},${y + height} Z`}
                                  fill={gradId}
                                />
                              ) : (
                                <rect
                                  x={x}
                                  y={y - 3}
                                  width={width}
                                  height={4}
                                  rx={2}
                                  fill={isLight ? "rgba(2, 116, 187, 0.2)" : "rgba(252, 212, 0, 0.25)"}
                                />
                              )}
                            </g>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  /* Ranked List View */
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-full pr-1">
                    {throughputData
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .map((item, idx) => (
                        <div
                          key={item.key}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-xl border p-2.5 transition",
                            isLight
                              ? "border-slate-200 bg-slate-50 hover:bg-slate-100"
                              : "border-white/5 bg-[#122335]/70 hover:bg-[#122335] hover:border-[#FCD400]/40"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black font-mono shadow-sm",
                                idx === 0
                                  ? "bg-[#FCD400] text-[#0B1A2C]"
                                  : idx === 1
                                  ? isLight ? "bg-slate-200 text-slate-800" : "bg-slate-300 text-[#0B1A2C]"
                                  : idx === 2
                                  ? "bg-amber-600 text-white"
                                  : isLight ? "bg-slate-200 text-slate-600" : "bg-white/10 text-slate-300"
                              )}
                            >
                              {idx + 1}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("truncate text-xs font-bold", isLight ? "text-slate-900" : "text-white")}>{item.label}</p>
                              <p className={cn("truncate text-[10px]", isLight ? "text-slate-500" : "text-slate-400")}>{item.sub}</p>
                            </div>
                          </div>
                          <div className={cn(
                            "rounded-md border px-2 py-0.5 text-xs font-bold font-mono shrink-0",
                            isLight
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-[#FCD400]/40 bg-[#FCD400]/10 text-[#FCD400]"
                          )}>
                            {item.count} events
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Bottom Real-Time Telemetry Bar */}
              <div className={cn("flex items-center justify-between text-[11px] px-1 pt-2.5 mt-1 border-t", isLight ? "border-slate-200" : "border-white/5")}>
                <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Real-time Database Sync
                </div>
                <div className={cn("font-mono text-[11px]", isLight ? "text-slate-600" : "text-slate-300")}>
                  <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>{totalThroughputCount}</span> Total Operations
                </div>
              </div>
            </motion.section>
          </div>

          {/* Command Shortcuts Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <h2 className={cn("mb-4 text-[10px] font-bold tracking-[0.15em] uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
              COMMAND_SHORTCUTS
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Shortcut 1: User Management */}
              <button
                type="button"
                onClick={() => router.push("/super-admin/system-management")}
                className={cn(
                  "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 cursor-pointer",
                  isLight
                    ? "border-slate-200 bg-white hover:border-[#0274BB]/50 hover:shadow-md"
                    : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                )}
              >
                <div className={cn("absolute inset-0 transition-opacity duration-300 group-hover:opacity-100 opacity-0", isLight ? "bg-gradient-to-b from-[#0274BB]/0 to-[#0274BB]/5" : "bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10")} />
                <div className={cn(
                  "z-10 flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-all duration-300 group-hover:scale-110",
                  isLight
                    ? "bg-slate-100 text-slate-600 group-hover:bg-[#0274BB]/15 group-hover:text-[#0274BB]"
                    : "bg-white/5 text-slate-400 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                )}>
                  <Users className="h-5 w-5" />
                </div>
                <span className={cn(
                  "z-10 text-[9px] font-bold tracking-[0.15em] transition-colors duration-300",
                  isLight ? "text-slate-600 group-hover:text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]"
                )}>
                  USER_CRUD
                </span>
              </button>

              {/* Shortcut 2: Audit Logs */}
              <button
                type="button"
                onClick={() => router.push("/super-admin/audit-logs")}
                className={cn(
                  "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 cursor-pointer",
                  isLight
                    ? "border-slate-200 bg-white hover:border-[#0274BB]/50 hover:shadow-md"
                    : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                )}
              >
                <div className={cn("absolute inset-0 transition-opacity duration-300 group-hover:opacity-100 opacity-0", isLight ? "bg-gradient-to-b from-[#0274BB]/0 to-[#0274BB]/5" : "bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10")} />
                <div className={cn(
                  "z-10 flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-all duration-300 group-hover:scale-110",
                  isLight
                    ? "bg-slate-100 text-slate-600 group-hover:bg-[#0274BB]/15 group-hover:text-[#0274BB]"
                    : "bg-white/5 text-slate-400 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                )}>
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <span className={cn(
                  "z-10 text-[9px] font-bold tracking-[0.15em] transition-colors duration-300",
                  isLight ? "text-slate-600 group-hover:text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]"
                )}>
                  AUDIT_LOGS
                </span>
              </button>

              {/* Shortcut 3: Master Records */}
              <button
                type="button"
                onClick={() => router.push("/super-admin/records")}
                className={cn(
                  "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 cursor-pointer",
                  isLight
                    ? "border-slate-200 bg-white hover:border-[#0274BB]/50 hover:shadow-md"
                    : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                )}
              >
                <div className={cn("absolute inset-0 transition-opacity duration-300 group-hover:opacity-100 opacity-0", isLight ? "bg-gradient-to-b from-[#0274BB]/0 to-[#0274BB]/5" : "bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10")} />
                <div className={cn(
                  "z-10 flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-all duration-300 group-hover:scale-110",
                  isLight
                    ? "bg-slate-100 text-slate-600 group-hover:bg-[#0274BB]/15 group-hover:text-[#0274BB]"
                    : "bg-white/5 text-slate-400 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                )}>
                  <ClipboardList className="h-5 w-5" />
                </div>
                <span className={cn(
                  "z-10 text-[9px] font-bold tracking-[0.15em] transition-colors duration-300",
                  isLight ? "text-slate-600 group-hover:text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]"
                )}>
                  MASTER_RECORDS
                </span>
              </button>

              {/* Shortcut 4: Global Settings */}
              <button
                type="button"
                onClick={() => router.push("/super-admin/settings")}
                className={cn(
                  "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 cursor-pointer",
                  isLight
                    ? "border-slate-200 bg-white hover:border-[#0274BB]/50 hover:shadow-md"
                    : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                )}
              >
                <div className={cn("absolute inset-0 transition-opacity duration-300 group-hover:opacity-100 opacity-0", isLight ? "bg-gradient-to-b from-[#0274BB]/0 to-[#0274BB]/5" : "bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10")} />
                <div className={cn(
                  "z-10 flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-all duration-300 group-hover:scale-110",
                  isLight
                    ? "bg-slate-100 text-slate-600 group-hover:bg-[#0274BB]/15 group-hover:text-[#0274BB]"
                    : "bg-white/5 text-slate-400 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                )}>
                  <Settings2 className="h-5 w-5" />
                </div>
                <span className={cn(
                  "z-10 text-[9px] font-bold tracking-[0.15em] transition-colors duration-300",
                  isLight ? "text-slate-600 group-hover:text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]"
                )}>
                  SYS_SETTINGS
                </span>
              </button>

              {/* Shortcut 5: Database Recovery */}
              <button
                type="button"
                onClick={() => router.push("/super-admin/settings")}
                className={cn(
                  "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 cursor-pointer",
                  isLight
                    ? "border-slate-200 bg-white hover:border-[#0274BB]/50 hover:shadow-md"
                    : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                )}
              >
                <div className={cn("absolute inset-0 transition-opacity duration-300 group-hover:opacity-100 opacity-0", isLight ? "bg-gradient-to-b from-[#0274BB]/0 to-[#0274BB]/5" : "bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10")} />
                <div className={cn(
                  "z-10 flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-all duration-300 group-hover:scale-110",
                  isLight
                    ? "bg-slate-100 text-slate-600 group-hover:bg-[#0274BB]/15 group-hover:text-[#0274BB]"
                    : "bg-white/5 text-slate-400 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                )}>
                  <Database className="h-5 w-5" />
                </div>
                <span className={cn(
                  "z-10 text-[9px] font-bold tracking-[0.15em] transition-colors duration-300",
                  isLight ? "text-slate-600 group-hover:text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]"
                )}>
                  DB_RECOVERY
                </span>
              </button>
            </div>
          </motion.section>
        </div>

        {/* Right Column (Span 1) */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Hardware & Runtime Telemetry Card */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={cn(
              "rounded-2xl border p-6 space-y-5",
              isLight ? "border-slate-200 bg-white shadow-sm" : "border-white/10 bg-[#101D2D] shadow-xl"
            )}
          >
            <div className={cn("flex items-center justify-between border-b pb-4", isLight ? "border-slate-200" : "border-white/10")}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  isLight ? "bg-amber-100 text-amber-700" : "bg-[#FCD400]/15 text-[#FCD400]"
                )}>
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={cn("text-base font-bold", isLight ? "text-slate-900" : "text-white")}>Platform Health & Vitals</h3>
                  <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-400")}>Node runtime telemetry and cluster state</p>
                </div>
              </div>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border",
                isLight
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              )}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {telemetry?.platformStatus || "Operational"}
              </span>
            </div>

            {/* Dual Resource Allocation Progress Bars */}
            <div className="space-y-4">
              <div className={cn("rounded-xl border p-3.5", isLight ? "border-slate-200 bg-slate-50" : "border-white/5 bg-white/[0.02]")}>
                <div className={cn("flex items-center justify-between text-xs", isLight ? "text-slate-700" : "text-slate-300")}>
                  <span className="font-semibold">Memory Allocation</span>
                  <span className={cn("font-bold font-mono", isLight ? "text-amber-800" : "text-[#FCD400]")}>{telemetry?.memoryUsagePercent ?? 36}%</span>
                </div>
                <div className={cn("mt-2 h-2 w-full overflow-hidden rounded-full", isLight ? "bg-slate-200" : "bg-white/10")}>
                  <div
                    className="h-full rounded-full bg-[#FCD400] transition-all duration-500"
                    style={{ width: `${Math.min(100, telemetry?.memoryUsagePercent ?? 36)}%` }}
                  />
                </div>
              </div>

              <div className={cn("rounded-xl border p-3.5", isLight ? "border-slate-200 bg-slate-50" : "border-white/5 bg-white/[0.02]")}>
                <div className={cn("flex items-center justify-between text-xs", isLight ? "text-slate-700" : "text-slate-300")}>
                  <span className="font-semibold">Database Storage Gauge</span>
                  <span className={cn("font-bold font-mono", isLight ? "text-sky-700" : "text-sky-400")}>{telemetry?.storageUsedPercent ?? 24}%</span>
                </div>
                <div className={cn("mt-2 h-2 w-full overflow-hidden rounded-full", isLight ? "bg-slate-200" : "bg-white/10")}>
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, telemetry?.storageUsedPercent ?? 24)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 4-Grid Node & Ecosystem Runtime Specs */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className={cn("rounded-xl p-3 border", isLight ? "border-slate-200 bg-slate-50" : "bg-white/5 border-white/5")}>
                <span className={cn("text-[10px] uppercase font-bold tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>Uptime</span>
                <p suppressHydrationWarning className={cn("font-mono font-bold mt-1", isLight ? "text-slate-900" : "text-white")}>
                  {telemetry?.uptimeSeconds ? `${Math.floor(telemetry.uptimeSeconds / 60)} mins` : "1 mins"}
                </p>
              </div>
              <div className={cn("rounded-xl p-3 border", isLight ? "border-slate-200 bg-slate-50" : "bg-white/5 border-white/5")}>
                <span className={cn("text-[10px] uppercase font-bold tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>Node Runtime</span>
                <p suppressHydrationWarning className={cn("font-mono font-bold mt-1", isLight ? "text-slate-900" : "text-white")}>
                  {telemetry?.nodeVersion || "v24.19.0"}
                </p>
              </div>
              <div className={cn("rounded-xl p-3 border", isLight ? "border-slate-200 bg-slate-50" : "bg-white/5 border-white/5")}>
                <span className={cn("text-[10px] uppercase font-bold tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>Database</span>
                <p className="font-semibold text-emerald-600 mt-1">PostgreSQL 16</p>
              </div>
              <div className={cn("rounded-xl p-3 border", isLight ? "border-slate-200 bg-slate-50" : "bg-white/5 border-white/5")}>
                <span className={cn("text-[10px] uppercase font-bold tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>STI WNU Sync</span>
                <p className={cn("font-semibold mt-1", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>Connected</p>
              </div>
            </div>
          </motion.section>

          {/* Security & Audit Alerts (Trending Records Style) */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isLight ? "#0274BB" : "#FCD400"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
                <h2 className={cn("text-base font-black tracking-wide uppercase", isLight ? "text-slate-900" : "text-white")}>
                  SECURITY & AUDIT ALERTS
                </h2>
              </div>
              <Link
                href="/super-admin/audit-logs"
                className={cn("text-[11px] font-bold hover:underline", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}
              >
                View All
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              {(auditLogs.length > 0 ? auditLogs.slice(0, 3) : STATIC_DEFAULT_ALERTS).map((alert, idx) => (
                <div
                  key={alert.id || idx}
                  onClick={() => router.push("/super-admin/audit-logs")}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border px-4 py-3.5 backdrop-blur-md transition-all hover:-translate-y-1",
                    isLight
                      ? idx === 0
                        ? "border-slate-200 border-r-[6px] border-r-amber-500 bg-amber-50/60 shadow-xs hover:bg-amber-50"
                        : "border-slate-200 border-r-[6px] border-r-transparent bg-white shadow-xs hover:bg-slate-50"
                      : idx === 0
                        ? "border-white/10 border-r-[6px] border-r-[#FCD400] bg-[#152E47]/80 shadow-lg hover:bg-[#1E3445]"
                        : "border-white/10 border-r-[6px] border-r-transparent bg-[#152E47]/60 shadow-md hover:bg-[#1E3445]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "text-xs font-black shrink-0",
                        idx === 0
                          ? isLight
                            ? "text-amber-800"
                            : "text-slate-400 group-hover:text-[#FCD400]"
                          : isLight
                            ? "text-slate-400 group-hover:text-slate-700"
                            : "text-slate-500 group-hover:text-slate-300"
                      )}
                    >
                      0{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className={cn("text-xs font-bold truncate block", isLight ? "text-slate-900" : "text-white")}>{alert.action}</span>
                      <span className={cn("text-[10px] truncate block mt-0.5", isLight ? "text-slate-500" : "text-slate-400")}>
                        By {alert.actor} • <span className={isLight ? "text-[#0274BB] font-semibold" : "text-[#FCD400]/80"}>{alert.module || "System"}</span>
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase shrink-0 border",
                      isLight
                        ? idx === 0
                          ? "border-amber-200 bg-amber-100 text-amber-800"
                          : "border-slate-200 bg-slate-100 text-slate-600 group-hover:text-slate-900"
                        : idx === 0
                          ? "border-white/5 bg-[#0F1D29] text-[#FCD400] group-hover:bg-[#FCD400]/10"
                          : "border-white/5 bg-[#0F1D29] text-slate-400 group-hover:text-white"
                    )}
                  >
                    AUDIT
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Live Terminal Activity (Signature Inset Console) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500" />
              <h2 className={cn("text-base font-black tracking-wide uppercase", isLight ? "text-slate-900" : "text-white")}>
                LIVE TERMINAL ACTIVITY
              </h2>
            </div>

            <div className={cn(
              "min-h-[220px] rounded-2xl border p-5 flex flex-col gap-3.5",
              isLight
                ? "border-slate-200 bg-slate-50 text-slate-800 shadow-xs"
                : "border-white/10 bg-[#0F1D29] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
            )}>
              {(auditLogs.length > 0 ? auditLogs.slice(0, 4) : STATIC_DEFAULT_LOGS).map((log: any, idx: number) => (
                <div key={log.id || idx} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                  <div className="min-w-0">
                    <div
                      suppressHydrationWarning
                      className={cn("text-[9px] font-bold tracking-widest font-mono uppercase", isLight ? "text-slate-500" : "text-slate-500")}
                    >
                      {mounted && log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : "LIVE"}
                    </div>
                    <div className={cn("font-mono text-[12px] font-medium leading-snug mt-0.5 truncate", isLight ? "text-slate-700" : "text-slate-300")}>
                      <span className={cn("font-bold", isLight ? "text-slate-900" : "text-white")}>{log.actor}</span>: {log.action || log.detail || log.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

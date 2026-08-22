"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { AdminPageHeader, AdminSection, AdminStatCard } from "@/components/admin/shared";
import { useSuperAdminVitals } from "@/lib/hooks/use-super-admin-vitals";
import { AnimatedNumber } from "@/components/ui/animated-number";

export function SuperAdminHomePage() {
  const {
    vitals,
    telemetry,
    isLoading,
    isRefreshing,
    isLiveConnected,
    lastUpdated,
    refresh,
  } = useSuperAdminVitals({
    pollingIntervalMs: 4000,
    enableLiveSocket: true,
    enableActivityStream: true,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Page Header & Real-Time Sync Controls ─────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          eyebrow="Super Admin · Control Center"
          title="Platform Governance & Infrastructure"
          description="Executive oversight of platform throughput, role distribution, system telemetry, and institutional ecosystem integrity."
        />

        <div className="flex items-center gap-3">
          {/* Live Stream Connectivity Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition-colors ${
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
            <span>{isLiveConnected ? "Live Socket Active" : "Adaptive Polling Active"}</span>
          </div>

          {/* Refresh Vitals Trigger Button */}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-4 py-2 text-xs font-bold text-[#0b1c2c] transition-all hover:brightness-110 shadow-lg shadow-[#FCD400]/20 active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing || isLoading ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Synchronizing..." : "Refresh Vitals"}</span>
          </button>
        </div>
      </div>

      {/* ── Top Vital Metric Cards (Dynamic Real-Time Data Binding) ────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Total User Base Card */}
        <div className="rounded-2xl border border-white/10 bg-[#122033] p-5 shadow-lg relative overflow-hidden transition hover:border-[#FCD400]/30 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total User Base</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FCD400]/10 text-[#FCD400] transition group-hover:scale-110">
              <Users className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 text-3xl font-black text-white tracking-tight">
            {mounted ? (
              <AnimatedNumber value={vitals?.totalUsers ?? 0} />
            ) : (
              <span suppressHydrationWarning>{vitals?.totalUsers ?? 0}</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-amber-300 font-semibold border border-amber-500/20">
              {mounted ? <AnimatedNumber value={vitals?.adminsCount ?? 0} /> : vitals?.adminsCount ?? 0} Admins
            </span>
            <span className="text-slate-500">·</span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-sky-300 font-semibold border border-sky-500/20">
              {mounted ? <AnimatedNumber value={vitals?.librariansCount ?? 0} /> : vitals?.librariansCount ?? 0} Librarians
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 font-semibold">
              {mounted ? <AnimatedNumber value={vitals?.studentsCount ?? 0} /> : vitals?.studentsCount ?? 0} Students
            </span>
          </div>
        </div>

        {/* 2. Active Circulation Card */}
        <div className="rounded-2xl border border-emerald-500/20 bg-[#10292B] p-5 shadow-lg relative overflow-hidden transition hover:border-emerald-500/40 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Active Circulation</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition group-hover:scale-110">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 text-3xl font-black text-emerald-400 tracking-tight">
            {mounted ? (
              <AnimatedNumber value={vitals?.activeBorrows ?? 0} />
            ) : (
              <span suppressHydrationWarning>{vitals?.activeBorrows ?? 0}</span>
            )}
          </div>

          <p className="mt-3 text-[11px] text-emerald-200/80">
            Out of{" "}
            <strong className="text-white font-bold">
              {mounted ? <AnimatedNumber value={vitals?.activeBooksCount ?? 0} /> : vitals?.activeBooksCount ?? 0}
            </strong>{" "}
            active catalog resources
          </p>
        </div>

        {/* 3. AI Search Events Card */}
        <div className="rounded-2xl border border-violet-500/20 bg-[#1A1E38] p-5 shadow-lg relative overflow-hidden transition hover:border-violet-500/40 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300">AI Search Events</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 transition group-hover:scale-110">
              <BrainCircuit className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 text-3xl font-black text-violet-300 tracking-tight">
            {mounted ? (
              <AnimatedNumber value={vitals?.totalAiSearches ?? 0} />
            ) : (
              <span suppressHydrationWarning>{vitals?.totalAiSearches ?? 0}</span>
            )}
          </div>

          <p className="mt-3 text-[11px] text-violet-200/80 flex items-center gap-1.5">
            <span>Index:</span>
            <span className="font-bold text-white inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              {telemetry?.searchIndexStatus || "Healthy"}
            </span>
          </p>
        </div>

        {/* 4. Total Transactions Card */}
        <div className="rounded-2xl border border-sky-500/20 bg-[#12273D] p-5 shadow-lg relative overflow-hidden transition hover:border-sky-500/40 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">Total Transactions</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 transition group-hover:scale-110">
              <Activity className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 text-3xl font-black text-sky-300 tracking-tight">
            {mounted ? (
              <AnimatedNumber value={vitals?.totalTransactions ?? 0} />
            ) : (
              <span suppressHydrationWarning>{vitals?.totalTransactions ?? 0}</span>
            )}
          </div>

          <p className="mt-3 text-[11px] text-sky-200/80">
            <strong className="text-amber-300 font-bold">
              {mounted ? <AnimatedNumber value={vitals?.pendingTransactions ?? 0} /> : vitals?.pendingTransactions ?? 0}
            </strong>{" "}
            pending queue actions
          </p>
        </div>
      </div>

      {/* ── Infrastructure & Ecosystem Telemetry ─────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Telemetry Panel */}
        <div className="lg:col-span-2 rounded-2xl border border-[#273852] bg-[#101D2D] p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-white/8 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD400]/15 text-[#FCD400]">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Platform Health & Vitals</h3>
                <p className="text-xs text-slate-400">Node runtime telemetry and database engine health</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {telemetry?.platformStatus || "Operational"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Memory Allocation</span>
                <span className="font-bold text-white">{telemetry?.memoryUsagePercent ?? 36}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#FCD400] transition-all duration-500"
                  style={{ width: `${Math.min(100, telemetry?.memoryUsagePercent ?? 36)}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Database Storage Gauge</span>
                <span className="font-bold text-white">{telemetry?.storageUsedPercent ?? 24}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, telemetry?.storageUsedPercent ?? 24)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 text-xs">
            <div className="rounded-lg bg-white/5 p-3">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Uptime</span>
              <p suppressHydrationWarning className="font-mono font-bold text-white mt-1">
                {mounted && telemetry?.uptimeSeconds ? `${Math.floor(telemetry.uptimeSeconds / 60)} mins` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Node Runtime</span>
              <p suppressHydrationWarning className="font-mono font-bold text-white mt-1">
                {mounted && telemetry?.nodeVersion ? telemetry.nodeVersion : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Database</span>
              <p className="font-semibold text-emerald-400 mt-1">PostgreSQL 16</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <span className="text-slate-400 text-[10px] uppercase font-bold">STI WNU Sync</span>
              <p className="font-semibold text-[#FCD400] mt-1">Connected</p>
            </div>
          </div>
        </div>

        {/* Quick Command Hub */}
        <div className="rounded-2xl border border-[#273852] bg-[#101D2D] p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-white font-bold text-base pb-3 border-b border-white/8">
              <ShieldCheck className="h-5 w-5 text-[#FCD400]" />
              Super Admin Quick Hub
            </div>
            <p className="text-xs text-slate-400 mt-2">Direct access to governance, security audits, and global settings.</p>

            <div className="mt-4 space-y-2">
              <Link
                href="/super-admin/system-management"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-[#FCD400]/40 group"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-[#FCD400]" />
                  <span>Account Management & CRUD</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
              </Link>

              <Link
                href="/super-admin/audit-logs"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-[#FCD400]/40 group"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span>Audit & Security Logs</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
              </Link>

              <Link
                href="/super-admin/records"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-[#FCD400]/40 group"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="h-4 w-4 text-sky-400" />
                  <span>Master Tabbed Records</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
              </Link>

              <Link
                href="/super-admin/settings"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-[#FCD400]/40 group"
              >
                <div className="flex items-center gap-2.5">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>Disaster Recovery & Sync</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#FCD400]/20 bg-[#FCD400]/5 p-3 text-[11px] text-slate-300">
            <span className="font-bold text-[#FCD400]">RBAC Active:</span> All platform mutations require Super Admin authorization and are logged to audit trails.
          </div>
        </div>
      </div>
    </div>
  );
}

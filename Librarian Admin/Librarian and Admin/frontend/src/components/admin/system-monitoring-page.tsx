"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Key,
  User,
  BookOpen,
  ArrowDownUp,
  Sparkles,
  Database,
  Shield,
  Users,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  Info
} from "lucide-react";

import { AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { MonitoringPayload } from "@/lib/admin/types";
import { formatDateTime, cn } from "@/lib/utils";

function getAvatarGradient(name: string) {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
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

const TYPE_CONFIG: Record<string, { icon: any; text: string; bg: string; border: string }> = {
  Auth: { icon: Key, text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  User: { icon: User, text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  Book: { icon: BookOpen, text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  Transaction: { icon: ArrowDownUp, text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  AI: { icon: Sparkles, text: "text-[#FFD600]", bg: "bg-[#FFD600]/10", border: "border-[#FFD600]/20" },
  System: { icon: Database, text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
};

const getTypeConfig = (type: string) => TYPE_CONFIG[type] ?? { icon: Database, text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" };

const SEVERITY_CONFIG: Record<string, { text: string; bg: string; border: string; icon: any }> = {
  info: { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", icon: Info },
  warning: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle },
  error: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", icon: AlertTriangle },
  danger: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", icon: AlertTriangle },
  success: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle },
};

const getSeverityConfig = (sev: string) => {
  const norm = sev.toLowerCase();
  return SEVERITY_CONFIG[norm] ?? { text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", icon: Info };
};

export function SystemMonitoringPage() {
  const [payload, setPayload] = useState<MonitoringPayload | null>(null);
  const [actor, setActor] = useState("All");
  const [activityType, setActivityType] = useState("All");
  const [from, setFrom] = useState("");
  const deferredActor = useDeferredValue(actor);

  const [isActorFocused, setIsActorFocused] = useState(false);
  const [isSelectFocused, setIsSelectFocused] = useState(false);
  const [isDateFocused, setIsDateFocused] = useState(false);

  useEffect(() => {
    void requestJson<MonitoringPayload>(
      `/api/admin/monitoring?actor=${encodeURIComponent(deferredActor)}&activityType=${encodeURIComponent(activityType)}&from=${encodeURIComponent(from)}`,
    ).then((response) => {
      startTransition(() => setPayload(response));
    });
  }, [deferredActor, activityType, from]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="System Monitoring"
        description="Filter user actions, transaction changes, AI searches, and authentication events with timestamped operational logs."
      />

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {[
          {
            label: "Auth Events",
            value: payload?.totals.authEvents ?? "...",
            icon: Shield,
            color: "text-slate-400",
            bg: "from-slate-500/5 to-transparent",
            border: "border-slate-500/10 hover:border-slate-500/30",
            glow: "shadow-[0_0_20px_rgba(148,163,184,0.02)]",
          },
          {
            label: "AI Events",
            value: payload?.totals.aiEvents ?? "...",
            icon: Sparkles,
            color: "text-[#FFD600]",
            bg: "from-[#FFD600]/5 to-transparent",
            border: "border-[#FFD600]/10 hover:border-[#FFD600]/30",
            glow: "shadow-[0_0_20px_rgba(255,214,0,0.02)]",
          },
          {
            label: "Transaction Events",
            value: payload?.totals.transactionEvents ?? "...",
            icon: ArrowDownUp,
            color: "text-emerald-400",
            bg: "from-emerald-500/5 to-transparent",
            border: "border-emerald-500/10 hover:border-emerald-500/30",
            glow: "shadow-[0_0_20px_rgba(52,211,153,0.02)]",
          },
          {
            label: "User Events",
            value: payload?.totals.userEvents ?? "...",
            icon: Users,
            color: "text-rose-400",
            bg: "from-rose-500/5 to-transparent",
            border: "border-rose-500/10 hover:border-rose-500/30",
            glow: "shadow-[0_0_20px_rgba(244,63,94,0.02)]",
          }
        ].map((card) => {
          const IconComp = card.icon;
          return (
            <motion.div
              key={card.label}
              whileHover={{ y: -4 }}
              className={cn(
                "group p-6 rounded-2xl border bg-gradient-to-b backdrop-blur-md transition-all duration-300 relative overflow-hidden",
                card.border,
                card.bg,
                card.glow
              )}
            >
              {/* Card top border light */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:via-white/20 transition-all duration-300" />
              
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase select-none">
                  {card.label}
                </span>
                <IconComp className={cn("h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110", card.color)} />
              </div>
              <p className="mt-5 text-4xl font-extrabold text-white tracking-tight leading-none">
                {card.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      <AdminSection
        title="Audit Feed"
        description="Narrow by actor, date, and activity type to review the live administrative trail."
      >
        <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <div className={cn(
            "relative flex items-center rounded-xl border bg-white/5 transition-all duration-300",
            isActorFocused
              ? "border-[#FFD600] bg-[#0A1624] shadow-[0_0_15px_rgba(255,214,0,0.12)] ring-1 ring-[#FFD600]"
              : "border-white/10"
          )}>
            <User className={cn("absolute left-3.5 h-4.5 w-4.5 transition-colors duration-300", isActorFocused ? "text-[#FFD600]" : "text-slate-500")} />
            <input
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              onFocus={() => setIsActorFocused(true)}
              onBlur={() => setIsActorFocused(false)}
              placeholder="Filter by actor..."
              className="w-full bg-transparent py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-none"
            />
          </div>

          <div className={cn(
            "relative flex items-center rounded-xl border bg-white/5 transition-all duration-300",
            isSelectFocused
              ? "border-[#FFD600] bg-[#0A1624] shadow-[0_0_15px_rgba(255,214,0,0.12)] ring-1 ring-[#FFD600]"
              : "border-white/10"
          )}>
            <Activity className={cn("absolute left-3.5 h-4.5 w-4.5 transition-colors duration-300", isSelectFocused ? "text-[#FFD600]" : "text-slate-500")} />
            <select
              value={activityType}
              onChange={(event) => setActivityType(event.target.value)}
              onFocus={() => setIsSelectFocused(true)}
              onBlur={() => setIsSelectFocused(false)}
              className="w-full bg-transparent py-3 pl-11 pr-8 text-sm text-white outline-none appearance-none cursor-pointer"
            >
              <option value="All" className="bg-[#0b1c2c]">All Activities</option>
              <option value="Auth" className="bg-[#0b1c2c]">Auth</option>
              <option value="User" className="bg-[#0b1c2c]">User</option>
              <option value="Book" className="bg-[#0b1c2c]">Book</option>
              <option value="Transaction" className="bg-[#0b1c2c]">Transaction</option>
              <option value="AI" className="bg-[#0b1c2c]">AI</option>
              <option value="System" className="bg-[#0b1c2c]">System</option>
            </select>
            {/* Custom arrow icon for select */}
            <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-400" />
          </div>

          <div className={cn(
            "relative flex items-center rounded-xl border bg-white/5 transition-all duration-300",
            isDateFocused
              ? "border-[#FFD600] bg-[#0A1624] shadow-[0_0_15px_rgba(255,214,0,0.12)] ring-1 ring-[#FFD600]"
              : "border-white/10"
          )}>
            <Calendar className={cn("absolute left-3.5 h-4.5 w-4.5 transition-colors duration-300", isDateFocused ? "text-[#FFD600]" : "text-slate-500")} />
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              onFocus={() => setIsDateFocused(true)}
              onBlur={() => setIsDateFocused(false)}
              className="w-full bg-transparent py-3 pl-11 pr-4 text-sm text-white outline-none select-none"
            />
          </div>
        </div>

        <AdminTable>
          <table className="min-w-full text-left">
            <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)] border-b border-[var(--line)]">
              <tr>
                <th className="px-4 py-3.5">Actor</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Message</th>
                <th className="px-4 py-3.5">Severity</th>
                <th className="px-4 py-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.logs ?? []).map((log) => {
                const typeCfg = getTypeConfig(log.activityType);
                const TypeIcon = typeCfg.icon;

                const sevCfg = getSeverityConfig(log.severity);
                const SevIcon = sevCfg.icon;

                return (
                  <tr key={log.id} className="border-t border-[var(--line)] hover:bg-white/[0.015] transition-colors duration-200 group">
                    {/* Actor column with Avatar */}
                    <td className="px-4 py-3.5 text-sm font-medium text-white/95">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-[9px] shadow-sm uppercase select-none", getAvatarGradient(log.actor))}>
                          {log.actor.charAt(0)}
                        </div>
                        <span className="truncate max-w-[130px]">{log.actor}</span>
                      </div>
                    </td>

                    {/* Type column with custom badge */}
                    <td className="px-4 py-3.5 text-sm">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                        typeCfg.bg, typeCfg.border, typeCfg.text
                      )}>
                        <TypeIcon className="h-3 w-3" />
                        {log.activityType}
                      </span>
                    </td>

                    {/* Message column */}
                    <td className="px-4 py-3.5 text-sm text-slate-300 font-medium group-hover:text-white transition-colors duration-200">
                      {log.message}
                    </td>

                    {/* Severity column with glowing pill badge */}
                    <td className="px-4 py-3.5 text-sm">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase shadow-sm",
                        sevCfg.bg, sevCfg.border, sevCfg.text
                      )}>
                        <SevIcon className="h-3 w-3" />
                        {log.severity}
                      </span>
                    </td>

                    {/* Timestamp column */}
                    <td className="px-4 py-3.5 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                  </tr>
                );
              })}
              {payload?.logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-white/40">
                    No activity logs match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </div>
  );
}

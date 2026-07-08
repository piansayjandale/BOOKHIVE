"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Printer, TrendingUp, Calendar, BookOpen, Layers } from "lucide-react";

import { downloadCsv } from "@/lib/utils";
import type { ReportsPayload } from "@/lib/types";

const chartColors = ["#6EE7B7", "#93C5FD", "#FDE68A", "#FCA5A5", "#C4B5FD", "#F9A8D4"];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0F1D29]/95 p-3 shadow-xl backdrop-blur">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className="mt-1.5 space-y-1">
          {payload.map((p: any) => (
            <p key={p.name} className="text-xs font-semibold" style={{ color: p.color || p.fill }}>
              {p.name}: <span className="text-white font-mono">{p.value}</span>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function ReportsModule() {
  const [reports, setReports] = useState<ReportsPayload | null>(null);

  const loadReports = useCallback(async () => {
    const response = await fetch("/api/reports");
    if (!response.ok) return;
    const payload = (await response.json()) as ReportsPayload;
    startTransition(() => setReports(payload));
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const totals = useMemo(() => {
    if (!reports) return null;
    const totalBorrows = reports.monthlyBorrowing.reduce((sum, item) => sum + item.borrows, 0);
    const totalReservations = reports.monthlyBorrowing.reduce((sum, item) => sum + item.reservations, 0);
    return { totalBorrows, totalReservations };
  }, [reports]);

  if (!reports || !totals) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FCD400] border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-slate-400">Loading library analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 px-1 overflow-y-auto pb-8">
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">Librarian · Reports</p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">Library Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-400">Visualize borrowing trends, track popular genres, and download system reports.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            suppressHydrationWarning
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <Printer className="h-4 w-4" />
            Print Page
          </button>
          <button
            onClick={() =>
              downloadCsv(
                "bookhive-top-borrowed.csv",
                reports.topBorrowed.map((item) => ({ title: item.title, borrows: item.borrows }))
              )
            }
            suppressHydrationWarning
            className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
          >
            <Download className="h-4 w-4" />
            Export Data (CSV)
          </button>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Borrows", value: totals.totalBorrows.toLocaleString(), color: "#6EE7B7" },
          { label: "Reservations", value: totals.totalReservations.toLocaleString(), color: "#93C5FD" },
          { label: "Top Section", value: reports.departmentUsage[0]?.department ?? "N/A", color: "#FDE68A" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/8 bg-[#152E47]/60 px-5 py-4 backdrop-blur transition hover:bg-[#152E47]/80"
            style={{ borderLeftColor: stat.color, borderLeftWidth: 4 }}
          >
            <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">{stat.label}</p>
            <p className="mt-1 text-2xl font-black text-white truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Core Charts Section ─────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Monthly Trend */}
        <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 p-6 backdrop-blur flex flex-col">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 items-center justify-center rounded-lg bg-blue-500/10 px-2 text-[10px] font-bold tracking-wider text-blue-400 uppercase">
              Trendline
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Borrowing & Reservation Trends</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">Monthly overview of checkout volumes and reservations across the system.</p>
          <div className="mt-6 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reports.monthlyBorrowing} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                <Line name="Borrows" type="monotone" dataKey="borrows" stroke="#6EE7B7" strokeWidth={3} dot={{ fill: "#6EE7B7", strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
                <Line name="Reservations" type="monotone" dataKey="reservations" stroke="#93C5FD" strokeWidth={3} dot={{ fill: "#93C5FD", strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section Demand */}
        <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 p-6 backdrop-blur flex flex-col">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 items-center justify-center rounded-lg bg-[#FCD400]/10 px-2 text-[10px] font-bold tracking-wider text-[#FCD400] uppercase">
              Sections
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Section Demand Share</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">Usage breakdown distribution mapping to the library sections taxonomy.</p>
          <div className="mt-6 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.departmentUsage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="department" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar name="Checkout Actions" dataKey="usage" radius={[6, 6, 0, 0]}>
                  {reports.departmentUsage.map((entry, index) => (
                    <Cell key={entry.department} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Sub Analytics Section ───────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        {/* Most Borrowed Leaderboard */}
        <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 p-6 backdrop-blur flex flex-col">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 items-center justify-center rounded-lg bg-emerald-500/10 px-2 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
              Leaderboard
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Top Borrowed Books</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">The most requested and checked out titles in the catalog library.</p>
          <div className="mt-5 space-y-2.5 flex-1 overflow-y-auto max-h-[320px] pr-1">
            {reports.topBorrowed.map((item, index) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/[0.04] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 font-mono text-xs font-bold text-slate-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-500 tracking-wide mt-0.5">Top-tier checkout status</p>
                  </div>
                </div>
                <div className="rounded-md bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 font-mono">
                  {item.borrows} borrows
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operational status */}
        <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 p-6 backdrop-blur flex flex-col">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 items-center justify-center rounded-lg bg-pink-500/10 px-2 text-[10px] font-bold tracking-wider text-pink-400 uppercase">
              Operations
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Status Breakdown Share</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">Total operational active queue distribution across transactional states.</p>
          <div className="mt-4 h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reports.statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={3}
                >
                  {reports.statusBreakdown.map((entry, index) => (
                    <Cell key={entry.status} fill={chartColors[(index + 2) % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

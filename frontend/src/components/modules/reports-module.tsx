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
import { Download, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ModuleHeader } from "@/components/ui/module-header";
import { Panel } from "@/components/ui/panel";
import type { ReportsPayload } from "@/lib/types";
import { downloadCsv } from "@/lib/utils";

const chartColors = ["#60a5fa", "#22d3ee", "#34d399", "#fbbf24", "#f472b6"];

export function ReportsModule() {
  const [reports, setReports] = useState<ReportsPayload | null>(null);

  const loadReports = useCallback(async () => {
    const response = await fetch("/api/reports");
    const payload = (await response.json()) as ReportsPayload;
    startTransition(() => setReports(payload));
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const totals = useMemo(() => {
    if (!reports) {
      return null;
    }

    const totalBorrows = reports.monthlyBorrowing.reduce((sum, item) => sum + item.borrows, 0);
    const totalReservations = reports.monthlyBorrowing.reduce(
      (sum, item) => sum + item.reservations,
      0,
    );

    return { totalBorrows, totalReservations };
  }, [reports]);

  if (!reports || !totals) {
    return null;
  }

  return (
    <div className="space-y-8">
      <ModuleHeader
        eyebrow="Reports"
        title="Descriptive analytics for library performance"
        description="Visualize borrowing trends, compare department demand, and export clean analytics for admin review and printing."
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#57c3ff,#2563eb)] px-5 py-3 text-sm font-semibold text-white"
          onClick={() =>
            downloadCsv(
              "bookhive-top-borrowed.csv",
              reports.topBorrowed.map((item) => ({ title: item.title, borrows: item.borrows })),
            )
          }
        >
          <Download className="h-4 w-4" />
          Export Reports
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-5 py-3 text-sm font-semibold text-white/75"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          Print Analytics
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Borrows", value: totals.totalBorrows.toString() },
          { label: "Reservations", value: totals.totalReservations.toString() },
          { label: "Top Department", value: reports.departmentUsage[0]?.department ?? "N/A" },
        ].map((card) => (
          <Panel key={card.label} className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--module-muted-2)]">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--module-title-color)]">{card.value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-6">
          <div>
            <Badge>Monthly Usage</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-[var(--module-title-color)]">Borrowing vs reservation trend</h2>
          </div>
          <div className="mt-6 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reports.monthlyBorrowing}>
                <XAxis dataKey="month" stroke="var(--module-muted-2)" />
                <YAxis stroke="var(--module-muted-2)" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="borrows" stroke="#60a5fa" strokeWidth={3} />
                <Line
                  type="monotone"
                  dataKey="reservations"
                  stroke="#34d399"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-6">
          <div>
            <Badge tone="success">Demand Mix</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-white">Department usage trends</h2>
          </div>
          <div className="mt-6 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reports.departmentUsage}>
                <XAxis dataKey="department" stroke="var(--module-muted-2)" tick={false} />
                <YAxis stroke="var(--module-muted-2)" />
                <Tooltip />
                <Bar dataKey="usage" radius={[10, 10, 0, 0]}>
                  {reports.departmentUsage.map((entry, index) => (
                    <Cell key={entry.department} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-6">
          <div>
            <Badge>Top Records</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-white">Most borrowed books</h2>
          </div>
          <div className="mt-6 space-y-3">
            {reports.topBorrowed.map((item, index) => (
              <div key={item.title} className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/20 text-[var(--module-title-color)]">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--module-title-color)]">{item.title}</p>
                      <p className="text-sm text-[var(--module-muted-2)]">Borrow count leaderboard</p>
                    </div>
                  </div>
                  <Badge tone="success">{item.borrows}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <div>
            <Badge tone="warning">Operational Status</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-white">Transaction status share</h2>
          </div>
          <div className="mt-6 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reports.statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={80}
                  outerRadius={118}
                  paddingAngle={4}
                >
                  {reports.statusBreakdown.map((entry, index) => (
                    <Cell key={entry.status} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

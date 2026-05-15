"use client";

import { startTransition, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Printer, Sheet } from "lucide-react";

import { AdminPageHeader, AdminSection } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AnalyticsPayload } from "@/lib/admin/types";
import { downloadCsv } from "@/lib/utils";

export function AnalyticsPage() {
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    void requestJson<AnalyticsPayload>("/api/admin/analytics").then((response) => {
      startTransition(() => setPayload(response));
    });
  }, []);

  function handleExport() {
    downloadCsv(
      "bookhive-analytics.csv",
      (payload?.mostBorrowedBooks ?? []).map((item) => ({
        title: item.title,
        borrows: item.borrows,
      })),
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Analytics"
        description="Visualize demand, borrowing trends, department engagement, and operational status from centralized BookHive data."
        actions={
          <>
            <button type="button" className="admin-secondary-btn inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm" onClick={handleExport}>
              <Sheet className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" className="admin-primary-btn inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print / PDF
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSection title="Most Borrowed Books" description="Top performers by borrow volume.">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload?.mostBorrowedBooks ?? []}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="title" stroke="var(--muted)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--muted)" />
                <Tooltip />
                <Bar dataKey="borrows" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminSection>

        <AdminSection title="Most Active Departments" description="Transaction volume by department.">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={payload?.mostActiveDepartments ?? []} dataKey="total" nameKey="department" outerRadius={110} fill="#2563eb" />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </AdminSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSection title="Monthly Trends" description="Borrowing, return, and reservation movement over time.">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={payload?.monthlyTrends ?? []}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" />
                <Tooltip />
                <Line type="monotone" dataKey="borrows" stroke="#f59e0b" strokeWidth={3} />
                <Line type="monotone" dataKey="returns" stroke="#0ea5e9" strokeWidth={2} />
                <Line type="monotone" dataKey="reservations" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AdminSection>

        <AdminSection title="Yearly Volume" description="Aggregate transaction activity by year.">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload?.yearlyTrends ?? []}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="year" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" />
                <Tooltip />
                <Bar dataKey="transactions" fill="#0f766e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminSection>
      </div>
    </div>
  );
}

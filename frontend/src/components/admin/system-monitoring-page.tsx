"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { AdminPageHeader, AdminSection, AdminStatCard, AdminTable } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { MonitoringPayload } from "@/lib/admin/types";
import { formatDateTime } from "@/lib/utils";

export function SystemMonitoringPage() {
  const [payload, setPayload] = useState<MonitoringPayload | null>(null);
  const [actor, setActor] = useState("All");
  const [activityType, setActivityType] = useState("All");
  const [from, setFrom] = useState("");
  const deferredActor = useDeferredValue(actor);

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

      <div className="grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Auth Events" value={payload?.totals.authEvents ?? "..."} />
        <AdminStatCard label="AI Events" value={payload?.totals.aiEvents ?? "..."} tone="success" />
        <AdminStatCard label="Transaction Events" value={payload?.totals.transactionEvents ?? "..."} tone="warning" />
        <AdminStatCard label="User Events" value={payload?.totals.userEvents ?? "..."} tone="danger" />
      </div>

      <AdminSection
        title="Audit Feed"
        description="Narrow by actor, date, and activity type to review the live administrative trail."
      >
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="Filter by actor" className="glass-input px-4 py-3" />
          <select value={activityType} onChange={(event) => setActivityType(event.target.value)} className="glass-input px-4 py-3">
            <option value="All">All Activities</option>
            <option value="Auth">Auth</option>
            <option value="User">User</option>
            <option value="Book">Book</option>
            <option value="Transaction">Transaction</option>
            <option value="AI">AI</option>
            <option value="System">System</option>
          </select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="glass-input px-4 py-3" />
        </div>

        <AdminTable>
          <table className="min-w-full text-left">
            <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
              <tr>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.logs ?? []).map((log) => (
                <tr key={log.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 text-sm">{log.actor}</td>
                  <td className="px-4 py-3 text-sm">{log.activityType}</td>
                  <td className="px-4 py-3 text-sm">{log.message}</td>
                  <td className="px-4 py-3 text-sm">{log.severity}</td>
                  <td className="px-4 py-3 text-sm">{formatDateTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </div>
  );
}

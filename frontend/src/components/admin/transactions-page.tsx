"use client";

import { startTransition, useEffect, useState } from "react";
import { Check, X } from "lucide-react";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminPageHeader, AdminSection, AdminStatCard, AdminTable } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminTransactionsPayload } from "@/lib/admin/types";
import type { TransactionStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type TransactionTab = "borrow" | "returns" | "reservations" | "history";

export function TransactionsPage() {
  const { notify } = useNotice();
  const [payload, setPayload] = useState<AdminTransactionsPayload | null>(null);
  const [tab, setTab] = useState<TransactionTab>("borrow");

  async function loadTransactions() {
    const nextPayload = await requestJson<AdminTransactionsPayload>("/api/admin/transactions");
    startTransition(() => setPayload(nextPayload));
  }

  useEffect(() => {
    void loadTransactions();
  }, []);

  async function updateStatus(id: string, status: TransactionStatus) {
    try {
      await requestJson(`/api/admin/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      notify(`Transaction marked ${status.toLowerCase()}.`, "success");
      await loadTransactions();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update transaction.", "error");
    }
  }

  const rows =
    tab === "borrow"
      ? payload?.borrowRequests ?? []
      : tab === "returns"
        ? payload?.returnRecords ?? []
        : tab === "reservations"
          ? payload?.reservations ?? []
          : payload?.transactionHistory ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Transactions"
        description="Review borrow requests, returns, reservations, and full transaction history without breaking librarian ownership rules."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Pending" value={payload?.summary.pending ?? "..."} />
        <AdminStatCard label="Approved" value={payload?.summary.approved ?? "..."} tone="success" />
        <AdminStatCard label="Declined" value={payload?.summary.declined ?? "..."} tone="danger" />
        <AdminStatCard label="Returned" value={payload?.summary.returned ?? "..."} tone="warning" />
      </div>

      <AdminSection
        title="Transaction Workspace"
        description={
          payload?.allowAdminControl
            ? "Admin override is enabled. Use controls carefully and only for exception handling."
            : "Admin override is disabled. This screen is currently view-only until enabled in Settings."
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["borrow", "Borrow Requests"],
            ["returns", "Return Records"],
            ["reservations", "Reservations"],
            ["history", "Transaction History"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rounded-full border px-4 py-2 text-sm ${
                tab === value
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--module-title-color)]"
                  : "border-[var(--line)]"
              }`}
              onClick={() => setTab(value as TransactionTab)}
            >
              {label}
            </button>
          ))}
        </div>

        <AdminTable>
          <table className="min-w-full text-left">
            <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{item.studentName}</p>
                    <p className="text-xs text-[var(--module-muted-color)]">{item.studentId}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{item.resourceTitle}</td>
                  <td className="px-4 py-3 text-sm">{item.type}</td>
                  <td className="px-4 py-3 text-sm">{item.status}</td>
                  <td className="px-4 py-3 text-sm">{formatDateTime(item.requestedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="admin-success-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                        onClick={() => void updateStatus(item.id, "Approved")}
                        disabled={!payload?.allowAdminControl}
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="admin-danger-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                        onClick={() => void updateStatus(item.id, "Declined")}
                        disabled={!payload?.allowAdminControl}
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </div>
  );
}

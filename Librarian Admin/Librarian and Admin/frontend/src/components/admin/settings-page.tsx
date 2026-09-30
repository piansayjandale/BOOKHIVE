"use client";

import { useEffect, useState } from "react";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminPageHeader, AdminSection, FieldLabel } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminSettingsPayload } from "@/lib/admin/types";

export function SettingsPage() {
  const { notify } = useNotice();
  const [form, setForm] = useState<AdminSettingsPayload | null>(null);

  useEffect(() => {
    void requestJson<AdminSettingsPayload>("/api/admin/settings").then((response) => {
      setForm(response);
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    await requestJson("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    notify("Settings saved.", "success");
  }

  if (!form) {
    return null;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Settings"
        description="Configure borrowing limits, duration windows, notifications, AI behavior, and admin transaction permissions."
      />

      <AdminSection
        title="System Configuration"
        description="These values shape how the shared BookHive backend behaves across admin and librarian surfaces."
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <FieldLabel label="Borrow Limit">
            <input type="number" value={form.borrowLimit} onChange={(event) => setForm((current) => current ? { ...current, borrowLimit: Number(event.target.value) } : current)} className="glass-input w-full px-4 py-3" />
          </FieldLabel>
          <FieldLabel label="Borrow Duration Days">
            <input type="number" value={form.borrowDurationDays} onChange={(event) => setForm((current) => current ? { ...current, borrowDurationDays: Number(event.target.value) } : current)} className="glass-input w-full px-4 py-3" />
          </FieldLabel>
          <FieldLabel label="AI Engine">
            <input value={form.aiEngine} onChange={(event) => setForm((current) => current ? { ...current, aiEngine: event.target.value } : current)} className="glass-input w-full px-4 py-3" />
          </FieldLabel>
          <FieldLabel label="Theme">
            <select value={form.theme} onChange={(event) => setForm((current) => current ? { ...current, theme: event.target.value as "dark" | "light" } : current)} className="glass-input w-full px-4 py-3">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Storage Used Percent">
            <input type="number" value={form.storageUsedPercent} onChange={(event) => setForm((current) => current ? { ...current, storageUsedPercent: Number(event.target.value) } : current)} className="glass-input w-full px-4 py-3" />
          </FieldLabel>
          <FieldLabel label="Indexing Status">
            <select value={form.indexingStatus} onChange={(event) => setForm((current) => current ? { ...current, indexingStatus: event.target.value as "Healthy" | "Rebuilding" | "Delayed" } : current)} className="glass-input w-full px-4 py-3">
              <option value="Healthy">Healthy</option>
              <option value="Rebuilding">Rebuilding</option>
              <option value="Delayed">Delayed</option>
            </select>
          </FieldLabel>
          <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-4 py-4">
            <span>Notifications Enabled</span>
            <input type="checkbox" checked={form.notificationsEnabled} onChange={(event) => setForm((current) => current ? { ...current, notificationsEnabled: event.target.checked } : current)} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-4 py-4">
            <span>Email Notifications</span>
            <input type="checkbox" checked={form.emailNotifications} onChange={(event) => setForm((current) => current ? { ...current, emailNotifications: event.target.checked } : current)} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-4 py-4">
            <span>Admin Transaction Override</span>
            <input type="checkbox" checked={form.allowAdminTransactionControl} onChange={(event) => setForm((current) => current ? { ...current, allowAdminTransactionControl: event.target.checked } : current)} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-4 py-4">
            <span>AI Strict Mode</span>
            <input type="checkbox" checked={form.aiStrictMode} onChange={(event) => setForm((current) => current ? { ...current, aiStrictMode: event.target.checked } : current)} />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="admin-primary-btn rounded-2xl px-4 py-3 font-semibold">
              Save Settings
            </button>
          </div>
        </form>
      </AdminSection>
    </div>
  );
}

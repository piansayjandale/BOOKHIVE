"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  Download,
  FolderSync,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { AdminModal, AdminPageHeader, AdminSection, AdminTable, FieldLabel } from "@/components/admin/shared";
import { useNotice } from "@/components/providers/notice-provider";
import { requestJson } from "@/lib/admin/client";
import type { SuperAdminSettingsPayload, SystemBackupRecord } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export function SuperAdminSettingsPage() {
  const { notify } = useNotice();
  const [data, setData] = useState<SuperAdminSettingsPayload | null>(null);
  const [backups, setBackups] = useState<SystemBackupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoreModalBackup, setRestoreModalBackup] = useState<SystemBackupRecord | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Form state
  const [borrowLimit, setBorrowLimit] = useState(5);
  const [borrowDurationDays, setBorrowDurationDays] = useState(7);
  const [aiStrictMode, setAiStrictMode] = useState(true);
  const [allowAdminTransactionControl, setAllowAdminTransactionControl] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const loadSettingsAndBackups = useCallback(async () => {
    try {
      setIsLoading(true);
      const [settingsRes, backupsRes] = await Promise.all([
        requestJson<SuperAdminSettingsPayload>("/api/super-admin/settings"),
        requestJson<{ backups: SystemBackupRecord[] }>("/api/super-admin/backups"),
      ]);

      setData(settingsRes);
      setBackups(backupsRes.backups || []);

      if (settingsRes?.settings) {
        setBorrowLimit(settingsRes.settings.borrowLimit);
        setBorrowDurationDays(settingsRes.settings.borrowDurationDays);
        setAiStrictMode(settingsRes.settings.aiStrictMode);
        setAllowAdminTransactionControl(settingsRes.settings.allowAdminTransactionControl);
        setNotificationsEnabled(settingsRes.settings.notificationsEnabled);
      }
    } catch (err) {
      console.warn("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettingsAndBackups();
  }, [loadSettingsAndBackups]);

  // Save Settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updated = await requestJson<SuperAdminSettingsPayload>("/api/super-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrowLimit,
          borrowDurationDays,
          aiStrictMode,
          allowAdminTransactionControl,
          notificationsEnabled,
        }),
      });
      setData(updated);
      notify("Global system settings updated successfully.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to update settings.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  // Trigger Institutional Sync
  async function handleTriggerSync() {
    try {
      setIsSyncing(true);
      const res = await requestJson<{ message: string; log: any }>("/api/super-admin/settings/sync", {
        method: "POST",
      });
      notify(res.message || "Institutional sync completed.", "success");
      void loadSettingsAndBackups();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Sync failed.", "error");
    } finally {
      setIsSyncing(false);
    }
  }

  // Trigger Database Snapshot
  async function handleCreateBackup() {
    try {
      setIsBackingUp(true);
      const res = await requestJson<{ backup: SystemBackupRecord }>("/api/super-admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupType: "MANUAL" }),
      });
      notify(`Database snapshot ${res.backup.fileName} created successfully.`, "success");
      void loadSettingsAndBackups();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Backup failed.", "error");
    } finally {
      setIsBackingUp(false);
    }
  }

  // Restore snapshot
  async function handleRestore() {
    if (!restoreModalBackup) return;
    try {
      setIsRestoring(true);
      const res = await requestJson<{ message: string }>("/api/super-admin/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: restoreModalBackup.id }),
      });
      notify(res.message, "success");
      setRestoreModalBackup(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Restore failed.", "error");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Super Admin · Global Governance"
        title="Global System Settings & Disaster Recovery"
        description="Global environment configurations, STI WNU institutional directory sync schedules, and automated database snapshot controls."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Section 1: Global Constants Form ──────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-[#101D2D] p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 border-b border-white/8 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD400]/15 text-[#FCD400]">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Global Circulation & AI Parameters</h3>
              <p className="text-xs text-slate-400">Library policy thresholds and neural search configuration</p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Max Borrow Limit per Student</FieldLabel>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={borrowLimit}
                  onChange={(e) => setBorrowLimit(Number(e.target.value))}
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                />
              </div>

              <div>
                <FieldLabel>Standard Loan Duration (Days)</FieldLabel>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={borrowDurationDays}
                  onChange={(e) => setBorrowDurationDays(Number(e.target.value))}
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/5 transition">
                <input
                  type="checkbox"
                  checked={aiStrictMode}
                  onChange={(e) => setAiStrictMode(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-800 text-[#FCD400] focus:ring-[#FCD400]"
                />
                <div>
                  <span className="font-bold text-white">Strict AI Search Relevance Filtering</span>
                  <p className="text-[11px] text-slate-400">Enforce confidence thresholds on natural language book queries.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/5 transition">
                <input
                  type="checkbox"
                  checked={allowAdminTransactionControl}
                  onChange={(e) => setAllowAdminTransactionControl(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-800 text-[#FCD400] focus:ring-[#FCD400]"
                />
                <div>
                  <span className="font-bold text-white">Allow Admin Desk Transaction Overrides</span>
                  <p className="text-[11px] text-slate-400">Permit Admins to bypass standard loan limits during manual issue.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/5 transition">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-800 text-[#FCD400] focus:ring-[#FCD400]"
                />
                <div>
                  <span className="font-bold text-white">System Broadcast Notifications</span>
                  <p className="text-[11px] text-slate-400">Send real-time alerts for loan expiries and overdue violations.</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-xs font-bold text-[#0b1c2c] hover:brightness-110 shadow-lg shadow-[#FCD400]/20 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving Settings..." : "Save Global Constants"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Section 2: STI WNU Institutional Ecosystem Sync ─────────── */}
        <div className="rounded-2xl border border-white/10 bg-[#101D2D] p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                  <FolderSync className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">STI WNU Institutional Directory Sync</h3>
                  <p className="text-xs text-slate-400">Active Directory and academic enrollment reconciliation</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[10px] font-bold text-emerald-400">
                ACTIVE INTEGRATION
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Integration Provider</span>
                <span className="font-semibold text-white">{data?.institutionalSync?.provider || "STI WNU Ecosystem"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Automated Schedule</span>
                <span className="font-mono text-white">{data?.institutionalSync?.autoSyncSchedule || "Daily at 02:00 AM PHT"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Status</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Reconciled
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed rounded-xl bg-white/[0.02] border border-white/5 p-3">
              Triggering a sync reconciles all student ID numbers, department rosters, and active faculty records directly from the STI WNU directory services.
            </p>
          </div>

          <div className="pt-4 border-t border-white/8">
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void handleTriggerSync()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/20 border border-sky-500/30 py-2.5 text-xs font-bold text-sky-300 hover:bg-sky-500 hover:text-white transition disabled:opacity-50 shadow-lg shadow-sky-500/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Synchronizing Directory..." : "Trigger Manual STI WNU Sync Now"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 3: Database Snapshots & Disaster Recovery ────────── */}
      <AdminSection
        title="Disaster Recovery & Database Snapshots"
        description="Point-in-time PostgreSQL database snapshots and staging recovery testing."
        action={
          <button
            type="button"
            disabled={isBackingUp}
            onClick={() => void handleCreateBackup()}
            className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-4 py-2 text-xs font-bold text-[#0b1c2c] transition hover:brightness-110 shadow-lg shadow-[#FCD400]/20 disabled:opacity-50"
          >
            <Database className="h-3.5 w-3.5" />
            {isBackingUp ? "Creating..." : "Create Manual Snapshot"}
          </button>
        }
      >
        <AdminTable>
          <table className="min-w-full text-left text-xs">
            <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
              <tr>
                <th className="px-4 py-3">Snapshot File Name</th>
                <th className="px-4 py-3">Size (MB)</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3 text-right">Recovery Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {backups.map((bk, idx) => (
                <tr key={bk.id ? `bk-${bk.id}-${idx}` : `bk-idx-${idx}`} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 font-mono text-white font-bold">{bk.fileName}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{bk.fileSizeMb} MB</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                      {bk.backupType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{bk.createdBy}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {bk.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono">{formatDateTime(bk.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setRestoreModalBackup(bk)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Verify / Restore
                    </button>
                  </td>
                </tr>
              ))}

              {backups.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No database snapshots recorded yet. Click &quot;Create Manual Snapshot&quot; to generate one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>

      {/* ── RESTORE MODAL ────────────────────────────────────────────── */}
      {restoreModalBackup && (
        <AdminModal
          open={!!restoreModalBackup}
          onClose={() => setRestoreModalBackup(null)}
          title="Disaster Recovery Snapshot Verification"
          description={`Verify and dry-run recovery for snapshot ${restoreModalBackup.fileName}`}
        >
          <div className="space-y-4 text-xs text-slate-300">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <ShieldCheck className="h-4 w-4" />
                <span>Disaster Recovery Dry-Run Verification</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Snapshot <strong className="text-white font-mono">{restoreModalBackup.fileName}</strong> ({restoreModalBackup.fileSizeMb} MB) will be integrity-checked against current schema definitions.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setRestoreModalBackup(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => void handleRestore()}
                className="rounded-xl bg-[#FCD400] px-5 py-2 text-xs font-bold text-[#0b1c2c] hover:brightness-110 shadow-lg shadow-[#FCD400]/20 disabled:opacity-50"
              >
                {isRestoring ? "Verifying..." : "Run Disaster Recovery Verification"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

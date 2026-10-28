"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FolderSync,
  History,
  Lock,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
  Smartphone,
  Unlock,
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

  // Remote Maintenance Mode State
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState("System Maintenance & Update");
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "BookHive is currently undergoing scheduled maintenance and updates. Services are temporarily paused."
  );
  const [maintenanceUntil, setMaintenanceUntil] = useState<string | null>(null);
  const [maintenanceDurationHours, setMaintenanceDurationHours] = useState(1);
  const [minAppVersion, setMinAppVersion] = useState("1.0.9");
  const [latestApkUrl, setLatestApkUrl] = useState(
    "https://expo.dev/artifacts/eas/a3L1Zy4ZsfcYyQgjemhGKXJZwGQw54-073mSl8Jm4eY.apk"
  );
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  const [remainingTimeText, setRemainingTimeText] = useState("");
  const [timerHours, setTimerHours] = useState("01");
  const [timerMinutes, setTimerMinutes] = useState("00");
  const [timerSeconds, setTimerSeconds] = useState("00");

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
        
        const inMaint = Boolean(settingsRes.settings.isMaintenanceMode);
        setIsMaintenanceMode(inMaint);
        if (settingsRes.settings.maintenanceTitle) setMaintenanceTitle(settingsRes.settings.maintenanceTitle);
        if (settingsRes.settings.maintenanceMessage) setMaintenanceMessage(settingsRes.settings.maintenanceMessage);
        if (settingsRes.settings.maintenanceUntil) setMaintenanceUntil(settingsRes.settings.maintenanceUntil);
        if (
          settingsRes.settings.minAppVersion &&
          !["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.0.4"].includes(String(settingsRes.settings.minAppVersion).trim())
        ) {
          setMinAppVersion(settingsRes.settings.minAppVersion);
        }
        if (
          settingsRes.settings.latestApkUrl &&
          !settingsRes.settings.latestApkUrl.includes("mH97U3T7g48Yn3KFtIHH0Uyal0bzBl5MWx5iu39M_uI") &&
          !settingsRes.settings.latestApkUrl.includes("m90mnPT1hrznA0zP1xdm95K-P6ZMwCNdlYIbZ6kO-uQ") &&
          !settingsRes.settings.latestApkUrl.includes("wq4OYzJNpymhY6ysiXCuUri2xPkuZwsavxKd1eAqaoQ") &&
          !settingsRes.settings.latestApkUrl.includes("u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU") &&
          !settingsRes.settings.latestApkUrl.includes("9vqmAP6x6yMOIC_o6J9CLqo8sKcXd0rOtUXxAa7M5UU")
        ) {
          setLatestApkUrl(settingsRes.settings.latestApkUrl);
        }

        if (inMaint && settingsRes.settings.maintenanceUntil) {
          const diffMs = new Date(settingsRes.settings.maintenanceUntil).getTime() - Date.now();
          if (diffMs > 0) {
            const totalSec = Math.floor(diffMs / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            setTimerHours(h.toString().padStart(2, "0"));
            setTimerMinutes(m.toString().padStart(2, "0"));
            setTimerSeconds(s.toString().padStart(2, "0"));
            setRemainingTimeText(
              `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
            );
          }
        }
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

  // Sync preview timer display when not in active maintenance
  useEffect(() => {
    if (!isMaintenanceMode) {
      setTimerHours(maintenanceDurationHours.toString().padStart(2, "0"));
      setTimerMinutes("00");
      setTimerSeconds("00");
      setRemainingTimeText(`${maintenanceDurationHours.toString().padStart(2, "0")}:00:00`);
    }
  }, [maintenanceDurationHours, isMaintenanceMode]);

  // Live countdown timer ticker for active maintenance
  useEffect(() => {
    if (!isMaintenanceMode || !maintenanceUntil) {
      return;
    }

    const updateTimer = () => {
      const diffMs = new Date(maintenanceUntil).getTime() - Date.now();
      if (diffMs <= 0) {
        setTimerHours("00");
        setTimerMinutes("00");
        setTimerSeconds("00");
        setRemainingTimeText("00:00:00");
        void loadSettingsAndBackups();
        return;
      }
      const totalSec = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const padH = h.toString().padStart(2, "0");
      const padM = m.toString().padStart(2, "0");
      const padS = s.toString().padStart(2, "0");
      setTimerHours(padH);
      setTimerMinutes(padM);
      setTimerSeconds(padS);
      setRemainingTimeText(`${padH}:${padM}:${padS}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isMaintenanceMode, maintenanceUntil, loadSettingsAndBackups]);

  // Toggle Remote Maintenance Mode
  async function handleToggleMaintenance() {
    try {
      setIsTogglingMaintenance(true);
      const nextState = !isMaintenanceMode;

      // Instant optimistic UI update so the timer starts immediately on click!
      if (nextState) {
        const optimisticEnd = new Date(Date.now() + maintenanceDurationHours * 3600 * 1000).toISOString();
        setIsMaintenanceMode(true);
        setMaintenanceUntil(optimisticEnd);
        setTimerHours(maintenanceDurationHours.toString().padStart(2, "0"));
        setTimerMinutes("00");
        setTimerSeconds("00");
        setRemainingTimeText(`${maintenanceDurationHours.toString().padStart(2, "0")}:00:00`);
      } else {
        setIsMaintenanceMode(false);
        setMaintenanceUntil(null);
      }

      const res = await requestJson<{ success: boolean; maintenance: any }>("/api/super-admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inMaintenance: nextState,
          title: maintenanceTitle,
          message: maintenanceMessage,
          durationHours: maintenanceDurationHours,
          minVersion: minAppVersion,
          latestApkUrl: latestApkUrl,
        }),
      });

      if (res?.maintenance) {
        setIsMaintenanceMode(Boolean(res.maintenance.inMaintenance));
        setMaintenanceUntil(res.maintenance.until);
      }

      notify(
        nextState
          ? `Remote maintenance lock activated for ${maintenanceDurationHours}h. Live timer running & apps locked.`
          : "Remote maintenance mode deactivated. Mobile applications unlocked.",
        nextState ? "info" : "success"
      );
      void loadSettingsAndBackups();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to toggle maintenance mode.", "error");
      void loadSettingsAndBackups();
    } finally {
      setIsTogglingMaintenance(false);
    }
  }

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

      {/* ── Remote Maintenance Mode & Mobile Update Card ─────────── */}
      <div
        className={`rounded-2xl border p-6 shadow-2xl space-y-6 transition-all ${
          isMaintenanceMode
            ? "border-amber-500/40 bg-gradient-to-br from-[#1c1809] to-[#101D2D] ring-1 ring-amber-500/20"
            : "border-white/10 bg-[#101D2D]"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                isMaintenanceMode
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-sky-500/15 text-sky-400 border border-sky-500/20"
              }`}
            >
              {isMaintenanceMode ? <AlertOctagon className="h-6 w-6 animate-pulse" /> : <Radio className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black text-white tracking-tight">
                  Remote Maintenance Mode & Mobile App Update
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Remotely lock mobile apps with an un-dismissible countdown timer and dispatch the latest APK update link.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMaintenanceMode ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/40 px-3.5 py-1 text-xs font-bold text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                MAINTENANCE ACTIVE ({remainingTimeText || "In Progress"})
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1 text-xs font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                SYSTEM LIVE · CLIENTS OPERATIONAL
              </span>
            )}
          </div>
        </div>

        {/* Live Digital Countdown Timer Section */}
        {isMaintenanceMode ? (
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-[#1a1402] to-amber-500/10 p-5 shadow-inner">
            <div className="flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="space-y-1.5 text-center md:text-left">
                <div className="inline-flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Remote Lockdown Active · {maintenanceDurationHours}h Window</span>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Maintenance Countdown Running
                </h4>
                <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                  Mobile devices are restricted to the maintenance screen. Students see your broadcast message and can tap to download update v{minAppVersion}.
                  {maintenanceUntil && (
                    <span className="block text-amber-200/90 font-mono mt-1 text-[11px]">
                      Scheduled Completion: {formatDateTime(maintenanceUntil)}
                    </span>
                  )}
                </p>
              </div>

              {/* Big Digital Clock Display */}
              <div className="flex items-center gap-2 bg-[#060d16] border border-amber-500/30 p-3 rounded-2xl shadow-xl">
                <div className="flex flex-col items-center bg-[#0d1b2a] border border-amber-500/20 rounded-xl px-4 py-2 min-w-[72px]">
                  <span className="font-mono text-3xl font-black text-white">{timerHours}</span>
                  <span className="text-[9px] font-black text-amber-400 tracking-widest mt-0.5">HOURS</span>
                </div>
                <span className="text-2xl font-black text-amber-400 font-mono pb-4">:</span>
                <div className="flex flex-col items-center bg-[#0d1b2a] border border-amber-500/20 rounded-xl px-4 py-2 min-w-[72px]">
                  <span className="font-mono text-3xl font-black text-white">{timerMinutes}</span>
                  <span className="text-[9px] font-black text-amber-400 tracking-widest mt-0.5">MINUTES</span>
                </div>
                <span className="text-2xl font-black text-amber-400 font-mono pb-4">:</span>
                <div className="flex flex-col items-center bg-[#0d1b2a] border border-amber-500/20 rounded-xl px-4 py-2 min-w-[72px]">
                  <span className="font-mono text-3xl font-black text-amber-300">{timerSeconds}</span>
                  <span className="text-[9px] font-black text-amber-400 tracking-widest mt-0.5">SECONDS</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-300">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-slate-200">Selected Lockdown Window: {maintenanceDurationHours} Hour{maintenanceDurationHours > 1 ? "s" : ""}</span>
                <p className="text-[11px] text-slate-400">Activating will immediately broadcast a {maintenanceDurationHours}-hour countdown timer to all student phones.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs bg-black/30 border border-white/10 px-3 py-1.5 rounded-lg text-slate-300">
              <span className="text-slate-400">Timer Preview:</span>
              <strong className="text-white font-bold">{timerHours}:{timerMinutes}:{timerSeconds}</strong>
            </div>
          </div>
        )}

        {/* Configuration Fields */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <FieldLabel>Duration Preset</FieldLabel>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {[1, 2, 4, 8].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  disabled={isMaintenanceMode}
                  onClick={() => setMaintenanceDurationHours(hrs)}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    maintenanceDurationHours === hrs
                      ? "bg-[#FCD400] text-slate-950 border-[#FCD400]"
                      : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                  } disabled:opacity-50`}
                >
                  {hrs}h
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Target Min App Version</FieldLabel>
            <input
              type="text"
              value={minAppVersion}
              onChange={(e) => setMinAppVersion(e.target.value)}
              placeholder="e.g. 1.0.2"
              className="glass-input w-full p-2.5 mt-1 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Latest APK Artifact URL (One-Tap Download Link)</FieldLabel>
            <input
              type="url"
              value={latestApkUrl}
              onChange={(e) => setLatestApkUrl(e.target.value)}
              placeholder="https://expo.dev/artifacts/eas/...apk"
              className="glass-input w-full p-2.5 mt-1 text-xs font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Maintenance Notice Title</FieldLabel>
            <input
              type="text"
              value={maintenanceTitle}
              onChange={(e) => setMaintenanceTitle(e.target.value)}
              className="glass-input w-full p-2.5 mt-1 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Maintenance Notice Message (Broadcast to Phones)</FieldLabel>
            <input
              type="text"
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              className="glass-input w-full p-2.5 mt-1 text-xs"
            />
          </div>
        </div>

        {/* Action Toggle Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/8">
          <span className="text-[11px] text-slate-400">
            {isMaintenanceMode
              ? "Ending maintenance will immediately broadcast unlock signals to all connected student phones."
              : `Activating will immediately broadcast a ${maintenanceDurationHours}-hour lockdown with update download link.`}
          </span>

          <button
            type="button"
            disabled={isTogglingMaintenance}
            onClick={() => void handleToggleMaintenance()}
            className={`flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-black transition shadow-lg disabled:opacity-50 ${
              isMaintenanceMode
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20"
                : "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20"
            }`}
          >
            {isMaintenanceMode ? (
              <>
                <Unlock className="h-4 w-4" />
                {isTogglingMaintenance ? "Unlocking Mobile Apps..." : "End Maintenance & Unlock Mobile Apps Now"}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                {isTogglingMaintenance
                  ? "Broadcasting Lock..."
                  : `Activate ${maintenanceDurationHours}h Maintenance Lock & Broadcast to Apps`}
              </>
            )}
          </button>
        </div>
      </div>

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

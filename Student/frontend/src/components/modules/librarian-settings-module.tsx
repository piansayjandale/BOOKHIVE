"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Layers3, RefreshCcw, Shield, SlidersHorizontal } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import type { SystemPreference } from "@/lib/types";

export function LibrarianSettingsModule() {
  const { user } = useSession();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<SystemPreference | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    const payload = (await response.json()) as { settings: SystemPreference };
    startTransition(() => setSettings(payload.settings));
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) {
      return;
    }

    setSettingsSaving(true);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });
    const payload = (await response.json()) as { settings: SystemPreference };
    setSettings(payload.settings);
    setTheme(payload.settings.theme);
    setSettingsSaving(false);
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="flex h-full flex-col gap-6 px-1">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">
            Librarian · Settings
          </p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">
            System Settings
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Adjust borrowing defaults, keep the interface theme aligned, and manage the operational preferences that sync directly with the shared BookHive backend.
          </p>
        </div>
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => void loadSettings()}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Main Layout Grid ────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        
        {/* ── Left Column: Circulation Preferences ────────────── */}
        <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#6EE7B7] uppercase">
                Operational Sync
              </p>
              <h2 className="mt-1 text-xl font-bold text-white tracking-tight">Circulation preferences</h2>
              <p className="mt-1 text-xs text-slate-400">
                Changes here are reflected across the librarian and admin workspaces in the shared system.
              </p>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={saveSettings}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Theme</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={settings.theme}
                  onChange={(event) =>
                    setSettings((current) =>
                      current
                        ? { ...current, theme: event.target.value as SystemPreference["theme"] }
                        : current,
                    )
                  }
                >
                  <option value="dark" className="bg-[#0F1D29]">Dark</option>
                  <option value="light" className="bg-[#0F1D29]">Light</option>
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">AI Engine</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={settings.aiEngine}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, aiEngine: event.target.value } : current,
                    )
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Borrow Limit</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={settings.borrowLimit}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, borrowLimit: Number(event.target.value) } : current,
                    )
                  }
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Borrow Duration</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={settings.borrowDurationDays}
                  onChange={(event) =>
                    setSettings((current) =>
                      current
                        ? { ...current, borrowDurationDays: Number(event.target.value) }
                        : current,
                    )
                  }
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Storage Used %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={settings.storageUsedPercent}
                  onChange={(event) =>
                    setSettings((current) =>
                      current
                        ? { ...current, storageUsedPercent: Number(event.target.value) }
                        : current,
                    )
                  }
                />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Indexing Status</span>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                value={settings.indexingStatus}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          indexingStatus: event.target.value as SystemPreference["indexingStatus"],
                        }
                      : current,
                  )
                }
              >
                {["Healthy", "Rebuilding", "Delayed"].map((option) => (
                  <option key={option} value={option} className="bg-[#0F1D29]">
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={settingsSaving}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#FCD400] px-5 py-3 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50 mt-2"
            >
              {settingsSaving ? "Saving..." : "Save Preferences"}
            </button>
          </form>

          {/* Form metrics indicators */}
          <div className="mt-4 grid gap-3 grid-cols-3">
            {[
              { label: "Borrow Limit", value: `${settings.borrowLimit} books`, color: "#6EE7B7" },
              { label: "Borrow Duration", value: `${settings.borrowDurationDays} days`, color: "#FCD400" },
              { label: "Indexing", value: settings.indexingStatus, color: "#C4B5FD" },
            ].map((item) => (
              <div key={item.label}
                className="rounded-xl border border-white/8 bg-[#152E47]/60 px-4 py-3 backdrop-blur"
                style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
              >
                <p className="text-[9px] font-bold tracking-[0.18em] text-slate-400 uppercase">{item.label}</p>
                <p className="mt-0.5 text-base font-black text-white whitespace-nowrap">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Column: Identity Details & Access Scope ───── */}
        <div className="grid gap-6">
          
          {/* Identity details */}
          <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur p-6 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-[#93C5FD] uppercase">Profile</p>
                <h2 className="mt-1 text-xl font-bold text-white tracking-tight">Connected librarian identity</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Session-aware profile details for the currently active librarian account.
                </p>
              </div>
              <Shield className="h-4 w-4 text-slate-500 mt-1" />
            </div>

            <div className="mt-2 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#60a5fa,#38bdf8)] text-lg font-black text-white shadow-md">
                {user?.avatar ?? "LB"}
              </div>
              <div>
                <p className="text-lg font-bold text-white">{user?.name ?? "Library Staff"}</p>
                <p className="mt-0.5 text-xs text-slate-400">{user?.email ?? "librarian@stiwnu.edu.ph"}</p>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-[#152E47]/60 px-4 py-3 backdrop-blur">
                <p className="text-[9px] font-bold tracking-[0.18em] text-slate-400 uppercase">Role</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{user?.role ?? "Librarian"}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-[#152E47]/60 px-4 py-3 backdrop-blur">
                <p className="text-[9px] font-bold tracking-[0.18em] text-slate-400 uppercase">Theme Mode</p>
                <p className="mt-0.5 text-sm font-semibold text-white capitalize">{settings.theme}</p>
              </div>
            </div>
          </div>

          {/* Access scope */}
          <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur p-6 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-amber-400 uppercase">Access Scope</p>
                <h2 className="mt-1 text-xl font-bold text-white tracking-tight">Operational permissions</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Shared backend capabilities available from the librarian workspace.
                </p>
              </div>
              <SlidersHorizontal className="h-4 w-4 text-slate-500 mt-1" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Manage records and update catalog metadata",
                "Process borrowing, returns, and reservations",
                "Publish announcements for students and staff",
                "Review reports and audit history in real time",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/8 bg-white/5 p-4 hover:bg-white/[0.07] transition-all">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300">
                      <Layers3 className="h-4 w-4" />
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300 font-medium">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

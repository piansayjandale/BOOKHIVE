"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Layers3, Shield, SlidersHorizontal } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { Badge } from "@/components/ui/badge";
import { ModuleHeader } from "@/components/ui/module-header";
import { Panel } from "@/components/ui/panel";
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
    <div className="space-y-8">
      <ModuleHeader
        eyebrow="Settings"
        title="Operational settings and librarian profile controls"
        description="Adjust borrowing defaults, keep the interface theme aligned, and manage the operational preferences that sync directly with the shared BookHive backend."
      />

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Panel className="p-6">
          <Badge tone="success">Operational Sync</Badge>
          <h2 className="mt-4 text-2xl font-semibold text-white">Circulation preferences</h2>
          <p className="mt-2 text-sm text-white/60">
            Changes here are reflected across the librarian and admin workspaces in the shared system.
          </p>

          <form className="mt-6 grid gap-4" onSubmit={saveSettings}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Theme</span>
                <select
                  className="glass-input rounded-2xl px-4 py-3"
                  value={settings.theme}
                  onChange={(event) =>
                    setSettings((current) =>
                      current
                        ? { ...current, theme: event.target.value as SystemPreference["theme"] }
                        : current,
                    )
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/65">AI Engine</span>
                <input
                  className="glass-input rounded-2xl px-4 py-3"
                  value={settings.aiEngine}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, aiEngine: event.target.value } : current,
                    )
                  }
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Borrow Limit</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="glass-input rounded-2xl px-4 py-3"
                  value={settings.borrowLimit}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, borrowLimit: Number(event.target.value) } : current,
                    )
                  }
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/65">Borrow Duration</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="glass-input rounded-2xl px-4 py-3"
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

              <label className="grid gap-2">
                <span className="text-sm text-white/65">Storage Used %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="glass-input rounded-2xl px-4 py-3"
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

            <label className="grid gap-2">
              <span className="text-sm text-white/65">Indexing Status</span>
              <select
                className="glass-input rounded-2xl px-4 py-3"
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
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={settingsSaving}
              className="rounded-2xl bg-[linear-gradient(135deg,#57c3ff,#2563eb)] px-5 py-3 text-sm font-semibold text-white"
            >
              {settingsSaving ? "Saving..." : "Save Preferences"}
            </button>
          </form>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              { label: "Borrow Limit", value: `${settings.borrowLimit} books` },
              { label: "Borrow Duration", value: `${settings.borrowDurationDays} days` },
              { label: "Indexing", value: settings.indexingStatus },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge>Profile</Badge>
                <h2 className="mt-4 text-2xl font-semibold text-white">Connected librarian identity</h2>
                <p className="mt-2 text-sm text-white/60">
                  Session-aware profile details for the currently active librarian account.
                </p>
              </div>
              <Shield className="h-5 w-5 text-white/40" />
            </div>

            <div className="mt-6 rounded-[28px] border border-white/8 bg-black/15 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#60a5fa,#38bdf8)] text-lg font-semibold text-white">
                  {user?.avatar ?? "LB"}
                </div>
                <div>
                  <p className="text-2xl font-semibold text-white">{user?.name ?? "Library Staff"}</p>
                  <p className="mt-1 text-sm text-white/55">{user?.email ?? "librarian@stiwnu.edu.ph"}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Role</p>
                  <p className="mt-2 text-lg font-semibold text-white">{user?.role ?? "Librarian"}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Theme Mode</p>
                  <p className="mt-2 text-lg font-semibold text-white">{settings.theme}</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone="warning">Access Scope</Badge>
                <h2 className="mt-4 text-2xl font-semibold text-white">Operational permissions</h2>
                <p className="mt-2 text-sm text-white/60">
                  Shared backend capabilities available from the librarian workspace.
                </p>
              </div>
              <SlidersHorizontal className="h-5 w-5 text-white/40" />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                "Manage records and update catalog metadata",
                "Process borrowing, returns, and reservations",
                "Publish announcements for students and staff",
                "Review reports and audit history in real time",
              ].map((item) => (
                <div key={item} className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-black/20">
                      <Layers3 className="h-4 w-4 text-sky-300" />
                    </div>
                    <p className="text-sm leading-7 text-white/65">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

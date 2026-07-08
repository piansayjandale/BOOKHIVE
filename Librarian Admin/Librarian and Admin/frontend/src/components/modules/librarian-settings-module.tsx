"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Layers3, RefreshCcw, Shield, SlidersHorizontal } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import type { SystemPreference } from "@/lib/types";

export function LibrarianSettingsModule() {
  const { user, setUser } = useSession();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<SystemPreference | null>(null);
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    phone: string;
    bio: string;
    department: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, profileRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/profile"),
      ]);
      const settingsPayload = (await settingsRes.json()) as { settings: SystemPreference };
      const profilePayload = (await profileRes.json()) as {
        id: string;
        name: string;
        email: string;
        phone: string;
        bio: string;
        department: string;
        avatar: string;
      };

      startTransition(() => {
        setSettings(settingsPayload.settings);
        setProfile({
          name: profilePayload.name,
          email: profilePayload.email,
          phone: profilePayload.phone,
          bio: profilePayload.bio,
          department: profilePayload.department,
        });
      });
    } catch (err) {
      console.error("Failed to load settings data", err);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveProfileAndSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || !profile) {
      return;
    }

    setSaving(true);
    try {
      const [settingsRes, profileRes] = await Promise.all([
        fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }),
        fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        }),
      ]);

      const settingsPayload = (await settingsRes.json()) as { settings: SystemPreference };
      const profilePayload = (await profileRes.json()) as {
        id: string;
        name: string;
        email: string;
        phone: string;
        bio: string;
        department: string;
        avatar: string;
      };

      setSettings(settingsPayload.settings);
      setTheme(settingsPayload.settings.theme);

      setProfile({
        name: profilePayload.name,
        email: profilePayload.email,
        phone: profilePayload.phone,
        bio: profilePayload.bio,
        department: profilePayload.department,
      });

      if (user) {
        setUser({
          ...user,
          name: profilePayload.name,
          email: profilePayload.email,
          avatar: profilePayload.avatar,
        });
      }
    } catch (err) {
      console.error("Failed to save data", err);
    } finally {
      setSaving(false);
    }
  }

  if (!settings || !profile) {
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
            Adjust your personal details, biography, contact information, and workspace appearance.
          </p>
        </div>
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => void loadData()}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Main Layout Grid ────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        
        {/* ── Left Column: Profile Settings ────────────── */}
        <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#6EE7B7] uppercase">
                Librarian Identity
              </p>
              <h2 className="mt-1 text-xl font-bold text-white tracking-tight">Profile settings</h2>
              <p className="mt-1 text-xs text-slate-400">
                Update your name, email, contact details, biography, and theme preference.
              </p>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={saveProfileAndSettings}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Full Name</span>
                <input
                  type="text"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Email Address</span>
                <input
                  type="email"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={profile.email}
                  onChange={(event) =>
                    setProfile((current) =>
                      current ? { ...current, email: event.target.value } : current,
                    )
                  }
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Phone Number</span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={profile.phone}
                  onChange={(event) =>
                    setProfile((current) =>
                      current ? { ...current, phone: event.target.value } : current,
                    )
                  }
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Theme Mode</span>
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
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Biography</span>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none transition-colors resize-none"
                placeholder="Tell us about yourself..."
                value={profile.bio}
                onChange={(event) =>
                  setProfile((current) =>
                    current ? { ...current, bio: event.target.value } : current,
                  )
                }
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#FCD400] px-5 py-3 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50 mt-2 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Profile & Settings"}
            </button>
          </form>
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

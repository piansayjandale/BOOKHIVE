"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PencilLine, Plus, Shield, Trash2 } from "lucide-react";

import { useTheme } from "@/components/providers/theme-provider";
import { Badge } from "@/components/ui/badge";
import { ModuleHeader } from "@/components/ui/module-header";
import { Panel } from "@/components/ui/panel";
import { VirtualizedList } from "@/components/ui/virtualized-list";
import type { Department, Role, SystemPreference, SystemUser } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const emptyUserForm = {
  name: "",
  email: "",
  role: "Student" as Role,
  department: "Computer Science" as Department,
  status: "Active" as SystemUser["status"],
};

export function SettingsModule() {
  const [settings, setSettings] = useState<SystemPreference | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "All">("All");
  const deferredSearch = useDeferredValue(search);
  const { setTheme } = useTheme();

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    const payload = (await response.json()) as { settings: SystemPreference };
    startTransition(() => setSettings(payload.settings));
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({
      search: deferredSearch,
      role: roleFilter,
    });
    const response = await fetch(`/api/users?${params.toString()}`);
    const payload = (await response.json()) as { users: SystemUser[] };
    startTransition(() => setUsers(payload.users));
  }, [deferredSearch, roleFilter]);

  useEffect(() => {
    void Promise.all([loadSettings(), loadUsers()]);
  }, [loadSettings, loadUsers]);

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

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const endpoint = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
    const method = editingUserId ? "PUT" : "POST";

    await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userForm),
    });

    setUserForm(emptyUserForm);
    setEditingUserId(null);
    await loadUsers();
  }

  function editUser(user: SystemUser) {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      status: user.status,
    });
  }

  async function deleteUser(id: string) {
    await fetch(`/api/users/${id}`, {
      method: "DELETE",
    });
    await loadUsers();
    if (editingUserId === id) {
      setEditingUserId(null);
      setUserForm(emptyUserForm);
    }
  }

  const userCounts = useMemo(
    () => ({
      admins: users.filter((user) => user.role === "Admin").length,
      librarians: users.filter((user) => user.role === "Librarian").length,
      students: users.filter((user) => user.role === "Student").length,
    }),
    [users],
  );

  if (!settings) {
    return null;
  }

  return (
    <div className="space-y-8">
      <ModuleHeader
        eyebrow="Settings"
        title="System preferences and account access control"
        description="Tune borrowing rules, switch themes, manage indexing health, and maintain role-based BookHive accounts for admins, librarians, and students."
      />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <Panel className="p-6">
          <Badge tone="success">System Preferences</Badge>
          <h2 className="mt-4 text-2xl font-semibold text-[var(--module-title-color)]">Operational controls</h2>
          <form className="mt-6 grid gap-4" onSubmit={saveSettings}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Theme</span>
                <select
                  className="glass-input rounded-2xl px-4 py-3"
                  value={settings.theme}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, theme: event.target.value as SystemPreference["theme"] } : current,
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
              { label: "Admins", value: userCounts.admins.toString() },
              { label: "Librarians", value: userCounts.librarians.toString() },
              { label: "Students", value: userCounts.students.toString() },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--module-muted-2)]">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--module-title-color)]">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge>Account Management</Badge>
              <h2 className="mt-4 text-2xl font-semibold text-white">RBAC user directory</h2>
              <p className="mt-2 text-sm text-white/60">
                Maintain admin, librarian, and student access with searchable role filters.
              </p>
            </div>
            <Shield className="h-5 w-5 text-white/40" />
          </div>

          <form className="mt-6 grid gap-4 rounded-[28px] border border-white/8 bg-black/15 p-4" onSubmit={saveUser}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Name</span>
                <input
                  className="glass-input rounded-2xl px-4 py-3"
                  value={userForm.name}
                  onChange={(event) =>
                    setUserForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Email</span>
                <input
                  type="email"
                  className="glass-input rounded-2xl px-4 py-3"
                  value={userForm.email}
                  onChange={(event) =>
                    setUserForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Role</span>
                <select
                  className="glass-input rounded-2xl px-4 py-3"
                  value={userForm.role}
                  onChange={(event) =>
                    setUserForm((current) => ({ ...current, role: event.target.value as Role }))
                  }
                >
                  {["Admin", "Librarian", "Student"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Department</span>
                <select
                  className="glass-input rounded-2xl px-4 py-3"
                  value={userForm.department}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      department: event.target.value as Department,
                    }))
                  }
                >
                  {[
                    "Computer Science",
                    "Engineering",
                    "Education",
                    "Business & Accountancy",
                    "Arts & Sciences",
                  ].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Status</span>
                <select
                  className="glass-input rounded-2xl px-4 py-3"
                  value={userForm.status}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      status: event.target.value as SystemUser["status"],
                    }))
                  }
                >
                  {["Active", "Suspended"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#57c3ff,#2563eb)] px-5 py-3 text-sm font-semibold text-white"
              >
                {editingUserId ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingUserId ? "Update Account" : "Add Account"}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/6 px-5 py-3 text-sm font-semibold text-white/75"
                onClick={() => {
                  setEditingUserId(null);
                  setUserForm(emptyUserForm);
                }}
              >
                Reset
              </button>
            </div>
          </form>

          <div className="mt-6 grid gap-3 xl:grid-cols-[1fr_180px]">
            <input
              className="glass-input rounded-2xl px-4 py-3"
              placeholder="Search name, email, role, or department"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="glass-input rounded-2xl px-4 py-3"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as Role | "All")}
            >
              {["All", "Admin", "Librarian", "Student"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/8 bg-black/15 p-3">
            <VirtualizedList
              items={users}
              height={470}
              itemHeight={120}
              renderItem={(user) => (
                <div className="h-[120px] px-2 py-2">
                  <div className="flex h-full flex-col rounded-[24px] border border-white/8 bg-white/4 p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-white">{user.name}</p>
                        <Badge tone={user.status === "Active" ? "success" : "danger"}>
                          {user.status}
                        </Badge>
                        <Badge>{user.role}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-white/60">
                        {user.email} • {user.department}
                      </p>
                      <p className="mt-2 text-xs text-white/45">
                        Last active {formatDateTime(user.lastActive)}
                      </p>
                    </div>

                    <div className="mt-4 flex gap-2 lg:mt-0">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/15 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200"
                        onClick={() => editUser(user)}
                      >
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200"
                        onClick={() => void deleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

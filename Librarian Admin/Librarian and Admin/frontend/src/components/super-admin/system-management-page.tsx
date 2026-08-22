"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Edit2,
  HardDrive,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Zap,
} from "lucide-react";

import { AdminModal, AdminPageHeader, AdminSection, AdminTable, FieldLabel } from "@/components/admin/shared";
import { useNotice } from "@/components/providers/notice-provider";
import { requestJson } from "@/lib/admin/client";
import type { SuperAdminUserRecord } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const ALL_ROLES = [
  "Super Admin",
  "Admin",
  "Circulation Librarian",
  "Technical Librarian",
  "Student",
];

const emptyUserForm = {
  name: "",
  email: "",
  idNumber: "",
  role: "Student",
  department: "General",
  course: "General",
  status: "Active",
  password: "",
};

export function SystemManagementPage() {
  const { notify } = useNotice();
  const [isPending, startTransition] = useTransition();

  // Tab navigation
  const [activeTab, setActiveTab] = useState<"accounts" | "pruning" | "infrastructure">("accounts");

  // Accounts state
  const [users, setUsers] = useState<SuperAdminUserRecord[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SuperAdminUserRecord | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<SuperAdminUserRecord | null>(null);

  // Pruning state
  const [pruneConfirmType, setPruneConfirmType] = useState<"books" | "accounts" | null>(null);
  const [isPruning, setIsPruning] = useState(false);

  // Infrastructure state
  const [infraData, setInfraData] = useState<any>(null);
  const [isReindexing, setIsReindexing] = useState(false);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      const query = `/api/super-admin/users?role=${encodeURIComponent(roleFilter)}&status=${encodeURIComponent(statusFilter)}&search=${encodeURIComponent(search)}&page=${page}&pageSize=10`;
      const res = await requestJson<{ users: SuperAdminUserRecord[]; total: number }>(query);
      startTransition(() => {
        setUsers(res.users || []);
        setTotalUsers(res.total || 0);
      });
    } catch (err) {
      console.warn("Failed to load users:", err);
    }
  }, [roleFilter, statusFilter, search, page]);

  // Load infrastructure
  const loadInfrastructure = useCallback(async () => {
    try {
      const res = await requestJson("/api/super-admin/infrastructure");
      setInfraData(res);
    } catch (err) {
      console.warn("Failed to load infrastructure telemetry:", err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "accounts") void loadUsers();
    if (activeTab === "infrastructure") void loadInfrastructure();
  }, [activeTab, loadUsers, loadInfrastructure]);

  // User CRUD Handlers
  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingUser) {
        await requestJson(`/api/super-admin/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userForm),
        });
        notify(`Account for ${userForm.name} updated successfully.`, "success");
      } else {
        await requestJson("/api/super-admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userForm),
        });
        notify(`Account for ${userForm.name} created successfully.`, "success");
      }
      setUserModalOpen(false);
      setEditingUser(null);
      setUserForm(emptyUserForm);
      void loadUsers();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to save user account.", "error");
    }
  }

  async function handleDeleteUser() {
    if (!deleteConfirmUser) return;
    try {
      await requestJson(`/api/super-admin/users/${deleteConfirmUser.id}`, {
        method: "DELETE",
      });
      notify(`Account ${deleteConfirmUser.name} deleted permanently.`, "success");
      setDeleteConfirmUser(null);
      void loadUsers();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to delete user.", "error");
    }
  }

  // Pruning Handlers
  async function handlePrune(type: "books" | "accounts") {
    try {
      setIsPruning(true);
      const url = type === "books" ? "/api/super-admin/pruning/books" : "/api/super-admin/pruning/accounts";
      const res = await requestJson<{ purgedCount: number }>(url, { method: "POST" });
      notify(`Permanent purge completed: ${res.purgedCount} records deleted.`, "success");
      setPruneConfirmType(null);
      void loadUsers();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Pruning failed.", "error");
    } finally {
      setIsPruning(false);
    }
  }

  // Reindex handler
  async function handleReindex() {
    try {
      setIsReindexing(true);
      await requestJson("/api/super-admin/infrastructure/rebuild-index", { method: "POST" });
      notify("Catalog search and vector index rebuilt successfully.", "success");
      void loadInfrastructure();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Reindex failed.", "error");
    } finally {
      setIsReindexing(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Super Admin · System Management"
        title="Platform Governance & Control"
        description="Comprehensive account lifecycle management, database data pruning, and platform infrastructure health."
      />

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[var(--line)] pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={cn(
            "pb-3 text-sm font-semibold transition relative whitespace-nowrap",
            activeTab === "accounts" ? "text-white font-bold" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#FCD400]" />
            Account Management & CRUD
          </div>
          {activeTab === "accounts" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FCD400]" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pruning")}
          className={cn(
            "pb-3 text-sm font-semibold transition relative whitespace-nowrap",
            activeTab === "pruning" ? "text-white font-bold" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-rose-400" />
            Data Pruning & Retention
          </div>
          {activeTab === "pruning" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FCD400]" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("infrastructure")}
          className={cn(
            "pb-3 text-sm font-semibold transition relative whitespace-nowrap",
            activeTab === "infrastructure" ? "text-white font-bold" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-sky-400" />
            Infrastructure Health & Telemetry
          </div>
          {activeTab === "infrastructure" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FCD400]" />}
        </button>
      </div>

      {/* ── TAB 1: ACCOUNTS CRUD ───────────────────────────────────────── */}
      {activeTab === "accounts" && (
        <AdminSection
          title="User Accounts Management"
          description="Create, view, update roles, or deactivate accounts for all platform user types."
          action={
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setUserForm(emptyUserForm);
                setUserModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-4 py-2 text-xs font-bold text-[#0b1c2c] transition hover:brightness-110 shadow-lg shadow-[#FCD400]/20"
            >
              <UserPlus className="h-4 w-4" />
              Create Account
            </button>
          }
        >
          {/* Filters */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, ID number..."
                className="glass-input w-full pl-9 pr-3 py-2 text-xs"
              />
            </div>

            <div>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="glass-input w-full px-3 py-2 text-xs"
              >
                <option value="All" className="bg-[#101D2D] text-white">All Roles</option>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r} className="bg-[#101D2D] text-white">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="glass-input w-full px-3 py-2 text-xs"
              >
                <option value="All" className="bg-[#101D2D] text-white">All Statuses</option>
                <option value="Active" className="bg-[#101D2D] text-white">Active</option>
                <option value="Suspended" className="bg-[#101D2D] text-white">Suspended / Deactivated</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <AdminTable>
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">ID Number</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department / Course</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {users.map((user, idx) => (
                  <tr key={user.id ? `u-${user.id}-${idx}` : `u-idx-${idx}`} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{user.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{user.idNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          user.role.includes("Super Admin")
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : user.role.includes("Admin")
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : user.role.includes("Librarian")
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        )}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div>{user.department}</div>
                      <div className="text-[10px] text-slate-400">{user.course}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          user.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        )}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(user);
                            setUserForm({
                              name: user.name,
                              email: user.email,
                              idNumber: user.idNumber,
                              role: user.role,
                              department: user.department || "General",
                              course: user.course || "General",
                              status: user.status,
                              password: "",
                            });
                            setUserModalOpen(true);
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
                          title="Edit Account"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-[#FCD400]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmUser(user)}
                          className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                          title="Delete Account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No user accounts found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      )}

      {/* ── TAB 2: DATA PRUNING ────────────────────────────────────────── */}
      {activeTab === "pruning" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/10 p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanent Data Retention & Pruning Controls</h3>
                <p className="text-xs text-rose-200/80">Irreversible maintenance procedures to purge dormant or obsolete records.</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Purge Archived Books */}
              <div className="rounded-xl border border-white/10 bg-[#101D2D] p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Purge Archived Books</span>
                    <Trash2 className="h-4 w-4 text-rose-400" />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Permanently delete all book records marked as <strong className="text-white">Archived</strong> from the PostgreSQL database. This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPruneConfirmType("books")}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/15 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500 hover:text-white"
                >
                  Purge Archived Books Now
                </button>
              </div>

              {/* Purge Deactivated Accounts */}
              <div className="rounded-xl border border-white/10 bg-[#101D2D] p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Purge Deactivated Accounts</span>
                    <UserX className="h-4 w-4 text-rose-400" />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Permanently remove all user accounts in <strong className="text-white">Suspended</strong> status along with their associated session tokens.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPruneConfirmType("accounts")}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/15 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500 hover:text-white"
                >
                  Purge Deactivated Accounts Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: INFRASTRUCTURE HEALTH ───────────────────────────────── */}
      {activeTab === "infrastructure" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Server Specifications */}
            <div className="rounded-2xl border border-white/10 bg-[#101D2D] p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-white/8 pb-3">
                <Cpu className="h-5 w-5 text-[#FCD400]" />
                Server Environment
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Hostname</span>
                  <span suppressHydrationWarning className="font-mono text-white font-bold">{infraData?.hostname || "bookhive-srv-01"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Platform OS</span>
                  <span suppressHydrationWarning className="font-mono text-white">{infraData?.platform || "win32"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">CPU Cores</span>
                  <span suppressHydrationWarning className="font-bold text-white">{infraData?.cpus || 8} Cores</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Uptime</span>
                  <span suppressHydrationWarning className="font-mono text-emerald-400 font-bold">{Math.floor((infraData?.uptimeSeconds || 3600) / 60)} mins</span>
                </div>
              </div>
            </div>

            {/* Database Engine Pool */}
            <div className="rounded-2xl border border-white/10 bg-[#101D2D] p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-white/8 pb-3">
                <Database className="h-5 w-5 text-sky-400" />
                PostgreSQL Connection Pool
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Engine Version</span>
                  <span className="font-bold text-white">PostgreSQL 16 (pgcrypto)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Pool Capacity</span>
                  <span className="font-mono text-white">{infraData?.database?.poolSize ?? 10} connections</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Idle Connections</span>
                  <span className="font-mono text-emerald-400">{infraData?.database?.idleConnections ?? 5} ready</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Queue Status</span>
                  <span className="font-mono text-slate-300">{infraData?.database?.waitingClients ?? 0} waiting</span>
                </div>
              </div>
            </div>

            {/* AI Search & Neural Index */}
            <div className="rounded-2xl border border-white/10 bg-[#101D2D] p-6 space-y-4 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 text-white font-bold text-sm border-b border-white/8 pb-3">
                  <Zap className="h-5 w-5 text-violet-400" />
                  Neural Search Index
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Engine</span>
                    <span className="font-bold text-white">{infraData?.searchIndex?.engine || "BookHive AI"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Index Status</span>
                    <span className="font-bold text-emerald-400">{infraData?.searchIndex?.status || "Healthy"}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isReindexing}
                onClick={() => void handleReindex()}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-violet-500/20 border border-violet-500/30 py-2.5 text-xs font-bold text-violet-300 hover:bg-violet-500 hover:text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isReindexing ? "animate-spin" : ""}`} />
                {isReindexing ? "Rebuilding..." : "Rebuild Catalog Search Index"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT USER MODAL ───────────────────────────────────── */}
      {userModalOpen && (
        <AdminModal
          open={userModalOpen}
          onClose={() => {
            setUserModalOpen(false);
            setEditingUser(null);
          }}
          title={editingUser ? "Edit User Account" : "Create New User Account"}
          description={editingUser ? `Update account parameters for ${editingUser.name}` : "Add an administrator, librarian, or student user to the platform."}
        >
          <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Full Name *</FieldLabel>
                <input
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="e.g. Maria Santos"
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                />
              </div>

              <div>
                <FieldLabel>Institutional Email *</FieldLabel>
                <input
                  required
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="e.g. maria.santos@stiwnu.edu.ph"
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                />
              </div>

              <div>
                <FieldLabel>ID Number *</FieldLabel>
                <input
                  required
                  value={userForm.idNumber}
                  onChange={(e) => setUserForm({ ...userForm, idNumber: e.target.value })}
                  placeholder="e.g. ADM-2026-004"
                  className="glass-input w-full p-2.5 mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <FieldLabel>Assigned Role *</FieldLabel>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r} className="bg-[#101D2D] text-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Department</FieldLabel>
                <input
                  value={userForm.department}
                  onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                  placeholder="e.g. Library Services / CS Department"
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                />
              </div>

              <div>
                <FieldLabel>Course / Program</FieldLabel>
                <input
                  value={userForm.course}
                  onChange={(e) => setUserForm({ ...userForm, course: e.target.value })}
                  placeholder="e.g. BS Information Technology"
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                />
              </div>

              <div>
                <FieldLabel>Account Status</FieldLabel>
                <select
                  value={userForm.status}
                  onChange={(e) => setUserForm({ ...userForm, status: e.target.value as "Active" | "Suspended" })}
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                >
                  <option value="Active" className="bg-[#101D2D] text-white">Active</option>
                  <option value="Suspended" className="bg-[#101D2D] text-white">Suspended / Deactivated</option>
                </select>
              </div>

              <div>
                <FieldLabel>{editingUser ? "New Password (optional)" : "Initial Password"}</FieldLabel>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? "Leave blank to keep unchanged" : "Defaults to BookHiveDefault!2026"}
                  className="glass-input w-full p-2.5 mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/8">
              <button
                type="button"
                onClick={() => {
                  setUserModalOpen(false);
                  setEditingUser(null);
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#FCD400] px-5 py-2 text-xs font-bold text-[#0b1c2c] hover:brightness-110 shadow-lg shadow-[#FCD400]/20"
              >
                {editingUser ? "Save Changes" : "Create Account"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* ── DELETE USER CONFIRM MODAL ──────────────────────────────────── */}
      {deleteConfirmUser && (
        <AdminModal
          open={!!deleteConfirmUser}
          onClose={() => setDeleteConfirmUser(null)}
          title="Delete User Account"
          description="Are you sure you want to permanently delete this user?"
        >
          <div className="space-y-4 text-xs text-slate-300">
            <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-rose-300">
              Warning: Permanently removing <strong className="text-white">{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email}) cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteUser()}
                className="rounded-xl bg-rose-500 px-5 py-2 text-xs font-bold text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* ── PRUNING CONFIRM MODAL ──────────────────────────────────────── */}
      {pruneConfirmType && (
        <AdminModal
          open={!!pruneConfirmType}
          onClose={() => setPruneConfirmType(null)}
          title={`Confirm Permanent Purge: ${pruneConfirmType === "books" ? "Archived Books" : "Deactivated Accounts"}`}
          description="This maintenance action will permanently delete matched records from PostgreSQL storage."
        >
          <div className="space-y-4 text-xs text-slate-300">
            <div className="rounded-xl bg-rose-950/40 border border-rose-500/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertTriangle className="h-4 w-4" />
                <span>Irreversible Data Destruction</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                You are about to permanently delete all {pruneConfirmType === "books" ? "books marked as Archived" : "user accounts in Suspended status"}. A database backup is recommended prior to pruning.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isPruning}
                onClick={() => setPruneConfirmType(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPruning}
                onClick={() => void handlePrune(pruneConfirmType)}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {isPruning ? "Purging..." : "Confirm & Purge Now"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

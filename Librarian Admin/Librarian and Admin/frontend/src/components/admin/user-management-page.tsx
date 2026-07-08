"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { Eye, Archive, Plus, Search, UserX, ChevronLeft, ChevronRight, Mail } from "lucide-react";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminModal, AdminPageHeader, AdminSection, AdminTable, FieldLabel } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminUserRecord, AdminUsersPayload } from "@/lib/admin/types";
import { cn, formatDateTime } from "@/lib/utils";

const emptyUserForm = {
  name: "",
  idNumber: "",
  email: "",
  role: "Student",
  department: "Circulation",
  course: "",
};

const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Declined: "bg-red-500/10 text-red-400 border-red-500/20",
  Returned: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    Admin: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Librarian: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    Student: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[role] || "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>
      {role}
    </span>
  );
}

export function UserManagementPage({ tabs }: { tabs?: ReactNode }) {
  const { notify } = useNotice();
  const [payload, setPayload] = useState<AdminUsersPayload | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [form, setForm] = useState(emptyUserForm);
  const deferredSearch = useDeferredValue(search);

  const [studentTxns, setStudentTxns] = useState<any[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const loadStudentTxns = useCallback(async (studentId: string) => {
    setLoadingTxns(true);
    try {
      const res = await requestJson<{ transactions: any[] }>(
        `/api/admin/transactions?status=All&type=All&studentId=${encodeURIComponent(studentId)}`,
      );
      setStudentTxns(res.transactions || []);
    } catch (err) {
      console.error("Failed to load student transactions:", err);
    } finally {
      setLoadingTxns(false);
    }
  }, []);

  useEffect(() => {
    if (open && editingUser && editingUser.role === "Student") {
      void loadStudentTxns(editingUser.idNumber);
      
      const interval = setInterval(() => {
        void loadStudentTxns(editingUser.idNumber);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [open, editingUser, loadStudentTxns]);

  const loadUsers = useCallback(async () => {
    const nextPayload = await requestJson<AdminUsersPayload>(
      `/api/admin/users?search=${encodeURIComponent(deferredSearch)}&role=${encodeURIComponent(role)}&page=${page}&pageSize=8`,
    );
    startTransition(() => setPayload(nextPayload));
  }, [deferredSearch, page, role]);

  useEffect(() => {
    void loadUsers();
    const interval = setInterval(() => {
      void loadUsers();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadUsers]);

  const [inviteEmail, setInviteEmail] = useState("");

  function openInvite() {
    setEditingUser(null);
    setInviteEmail("");
    setOpen(true);
  }

  function openEdit(user: AdminUserRecord) {
    setEditingUser(user);
    setForm({
      name: user.name,
      idNumber: user.idNumber,
      email: user.email,
      role: user.role,
      department: user.department,
      course: user.course,
    });
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingUser) {
      await requestJson(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      notify("User updated successfully.", "success");
    }

    setOpen(false);
    await loadUsers();
  }

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const searchEmail = inviteEmail.trim().toLowerCase();
    if (!searchEmail) return;

    try {
      const searchRes = await requestJson<AdminUsersPayload>(
        `/api/admin/users?search=${encodeURIComponent(searchEmail)}&role=All&page=1&pageSize=10`
      );

      const targetUser = searchRes.users.find(
        (u) => u.email.toLowerCase() === searchEmail
      );

      if (!targetUser) {
        notify("No account found with this email.", "error");
        return;
      }

      if (targetUser.role === "Admin") {
        notify("This user is already an Admin.", "error");
        return;
      }

      if (targetUser.role === "Student") {
        notify("Only Librarian accounts can be invited to become Admin.", "error");
        return;
      }

      // Promote the librarian to Admin
      await requestJson(`/api/admin/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "Admin" }),
      });

      notify(`${targetUser.name} has been promoted to Admin.`, "success");
      setOpen(false);
      await loadUsers();
    } catch (err: any) {
      notify("Failed to process invitation.", "error");
      console.error(err);
    }
  }

  async function handleDelete(user: AdminUserRecord) {
    if (!window.confirm(`Are you sure you want to archive ${user.name}?`)) {
      return;
    }

    await requestJson(`/api/admin/users/${user.id}`, { method: "DELETE" });
    notify("User archived.", "success");
    await loadUsers();
  }

  const totalPages = payload ? Math.max(1, Math.ceil(payload.total / payload.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="User Management"
        description="Create, update, search, filter, and manage BookHive admin, librarian, and student accounts."
        actions={
          <button
            type="button"
            className="admin-primary-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition active:scale-95"
            onClick={openInvite}
          >
            <Plus className="h-4 w-4" />
            Invite
          </button>
        }
      />

      {tabs}

      <AdminSection
        title="Directory"
        description="Search by name, ID number, email, department, or course. Filter by role and move through paginated results."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--topbar-muted)]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, ID, email, course..."
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-[var(--topbar-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--topbar-muted)] whitespace-nowrap">Filter by Role</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
              className="min-w-[150px] rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Librarian">Librarian</option>
              <option value="Student">Student</option>
            </select>
          </div>
        </div>

        <AdminTable>
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--table-header-bg)]">
                {["Name", "ID Number", "Role", "Department", "Course", "Last Active", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-4 text-left text-[11px] font-bold tracking-[0.18em] text-[var(--table-header-foreground)] uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(payload?.users ?? []).map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[var(--line)] transition hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-4 whitespace-nowrap">
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-[var(--topbar-muted)] mt-0.5">{user.email}</p>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-slate-300 whitespace-nowrap">{user.idNumber}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-300 whitespace-nowrap">{user.department}</td>
                  <td className="px-5 py-4 text-sm text-slate-300 whitespace-nowrap">{user.course || "—"}</td>
                  <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(user.lastActive)}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:border-white/20 hover:text-white transition active:scale-95"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-400" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(user)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/15 hover:border-amber-500/30 transition active:scale-95"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archived
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {(!payload || payload.users.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-[var(--module-muted-color)]">
                    <UserX className="mx-auto mb-4 h-10 w-10 opacity-30 text-[var(--topbar-muted)]" />
                    <p className="text-sm font-medium">No accounts found in this directory.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTable>

        <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-4">
          <p className="text-xs text-[var(--module-muted-color)] font-medium">
            Showing Page <span className="text-white font-semibold">{payload?.page ?? 1}</span> of <span className="text-white font-semibold">{totalPages}</span> · {payload?.total ?? 0} total records
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:pointer-events-none transition active:scale-95"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </AdminSection>

      <AdminModal
        open={open}
        title={editingUser && editingUser.role === "Student" ? `Student Activity: ${editingUser.name}` : (editingUser ? "View / Edit User" : "Invite Librarian to Admin")}
        description={editingUser && editingUser.role === "Student" ? "View book borrowing and reservation logs for this student." : (editingUser ? "View or manage directory details and role-based access for the shared BookHive system." : "Enter a Librarian's Gmail address to invite and promote them to an Admin account.")}
        onClose={() => setOpen(false)}
      >
        {editingUser && editingUser.role === "Student" ? (
          <div className="space-y-5 text-slate-300">
            <div className="grid grid-cols-2 gap-4 border-b border-[var(--line)] pb-5 text-sm">
              <div>
                <p className="text-xs text-[var(--topbar-muted)] font-bold uppercase tracking-wider">Student Email</p>
                <p className="font-semibold text-white mt-1">{editingUser.email}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--topbar-muted)] font-bold uppercase tracking-wider">Student ID / Course</p>
                <p className="font-semibold text-white mt-1">{editingUser.idNumber} · {editingUser.course}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Transaction Records</h4>
              {loadingTxns && studentTxns.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Loading records...</p>
              ) : studentTxns.length === 0 ? (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-6 text-center text-amber-400 italic">
                  (no record)
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]">
                  <table className="min-w-full text-xs text-left">
                    <thead className="bg-[var(--table-header-bg)] text-[10px] uppercase font-bold tracking-wider text-[var(--table-header-foreground)]">
                      <tr>
                        <th className="px-4 py-3">Book Title</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentTxns.map((tx) => (
                        <tr key={tx.id} className="border-t border-[var(--line)] hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-medium text-white">{tx.resourceTitle}</td>
                          <td className="px-4 py-3 font-semibold text-[#ffd166]">{tx.type}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                              STATUS_STYLE[tx.status] || "text-slate-400 border-white/10 bg-white/5"
                            )}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(tx.requestedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="admin-secondary-btn rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-95"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        ) : editingUser ? (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <FieldLabel label="Name">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                required
              />
            </FieldLabel>
            <FieldLabel label="ID Number">
              <input
                value={form.idNumber}
                onChange={(event) => setForm((current) => ({ ...current, idNumber: event.target.value }))}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                required
              />
            </FieldLabel>
            <FieldLabel label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                required
              />
            </FieldLabel>
            <FieldLabel label="Role">
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              >
                <option value="Admin">Admin</option>
                <option value="Librarian">Librarian</option>
                <option value="Student">Student</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Section">
              <select
                value={form.department}
                onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              >
                <option value="Circulation">Circulation</option>
                <option value="General Reference">General Reference</option>
                <option value="Filipiniana">Filipiniana</option>
                <option value="Reserve">Reserve</option>
                <option value="Periodical">Periodical</option>
                <option value="Special Collections">Special Collections</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Course">
              <input
                value={form.course}
                onChange={(event) => setForm((current) => ({ ...current, course: event.target.value }))}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                required
              />
            </FieldLabel>
            <div className="md:col-span-2 flex justify-end gap-3 pt-3">
              <button
                type="button"
                className="admin-secondary-btn rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-95"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-primary-btn rounded-xl px-5 py-2.5 text-sm font-bold transition active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <form className="space-y-5" onSubmit={handleInviteSubmit}>
            <FieldLabel label="Librarian Gmail">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--topbar-muted)]" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="Enter Librarian's Gmail"
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-3 pl-10 pr-4 text-sm text-white placeholder:text-[var(--topbar-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                  required
                />
              </div>
            </FieldLabel>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="admin-secondary-btn rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-95"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-primary-btn rounded-xl px-5 py-2.5 text-sm font-bold transition active:scale-95"
              >
                Submit
              </button>
            </div>
          </form>
        )}
      </AdminModal>
    </div>
  );
}

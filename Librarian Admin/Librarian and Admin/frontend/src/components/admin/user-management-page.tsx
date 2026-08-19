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
              <option value="Technical Librarian">Technical Librarian</option>
              <option value="Circulation Librarian">Circulation Librarian</option>
              <option value="Librarian">Librarian (Legacy)</option>
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
        title={editingUser && editingUser.role === "Student" ? `Student Library Record: ${editingUser.name}` : (editingUser ? "View / Edit User" : "Invite Librarian to Admin")}
        description={editingUser && editingUser.role === "Student" ? "Restricted View: Library Card (Book Card) and Violation Records." : (editingUser ? "View or manage directory details and role-based access for the shared BookHive system." : "Enter a Librarian's Gmail address to invite and promote them to an Admin account.")}
        onClose={() => setOpen(false)}
      >
        {editingUser && editingUser.role === "Student" ? (
          <div className="space-y-6 text-slate-300">
            {/* 1. LIBRARY CARD VIEW */}
            <div className="rounded-2xl border border-[var(--line)] bg-[#131E33] p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-[#24334C] mb-4">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#FCD34D]">OFFICIAL BOOK CARD</span>
                <span className="text-xs text-slate-400 font-mono">QR: {editingUser.qrCode || `e1a1-${editingUser.idNumber || "default"}`}</span>
              </div>

              {/* Data Table */}
              <div className="rounded-xl border border-[#2E3F5C] overflow-hidden text-xs">
                {/* Row 1: Fullname */}
                <div className="flex border-b border-[#2E3F5C] bg-[#16233B]/70">
                  <div className="w-[32%] px-3 py-2 border-r border-[#2E3F5C] font-semibold text-slate-300">Fullname:</div>
                  <div className="flex-1 px-3 py-2 font-bold text-white">{editingUser.name}</div>
                </div>

                {/* Row 2: Course & Section */}
                <div className="flex border-b border-[#2E3F5C] bg-[#16233B]/70">
                  <div className="w-[32%] px-3 py-2 border-r border-[#2E3F5C] font-semibold text-slate-300">Course & Section:</div>
                  <div className="flex-1 px-3 py-2 font-bold text-white">{editingUser.course || "General Program"} {editingUser.department ? `· ${editingUser.department}` : ""}</div>
                </div>

                {/* Row 3: Column Headers */}
                <div className="flex border-b-2 border-[#3B4E70] bg-[#1C2C4A] text-[11px] font-extrabold text-slate-200">
                  <div className="w-[28%] px-3 py-2.5 border-r border-[#2E3F5C]">Borrow Date:</div>
                  <div className="w-[28%] px-3 py-2.5 border-r border-[#2E3F5C]">Due Return Date:</div>
                  <div className="flex-1 px-3 py-2.5">Book Title</div>
                </div>

                {/* Data Rows */}
                {loadingTxns ? (
                  <div className="p-4 text-center text-slate-400 italic">Loading library card records...</div>
                ) : studentTxns.filter((t) => t.type === "Borrow").length === 0 ? (
                  <div className="p-4 text-center text-slate-400 italic">No borrow records on library card.</div>
                ) : (
                  studentTxns
                    .filter((t) => t.type === "Borrow")
                    .map((tx, idx) => (
                      <div
                        key={tx.id || idx}
                        className="flex border-b border-[#24334C] last:border-b-0 hover:bg-white/[0.02]"
                      >
                        <div className="w-[28%] px-3 py-2 border-r border-[#24334C] text-slate-300">
                          {tx.requestedAt ? new Date(tx.requestedAt).toLocaleDateString() : "—"}
                        </div>
                        <div className="w-[28%] px-3 py-2 border-r border-[#24334C] text-amber-300 font-medium">
                          {tx.dueDate ? new Date(tx.dueDate).toLocaleDateString() : (tx.status === "Approved" ? "Active Loan" : "—")}
                        </div>
                        <div className="flex-1 px-3 py-2 font-semibold text-white truncate">
                          {tx.resourceTitle}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* 2. VIOLATION RECORD */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Violation Record</h4>
              </div>

              {studentTxns.filter((t) => t.type === "Borrow" && t.status === "Approved" && t.dueDate && new Date(t.dueDate) < new Date()).length === 0 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3 text-xs text-emerald-400">
                  <span className="font-bold">✓ Clear Record:</span>
                  <span>Student has no active overdue loans or penalty violations.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {studentTxns
                    .filter((t) => t.type === "Borrow" && t.status === "Approved" && t.dueDate && new Date(t.dueDate) < new Date())
                    .map((ov) => (
                      <div key={ov.id} className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-rose-400">Overdue Loan: {ov.resourceTitle}</p>
                          <p className="text-[11px] text-rose-300/70 mt-0.5">Due date was {new Date(ov.dueDate).toLocaleDateString()}. Policy fine applied.</p>
                        </div>
                        <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                          Active Fine
                        </span>
                      </div>
                    ))}
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
                <option value="Technical Librarian">Technical Librarian</option>
                <option value="Circulation Librarian">Circulation Librarian</option>
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

"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminModal, AdminPageHeader, AdminSection, AdminTable, FieldLabel } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminUserRecord, AdminUsersPayload } from "@/lib/admin/types";
import { formatDateTime } from "@/lib/utils";

const emptyUserForm = {
  name: "",
  idNumber: "",
  email: "",
  role: "Student",
  department: "Computer Science",
  course: "",
};

export function UserManagementPage() {
  const { notify } = useNotice();
  const [payload, setPayload] = useState<AdminUsersPayload | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [form, setForm] = useState(emptyUserForm);
  const deferredSearch = useDeferredValue(search);

  const loadUsers = useCallback(async () => {
    const nextPayload = await requestJson<AdminUsersPayload>(
      `/api/admin/users?search=${encodeURIComponent(deferredSearch)}&role=${encodeURIComponent(role)}&page=${page}&pageSize=8`,
    );
    startTransition(() => setPayload(nextPayload));
  }, [deferredSearch, page, role]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function openCreate() {
    setEditingUser(null);
    setForm(emptyUserForm);
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
    } else {
      const created = await requestJson<{ tempPassword: string }>(`/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      notify(`User created. Default password: ${created.tempPassword}`, "success");
    }

    setOpen(false);
    await loadUsers();
  }

  async function handleDelete(user: AdminUserRecord) {
    if (!window.confirm(`Delete ${user.name}?`)) {
      return;
    }

    await requestJson(`/api/admin/users/${user.id}`, { method: "DELETE" });
    notify("User deleted.", "success");
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
            className="admin-primary-btn inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        }
      />

      <AdminSection
        title="Directory"
        description="Search by name, ID number, email, department, or course. Filter by role and move through paginated results."
      >
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search users"
            className="glass-input px-4 py-3"
          />
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            className="glass-input px-4 py-3"
          >
            <option value="All">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Librarian">Librarian</option>
            <option value="Student">Student</option>
          </select>
        </div>

        <AdminTable>
          <table className="min-w-full text-left">
            <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">ID Number</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.users ?? []).map((user) => (
                <tr key={user.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs text-[var(--module-muted-color)]">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{user.idNumber}</td>
                  <td className="px-4 py-3 text-sm">{user.role}</td>
                  <td className="px-4 py-3 text-sm">{user.department}</td>
                  <td className="px-4 py-3 text-sm">{user.course}</td>
                  <td className="px-4 py-3 text-sm">{formatDateTime(user.lastActive)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="admin-secondary-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-danger-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                        onClick={() => void handleDelete(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[var(--module-muted-color)]">
            Page {payload?.page ?? 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </AdminSection>

      <AdminModal
        open={open}
        title={editingUser ? "Edit User" : "Create User"}
        description="Manage directory details and role-based access for the shared BookHive system."
        onClose={() => setOpen(false)}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <FieldLabel label="Name">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="glass-input w-full px-4 py-3"
              required
            />
          </FieldLabel>
          <FieldLabel label="ID Number">
            <input
              value={form.idNumber}
              onChange={(event) => setForm((current) => ({ ...current, idNumber: event.target.value }))}
              className="glass-input w-full px-4 py-3"
              required
            />
          </FieldLabel>
          <FieldLabel label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="glass-input w-full px-4 py-3"
              required
            />
          </FieldLabel>
          <FieldLabel label="Role">
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              className="glass-input w-full px-4 py-3"
            >
              <option value="Admin">Admin</option>
              <option value="Librarian">Librarian</option>
              <option value="Student">Student</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Department">
            <select
              value={form.department}
              onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
              className="glass-input w-full px-4 py-3"
            >
              <option value="Computer Science">Computer Science</option>
              <option value="Engineering">Engineering</option>
              <option value="Education">Education</option>
              <option value="Business & Accountancy">Business &amp; Accountancy</option>
              <option value="Arts & Sciences">Arts &amp; Sciences</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Course">
            <input
              value={form.course}
              onChange={(event) => setForm((current) => ({ ...current, course: event.target.value }))}
              className="glass-input w-full px-4 py-3"
              required
            />
          </FieldLabel>
          <div className="md:col-span-2 flex justify-end gap-3">
            <button type="button" className="admin-secondary-btn rounded-2xl px-4 py-3" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="admin-primary-btn rounded-2xl px-4 py-3 font-semibold">
              {editingUser ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}

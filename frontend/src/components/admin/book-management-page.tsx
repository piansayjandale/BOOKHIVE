"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useState } from "react";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminModal, AdminPageHeader, AdminSection, AdminTable, FieldLabel } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminBookRecord, AdminBooksPayload, RecordsCatalogPayload } from "@/lib/admin/types";
import { formatDate } from "@/lib/utils";

const emptyBookForm = {
  title: "",
  author: "",
  isbn: "",
  department: "Computer Science",
  category: "",
  shelfLocation: "",
  publishedDate: "",
  summary: "",
  archived: false,
  availability: "Available",
};

export function BookManagementPage() {
  const { notify } = useNotice();
  const [tab, setTab] = useState<"management" | "catalog">("management");
  const [payload, setPayload] = useState<AdminBooksPayload | null>(null);
  const [catalogPayload, setCatalogPayload] = useState<RecordsCatalogPayload | null>(null);
  const [search, setSearch] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [catalogDepartment, setCatalogDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<AdminBookRecord | null>(null);
  const [form, setForm] = useState(emptyBookForm);
  const deferredSearch = useDeferredValue(search);
  const deferredCatalogSearch = useDeferredValue(catalogSearch);

  const loadBooks = useCallback(async () => {
    const nextPayload = await requestJson<AdminBooksPayload>(
      `/api/admin/books?search=${encodeURIComponent(deferredSearch)}&department=${encodeURIComponent(department)}&status=${encodeURIComponent(status)}&page=${page}&pageSize=8`,
    );
    startTransition(() => setPayload(nextPayload));
  }, [deferredSearch, department, page, status]);

  const loadCatalog = useCallback(async () => {
    const nextPayload = await requestJson<RecordsCatalogPayload>(
      `/api/admin/records-catalog?search=${encodeURIComponent(deferredCatalogSearch)}&department=${encodeURIComponent(catalogDepartment)}`,
    );
    startTransition(() => setCatalogPayload(nextPayload));
  }, [deferredCatalogSearch, catalogDepartment]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  function openCreate() {
    setEditingBook(null);
    setForm(emptyBookForm);
    setOpen(true);
  }

  function openEdit(book: AdminBookRecord) {
    setEditingBook(book);
    setForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      department: book.department,
      category: book.category,
      shelfLocation: book.shelfLocation,
      publishedDate: book.publishedDate,
      summary: book.summary,
      archived: book.archived,
      availability: book.availability,
    });
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingBook) {
      await requestJson(`/api/admin/books/${editingBook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      notify("Book updated successfully.", "success");
    } else {
      await requestJson(`/api/admin/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      notify("Book added to the catalog.", "success");
    }

    setOpen(false);
    await loadBooks();
  }

  async function handleArchive(book: AdminBookRecord) {
    await requestJson(`/api/admin/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    notify("Book archived.", "info");
    await loadBooks();
  }

  async function handleDelete(book: AdminBookRecord) {
    if (!window.confirm(`Delete ${book.title}?`)) {
      return;
    }

    await requestJson(`/api/admin/books/${book.id}`, { method: "DELETE" });
    notify("Book deleted.", "success");
    await loadBooks();
  }

  const totalPages = payload ? Math.max(1, Math.ceil(payload.total / payload.pageSize)) : 1;

  // ...existing code...
  // Get user role from session (pseudo, replace with actual session logic)
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    // TODO: Replace with actual session fetch logic
    setUserRole(typeof window !== 'undefined' ? window.localStorage.getItem('role') : null);
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Book Management & Catalog"
        description={
          tab === "management"
            ? "Create, update, and remove books while keeping citation data, organization, and department alignment intact."
            : "Inspect the full system-wide book record set in a structured, read-only view organized by department and title."
        }
        actions={
          tab === "management" ? (
            <button
              type="button"
              className="admin-primary-btn inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Add Book
            </button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[var(--line)]">
        <button
          type="button"
          onClick={() => setTab("management")}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${tab === "management" ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "text-[var(--module-muted-color)] hover:text-[var(--foreground)]"}`}
        >
          Management
        </button>
        <button
          type="button"
          onClick={() => setTab("catalog")}
          className={`px-4 py-3 font-semibold text-sm transition-colors ${tab === "catalog" ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "text-[var(--module-muted-color)] hover:text-[var(--foreground)]"}`}
        >
          Catalog
        </button>
      </div>

      {/* Management Tab */}
      {tab === "management" && (
        <AdminSection
          title="Catalog Control"
          description="Filter by department or archive status, search titles alphabetically, and inspect generated APA citations."
        >
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search books"
              className="glass-input px-4 py-3"
            />
            <select
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setPage(1);
              }}
              className="glass-input px-4 py-3"
            >
              <option value="All">All Departments</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Engineering">Engineering</option>
              <option value="Education">Education</option>
              <option value="Business & Accountancy">Business &amp; Accountancy</option>
              <option value="Arts & Sciences">Arts &amp; Sciences</option>
            </select>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="glass-input px-4 py-3"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <AdminTable>
            <table className="min-w-full text-left">
              <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
                <tr>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Shelf</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.books ?? []).map((book) => (
                  <tr key={book.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold">{book.title}</p>
                      <p className="mt-1 text-xs text-[var(--module-muted-color)]">{book.apaCitation}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{book.department}</td>
                    <td className="px-4 py-3 text-sm">{book.category}</td>
                    <td className="px-4 py-3 text-sm">{book.shelfLocation}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(book.publishedDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="admin-secondary-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                          onClick={() => openEdit(book)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        {/* Only show Archive for Librarian */}
                        {userRole === 'Librarian' && (
                          <button
                            type="button"
                            className="admin-secondary-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                            onClick={() => void handleArchive(book)}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-danger-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                          onClick={() => void handleDelete(book)}
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
      )}

      {/* Catalog Tab */}
      {tab === "catalog" && (
        <AdminSection
          title="Catalog View"
          description="Apply title and department filters to review the centralized records collection."
        >
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
            <input
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="Search title or author"
              className="glass-input px-4 py-3"
            />
            <select
              value={catalogDepartment}
              onChange={(event) => setCatalogDepartment(event.target.value)}
              className="glass-input px-4 py-3"
            >
              <option value="All">All Departments</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Engineering">Engineering</option>
              <option value="Education">Education</option>
              <option value="Business & Accountancy">Business &amp; Accountancy</option>
              <option value="Arts & Sciences">Arts &amp; Sciences</option>
            </select>
          </div>

          <AdminTable>
            <table className="min-w-full text-left">
              <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Shelf</th>
                </tr>
              </thead>
              <tbody>
                {(catalogPayload?.records ?? []).map((record) => (
                  <tr key={record.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 text-sm font-semibold">{record.title}</td>
                    <td className="px-4 py-3 text-sm">{record.author}</td>
                    <td className="px-4 py-3 text-sm">{record.department}</td>
                    <td className="px-4 py-3 text-sm">{record.category}</td>
                    <td className="px-4 py-3 text-sm">{record.shelfLocation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      )}

      <AdminModal
        open={open}
        title={editingBook ? "Edit Book" : "Add Book"}
        description="Manage core catalog metadata and BookHive's generated APA citation references."
        onClose={() => setOpen(false)}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <FieldLabel label="Title">
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="glass-input w-full px-4 py-3" required />
          </FieldLabel>
          <FieldLabel label="Author">
            <input value={form.author} onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))} className="glass-input w-full px-4 py-3" required />
          </FieldLabel>
          <FieldLabel label="ISBN">
            <input value={form.isbn} onChange={(event) => setForm((current) => ({ ...current, isbn: event.target.value }))} className="glass-input w-full px-4 py-3" required />
          </FieldLabel>
          <FieldLabel label="Department">
            <select value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} className="glass-input w-full px-4 py-3">
              <option value="Computer Science">Computer Science</option>
              <option value="Engineering">Engineering</option>
              <option value="Education">Education</option>
              <option value="Business & Accountancy">Business &amp; Accountancy</option>
              <option value="Arts & Sciences">Arts &amp; Sciences</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Category">
            <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="glass-input w-full px-4 py-3" required />
          </FieldLabel>
          <FieldLabel label="Shelf Location">
            <input value={form.shelfLocation} onChange={(event) => setForm((current) => ({ ...current, shelfLocation: event.target.value }))} className="glass-input w-full px-4 py-3" required />
          </FieldLabel>
          <FieldLabel label="Published Date">
            <input type="date" value={form.publishedDate} onChange={(event) => setForm((current) => ({ ...current, publishedDate: event.target.value }))} className="glass-input w-full px-4 py-3" required />
          </FieldLabel>
          <FieldLabel label="Availability">
            <select value={form.availability} onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))} className="glass-input w-full px-4 py-3">
              <option value="Available">Available</option>
              <option value="Limited">Limited</option>
              <option value="Reserved">Reserved</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Summary">
            <textarea value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} className="glass-input w-full px-4 py-3" required />
          </FieldLabel>
          <div className="md:col-span-2 flex justify-end gap-3">
            <button type="button" className="admin-secondary-btn rounded-2xl px-4 py-3" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="admin-primary-btn rounded-2xl px-4 py-3 font-semibold">
              {editingBook ? "Save Changes" : "Create Book"}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}

"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { Archive, Eye, Plus, Search, ChevronLeft, ChevronRight, Inbox, Check, X } from "lucide-react";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminModal, AdminPageHeader, AdminSection, AdminTable, FieldLabel } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminBookRecord, AdminBooksPayload, AdminTransactionsPayload } from "@/lib/admin/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const emptyBookForm = {
  title: "",
  author: "",
  isbn: "",
  department: "Circulation",
  category: "",
  shelfLocation: "",
  publishedDate: "",
  summary: "",
  archived: false,
  availability: "Available",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Declined: "bg-red-500/15 text-red-300 border-red-500/30",
    Returned: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[status] ?? "text-slate-400 border-white/10 bg-white/5"}`}
    >
      {status}
    </span>
  );
}

export function BookManagementPage({ tabs }: { tabs?: ReactNode }) {
  const { notify } = useNotice();
  const [payload, setPayload] = useState<AdminBooksPayload | null>(null);
  const [transactionsPayload, setTransactionsPayload] = useState<AdminTransactionsPayload | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("Active");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<AdminBookRecord | null>(null);
  const [form, setForm] = useState(emptyBookForm);
  const [isViewing, setIsViewing] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const loadBooks = useCallback(async () => {
    if (status === "Borrowed" || status === "Reserved") {
      return;
    }
    const nextPayload = await requestJson<AdminBooksPayload>(
      `/api/admin/books?search=${encodeURIComponent(deferredSearch)}&department=${encodeURIComponent(department)}&status=${encodeURIComponent(status)}&page=${page}&pageSize=8`,
    );
    startTransition(() => setPayload(nextPayload));
  }, [deferredSearch, department, page, status]);

  const loadTransactions = useCallback(async () => {
    try {
      const next = await requestJson<AdminTransactionsPayload>("/api/admin/transactions");
      startTransition(() => setTransactionsPayload(next));
    } catch (error) {
      console.error("Failed to load transactions:", error);
    }
  }, []);

  async function updateTransactionStatus(id: string, status: string) {
    try {
      await requestJson(`/api/admin/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      notify(`Transaction marked ${status.toLowerCase()}.`, "success");
      await loadTransactions();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update transaction.", "error");
    }
  }

  useEffect(() => {
    void loadBooks();
    const interval = setInterval(() => {
      void loadBooks();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadBooks]);

  useEffect(() => {
    if (status === "Borrowed" || status === "Reserved") {
      void loadTransactions();
      const interval = setInterval(() => {
        void loadTransactions();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [status, loadTransactions]);

  function openCreate() {
    setIsViewing(false);
    setEditingBook(null);
    setForm(emptyBookForm);
    setOpen(true);
  }

  function openView(book: AdminBookRecord) {
    setIsViewing(true);
    setEditingBook(book);
    setForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      department: book.department,
      category: book.category,
      shelfLocation: book.shelfLocation,
      publishedDate: book.publishedDate ? book.publishedDate.substring(0, 10) : "",
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

  async function handleRestore(book: AdminBookRecord) {
    await requestJson(`/api/admin/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    notify("Book restored successfully.", "success");
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

  const borrowRequestsList = transactionsPayload?.borrowRequests ?? [];
  const filteredBorrows = borrowRequestsList.filter((r) => {
    const matchesSearch = search
      ? r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        r.studentId.toLowerCase().includes(search.toLowerCase()) ||
        r.resourceTitle.toLowerCase().includes(search.toLowerCase()) ||
        (r.isbn ?? "").toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesDepartment = department !== "All" ? r.department === department : true;
    return matchesSearch && matchesDepartment;
  });

  const reservationsList = transactionsPayload?.reservations ?? [];
  const filteredReservations = reservationsList.filter((r) => {
    const matchesSearch = search
      ? r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        r.studentId.toLowerCase().includes(search.toLowerCase()) ||
        r.resourceTitle.toLowerCase().includes(search.toLowerCase()) ||
        (r.isbn ?? "").toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesDepartment = department !== "All" ? r.department === department : true;
    return matchesSearch && matchesDepartment;
  });

  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    setUserRole(typeof window !== 'undefined' ? window.localStorage.getItem('role') : null);
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Book Management & Catalog"
        description="Create, update, and remove books while keeping citation data, organization, and department alignment intact."
        actions={
          status !== "Borrowed" && status !== "Reserved" ? (
            <button
              type="button"
              className="admin-primary-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition active:scale-95"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Add Book
            </button>
          ) : null
        }
      />

      {tabs}

      <AdminSection
        title={status === "Borrowed" ? "Borrow Requests" : status === "Reserved" ? "Reservations" : "Catalog Control"}
        description={status === "Borrowed" ? "Manage active student borrow requests in real-time." : status === "Reserved" ? "Manage active student book reservations in real-time." : "Filter by department or status, search titles alphabetically, and inspect generated APA citations."}
      >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--topbar-muted)]" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={status === "Borrowed" || status === "Reserved" ? "Search student, book title, ISBN..." : "Search by title, author, ISBN..."}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-[var(--topbar-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--topbar-muted)] whitespace-nowrap">Section</span>
                <select
                  value={department}
                  onChange={(event) => {
                    setDepartment(event.target.value);
                    setPage(1);
                  }}
                  className="min-w-[150px] rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                >
                  <option value="All">All Sections</option>
                  <option value="Circulation">Circulation</option>
                  <option value="General Reference">General Reference</option>
                  <option value="Filipiniana">Filipiniana</option>
                  <option value="Reserve">Reserve</option>
                  <option value="Periodical">Periodical</option>
                  <option value="Special Collections">Special Collections</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--topbar-muted)] whitespace-nowrap">Status</span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="min-w-[130px] rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Borrowed">Borrowed</option>
                  <option value="Reserved">Reserved</option>
                </select>
              </div>
            </div>
          </div>

          <AdminTable>
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--table-header-bg)]">
                  {status === "Borrowed" || status === "Reserved" ? (
                    ["Student", "Book", "Requested", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-4 text-left text-[11px] font-bold tracking-[0.18em] text-[var(--table-header-foreground)] uppercase whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))
                  ) : (
                    ["Book", "Department", "Category", "Shelf", "Published", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-4 text-left text-[11px] font-bold tracking-[0.18em] text-[var(--table-header-foreground)] uppercase whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {status === "Borrowed" ? (
                  filteredBorrows.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--line)] transition hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-white">{item.studentName}</p>
                        <p className="text-xs text-[var(--topbar-muted)] mt-0.5 font-mono">{item.studentId}</p>
                      </td>
                      <td className="px-5 py-4 max-w-md">
                        <p className="text-sm font-semibold text-white leading-snug">{item.resourceTitle}</p>
                        {item.isbn && (
                          <p className="mt-1 text-xs text-[var(--topbar-muted)] font-mono leading-relaxed">ISBN: {item.isbn}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateTime(item.requestedAt)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          {item.status === "Pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void updateTransactionStatus(item.id, "Approved")}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition active:scale-95"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => void updateTransactionStatus(item.id, "Declined")}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15 hover:border-red-500/30 transition active:scale-95"
                              >
                                <X className="h-3.5 w-3.5" />
                                Decline
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-[var(--topbar-muted)] italic">No actions available</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : status === "Reserved" ? (
                  filteredReservations.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--line)] transition hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-white">{item.studentName}</p>
                        <p className="text-xs text-[var(--topbar-muted)] mt-0.5 font-mono">{item.studentId}</p>
                      </td>
                      <td className="px-5 py-4 max-w-md">
                        <p className="text-sm font-semibold text-white leading-snug">{item.resourceTitle}</p>
                        {item.isbn && (
                          <p className="mt-1 text-xs text-[var(--topbar-muted)] font-mono leading-relaxed">ISBN: {item.isbn}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateTime(item.requestedAt)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          {item.status === "Pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void updateTransactionStatus(item.id, "Approved")}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition active:scale-95"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => void updateTransactionStatus(item.id, "Declined")}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15 hover:border-red-500/30 transition active:scale-95"
                              >
                                <X className="h-3.5 w-3.5" />
                                Decline
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-[var(--topbar-muted)] italic">No actions available</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  (payload?.books ?? []).map((book) => (
                    <tr
                      key={book.id}
                      className="border-b border-[var(--line)] transition hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4 max-w-md">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white leading-snug">{book.title}</p>
                          {book.archived && (
                            <span className="inline-flex items-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[var(--topbar-muted)] leading-relaxed">{book.apaCitation}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-300 whitespace-nowrap">{book.department}</td>
                      <td className="px-5 py-4 text-sm text-slate-300 whitespace-nowrap">{book.category}</td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-300 whitespace-nowrap">{book.shelfLocation}</td>
                      <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{formatDate(book.publishedDate)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openView(book)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:border-white/20 hover:text-white transition active:scale-95"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-400" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Archive ${book.title}?`)) {
                                void handleArchive(book);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/15 hover:border-amber-500/30 transition active:scale-95"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                {((status === "Borrowed" && filteredBorrows.length === 0) ||
                  (status === "Reserved" && filteredReservations.length === 0) ||
                  (status !== "Borrowed" && status !== "Reserved" && (payload?.books ?? []).length === 0)) && (
                  <tr>
                    <td
                      colSpan={status === "Borrowed" || status === "Reserved" ? 5 : 6}
                      className="py-20 text-center text-[var(--module-muted-color)]"
                    >
                      <Inbox className="mx-auto mb-4 h-10 w-10 opacity-30 text-[var(--topbar-muted)]" />
                      <p className="text-sm font-medium">
                        {status === "Borrowed"
                          ? "No borrow requests found."
                          : status === "Reserved"
                          ? "No reservations found."
                          : "No books found in active catalog."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </AdminTable>

          {status !== "Borrowed" && status !== "Reserved" ? (
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
          ) : (
            <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--module-muted-color)] font-medium">
              <span>
                Showing <span className="text-white font-semibold">{status === "Borrowed" ? filteredBorrows.length : filteredReservations.length}</span> record(s)
              </span>
            </div>
          )}
        </AdminSection>
      <AdminModal
        open={open}
        title={isViewing ? "View Book Details" : editingBook ? "Edit Book Details" : "Add Book to Catalog"}
        description={isViewing ? "Inspect core catalog metadata and BookHive's generated APA citation references." : "Manage core catalog metadata and BookHive's generated APA citation references."}
        onClose={() => setOpen(false)}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <FieldLabel label="Title">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              required
              disabled={isViewing}
            />
          </FieldLabel>
          <FieldLabel label="Author">
            <input
              value={form.author}
              onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              required
              disabled={isViewing}
            />
          </FieldLabel>
          <FieldLabel label="ISBN">
            <input
              value={form.isbn}
              onChange={(event) => setForm((current) => ({ ...current, isbn: event.target.value }))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              required
              disabled={isViewing}
            />
          </FieldLabel>
          <FieldLabel label="Section">
            <select
              value={form.department}
              onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              disabled={isViewing}
            >
              <option value="Circulation">Circulation</option>
              <option value="General Reference">General Reference</option>
              <option value="Filipiniana">Filipiniana</option>
              <option value="Reserve">Reserve</option>
              <option value="Periodical">Periodical</option>
              <option value="Special Collections">Special Collections</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Category">
            <input
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              required
              disabled={isViewing}
            />
          </FieldLabel>
          <FieldLabel label="Shelf Location">
            <input
              value={form.shelfLocation}
              onChange={(event) => setForm((current) => ({ ...current, shelfLocation: event.target.value }))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              required
              disabled={isViewing}
            />
          </FieldLabel>
          <FieldLabel label="Published Date">
            <input
              type="date"
              value={form.publishedDate}
              onChange={(event) => setForm((current) => ({ ...current, publishedDate: event.target.value }))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              required
              disabled={isViewing}
            />
          </FieldLabel>
          <FieldLabel label="Availability">
            <select
              value={form.availability}
              onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
              disabled={isViewing}
            >
              <option value="Available">Available</option>
              <option value="Limited">Limited</option>
              <option value="Reserved">Reserved</option>
            </select>
          </FieldLabel>
          <div className="md:col-span-2">
            <FieldLabel label="Summary">
              <textarea
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 px-4 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] min-h-[110px]"
                required
                disabled={isViewing}
              />
            </FieldLabel>
          </div>
          <div className="md:col-span-2 flex items-center gap-3 select-none py-1">
            <input
              type="checkbox"
              id="form-archived"
              checked={form.archived}
              onChange={(event) => setForm((current) => ({ ...current, archived: event.target.checked }))}
              className="rounded border-[var(--line)] bg-[var(--table-header-bg)] text-[var(--accent)] focus:ring-[var(--accent)] h-4 w-4 cursor-pointer"
              disabled={isViewing}
            />
            <label htmlFor="form-archived" className="text-sm font-semibold cursor-pointer text-[var(--foreground)]">
              Archived (Hide from active catalog)
            </label>
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-3">
            <button
              type="button"
              className="admin-secondary-btn rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-95"
              onClick={() => setOpen(false)}
            >
              {isViewing ? "Close" : "Cancel"}
            </button>
            {!isViewing && (
              <button
                type="submit"
                className="admin-primary-btn rounded-xl px-5 py-2.5 text-sm font-bold transition active:scale-95"
              >
                {editingBook ? "Save Changes" : "Create Book"}
              </button>
            )}
          </div>
        </form>
      </AdminModal>
    </div>
  );
}

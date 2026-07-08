"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight, Inbox, RotateCcw } from "lucide-react";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminBookRecord, AdminBooksPayload, AdminUserRecord, AdminUsersPayload } from "@/lib/admin/types";
import { cn, formatDate } from "@/lib/utils";

type ArchiveType = "books" | "users";

export function ArchiveManagementPage({ tabs }: { tabs?: ReactNode }) {
  const { notify } = useNotice();
  const [archiveType, setArchiveType] = useState<ArchiveType>("books");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  // States for books
  const [booksPayload, setBooksPayload] = useState<AdminBooksPayload | null>(null);

  // States for users
  const [usersPayload, setUsersPayload] = useState<AdminUsersPayload | null>(null);

  // Load archived books
  const loadArchivedBooks = useCallback(async () => {
    try {
      const nextPayload = await requestJson<AdminBooksPayload>(
        `/api/admin/books?search=${encodeURIComponent(deferredSearch)}&archivedOnly=true&page=${page}&pageSize=8`,
      );
      startTransition(() => setBooksPayload(nextPayload));
    } catch (error) {
      console.error("Failed to load archived books:", error);
    }
  }, [deferredSearch, page]);

  // Load archived users
  const loadArchivedUsers = useCallback(async () => {
    try {
      const nextPayload = await requestJson<AdminUsersPayload>(
        `/api/admin/users?search=${encodeURIComponent(deferredSearch)}&status=Archived&page=${page}&pageSize=8`,
      );
      startTransition(() => setUsersPayload(nextPayload));
    } catch (error) {
      console.error("Failed to load archived users:", error);
    }
  }, [deferredSearch, page]);

  // Handle load triggering
  useEffect(() => {
    if (archiveType === "books") {
      void loadArchivedBooks();
    } else {
      void loadArchivedUsers();
    }
  }, [archiveType, loadArchivedBooks, loadArchivedUsers]);

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (archiveType === "books") {
        void loadArchivedBooks();
      } else {
        void loadArchivedUsers();
      }
    }, 3000); // refresh every 3 seconds

    return () => clearInterval(interval);
  }, [archiveType, loadArchivedBooks, loadArchivedUsers]);

  // Reset page when switching archive type
  const handleTypeChange = (type: ArchiveType) => {
    setArchiveType(type);
    setSearch("");
    setPage(1);
  };

  // Restore Book
  const handleRestoreBook = async (book: AdminBookRecord) => {
    try {
      await requestJson(`/api/admin/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      notify("Book restored successfully.", "success");
      void loadArchivedBooks();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to restore book.", "error");
    }
  };

  // Restore User
  const handleRestoreUser = async (user: AdminUserRecord) => {
    try {
      await requestJson(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active" }),
      });
      notify("User restored successfully.", "success");
      void loadArchivedUsers();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to restore user.", "error");
    }
  };

  const totalPages = archiveType === "books"
    ? (booksPayload ? Math.max(1, Math.ceil(booksPayload.total / booksPayload.pageSize)) : 1)
    : (usersPayload ? Math.max(1, Math.ceil(usersPayload.total / usersPayload.pageSize)) : 1);

  const totalRecords = archiveType === "books"
    ? (booksPayload?.total ?? 0)
    : (usersPayload?.total ?? 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Archive Control"
        description="Inspect and manage system catalog archives and deactivated/archived user accounts. Items here can be restored to active status."
      />

      {tabs}

      <AdminSection
        title="Archived System Records"
        description="Select the system category to inspect, filter by term, or restore records back to active state."
      >
        {/* Sub-tabs */}
        <div className="flex gap-6 border-b border-[var(--line)] pb-0.5 mb-6">
          <button
            type="button"
            onClick={() => handleTypeChange("books")}
            className={cn(
              "pb-3 text-xs font-bold uppercase tracking-wider transition-all relative whitespace-nowrap",
              archiveType === "books" ? "text-white" : "text-slate-400 hover:text-white"
            )}
          >
            Archived Books
            {archiveType === "books" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("users")}
            className={cn(
              "pb-3 text-xs font-bold uppercase tracking-wider transition-all relative whitespace-nowrap",
              archiveType === "users" ? "text-white" : "text-slate-400 hover:text-white"
            )}
          >
            Archived Users
            {archiveType === "users" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
          </button>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--topbar-muted)]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={archiveType === "books" ? "Search by title, author, ISBN..." : "Search user name, ID, email..."}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-[var(--topbar-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
          </div>
        </div>

        <AdminTable>
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--table-header-bg)]">
                {archiveType === "books" ? (
                  ["Book", "Department", "Category", "Shelf Location", "Published Date", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-left text-[11px] font-bold tracking-[0.18em] text-[var(--table-header-foreground)] uppercase whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))
                ) : (
                  ["User Name", "ID Number", "Email", "Role", "Department", "Actions"].map((h) => (
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
              {archiveType === "books" ? (
                (booksPayload?.books ?? []).map((book) => (
                  <tr key={book.id} className="border-b border-[var(--line)] transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4 max-w-md">
                      <p className="text-sm font-semibold text-white leading-snug">{book.title}</p>
                      <p className="mt-1 text-xs text-[var(--topbar-muted)] leading-relaxed">{book.author}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300 whitespace-nowrap">{book.department}</td>
                    <td className="px-5 py-4 text-sm text-slate-300 whitespace-nowrap">{book.category}</td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-300 whitespace-nowrap">{book.shelfLocation}</td>
                    <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{formatDate(book.publishedDate)}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void handleRestoreBook(book)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition active:scale-95"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                (usersPayload?.users ?? []).map((user) => (
                  <tr key={user.id} className="border-b border-[var(--line)] transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4 whitespace-nowrap font-semibold text-white">{user.name}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-300 whitespace-nowrap">{user.idNumber}</td>
                    <td className="px-5 py-4 text-sm text-slate-300 whitespace-nowrap">{user.email}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        user.role === "Admin" ? "bg-red-500/15 text-red-300 border border-red-500/20" :
                        user.role === "Librarian" ? "bg-amber-500/15 text-amber-300 border border-amber-500/20" :
                        "bg-sky-500/15 text-sky-300 border border-sky-500/20"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300 whitespace-nowrap">{user.department}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void handleRestoreUser(user)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition active:scale-95"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}

              {((archiveType === "books" && (booksPayload?.books ?? []).length === 0) ||
                (archiveType === "users" && (usersPayload?.users ?? []).length === 0)) && (
                <tr>
                  <td
                    colSpan={archiveType === "books" ? 6 : 6}
                    className="py-20 text-center text-[var(--module-muted-color)]"
                  >
                    <Inbox className="mx-auto mb-4 h-10 w-10 opacity-30 text-[var(--topbar-muted)]" />
                    <p className="text-sm font-medium">
                      No archived {archiveType === "books" ? "books" : "users"} found.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTable>

        <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-4">
          <p className="text-xs text-[var(--module-muted-color)] font-medium">
            Showing Page <span className="text-white font-semibold">{page}</span> of <span className="text-white font-semibold">{totalPages}</span> · {totalRecords} total archived records
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
    </div>
  );
}

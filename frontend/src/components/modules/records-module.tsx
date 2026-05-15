"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Archive, BookOpen, PencilLine, Plus, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ModuleHeader } from "@/components/ui/module-header";
import { Panel } from "@/components/ui/panel";
import type { BookRecord, Department } from "@/lib/types";

type RecordSortKey = "title" | "department" | "isbn" | "aiScore";

const departmentOptions: Array<Department | "All"> = [
  "All",
  "Computer Science",
  "Engineering",
  "Education",
  "Business & Accountancy",
  "Arts & Sciences",
];

const emptyBookForm = {
  title: "",
  author: "",
  isbn: "",
  publicationDate: "2025-01-01",
  department: "Computer Science" as Department,
  shelfLocation: "",
  summary: "",
  availability: "Available" as BookRecord["availability"],
};

function availabilityTone(availability: BookRecord["availability"]) {
  if (availability === "Reserved") {
    return "warning";
  }

  if (availability === "Limited") {
    return "danger";
  }

  return "success";
}

export function RecordsModule() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<Department | "All">("All");
  const [form, setForm] = useState(emptyBookForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState<RecordSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const deferredSearch = useDeferredValue(search);
  const pageSize = 60;

  const loadBooks = useCallback(async () => {
    const params = new URLSearchParams({
      search: deferredSearch,
      department,
      page: String(page),
      pageSize: String(pageSize),
    });
    const response = await fetch(`/api/records?${params.toString()}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to load records:", response.status, errorText);
      return;
    }
    let payload: { books: BookRecord[]; total: number } | null = null;
    try {
      payload = (await response.json()) as { books: BookRecord[]; total: number };
    } catch (error) {
      console.error("Invalid JSON from /api/records:", error);
      return;
    }

    if (!payload) {
      return;
    }

    startTransition(() => {
      setBooks(payload.books);
      setTotalBooks(payload.total);
    });
  }, [deferredSearch, department, page]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  function toggleSort(key: RecordSortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const sortedBooks = useMemo(() => {
    if (!books) return [] as BookRecord[];
    const s = [...books];
    if (!sortBy) {
      s.sort((a, b) => {
        const deptCompare = a.department.localeCompare(b.department);
        if (deptCompare !== 0) return deptCompare;
        return a.title.localeCompare(b.title);
      });
      return s;
    }

    s.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") {
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return s;
  }, [books, sortBy, sortDir]);

  const groupedRows = useMemo(() => {
    const rows: Array<{ type: "department"; department: Department } | { type: "book"; book: BookRecord }> = [];
    let currentDepartment: Department | null = null;
    for (const book of sortedBooks) {
      if (book.department !== currentDepartment) {
        currentDepartment = book.department;
        rows.push({ type: "department", department: book.department });
      }
      rows.push({ type: "book", book });
    }
    return rows;
  }, [sortedBooks]);

  function resetForm() {
    setForm(emptyBookForm);
    setEditingId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const endpoint = editingId ? `/api/records/${editingId}` : "/api/records";
    const method = editingId ? "PUT" : "POST";
    await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    resetForm();
    await loadBooks();
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/records/${id}`, {
      method: "DELETE",
    });
    await loadBooks();
    if (editingId === id) {
      resetForm();
    }
  }

  const insights = useMemo(() => {
    const limited = books.filter((book) => book.availability !== "Available").length;
    const highestScore = books.reduce((max, current) => Math.max(max, current.aiScore), 0);
    return {
      total: totalBooks,
      limited,
      highestScore,
    };
  }, [books, totalBooks]);

  const totalPages = Math.max(1, Math.ceil(totalBooks / pageSize));

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4 overflow-hidden">
      <ModuleHeader
        eyebrow="Records"
        title="Full catalog CRUD with discovery metadata"
        description="Manage book metadata, refresh shelf locations, generate APA-ready citations, and keep AI relevance data clean for BookHive prompt search."
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <Panel className="overflow-hidden p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge tone="success">{editingId ? "Edit Record" : "Add Record"}</Badge>
              <h2 className="mt-2 text-lg font-semibold text-[var(--module-title-color)]">
                {editingId ? "Update book information" : "ADD MATERIALS"}
              </h2>
              <p className="mt-1 text-xs text-[var(--module-muted-color)]">
                Keep department, shelf, and prompt-search metadata synchronized with the shared catalog.
              </p>
            </div>
            <BookOpen className="h-5 w-5 text-[var(--module-muted-2)]" />
          </div>

          <form className="mt-3 grid gap-2.5" onSubmit={handleSubmit}>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--module-muted-color)]">Title</span>
              <input
                className="control-compact"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>

            <div className="grid gap-2.5 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-[var(--module-muted-color)]">Author</span>
                <input
                  className="control-compact"
                  value={form.author}
                  onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-[var(--module-muted-color)]">ISBN</span>
                <input
                  className="control-compact"
                  value={form.isbn}
                  onChange={(event) => setForm((current) => ({ ...current, isbn: event.target.value }))}
                />
              </label>
            </div>

            <div className="grid gap-2.5 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-[var(--module-muted-color)]">Publication Date</span>
                <input
                  type="date"
                  className="control-compact"
                  value={form.publicationDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, publicationDate: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-[var(--module-muted-color)]">Department</span>
                <select
                  className="control-compact"
                  value={form.department}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      department: event.target.value as Department,
                    }))
                  }
                >
                  {departmentOptions
                    .filter((option) => option !== "All")
                    .map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-[var(--module-muted-color)]">Availability</span>
                <select
                  className="control-compact"
                  value={form.availability}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      availability: event.target.value as BookRecord["availability"],
                    }))
                  }
                >
                  {["Available", "Limited", "Reserved"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--module-muted-color)]">Shelf Location</span>
              <input
                className="control-compact"
                value={form.shelfLocation}
                onChange={(event) =>
                  setForm((current) => ({ ...current, shelfLocation: event.target.value }))
                }
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[var(--module-muted-color)]">Summary</span>
              <textarea
                className="glass-input min-h-32 px-3 py-2.5"
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[var(--sidebar-accent)] px-4 text-sm font-semibold text-[#0b1c2c]"
              >
                {editingId ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {submitting ? "Saving..." : editingId ? "Update Book" : "Add Book"}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-sm font-semibold text-[var(--module-muted-color)]"
                onClick={resetForm}
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </form>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { label: "Catalog Size", value: insights.total.toLocaleString() },
              { label: "Limited Stock", value: insights.limited.toString() },
              { label: "Top AI Score", value: `${insights.highestScore}%` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-muted)] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--module-muted-2)]">{stat.label}</p>
                <p className="mt-1.5 text-xl font-semibold text-[var(--module-title-color)]">{stat.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge>Catalog Monitor</Badge>
              <h2 className="mt-3 text-xl font-semibold text-[var(--module-title-color)]">Records Inventory</h2>
              <p className="mt-1 text-sm text-[var(--module-muted-color)]">
                Search the live catalog and keep each record readable, complete, and ready for AI matching.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_240px]">
            <input
              className="control-compact"
              placeholder="Search title, author, ISBN, or shelf"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
            <select
              className="control-compact"
              value={department}
              onChange={(event) => {
                setPage(1);
                setDepartment(event.target.value as Department | "All");
              }}
            >
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--module-muted-color)]">
            <span>
              Showing page {page} of {totalPages}
            </span>
            <span>{totalBooks.toLocaleString()} records in the shared catalog</span>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-[8px] border border-[var(--line)]">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
                  <th className="px-4 py-3 text-left">
                    <button type="button" onClick={() => toggleSort('title')} className="flex items-center gap-2">
                      Title
                      {sortBy === 'title' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button type="button" onClick={() => toggleSort('department')} className="flex items-center gap-2">
                      Department
                      {sortBy === 'department' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button type="button" onClick={() => toggleSort('isbn')} className="flex items-center gap-2">
                      ISBN
                      {sortBy === 'isbn' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button type="button" onClick={() => toggleSort('aiScore')} className="flex items-center gap-2">
                      AI Score
                      {sortBy === 'aiScore' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">Availability</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((row, index) => {
                  if (row.type === "department") {
                    return (
                      <tr key={`department-${row.department}-${index}`} className="bg-[var(--surface-muted)]">
                        <td colSpan={6} className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--module-muted-color)]">
                          Department: {row.department}
                        </td>
                      </tr>
                    );
                  }

                  const book = row.book;
                  return (
                    <tr key={book.id} className="border-b last:border-b-0 hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--module-title-color)]">{book.title}</div>
                        <div className="mt-0.5 text-sm text-[var(--module-muted-2)]">{book.author}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--module-muted-color)]">{book.department}</td>
                      <td className="px-4 py-3 text-[var(--module-muted-color)]">{book.isbn}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{book.aiScore}%</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={availabilityTone(book.availability)}>{book.availability}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-[8px] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200"
                            onClick={() => void handleDelete(book.id)}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1}
              className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--module-muted-color)] disabled:opacity-40"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--module-muted-color)] disabled:opacity-40"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

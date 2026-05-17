"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Library,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import type { BookRecord, Department } from "@/lib/types";

const departmentOptions: Array<Department | "All"> = [
  "All",
  "Circulation",
  "General Reference",
  "Filipiniana",
  "Reserve",
  "Periodical",
  "Special Collections",
];

const DEPT_COLORS: Record<string, string> = {
  "Circulation":         "#6EE7B7",
  "General Reference":  "#93C5FD",
  "Filipiniana":        "#FDE68A",
  "Reserve":            "#FCA5A5",
  "Periodical":         "#C4B5FD",
  "Special Collections":"#F9A8D4",
  "All":                "#94A3B8",
};

const emptyBookForm = {
  title: "",
  author: "",
  isbn: "",
  publicationDate: "2025-01-01",
  department: "Circulation" as Department,
  shelfLocation: "",
  summary: "",
  availability: "Available" as BookRecord["availability"],
};

function AvailBadge({ status }: { status: BookRecord["availability"] }) {
  const map = {
    Available: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Limited:   "bg-red-500/15 text-red-300 border-red-500/30",
    Reserved:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${map[status]}`}>
      {status}
    </span>
  );
}

export function RecordsModule() {
  const [books, setBooks]           = useState<BookRecord[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [search, setSearch]         = useState("");
  const [department, setDepartment] = useState<Department | "All">("All");
  const [page, setPage]             = useState(1);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(emptyBookForm);
  const [submitting, setSubmitting] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const pageSize = 60;

  const loadBooks = useCallback(async () => {
    const params = new URLSearchParams({
      search: deferredSearch,
      department,
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await fetch(`/api/records?${params}`);
    if (!res.ok) return;
    const payload = (await res.json()) as { books: BookRecord[]; total: number };
    startTransition(() => {
      setBooks(payload.books);
      setTotalBooks(payload.total);
    });
  }, [deferredSearch, department, page]);

  useEffect(() => { void loadBooks(); }, [loadBooks]);

  // Alphabetical grouping by first letter of title
  const groupedRows = useMemo(() => {
    const sorted = [...books].sort((a, b) => a.title.localeCompare(b.title));
    const rows: Array<{ type: "letter"; letter: string } | { type: "book"; book: BookRecord }> = [];
    let current = "";
    for (const book of sorted) {
      const letter = book.title[0]?.toUpperCase() ?? "#";
      if (letter !== current) {
        current = letter;
        rows.push({ type: "letter", letter });
      }
      rows.push({ type: "book", book });
    }
    return rows;
  }, [books]);

  const totalPages = Math.max(1, Math.ceil(totalBooks / pageSize));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(emptyBookForm);
    setShowModal(false);
    await loadBooks();
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    await loadBooks();
  }

  const available = books.filter(b => b.availability === "Available").length;
  const limited   = books.filter(b => b.availability !== "Available").length;

  return (
    <div className="flex h-full flex-col gap-6 px-1">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">Librarian · Records</p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">Catalog Inventory</h1>
          <p className="mt-0.5 text-sm text-slate-400">Browse, search and manage the shared book catalog.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          suppressHydrationWarning
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Book
        </button>
      </div>

      {/* ── Stat pills ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Records", value: totalBooks.toLocaleString(), color: "#FCD400" },
          { label: "Available",     value: available.toLocaleString(),  color: "#6EE7B7" },
          { label: "Not Available", value: limited.toLocaleString(),    color: "#FCA5A5" },
        ].map(stat => (
          <div key={stat.label}
            className="rounded-2xl border border-white/8 bg-[#152E47]/60 px-5 py-4 backdrop-blur"
            style={{ borderLeftColor: stat.color, borderLeftWidth: 4 }}
          >
            <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">{stat.label}</p>
            <p className="mt-1 text-2xl font-black text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Search & filter ────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
            placeholder="Search title, author, ISBN…"
            value={search}
            onChange={e => { setPage(1); setSearch(e.target.value); }}
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            suppressHydrationWarning
            className="rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-8 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none"
            value={department}
            onChange={e => { setPage(1); setDepartment(e.target.value as Department | "All"); }}
          >
            {departmentOptions.map(d => <option key={d} value={d} className="bg-[#0F1D29]">{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur">
        <div className="overflow-auto h-full">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-[#152E47]/60">
                {["Title / Author", "Department", "ISBN", "Shelf", "Availability", ""].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row, i) => {
                if (row.type === "letter") {
                  return (
                    <tr key={`letter-${row.letter}-${i}`}>
                      <td colSpan={6} className="px-5 py-2 bg-[#152E47]/30">
                        <span className="text-[11px] font-black tracking-[0.25em] text-[#FCD400] uppercase">
                          — {row.letter} —
                        </span>
                      </td>
                    </tr>
                  );
                }
                const book = row.book;
                const deptColor = DEPT_COLORS[book.department] ?? "#94A3B8";
                return (
                  <tr key={book.id} className="border-b border-white/5 transition hover:bg-white/3">
                    <td className="px-5 py-3.5 max-w-[260px]">
                      <div className="font-semibold text-white leading-snug line-clamp-1">{book.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{book.author}</div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: deptColor }}>
                        <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: deptColor }} />
                        {book.department}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{book.isbn}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{book.shelfLocation}</td>
                    <td className="px-5 py-3.5"><AvailBadge status={book.availability} /></td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => void handleDelete(book.id)}
                        suppressHydrationWarning
                        className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 transition"
                        title="Archive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {groupedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-500">
                    <Library className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2">
        <span>{totalBooks.toLocaleString()} records · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            suppressHydrationWarning
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold disabled:opacity-30 hover:bg-white/10 transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            suppressHydrationWarning
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold disabled:opacity-30 hover:bg-white/10 transition"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Add Book Modal ─────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/12 bg-[#0F1D29] shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD400]/15">
                  <BookOpen className="h-4 w-4 text-[#FCD400]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#FCD400] uppercase">Catalog</p>
                  <h2 className="text-base font-black text-white">Add New Book</h2>
                </div>
              </div>
              <button
                suppressHydrationWarning
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Title</span>
                <input suppressHydrationWarning required className="modal-input" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Author</span>
                  <input suppressHydrationWarning required className="modal-input" value={form.author}
                    onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">ISBN</span>
                  <input suppressHydrationWarning className="modal-input" value={form.isbn}
                    onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Pub. Date</span>
                  <input suppressHydrationWarning type="date" className="modal-input" value={form.publicationDate}
                    onChange={e => setForm(f => ({ ...f, publicationDate: e.target.value }))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Department</span>
                  <select suppressHydrationWarning className="modal-input" value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))}>
                    {departmentOptions.filter(d => d !== "All").map(d => (
                      <option key={d} value={d} className="bg-[#0F1D29]">{d}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Status</span>
                  <select suppressHydrationWarning className="modal-input" value={form.availability}
                    onChange={e => setForm(f => ({ ...f, availability: e.target.value as BookRecord["availability"] }))}>
                    {["Available", "Limited", "Reserved"].map(s => (
                      <option key={s} value={s} className="bg-[#0F1D29]">{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Shelf Location</span>
                <input suppressHydrationWarning className="modal-input" value={form.shelfLocation}
                  onChange={e => setForm(f => ({ ...f, shelfLocation: e.target.value }))} />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Summary</span>
                <textarea suppressHydrationWarning rows={3} className="modal-input resize-none" value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
              </label>

              <div className="flex justify-end gap-3 pt-1">
                <button suppressHydrationWarning type="button" onClick={() => setShowModal(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition">
                  Cancel
                </button>
                <button suppressHydrationWarning type="submit" disabled={submitting}
                  className="rounded-xl bg-[#FCD400] px-6 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 hover:brightness-110 disabled:opacity-60 transition">
                  {submitting ? "Saving…" : "Add Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inline styles for modal inputs ─────────────────── */}
      <style>{`
        .modal-input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.05);
          padding: 8px 12px;
          font-size: 13px;
          color: #fff;
          outline: none;
          transition: border-color 0.15s;
        }
        .modal-input:focus {
          border-color: rgba(252,212,0,0.5);
        }
        .modal-input option {
          background: #0F1D29;
        }
      `}</style>
    </div>
  );
}

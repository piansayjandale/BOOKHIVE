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
  Clock,
  Copy,
  Download,
  Info,
  Library,
  Plus,
  Search,
  Tag,
  Upload,
  X,
} from "lucide-react";

import { useRouter } from "next/navigation";
import type { BookRecord, Department } from "@/lib/types";
import { useSession } from "@/components/providers/session-provider";

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
  genres: "",
  copies: 1,
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

function escapeCSV(val: any) {
  if (val === null || val === undefined) return "";
  let text = String(val).replace(/"/g, '""');
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    text = `"${text}"`;
  }
  return text;
}

function parseCSV(text: string) {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        entry += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(entry.trim());
        entry = "";
      } else if (char === '\r' || char === '\n') {
        row.push(entry.trim());
        entry = "";
        if (row.length > 0 || row.some(cell => cell !== "")) {
          lines.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        entry += char;
      }
    }
  }

  if (entry || row.length > 0) {
    row.push(entry.trim());
    if (row.some(cell => cell !== "")) {
      lines.push(row);
    }
  }

  return lines;
}

export function RecordsModule() {
  const router = useRouter();
  const { user } = useSession();
  const [books, setBooks]           = useState<BookRecord[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [search, setSearch]         = useState("");
  const [department, setDepartment] = useState<Department | "All">("All");
  const [page, setPage]             = useState(1);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(emptyBookForm);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<BookRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookRecord | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: 0 });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);
      let allBooks: any[] = [];
      const limit = 200;
      const total = totalBooks;
      
      const totalPages = Math.ceil(total / limit);
      
      for (let p = 1; p <= totalPages; p++) {
        const params = new URLSearchParams({
          search: search,
          department,
          page: String(p),
          pageSize: String(limit),
        });
        const res = await fetch(`/api/records?${params}`);
        if (!res.ok) throw new Error("Failed to fetch page " + p);
        const payload = await res.json();
        if (payload.books) {
          allBooks = allBooks.concat(payload.books);
        }
        setExportProgress(Math.round((p / (totalPages || 1)) * 100));
      }
      
      const headers = ["Title", "Author", "ISBN", "Published Date", "Department", "Shelf Location", "Summary", "Availability", "Genres", "Copies"];
      const csvRows = [headers.join(",")];
      
      for (const book of allBooks) {
        const row = [
          escapeCSV(book.title || ""),
          escapeCSV(book.author || ""),
          escapeCSV(book.isbn || ""),
          escapeCSV(book.publishedDate || book.publicationDate || ""),
          escapeCSV(book.department || ""),
          escapeCSV(book.shelfLocation || ""),
          escapeCSV(book.summary || ""),
          escapeCSV(book.availability || "Available"),
          escapeCSV(book.genres || ""),
          escapeCSV(String(book.copies || 1)),
        ];
        csvRows.push(row.join(","));
      }
      
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `bookhive_catalog_${department.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = parseCSV(text);
        if (lines.length <= 1) {
          alert("CSV file is empty or does not contain data rows.");
          return;
        }

        const headers = lines[0].map(h => h.toLowerCase().replace(/[\s_-]/g, ""));
        const titleIdx = headers.indexOf("title");
        const authorIdx = headers.indexOf("author");

        if (titleIdx === -1 || authorIdx === -1) {
          alert("CSV must contain 'Title' and 'Author' columns.");
          return;
        }

        const bookDataList = lines.slice(1).map(row => {
          const book: any = {};
          row.forEach((cell, idx) => {
            const header = headers[idx];
            if (!header) return;
            
            if (header === "title") book.title = cell;
            else if (header === "author") book.author = cell;
            else if (header === "isbn") book.isbn = cell;
            else if (header === "publicationdate" || header === "publisheddate") book.publicationDate = cell;
            else if (header === "department") book.department = cell;
            else if (header === "shelflocation") book.shelfLocation = cell;
            else if (header === "summary" || header === "description") book.summary = cell;
            else if (header === "availability") book.availability = cell;
            else if (header === "genres" || header === "genre" || header === "category") book.genres = cell;
            else if (header === "copies") book.copies = parseInt(cell) || 1;
          });
          return book;
        }).filter(b => b.title && b.author);

        if (bookDataList.length === 0) {
          alert("No valid books found in the CSV (missing Title or Author).");
          return;
        }

        setIsImporting(true);
        setImportProgress({ current: 0, total: bookDataList.length, errors: 0 });

        const validDepts = ["Circulation", "General Reference", "Filipiniana", "Reserve", "Periodical", "Special Collections"];
        let currentCount = 0;
        let errorCount = 0;

        const batchSize = 5;
        for (let i = 0; i < bookDataList.length; i += batchSize) {
          const batch = bookDataList.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (book) => {
            let matchedDept = "Circulation" as Department;
            const parsedDept = book.department?.trim();
            if (parsedDept) {
              const match = validDepts.find(d => d.toLowerCase() === parsedDept.toLowerCase());
              if (match) matchedDept = match as Department;
            }

            const payload = {
              title: book.title,
              author: book.author,
              isbn: book.isbn || `N/A-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              publicationDate: book.publicationDate || new Date().toISOString().split("T")[0],
              department: matchedDept,
              shelfLocation: book.shelfLocation || "",
              summary: book.summary || "",
              availability: book.availability || "Available",
              genres: book.genres || "",
              copies: book.copies || 1,
            };

            try {
              const res = await fetch("/api/records", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (!res.ok) {
                errorCount++;
              }
            } catch (err) {
              errorCount++;
            }
            
            currentCount++;
            setImportProgress(p => ({ ...p, current: currentCount, errors: errorCount }));
          }));
        }

        await loadBooks();
        alert(`Import completed! ${bookDataList.length - errorCount} books imported successfully, ${errorCount} failed.`);
      } catch (err) {
        console.error("Import error:", err);
        alert("An error occurred during import: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };


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

  useEffect(() => {
    if (!search.trim()) {
      setSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          search: search,
          department,
          page: "1",
          pageSize: "5",
        });
        const res = await fetch(`/api/records?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.books) {
          setSuggestions(data.books);
        }
      } catch (err) {
        console.error("Suggestions load error:", err);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [search, department]);

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      const container = document.getElementById("search-autocomplete-container");
      if (container && !container.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

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
    if (user?.role === "Librarian") {
      await loadBooks();
    } else {
      router.push("/admin/management?tab=books");
    }
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

        <div className="flex items-center gap-3">
          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting || isImporting}
            suppressHydrationWarning
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
            title="Export Catalog to CSV"
          >
            {isExporting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                {exportProgress}%
              </span>
            ) : (
              <>
                <Download className="h-4 w-4 text-slate-400" />
                Export
              </>
            )}
          </button>

          {/* Import Button */}
          <button
            onClick={() => document.getElementById("csv-file-input")?.click()}
            disabled={isExporting || isImporting}
            suppressHydrationWarning
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
            title="Import Books from CSV"
          >
            {isImporting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                Importing...
              </span>
            ) : (
              <>
                <Upload className="h-4 w-4 text-slate-400" />
                Import
              </>
            )}
          </button>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleImportFileChange}
            className="hidden"
          />

          <button
            onClick={() => setShowModal(true)}
            suppressHydrationWarning
            className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add Book
          </button>
        </div>
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
        <div className="relative flex-1 min-w-[200px]" id="search-autocomplete-container">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
            placeholder="Search title, author, ISBN…"
            value={search}
            onChange={e => { setPage(1); setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-30 mt-1.5 rounded-xl border border-white/8 bg-[#0F1D29]/95 p-2 shadow-2xl backdrop-blur-md">
              <div className="space-y-1">
                {suggestions.map((book) => (
                  <button
                    key={`suggestion-${book.id}`}
                    onClick={() => {
                      setSearch(book.title);
                      setShowSuggestions(false);
                    }}
                    className="w-full flex items-center justify-between rounded-lg p-2 text-left hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-white line-clamp-1">{book.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{book.author}</p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                      {book.isbn}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <select
            suppressHydrationWarning
            className="rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 pr-8 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none"
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

            <tbody>
              {groupedRows.map((row, i) => {
                if (row.type === "letter") {
                  return (
                    <tr key={`letter-${row.letter}-${i}`} className="border-t border-b border-white/5 bg-transparent">
                      <td colSpan={6} className="px-5 py-3 text-center bg-transparent">
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
                  <tr key={book.id} className="border-b border-white/5 transition hover:bg-white/3 cursor-pointer" onClick={() => setSelectedBookDetails(book)}>
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
                        onClick={(e) => { e.stopPropagation(); void handleDelete(book.id); }}
                        suppressHydrationWarning
                        className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-1.5 text-orange-400 hover:bg-orange-500/15 hover:border-orange-500/30 transition active:scale-95"
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

              <div className="grid grid-cols-3 gap-4">
                <label className="grid gap-1.5 col-span-2">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Genre</span>
                  <input
                    suppressHydrationWarning
                    className="modal-input"
                    value={form.genres}
                    onChange={(e) => setForm((f) => ({ ...f, genres: e.target.value }))}
                    placeholder="e.g. Science Fiction, Tech"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Copies</span>
                  <input
                    suppressHydrationWarning
                    type="number"
                    min={1}
                    className="modal-input"
                    value={form.copies}
                    onChange={(e) => setForm((f) => ({ ...f, copies: parseInt(e.target.value) || 1 }))}
                  />
                </label>
              </div>

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
      {/* ── Import Progress Modal ──────────────────────────── */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/12 bg-[#0F1D29] p-6 shadow-2xl shadow-black/60">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD400]/15">
                <Upload className="h-4 w-4 text-[#FCD400] animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#FCD400] uppercase">Catalog</p>
                <h2 className="text-base font-black text-white">Importing Books</h2>
              </div>
            </div>
            
            <p className="text-sm text-slate-400 mb-6">
              Processing and inserting books into the catalog database. Please keep this window open.
            </p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Progress</span>
                <span>{importProgress.current} / {importProgress.total} books ({Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%)</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                <div 
                  className="bg-[#FCD400] h-full transition-all duration-300 rounded-full" 
                  style={{ width: `${(importProgress.current / (importProgress.total || 1)) * 100}%` }}
                />
              </div>
            </div>

            {importProgress.errors > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                ⚠️ Failed to import {importProgress.errors} books. (e.g. duplicate ISBNs or invalid records)
              </div>
            )}
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

      {/* ── Book Details Modal ─────────────────────────────────── */}
      {selectedBookDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedBookDetails(null)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/12 bg-[#0A1624] shadow-2xl shadow-black/60 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/8 px-8 py-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#14283F] to-transparent opacity-30" />
              <div className="relative z-10">
                <p className="text-[10px] font-bold tracking-[0.25em] text-[#FCD400] uppercase mb-2">Book Archive Details</p>
                <h2 className="text-3xl font-black text-white tracking-tight">{selectedBookDetails.title}</h2>
                <p className="mt-1 text-sm text-slate-400">By {selectedBookDetails.author}</p>
                <div className="mt-4">
                  <AvailBadge status={selectedBookDetails.availability} />
                </div>
              </div>
              <button
                suppressHydrationWarning
                onClick={() => setSelectedBookDetails(null)}
                className="relative z-10 rounded-lg p-2 text-slate-400 hover:bg-white/8 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 grid gap-6 max-h-[70vh] overflow-y-auto">
              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD600]/10 text-[#FFD600]">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">ISBN</p>
                    <p className="text-sm font-bold text-white">{selectedBookDetails.isbn}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD600]/10 text-[#FFD600]">
                    <Info className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Department</p>
                    <p className="text-sm font-bold text-white">{selectedBookDetails.department}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD600]/10 text-[#FFD600]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Shelf Location</p>
                    <p className="text-sm font-bold text-white">{selectedBookDetails.shelfLocation || "Not available"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFD600]/10 text-[#FFD600]">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Genre</p>
                    <p className="text-sm font-bold text-white">{selectedBookDetails.genres || "Not specified"}</p>
                  </div>
                </div>
              </div>

              {/* Citation */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold tracking-widest text-[#FCD400] uppercase">APA Scholarly Citation</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `${selectedBookDetails.author}. (n.d.). ${selectedBookDetails.title}. STI West Negros University Library.`;
                      void navigator.clipboard.writeText(text);
                      alert("Citation copied to clipboard!");
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    COPY TEXT
                  </button>
                </div>
                <div className="rounded-lg bg-black/40 p-4 font-mono text-sm leading-relaxed text-slate-300">
                  {selectedBookDetails.author}. (n.d.). {selectedBookDetails.title}. STI West Negros University Library.
                </div>
              </div>

              {/* Summary */}
              {selectedBookDetails.summary && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                  <h3 className="mb-3 text-[11px] font-bold tracking-widest text-slate-500 uppercase">Summary Description</h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {selectedBookDetails.summary}
                  </p>
                </div>
              )}
            </div>
            
            {/* Scrollbar style indication from screenshot (yellow right border) */}
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#FCD400]/80 rounded-l" />
          </div>
        </div>
      )}
    </div>
  );
}

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
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Info,
  Library,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";
import type { BookRecord, Department } from "@/lib/types";
import { useSession } from "@/components/providers/session-provider";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import { generateCallNumber, generateAccessionNumber, ALL_SYSTEM_GENRES, VOLUME_OPTIONS, EDITION_OPTIONS } from "@/lib/catalog/call-number";
import { CustomSelect } from "@/components/ui/custom-select";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export type NormalizedStatus = "Available" | "Reserved" | "Unavailable";

export function normalizeStatus(rawStatus?: string | null): NormalizedStatus {
  if (!rawStatus) return "Available";
  const s = rawStatus.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "available" || s === "instock" || s === "in_stock") {
    return "Available";
  }
  if (s === "reserved" || s === "pending" || s === "hold" || s === "onhold") {
    return "Reserved";
  }
  if (
    s === "unavailable" ||
    s === "notavailable" ||
    s === "limited" ||
    s === "borrowed" ||
    s === "checkedout" ||
    s === "onloan" ||
    s === "lost"
  ) {
    return "Unavailable";
  }
  return "Available";
}

export function computeBookCopyStats(book: BookRecord | { copies?: number; availability?: string } | null | undefined) {
  const status = normalizeStatus(book?.availability);
  const totalCopies = Math.max(1, Number(book?.copies) || 1);

  let availableCopies = totalCopies;
  let reservedCopies = 0;
  let unavailableCopies = 0;

  if (status === "Unavailable") {
    availableCopies = 0;
    reservedCopies = 0;
    unavailableCopies = totalCopies;
  } else if (status === "Reserved") {
    reservedCopies = 1;
    availableCopies = Math.max(0, totalCopies - 1);
    unavailableCopies = 0;
  } else {
    // Available
    availableCopies = totalCopies;
    reservedCopies = 0;
    unavailableCopies = 0;
  }

  return {
    totalCopies,
    availableCopies,
    reservedCopies,
    unavailableCopies,
    status,
  };
}

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

const DEPT_LIGHT_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "Circulation":         { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200/90", dot: "bg-emerald-500" },
  "General Reference":  { bg: "bg-sky-50",     text: "text-sky-800",     border: "border-sky-200/90",     dot: "bg-sky-500" },
  "Filipiniana":        { bg: "bg-amber-50",   text: "text-amber-800",   border: "border-amber-200/90",   dot: "bg-amber-500" },
  "Reserve":            { bg: "bg-rose-50",    text: "text-rose-800",    border: "border-rose-200/90",    dot: "bg-rose-500" },
  "Periodical":         { bg: "bg-purple-50",  text: "text-purple-800",  border: "border-purple-200/90",  dot: "bg-purple-500" },
  "Special Collections":{ bg: "bg-pink-50",    text: "text-pink-800",    border: "border-pink-200/90",    dot: "bg-pink-500" },
  "All":                { bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200/90",   dot: "bg-slate-400" },
};

function sanitizeIsbn(isbn?: string | null): string {
  if (!isbn) return "";
  return String(isbn)
    .replace(/[—–]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

const emptyBookForm = {
  title: "",
  author: "",
  isbn: "",
  publisher: "",
  publicationDate: "2026-09-01",
  department: "Circulation" as Department,
  shelfLocation: "",
  accessionNumber: "",
  genres: "",
  volume: "Single Volume / None",
  edition: "Single Edition / None",
  copies: 1,
  summary: "",
  availability: "Available" as BookRecord["availability"],
};

function AvailBadge({ status, isLight = false }: { status: BookRecord["availability"] | "Unavailable" | string; isLight?: boolean }) {
  const normalized = normalizeStatus(status);
  const mapDark: Record<NormalizedStatus, { badge: string; dot: string }> = {
    Available: {
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      dot: "bg-emerald-400",
    },
    Reserved: {
      badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      dot: "bg-amber-400",
    },
    Unavailable: {
      badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      dot: "bg-rose-400",
    },
  };
  const mapLight: Record<NormalizedStatus, { badge: string; dot: string }> = {
    Available: {
      badge: "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-2xs",
      dot: "bg-emerald-500 ring-2 ring-emerald-200",
    },
    Reserved: {
      badge: "bg-amber-50 text-amber-900 border-amber-300 font-bold shadow-2xs",
      dot: "bg-amber-500 ring-2 ring-amber-200",
    },
    Unavailable: {
      badge: "bg-rose-50 text-rose-800 border-rose-300 font-bold shadow-2xs",
      dot: "bg-rose-500 ring-2 ring-rose-200",
    },
  };
  const config = isLight ? mapLight[normalized] : mapDark[normalized];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${config.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {normalized}
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

export function RecordsModule({ variant }: { variant?: "technical" | "circulation" | "admin" | "librarian" } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const isTechnical = true;
  const canAddBook = true;
  const canExport = user?.role?.toUpperCase().includes("ADMIN") || (user?.permissions as any)?.export !== false;
  const canImport = user?.role?.toUpperCase().includes("ADMIN") || (user?.permissions as any)?.import !== false;
  const [books, setBooks]           = useState<BookRecord[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [search, setSearch]         = useState("");

  const deptFromQuery = searchParams.get("department");
  const [department, setDepartment] = useState<Department | "All">(() => {
    if (deptFromQuery && departmentOptions.includes(deptFromQuery as any)) {
      return deptFromQuery as Department;
    }
    return "All";
  });

  useEffect(() => {
    const q = searchParams.get("department");
    if (q && departmentOptions.includes(q as any)) {
      setDepartment(q as Department);
      setPage(1);
    }
  }, [searchParams]);

  const [page, setPage]             = useState(1);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(emptyBookForm);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<BookRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookRecord | null>(null);

  const [dashboardSummary, setDashboardSummary] = useState<{
    totalBooks: number;
    activeBorrowedBooks: number;
    pendingRequests: number;
  } | null>(null);

  const [dynamicGenres, setDynamicGenres] = useState<string[]>([]);

  // Fetch dynamic system genres from database catalog
  useEffect(() => {
    let isMounted = true;
    async function fetchGenres() {
      try {
        const res = await fetch("/api/records/genres");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data?.genres && Array.isArray(data.genres)) {
          setDynamicGenres(data.genres);
        }
      } catch {
        // fallback to system genres
      }
    }
    void fetchGenres();
    return () => { isMounted = false; };
  }, []);

  const sortedGenres = useMemo(() => {
    const set = new Set<string>();
    ALL_SYSTEM_GENRES.forEach((g) => { if (g) set.add(g.trim()); });
    dynamicGenres.forEach((g) => { if (g) set.add(g.trim()); });
    books.forEach((b) => {
      if (b.genres) {
        b.genres.split(",").forEach(g => { const clean = g.trim(); if (clean) set.add(clean); });
      }
      if ((b as any).category) {
        set.add((b as any).category.trim());
      }
    });
    if (form.genres && form.genres.trim()) {
      set.add(form.genres.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [dynamicGenres, books, form.genres]);

  // ── Segmented Toggle: "records" vs "digitized" ──────────────
  const [activeTab, setActiveTab] = useState<"records" | "digitized">("records");

  // ── Digitized Queue State (Librarian Mobile Intake) ──────────
  const [digitizedBooks, setDigitizedBooks] = useState<any[]>([]);
  const [digitizedLoading, setDigitizedLoading] = useState(false);
  const [digitizedSearch, setDigitizedSearch] = useState("");
  const [digitizedDept, setDigitizedDept] = useState<Department | "All">("All");
  const [selectedDigitizedForReview, setSelectedDigitizedForReview] = useState<any | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState<any>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [expandedRawTextId, setExpandedRawTextId] = useState<string | null>(null);

  const reviewGenreOptions = useMemo(() => {
    const set = new Set<string>();
    sortedGenres.forEach((g) => { if (g) set.add(g.trim()); });
    if (reviewForm?.genres && reviewForm.genres.trim()) {
      set.add(reviewForm.genres.trim());
    }
    if (reviewForm?.category && reviewForm.category.trim()) {
      set.add(reviewForm.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [sortedGenres, reviewForm?.genres, reviewForm?.category]);

  const fetchDigitizedBooks = useCallback(async () => {
    try {
      setDigitizedLoading(true);
      const params = new URLSearchParams();
      if (digitizedSearch) params.set("search", digitizedSearch);
      if (digitizedDept !== "All") params.set("department", digitizedDept);
      const res = await fetch(`/api/records/digitized?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.books)) {
        setDigitizedBooks(data.books);
      }
    } catch (err) {
      console.warn("Failed to fetch digitized queue:", err);
    } finally {
      setDigitizedLoading(false);
    }
  }, [digitizedSearch, digitizedDept]);

  useEffect(() => {
    void fetchDigitizedBooks();
  }, [fetchDigitizedBooks]);

  const pendingDigitizedCount = useMemo(() => {
    return digitizedBooks.filter(b => b.status !== "Cataloged" && b.status !== "Rejected").length;
  }, [digitizedBooks]);

  const filteredDigitizedBooks = useMemo(() => {
    return digitizedBooks.filter(b => b.status !== "Cataloged" && b.status !== "Rejected");
  }, [digitizedBooks]);

  const handleOpenReviewModal = (book: any) => {
    setSelectedDigitizedForReview(book);
    const pubYear = book.year || (book.publishedDate ? String(book.publishedDate).substring(0, 4) : "2026");
    const pubDate = book.publishedDate || `${pubYear}-01-01`;

    const initialReview = {
      title: book.title || "",
      author: book.author || "",
      isbn: sanitizeIsbn(book.isbn),
      department: (book.department && departmentOptions.includes(book.department as any) ? book.department : "Circulation") as Department,
      genres: book.genre || book.category || "General",
      category: book.category || book.genre || "General",
      copies: Math.max(1, Number(book.copies || 1)),
      edition: book.edition || "1st Edition",
      volume: book.volume || "Vol. 1",
      publisher: book.publisher || "",
      publishedDate: pubDate,
      summary: book.summary || "",
      shelfLocation: book.shelfLocation || "",
      accessionNumber: book.accessionNumber || "",
    };

    const generatedCall = generateCallNumber(initialReview);
    const generatedAcc = generateAccessionNumber(initialReview);

    setReviewForm({
      ...initialReview,
      shelfLocation: book.shelfLocation || generatedCall,
      accessionNumber: book.accessionNumber || generatedAcc,
    });
    setShowReviewModal(true);
  };

  const handleReviewFieldChange = (field: string, value: any) => {
    const sanitizedVal = field === "isbn" ? String(value).replace(/[—–]/g, "-").replace(/-+/g, "-") : value;
    setReviewForm((prev: any) => {
      const next = {
        ...prev,
        [field]: sanitizedVal,
        ...(field === "genres" ? { category: sanitizedVal } : {}),
      };
      if (["title", "author", "isbn", "department", "genres", "volume", "edition", "copies", "publishedDate"].includes(field)) {
        const nextCall = generateCallNumber(next);
        const nextAcc = generateAccessionNumber(next);
        return {
          ...next,
          shelfLocation: nextCall,
          accessionNumber: nextAcc,
        };
      }
      return next;
    });
  };

  const handleApproveAndCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDigitizedForReview || !reviewForm) return;

    try {
      setIsApproving(true);
      const payload = {
        ...reviewForm,
        isbn: sanitizeIsbn(reviewForm.isbn),
      };
      const res = await fetch(`/api/records/digitized/${selectedDigitizedForReview.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to approve and catalog book.");
      }

      setDigitizedBooks(prev => prev.filter(b => b.id !== selectedDigitizedForReview.id));
      setShowReviewModal(false);
      setSelectedDigitizedForReview(null);

      void loadBooks();
      alert(`✓ Successfully Cataloged!\n"${reviewForm.title}" is now officially published to the library catalog.`);
    } catch (err: any) {
      alert("Cataloging Error: " + (err.message || String(err)));
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectDigitizedBook = async (book: any) => {
    const confirmed = window.confirm(`Are you sure you want to reject and remove "${book.title}" from the digitized queue?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/records/digitized/${book.id}`, { method: "DELETE" });
      if (res.ok) {
        setDigitizedBooks(prev => prev.filter(b => b.id !== book.id));
      }
    } catch (err: any) {
      alert("Failed to reject entry: " + (err?.message || String(err)));
    }
  };

  // Automatic Call Number & Accession Number generation when input fields change
  useEffect(() => {
    if (!showModal) return;
    const generatedCall = generateCallNumber({
      title: form.title,
      author: form.author,
      isbn: form.isbn,
      publicationDate: form.publicationDate,
      department: form.department,
      genres: form.genres,
      volume: form.volume,
      edition: form.edition,
      copies: form.copies,
    });
    const generatedAcc = generateAccessionNumber({
      title: form.title,
      author: form.author,
      isbn: form.isbn,
      publicationDate: form.publicationDate,
      department: form.department,
      copies: form.copies,
    });
    setForm(prev => ({ ...prev, shelfLocation: generatedCall, accessionNumber: generatedAcc }));
  }, [
    showModal,
    form.title,
    form.author,
    form.isbn,
    form.publicationDate,
    form.department,
    form.genres,
    form.volume,
    form.edition,
    form.copies,
  ]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: 0 });

  useEffect(() => {
    let isMounted = true;
    async function fetchSummary() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.summary) {
          setDashboardSummary({
            totalBooks: data.summary.totalBooks || 0,
            activeBorrowedBooks: data.summary.activeBorrowedBooks || 0,
            pendingRequests: data.summary.pendingRequests || 0,
          });
        }
      } catch {
        // ignore background fetch error
      }
    }
    void fetchSummary();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "import") {
        const timer = setTimeout(() => {
          document.getElementById("csv-file-input")?.click();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, []);

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
      
      const headers = ["Title", "Author", "ISBN", "Publisher", "Published Date", "Department", "Call Number", "Summary", "Availability", "Genres", "Copies"];
      const csvRows = [headers.join(",")];
      
      for (const book of allBooks) {
        const row = [
          escapeCSV(book.title || ""),
          escapeCSV(book.author || ""),
          escapeCSV(book.isbn || ""),
          escapeCSV((book as any).publisher || ""),
          escapeCSV(book.publishedDate || book.publicationDate || ""),
          escapeCSV(book.department || ""),
          escapeCSV(book.shelfLocation || ""),
          escapeCSV(book.summary || ""),
          escapeCSV(normalizeStatus(book.availability)),
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
            else if (header === "publisher") book.publisher = cell;
            else if (header === "publicationdate" || header === "publisheddate") book.publicationDate = cell;
            else if (header === "department") book.department = cell;
            else if (header === "shelflocation") book.shelfLocation = cell;
            else if (header === "summary" || header === "description") book.summary = cell;
            else if (header === "availability") book.availability = normalizeStatus(cell);
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
              publisher: book.publisher || "",
              publicationDate: book.publicationDate || new Date().toISOString().split("T")[0],
              department: matchedDept,
              shelfLocation: book.shelfLocation || "",
              summary: book.summary || "",
              availability: normalizeStatus(book.availability),
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

  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const commitPage = useCallback((valStr: string) => {
    const parsed = parseInt(valStr.trim(), 10);
    if (isNaN(parsed) || parsed < 1) {
      setPage(1);
      setPageInput("1");
    } else if (parsed > totalPages) {
      setPage(totalPages);
      setPageInput(String(totalPages));
    } else {
      setPage(parsed);
      setPageInput(String(parsed));
    }
  }, [totalPages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        availability: normalizeStatus(form.availability),
      }),
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

  // Inventory Summary Metrics (accurate client synchronization)
  const stats = useMemo(() => {
    // If a filter is active and all results are within the current loaded array
    if ((search.trim() !== "" || department !== "All") && totalBooks <= books.length && books.length > 0) {
      let totalCopies = 0;
      let availCopies = 0;
      let resCopies = 0;
      let unavailCopies = 0;
      let availRecords = 0;
      let resRecords = 0;
      let unavailRecords = 0;

      for (const b of books) {
        const c = computeBookCopyStats(b);
        totalCopies += c.totalCopies;
        availCopies += c.availableCopies;
        resCopies += c.reservedCopies;
        unavailCopies += c.unavailableCopies;

        if (c.status === "Available") availRecords++;
        else if (c.status === "Reserved") resRecords++;
        else unavailRecords++;
      }

      return {
        total: totalBooks,
        totalCopies: totalCopies || totalBooks,
        available: availRecords,
        reserved: resRecords,
        unavailable: unavailRecords,
        availableCopies: availCopies,
        reservedCopies: resCopies,
        unavailableCopies: unavailCopies,
      };
    }

    // Catalog-wide view synced with backend summary
    const unavailable = dashboardSummary?.activeBorrowedBooks ?? books.filter(b => normalizeStatus(b.availability) === "Unavailable").length;
    const reserved = dashboardSummary?.pendingRequests ?? books.filter(b => normalizeStatus(b.availability) === "Reserved").length;
    const safeUnavailable = Math.min(totalBooks, unavailable);
    const safeReserved = Math.min(Math.max(0, totalBooks - safeUnavailable), reserved);
    const available = Math.max(0, totalBooks - safeUnavailable - safeReserved);

    const avgCopies = books.length > 0
      ? books.reduce((acc, b) => acc + (Math.max(1, Number(b.copies) || 1)), 0) / books.length
      : 1;
    const totalCopies = Math.round(totalBooks * avgCopies);

    return {
      total: totalBooks,
      totalCopies: Math.max(totalBooks, totalCopies),
      available,
      reserved: safeReserved,
      unavailable: safeUnavailable,
    };
  }, [books, totalBooks, search, department, dashboardSummary]);

  return (
    <div className="flex min-h-full flex-col gap-6 px-1 pb-10">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-[11px] font-bold tracking-[0.2em] uppercase transition-colors",
            isLight ? "text-[#0274BB]" : "text-[#FCD400]"
          )}>
            Librarian · Records
          </p>
          <h1 className={cn(
            "mt-1 text-2xl font-black tracking-tight transition-colors",
            isLight ? "text-slate-900" : "text-white"
          )}>
            {activeTab === "records" ? "Catalog Inventory" : "Digitized Queue & Cataloging"}
          </h1>
          <p className={cn(
            "mt-0.5 text-sm transition-colors",
            isLight ? "text-slate-600 font-medium" : "text-slate-400"
          )}>
            {activeTab === "records"
              ? "Browse, search and manage the shared book catalog."
              : "Review and complete official cataloging for books ingested from the Librarian Mobile App book scanner."}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {/* Records & Digitized Segmented Toggle - Placed immediately before Export */}
          <div className={cn(
            "flex items-center p-1 rounded-xl border transition-all",
            isLight
              ? "bg-slate-100/90 border-[#cbd5e1] shadow-2xs"
              : "bg-white/5 border-white/10"
          )}>
            <button
              type="button"
              onClick={() => setActiveTab("records")}
              className={cn(
                "flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-[92px]",
                activeTab === "records"
                  ? isLight
                    ? "bg-[#0274BB] text-white shadow-sm ring-1 ring-[#0274BB]/20"
                    : "bg-[#0274BB] text-white shadow-md"
                  : isLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Records</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("digitized");
                void fetchDigitizedBooks();
              }}
              className={cn(
                "flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-[92px]",
                activeTab === "digitized"
                  ? isLight
                    ? "bg-[#0274BB] text-white shadow-sm ring-1 ring-[#0274BB]/20"
                    : "bg-[#0274BB] text-white shadow-md"
                  : isLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Sparkles className={cn("h-3.5 w-3.5", activeTab === "digitized" ? "text-amber-300" : "text-amber-500")} />
              <span>Digitized</span>
            </button>
          </div>

          {/* Export Button - Blue Highlight */}
          {canExport && (
            <button
              onClick={handleExport}
              disabled={isExporting || isImporting}
              suppressHydrationWarning
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold shadow-2xs transition active:scale-95 disabled:opacity-50",
                isLight
                  ? "border-sky-200 bg-sky-50/70 text-[#0274BB] hover:bg-sky-100 hover:border-sky-300"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10 shadow-lg"
              )}
              title="Export Catalog to CSV"
            >
              {isExporting ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                  {exportProgress}%
                </span>
              ) : (
                <>
                  <Download className={cn("h-4 w-4", isLight ? "text-[#0274BB]" : "text-slate-400")} />
                  Export
                </>
              )}
            </button>
          )}

          {canImport && canAddBook && (
            <>
              {/* Import Button - Violet Highlight */}
              <button
                onClick={() => document.getElementById("csv-file-input")?.click()}
                disabled={isExporting || isImporting}
                suppressHydrationWarning
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold shadow-2xs transition active:scale-95 disabled:opacity-50",
                  isLight
                    ? "border-purple-200 bg-purple-50/70 text-purple-700 hover:bg-purple-100 hover:border-purple-300"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10 shadow-lg"
                )}
                title="Import Books from CSV"
              >
                {isImporting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                    Importing...
                  </span>
                ) : (
                  <>
                    <Upload className={cn("h-4 w-4", isLight ? "text-purple-600" : "text-slate-400")} />
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
            </>
          )}

          {canAddBook && (
            /* Add Book Button - Vibrant Yellow Highlight */
            <button
              onClick={() => setShowModal(true)}
              suppressHydrationWarning
              className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-md shadow-[#FCD400]/25 transition hover:brightness-105 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add Book
            </button>
          )}
        </div>
      </div>

      {activeTab === "records" ? (
        <>

      {/* ── Search & filter ────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]" id="search-autocomplete-container">
          <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", isLight ? "text-[#0274BB]" : "text-slate-500")} />
          <input
            suppressHydrationWarning
            className={cn(
              "w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-all",
              isLight
                ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#0274BB] focus:ring-2 focus:ring-[#0274BB]/15 shadow-2xs"
                : "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-[#FCD400]/50"
            )}
            placeholder="Search title, author, ISBN…"
            value={search}
            onChange={e => { setPage(1); setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className={cn(
              "absolute left-0 right-0 z-30 mt-1.5 rounded-xl border p-2 shadow-2xl backdrop-blur-md",
              isLight ? "border-slate-200 bg-white text-slate-900" : "border-white/8 bg-[#0F1D29]/95 text-white"
            )}>
              <div className="space-y-1">
                {suggestions.map((book) => (
                  <button
                    key={`suggestion-${book.id}`}
                    onClick={() => {
                      setSearch(book.title);
                      setShowSuggestions(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg p-2 text-left transition-colors",
                      isLight ? "hover:bg-slate-100" : "hover:bg-white/5"
                    )}
                  >
                    <div>
                      <p className={cn("text-xs font-bold line-clamp-1", isLight ? "text-slate-900" : "text-white")}>{book.title}</p>
                      <p className={cn("text-[10px] mt-0.5", isLight ? "text-slate-500" : "text-slate-400")}>{book.author}</p>
                    </div>
                    <span className={cn(
                      "text-[9px] font-mono px-1.5 py-0.5 rounded border",
                      isLight ? "bg-slate-100 text-slate-600 border-slate-200" : "text-slate-400 bg-white/5 border-white/5"
                    )}>
                      {sanitizeIsbn(book.isbn)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="min-w-[180px] sm:min-w-[210px]">
          <CustomSelect
            value={department}
            options={departmentOptions}
            onChange={(val) => {
              setPage(1);
              const newDept = val as Department | "All";
              setDepartment(newDept);
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                if (newDept === "All") {
                  url.searchParams.delete("department");
                } else {
                  url.searchParams.set("department", newDept);
                }
                window.history.replaceState(null, "", url.toString());
              }
            }}
            buttonClassName={cn(
              "h-[42px] rounded-xl py-2.5 px-4 text-sm font-semibold transition-all shadow-xs",
              isLight
                ? "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 focus:border-[#0274BB]"
                : "border-white/10 bg-white/5 text-white hover:border-white/20 focus:border-[#FCD400]"
            )}
          />
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className={cn(
        "min-h-[580px] lg:min-h-[660px] overflow-hidden rounded-2xl border transition-all flex flex-col",
        isLight
          ? "border-slate-200/90 bg-white shadow-2xs"
          : "border-white/8 bg-[#0F1D29]/80 backdrop-blur"
      )}>
        <div className="overflow-auto flex-1 h-full">
          <table className="min-w-full text-sm">
            <thead className={cn(
              "sticky top-0 z-10 backdrop-blur border-b text-[11px] font-bold uppercase tracking-wider",
              isLight
                ? "bg-slate-100/95 text-slate-700 border-slate-200"
                : "bg-[#0F1D29]/95 text-slate-400 border-white/10"
            )}>
              <tr>
                <th className="px-5 py-3.5 text-left">Book / Author</th>
                <th className="px-5 py-3.5 text-left">Department</th>
                <th className="px-5 py-3.5 text-left">ISBN</th>
                <th className="px-5 py-3.5 text-left">Call Number</th>
                <th className="px-5 py-3.5 text-left">Copy Tracking</th>
                <th className="px-5 py-3.5 text-left">Status</th>
                <th className="px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row, i) => {
                if (row.type === "letter") {
                  return (
                    <tr
                      key={`letter-${row.letter}-${i}`}
                      className={cn(
                        "border-t border-b transition-colors",
                        isLight ? "border-purple-200/80 bg-purple-50/50" : "border-t border-b border-white/5 bg-white/[0.01]"
                      )}
                    >
                      <td colSpan={7} className="px-5 py-2.5 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-2 rounded-full px-4 py-0.5 text-[11px] font-black tracking-[0.25em] uppercase shadow-2xs",
                          isLight
                            ? "bg-purple-100 text-purple-700 border border-purple-300"
                            : "text-[#FCD400]"
                        )}>
                          — {row.letter} —
                        </span>
                      </td>
                    </tr>
                  );
                }
                const book = row.book;
                const copyStats = computeBookCopyStats(book);
                const deptColor = DEPT_COLORS[book.department] ?? "#94A3B8";
                const deptStyle = DEPT_LIGHT_STYLES[book.department] ?? DEPT_LIGHT_STYLES["All"];
                return (
                  <tr
                    key={book.id}
                    className={cn(
                      "border-b transition cursor-pointer group",
                      isLight
                        ? "border-slate-100 hover:bg-blue-50/30"
                        : "border-white/5 hover:bg-white/[0.04]"
                    )}
                    onClick={() => setSelectedBookDetails(book)}
                  >
                    <td className="px-5 py-4 max-w-[280px]">
                      <div className={cn(
                        "font-bold text-[15px] leading-snug line-clamp-1 transition-colors",
                        isLight ? "text-slate-900 group-hover:text-[#0274BB]" : "text-white group-hover:text-[#FCD400]"
                      )}>
                        {book.title}
                      </div>
                      <div className={cn(
                        "text-xs font-medium mt-1 line-clamp-1",
                        isLight ? "text-slate-500" : "text-slate-400"
                      )}>
                        {book.author}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {isLight ? (
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs",
                          deptStyle.bg, deptStyle.text, deptStyle.border
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full inline-block", deptStyle.dot)} />
                          {book.department}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: deptColor }}>
                          <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: deptColor }} />
                          {book.department}
                        </span>
                      )}
                    </td>
                    <td className={cn("px-5 py-4 font-mono text-xs", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>
                      {sanitizeIsbn(book.isbn) || "—"}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {book.shelfLocation ? (
                        <span className={cn(
                          "font-medium",
                          isLight ? "text-slate-700" : "text-slate-300"
                        )}>
                          {book.shelfLocation}
                        </span>
                      ) : (
                        <span className={isLight ? "text-slate-400 italic" : "text-slate-500 italic"}>Unavailable</span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                        isLight
                          ? "border-sky-200 bg-sky-50/70 text-slate-700"
                          : "border-white/8 bg-white/[0.03] text-slate-300"
                      )}>
                        <BookOpen className={cn("h-3.5 w-3.5", isLight ? "text-[#0274BB]" : "text-slate-400")} />
                        <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-white")}>{copyStats.availableCopies}</span>
                        <span className={isLight ? "text-slate-400" : "text-slate-400"}>/</span>
                        <span className={cn("font-semibold", isLight ? "text-slate-700" : "text-slate-300")}>{copyStats.totalCopies}</span>
                        <span className={cn("text-[10px] uppercase font-bold tracking-wider", isLight ? "text-[#0274BB]" : "text-slate-400")}>Available</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <AvailBadge status={copyStats.status} isLight={isLight} />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(book.id); }}
                        suppressHydrationWarning
                        className={cn(
                          "rounded-lg p-2 transition-all active:scale-95 inline-flex items-center justify-center",
                          isLight
                            ? "border border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white hover:border-orange-500 shadow-2xs"
                            : "border border-orange-500/20 bg-orange-500/5 text-orange-400 hover:bg-orange-500/15 hover:border-orange-500/30"
                        )}
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {groupedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className={cn("py-20 text-center", isLight ? "text-slate-500" : "text-slate-500")}>
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 pb-2 pt-2">
        <span>{totalBooks.toLocaleString()} records · page {page} of {totalPages}</span>
        <div className="flex items-center gap-2">
          {/* Prev Button */}
          <button
            type="button"
            suppressHydrationWarning
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="pagination-btn px-3 py-1.5 text-xs"
            title="Previous Page"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>

          {/* Single Page Number Box */}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInput}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              setPageInput(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitPage(pageInput);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const nextP = Math.min(totalPages, page + 1);
                setPage(nextP);
                setPageInput(String(nextP));
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const prevP = Math.max(1, page - 1);
                setPage(prevP);
                setPageInput(String(prevP));
              }
            }}
            onBlur={() => commitPage(pageInput)}
            className="pagination-single-box"
            title={`Page ${page} of ${totalPages} - Type a number and press Enter to toggle`}
            aria-label="Current page number"
          />

          {/* Next Button */}
          <button
            type="button"
            suppressHydrationWarning
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="pagination-btn px-3 py-1.5 text-xs"
            title="Next Page"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
      ) : (
        <>
          {/* ── Search & filter bar for Digitized Queue (Standardized layout) ─────────── */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors", isLight ? "text-[#0274BB]" : "text-slate-500")} />
              <input
                className={cn(
                  "w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-all",
                  isLight
                    ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#0274BB] focus:ring-2 focus:ring-[#0274BB]/15 shadow-2xs"
                    : "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-[#FCD400]/50"
                )}
                placeholder="Search scanned book title, author, ISBN, or raw OCR words…"
                value={digitizedSearch}
                onChange={(e) => setDigitizedSearch(e.target.value)}
              />
            </div>

            {/* Department Filter - exactly matching Records dropdown styling */}
            <div className="min-w-[180px] sm:min-w-[210px]">
              <CustomSelect
                options={departmentOptions}
                value={digitizedDept}
                onChange={(val) => setDigitizedDept(val as Department | "All")}
                buttonClassName={cn(
                  "h-[42px] rounded-xl py-2.5 px-4 text-sm font-semibold transition-all shadow-xs",
                  isLight
                    ? "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 focus:border-[#0274BB]"
                    : "border-white/10 bg-white/5 text-white hover:border-white/20 focus:border-[#FCD400]"
                )}
              />
            </div>

            {/* Refresh Button - height 42px matching the dropdown */}
            <button
              onClick={() => void fetchDigitizedBooks()}
              disabled={digitizedLoading}
              className={cn(
                "flex items-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-semibold transition active:scale-95 cursor-pointer shadow-xs",
                isLight
                  ? "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                  : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
              )}
              title="Refresh Queue from Mobile App"
            >
              <RefreshCw className={cn("h-4 w-4", digitizedLoading && "animate-spin text-[#0274BB]")} />
              <span>Refresh</span>
            </button>
          </div>

          {/* ── Table Container (Standardized with Records table) ──────────────────────── */}
          <div className={cn(
            "min-h-[580px] lg:min-h-[660px] overflow-hidden rounded-2xl border transition-all flex flex-col",
            isLight
              ? "border-slate-200/90 bg-white shadow-2xs"
              : "border-white/8 bg-[#0F1D29]/80 backdrop-blur"
          )}>
            <div className="overflow-auto flex-1 h-full">
              <table className="min-w-full text-sm">
                <thead className={cn(
                  "sticky top-0 z-10 backdrop-blur border-b text-[11px] font-bold uppercase tracking-wider",
                  isLight
                    ? "bg-slate-100/95 text-slate-700 border-slate-200"
                    : "bg-[#0F1D29]/95 text-slate-400 border-white/10"
                )}>
                  <tr>
                    <th className="px-5 py-3.5 text-left">Book / Author</th>
                    <th className="px-5 py-3.5 text-left">Department</th>
                    <th className="px-5 py-3.5 text-left">ISBN</th>
                    <th className="px-5 py-3.5 text-left">Call Number</th>
                    <th className="px-5 py-3.5 text-left">Copy Tracking</th>
                    <th className="px-5 py-3.5 text-left">Status</th>
                    <th className="px-5 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDigitizedBooks.map((book) => {
                    const deptColor = DEPT_COLORS[book.department] ?? "#94A3B8";
                    const deptStyle = DEPT_LIGHT_STYLES[book.department] ?? DEPT_LIGHT_STYLES["Circulation"];
                    const copies = Math.max(1, Number(book.copies || 1));
                    const confidence = Number(book.confidence || 95);
                    const shelfCall = book.shelfLocation || generateCallNumber({
                      ...book,
                      department: (book.department && departmentOptions.includes(book.department as any) ? book.department : "Circulation") as Department,
                      genres: book.genre || book.category || "General",
                    }) || "CIR-13A.5";

                    return (
                      <tr
                        key={book.id}
                        className={cn(
                          "border-b transition cursor-pointer group",
                          isLight
                            ? "border-slate-100 hover:bg-blue-50/30"
                            : "border-white/5 hover:bg-white/[0.04]"
                        )}
                        onClick={() => handleOpenReviewModal(book)}
                      >
                        {/* 1. Book / Author (Exact Picture 3 placement) */}
                        <td className="px-5 py-4 max-w-[280px]">
                          <div className={cn(
                            "font-bold text-[15px] leading-snug line-clamp-1 transition-colors",
                            isLight ? "text-slate-900 group-hover:text-[#0274BB]" : "text-white group-hover:text-[#FCD400]"
                          )}>
                            {book.title}
                          </div>
                          <div className={cn(
                            "text-xs font-medium mt-1 line-clamp-1",
                            isLight ? "text-slate-500" : "text-slate-400"
                          )}>
                            {book.author || "Unknown Author"}
                          </div>
                        </td>

                        {/* 2. Department (Exact Picture 3 placement: ● Circulation) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {isLight ? (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs",
                              deptStyle.bg, deptStyle.text, deptStyle.border
                            )}>
                              <span className={cn("h-1.5 w-1.5 rounded-full inline-block", deptStyle.dot)} />
                              {book.department || "Circulation"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: deptColor }}>
                              <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: deptColor }} />
                              {book.department || "Circulation"}
                            </span>
                          )}
                        </td>

                        {/* 3. ISBN (Exact Picture 3 placement: plain mono font) */}
                        <td className={cn("px-5 py-4 font-mono text-xs", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>
                          {sanitizeIsbn(book.isbn) || "—"}
                        </td>

                        {/* 4. Call Number (Exact Picture 3 placement: CIR-13A.5) */}
                        <td className="px-5 py-4 text-xs">
                          <span className={cn(
                            "font-medium",
                            isLight ? "text-slate-700" : "text-slate-300"
                          )}>
                            {shelfCall}
                          </span>
                        </td>

                        {/* 5. Copy Tracking (Exact Picture 3 placement: 📖 5 / 5 AVAILABLE) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                            isLight
                              ? "border-sky-200 bg-sky-50/70 text-slate-700"
                              : "border-white/8 bg-white/[0.03] text-slate-300"
                          )}>
                            <BookOpen className={cn("h-3.5 w-3.5", isLight ? "text-[#0274BB]" : "text-slate-400")} />
                            <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-white")}>{copies}</span>
                            <span className={isLight ? "text-slate-400" : "text-slate-400"}>/</span>
                            <span className={cn("font-semibold", isLight ? "text-slate-700" : "text-slate-300")}>{copies}</span>
                            <span className={cn("text-[10px] uppercase font-bold tracking-wider", isLight ? "text-[#0274BB]" : "text-slate-400")}>Available</span>
                          </div>
                        </td>

                        {/* 6. Status (Exact Picture 3 placement: ● Needs Cataloging pill badge) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs",
                            isLight
                              ? "border-amber-300 bg-amber-50 text-amber-900"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          )}>
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Needs Cataloging
                          </span>
                        </td>

                        {/* 7. Action (Exact Picture 3 placement: Action buttons) */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenReviewModal(book); }}
                              className="relative -left-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0274BB] text-white text-xs font-bold hover:brightness-110 active:scale-95 shadow-sm transition cursor-pointer"
                              title="Review & Complete Cataloging"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Review & Catalog</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void handleRejectDigitizedBook(book); }}
                              className={cn(
                                "digitized-delete-btn rounded-xl p-2 transition-all active:scale-95 inline-flex items-center justify-center cursor-pointer shadow-xs",
                                isLight
                                  ? "digitized-delete-btn-light border border-red-400 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white"
                                  : "border border-red-500/30 bg-red-500/15 text-red-400 hover:bg-red-600 hover:text-white"
                              )}
                              title="Reject and Remove from Queue"
                            >
                              <Trash2
                                className="h-4 w-4"
                                style={isLight ? { color: "#dc2626", stroke: "#dc2626", strokeWidth: 2.2, opacity: 1 } : { color: "#f87171", stroke: "#f87171", opacity: 1 }}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Empty state when no books in queue */}
                  {filteredDigitizedBooks.length === 0 && (
                    <tr>
                      <td colSpan={7} className={cn("py-20 text-center", isLight ? "text-slate-500" : "text-slate-400")}>
                        <div className={cn(
                          "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-4 transition-colors",
                          isLight ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        )}>
                          <Smartphone className="h-8 w-8 animate-pulse" />
                        </div>
                        <h3 className={cn("text-base font-bold", isLight ? "text-slate-900" : "text-white")}>
                          No Pending Books in Digitized Queue
                        </h3>
                        <p className={cn("mt-1 text-xs max-w-md mx-auto", isLight ? "text-slate-500" : "text-slate-400")}>
                          Books scanned by librarians using the mobile app book scanner will stream directly here for final verification before being officially registered into the library catalog.
                        </p>
                        <button
                          onClick={() => void fetchDigitizedBooks()}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0274BB] px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110 active:scale-95 cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Check for Scanned Books
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Digitized Pagination ─────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 pb-2 pt-2">
            <span>{filteredDigitizedBooks.length.toLocaleString()} digitized records · page 1 of 1</span>
          </div>
        </>
      )}

      {/* ── Review & Complete Cataloging Modal (Digitized Ingestion) ── */}
      {showReviewModal && reviewForm && selectedDigitizedForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 modal-backdrop bg-slate-950/60 backdrop-blur-md"
            onClick={() => setShowReviewModal(false)}
          />

          <div className={cn(
            "relative z-10 w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden",
            isLight
              ? "border-slate-200 bg-white shadow-slate-900/15 text-slate-900"
              : "border-white/12 bg-[#0F1D29] shadow-black/60 text-white"
          )}>
            {/* Header */}
            <div className={cn(
              "flex items-center justify-between border-b px-6 py-4",
              isLight ? "border-slate-100 bg-slate-50/70" : "border-white/8 bg-white/3"
            )}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0274BB]/15 text-[#0274BB]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#0274BB] uppercase">Mobile Scanner Intake</p>
                  <h2 className={cn("text-base font-black", isLight ? "text-slate-900" : "text-white")}>
                    Complete Cataloging & Final Verification
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className={cn(
                  "rounded-lg p-1.5 transition cursor-pointer",
                  isLight ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700" : "text-slate-400 hover:bg-white/8 hover:text-white"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleApproveAndCatalog} className="px-6 py-5 max-h-[82vh] overflow-y-auto space-y-4">
              {/* Row 1: Title */}
              <label className="grid gap-1.5">
                <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                  Book Title <span className="text-red-500">*</span>
                </span>
                <input
                  required
                  className="modal-input"
                  value={reviewForm.title}
                  onChange={(e) => handleReviewFieldChange("title", e.target.value)}
                  placeholder="e.g. The Struggle"
                />
              </label>

              {/* Row 2: Author & ISBN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Author <span className="text-red-500">*</span>
                  </span>
                  <input
                    required
                    className="modal-input"
                    value={reviewForm.author}
                    onChange={(e) => handleReviewFieldChange("author", e.target.value)}
                    placeholder="e.g. Betty"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    ISBN <span className="text-red-500">*</span>
                  </span>
                  <input
                    required
                    className="modal-input"
                    value={reviewForm.isbn}
                    onChange={(e) => handleReviewFieldChange("isbn", e.target.value)}
                    placeholder="e.g. 978-0-123456-78-9"
                  />
                </label>
              </div>

              {/* Row 3: Department & Genre */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Department <span className="text-red-500">*</span>
                  </span>
                  <select
                    className="modal-input"
                    value={reviewForm.department}
                    onChange={(e) => handleReviewFieldChange("department", e.target.value)}
                  >
                    {departmentOptions.filter(d => d !== "All").map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Genre <span className="text-red-500">*</span>
                  </span>
                  <select
                    required
                    className="modal-input"
                    value={reviewForm.genres || reviewForm.category || ""}
                    onChange={(e) => handleReviewFieldChange("genres", e.target.value)}
                  >
                    <option value="" disabled>-- Select Genre --</option>
                    {reviewGenreOptions.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Row 4: Call Number & Accession Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                      Call Number / Shelf Location <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10px] text-[#0274BB] font-semibold">Auto-Formatted</span>
                  </div>
                  <input
                    required
                    className="modal-input font-mono font-bold"
                    value={reviewForm.shelfLocation}
                    onChange={(e) => handleReviewFieldChange("shelfLocation", e.target.value)}
                    placeholder="e.g. GEN-ACT-002"
                  />
                </label>
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                      Accession Number
                    </span>
                    <span className="text-[10px] text-[#0274BB] font-semibold">Auto-Assigned</span>
                  </div>
                  <input
                    className="modal-input font-mono"
                    value={reviewForm.accessionNumber}
                    onChange={(e) => handleReviewFieldChange("accessionNumber", e.target.value)}
                    placeholder="e.g. ACC-2026-0042"
                  />
                </label>
              </div>

              {/* Row 5: Copies, Edition, Volume, Published Date */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Copies
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="modal-input"
                    value={reviewForm.copies}
                    onChange={(e) => handleReviewFieldChange("copies", Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Edition
                  </span>
                  <select
                    className="modal-input text-xs"
                    value={reviewForm.edition}
                    onChange={(e) => handleReviewFieldChange("edition", e.target.value)}
                  >
                    {EDITION_OPTIONS.map(ed => (
                      <option key={ed} value={ed}>{ed}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Volume
                  </span>
                  <select
                    className="modal-input text-xs"
                    value={reviewForm.volume}
                    onChange={(e) => handleReviewFieldChange("volume", e.target.value)}
                  >
                    {VOLUME_OPTIONS.map(vol => (
                      <option key={vol} value={vol}>{vol}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Published Date
                  </span>
                  <input
                    type="date"
                    className="modal-input text-xs"
                    value={reviewForm.publishedDate}
                    onChange={(e) => handleReviewFieldChange("publishedDate", e.target.value)}
                  />
                </label>
              </div>

              {/* Row 6: Publisher */}
              <label className="grid gap-1.5">
                <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                  Publisher
                </span>
                <input
                  className="modal-input"
                  value={reviewForm.publisher}
                  onChange={(e) => handleReviewFieldChange("publisher", e.target.value)}
                  placeholder="e.g. Scholastic Press"
                />
              </label>

              {/* Row 7: Synopsis / Summary */}
              <label className="grid gap-1.5">
                <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                  Synopsis / Summary
                </span>
                <textarea
                  rows={3}
                  className="modal-input resize-none"
                  value={reviewForm.summary}
                  onChange={(e) => handleReviewFieldChange("summary", e.target.value)}
                  placeholder="Enter or verify summary extracted by mobile scanner..."
                />
              </label>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/60 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer",
                    isLight
                      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApproving}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md cursor-pointer active:scale-95 disabled:opacity-60",
                    "bg-[#0274BB] text-white hover:brightness-110 shadow-sky-600/25"
                  )}
                >
                  {isApproving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                      Publishing to Catalog...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Approve & Add to Catalog
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Book Modal ─────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 modal-backdrop bg-slate-950/60 backdrop-blur-md"
            onClick={() => setShowModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-white/12 bg-[#0F1D29] shadow-2xl shadow-black/60">
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
            <form onSubmit={handleSubmit} className="px-6 py-5 grid gap-4 max-h-[82vh] overflow-y-auto pr-2">
              {/* Row 1: Title */}
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Title</span>
                <input
                  suppressHydrationWarning
                  required
                  className="modal-input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Clean Code"
                />
              </label>

              {/* Row 2: Author & ISBN */}
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Author</span>
                  <input
                    suppressHydrationWarning
                    required
                    className="modal-input"
                    value={form.author}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    placeholder="e.g. Robert C. Martin"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">ISBN</span>
                  <input
                    suppressHydrationWarning
                    className="modal-input"
                    value={form.isbn}
                    onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
                    placeholder="e.g. 978-0132350884"
                  />
                </label>
              </div>

              {/* Row 3: Department Loc. & Genre */}
              <div className="grid grid-cols-2 gap-4">
                <CustomSelect
                  label="Department Loc."
                  value={form.department}
                  options={departmentOptions.filter((d) => d !== "All")}
                  onChange={(val) => setForm((f) => ({ ...f, department: val as Department }))}
                />
                <CustomSelect
                  label="Genre"
                  subLabel="Alphabetical (A-Z)"
                  value={form.genres}
                  options={sortedGenres}
                  onChange={(val) => setForm((f) => ({ ...f, genres: val }))}
                  placeholder="-- Select Genre (A-Z) --"
                />
              </div>

              {/* Row 4: Pub. Date & Call Number */}
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Pub. Date</span>
                  <input
                    suppressHydrationWarning
                    type="date"
                    className="modal-input"
                    value={form.publicationDate}
                    onChange={(e) => setForm((f) => ({ ...f, publicationDate: e.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Call Number</span>
                    <span className="text-[10px] text-[#FCD400] font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Auto
                    </span>
                  </div>
                  <input
                    suppressHydrationWarning
                    className="modal-input font-mono bg-white/[0.04] border-[#FCD400]/40 text-[#FCD400] focus:border-[#FCD400]"
                    value={form.shelfLocation}
                    onChange={(e) => setForm((f) => ({ ...f, shelfLocation: e.target.value }))}
                    placeholder="Auto-generated e.g. QA 76.73 .P98 2026"
                  />
                </label>
              </div>

              {/* Row 5: Volume & Edition */}
              <div className="grid grid-cols-2 gap-4">
                <CustomSelect
                  label="Volume"
                  value={form.volume}
                  options={VOLUME_OPTIONS}
                  onChange={(val) => setForm((f) => ({ ...f, volume: val }))}
                />
                <CustomSelect
                  label="Edition"
                  value={form.edition}
                  options={EDITION_OPTIONS}
                  onChange={(val) => setForm((f) => ({ ...f, edition: val }))}
                />
              </div>

              {/* Row 6: Copies & Accession Number */}
              <div className="grid grid-cols-2 gap-4">
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
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Accession Number</span>
                    <span className="text-[10px] text-[#FCD400] font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Auto
                    </span>
                  </div>
                  <input
                    suppressHydrationWarning
                    className="modal-input font-mono bg-white/[0.04] border-[#FCD400]/40 text-[#FCD400] focus:border-[#FCD400]"
                    value={form.accessionNumber}
                    onChange={(e) => setForm((f) => ({ ...f, accessionNumber: e.target.value }))}
                    placeholder="Auto e.g. ACC-2026-00421"
                  />
                </label>
              </div>

              {/* Row 7: Publisher */}
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Publisher</span>
                <input
                  suppressHydrationWarning
                  className="modal-input"
                  value={form.publisher}
                  onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                  placeholder="e.g. Pearson, O'Reilly Media, Scholastic Press"
                />
              </label>

              {/* Row 8: Summary */}
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Summary</span>
                <textarea
                  suppressHydrationWarning
                  rows={3}
                  className="modal-input resize-none"
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Enter brief synopsis or summary..."
                />
              </label>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  suppressHydrationWarning
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#FCD400] px-6 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 hover:brightness-110 disabled:opacity-60 transition cursor-pointer"
                >
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
          <div className="absolute inset-0 modal-backdrop bg-slate-950/60 backdrop-blur-md" />
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
        html[data-theme="light"] .modal-input {
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: #ffffff;
          color: #000000;
        }
        html[data-theme="light"] .modal-input:focus {
          border-color: #0274BB;
        }
        html[data-theme="light"] .modal-input option {
          background: #ffffff;
          color: #000000;
        }

        .pagination-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.05);
          color: #cbd5e1;
          font-weight: 600;
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .pagination-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }
        .pagination-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .pagination-single-box {
          width: 52px !important;
          height: 32px !important;
          min-width: 52px !important;
          max-width: 60px !important;
          padding: 0 6px !important;
          margin: 0 !important;
          text-align: center !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          border-radius: 8px !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          background: rgba(255, 255, 255, 0.05) !important;
          color: #ffffff !important;
          outline: none !important;
          box-shadow: none !important;
          transition: all 0.15s ease !important;
          cursor: text !important;
          box-sizing: border-box !important;
        }
        .pagination-single-box:focus {
          border-color: #FCD400 !important;
          box-shadow: 0 0 0 2px rgba(252, 212, 0, 0.25) !important;
          background: rgba(255, 255, 255, 0.08) !important;
          color: #FCD400 !important;
        }
        html[data-theme="light"] .pagination-btn {
          border-color: rgba(0, 0, 0, 0.15);
          background: #ffffff;
          color: #1e293b;
        }
        html[data-theme="light"] .pagination-btn:hover:not(:disabled) {
          background: #f1f5f9;
          color: #0f172a;
        }
        html[data-theme="light"] .pagination-single-box {
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        html[data-theme="light"] .pagination-single-box:focus {
          border-color: #0072ce !important;
          box-shadow: 0 0 0 2px rgba(0, 114, 206, 0.25) !important;
          color: #0072ce !important;
        }
      `}</style>

      {/* ── Book Details Modal ("Book Archive Details") ─────── */}
      <BookDetailModal
        open={Boolean(selectedBookDetails)}
        book={selectedBookDetails}
        onClose={() => setSelectedBookDetails(null)}
      />
    </div>
  );
}

"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  BookOpen,
  BookPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Info,
  Library,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";
import type { BookRecord, Department } from "@/lib/types";
import { useSession } from "@/components/providers/session-provider";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import { BookCoverImage } from "@/components/ui/book-cover-image";
import {
  extractEmbeddedCoverUri,
  stripEmbeddedCoverUri,
  registerUploadedBookCover,
} from "@/lib/book-covers";
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

function formatPriceWithCommas(val: string): string {
  if (!val) return "";
  const clean = val.replace(/[^0-9.]/g, "");
  if (!clean) return "";

  const parts = clean.split(".");
  let integerPart = parts[0] || "";
  const hasDecimal = parts.length > 1;
  const decimalPart = hasDecimal ? parts.slice(1).join("") : null;

  if (integerPart === "" && hasDecimal) {
    integerPart = "0";
  } else if (integerPart.length > 1 && integerPart.startsWith("0")) {
    integerPart = integerPart.replace(/^0+/, "") || "0";
  }

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (hasDecimal) {
    return `${formattedInteger}.${decimalPart!.slice(0, 2)}`;
  }
  return formattedInteger;
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
  series: "",
  edition: "Single Edition / None",
  copies: 1,
  price: "",
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
  const { user, refreshUser } = useSession();

  // Revalidate fresh user permissions from database on mount
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const { theme } = useTheme();
  const isLight = theme === "light";
  const isTechnical = true;
  const canAddBook = true;
  const canExport = user?.role?.toUpperCase().includes("ADMIN") || (user?.permissions as any)?.export !== false;
  const canImport = user?.role?.toUpperCase().includes("ADMIN") || (user?.permissions as any)?.import !== false;
  const canDigitized = user?.role?.toUpperCase().includes("ADMIN") || (user?.permissions as any)?.catalogDigitized !== false;
  const canCatalogDropdown =
    user?.role?.toUpperCase().includes("ADMIN") ||
    ((user?.permissions as any)?.catalogDropdown !== false &&
     (user?.permissions as any)?.transactionDropdown !== false &&
     (user?.permissions as any)?.dropdown !== false);
  const [books, setBooks]           = useState<BookRecord[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [search, setSearch]         = useState("");
  const searchField = "title";
  const [dailyBooksAdded, setDailyBooksAdded] = useState(0);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

  const isTechnicalLibrarian = useMemo(() => {
    if (!user) return false;
    const role = (user.role || "").toLowerCase();
    const subRole = (user.subRole || "").toLowerCase();
    const name = (user.name || "").toLowerCase();

    if (subRole.includes("technical")) return true;
    if (role.includes("technical")) return true;
    if (variant === "technical") return true;
    if (role.includes("librarian") && !subRole) {
      if (name.includes("yana")) return true;
      if (!name.includes("jan dale") && !subRole.includes("circulation")) return true;
    }
    return false;
  }, [user, variant]);

  const [librarianStats, setLibrarianStats] = useState<
    Array<{ id: string; name: string; subRole?: string; booksAdded: number; todayBooksAdded: number }>
  >([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [statTimeframe, setStatTimeframe] = useState<"all" | "today">("all");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

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
  const [authors, setAuthors]       = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const addBookFormRef              = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        addBookFormRef.current?.scrollTo({ top: 0, behavior: "instant" });
      }, 10);
    }
  }, [showModal]);

  const handleAddAuthor = () => {
    setAuthors((prev) => [...prev, ""]);
  };

  const handleRemoveAuthor = (index: number) => {
    setAuthors((prev) => {
      if (prev.length <= 1) return [""];
      const next = prev.filter((_, i) => i !== index);
      const joined = next.map((a) => a.trim()).filter(Boolean).join(", ");
      setForm((f) => ({ ...f, author: joined }));
      return next;
    });
  };

  const handleAuthorChange = (index: number, val: string) => {
    setAuthors((prev) => {
      const next = [...prev];
      next[index] = val;
      const joined = next.map((a) => a.trim()).filter(Boolean).join(", ");
      setForm((f) => ({ ...f, author: joined }));
      return next;
    });
  };
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

  useEffect(() => {
    if (!canDigitized && activeTab === "digitized") {
      setActiveTab("records");
    }
  }, [canDigitized, activeTab]);

  // ── Digitized Queue State (Librarian Mobile Intake) ──────────
  const [digitizedBooks, setDigitizedBooks] = useState<any[]>([]);
  const [digitizedLoading, setDigitizedLoading] = useState(false);
  const [digitizedSearch, setDigitizedSearch] = useState("");
  const [digitizedDept, setDigitizedDept] = useState<Department | "All">("All");
  const [selectedDigitizedForReview, setSelectedDigitizedForReview] = useState<any | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState<any>(null);
  const [reviewAuthors, setReviewAuthors] = useState<string[]>([""]);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [catalogSuccessModal, setCatalogSuccessModal] = useState<{
    open: boolean;
    title: string;
    bookTitle: string;
    message?: string;
    type?: "success" | "saved" | "info";
  } | null>(null);
  const [expandedRawTextId, setExpandedRawTextId] = useState<string | null>(null);

  const getLibrarianRole = useCallback(
    (name: string): string => {
      const lower = (name || "").toLowerCase().trim();
      if (!lower) return "Technical Librarian";
      if (user?.name && lower.includes(user.name.toLowerCase())) {
        if (user.subRole) return user.subRole;
        if (user.role && user.role !== "Librarian") return user.role;
      }
      const match = librarianStats.find(
        (l) => l.name && l.name.toLowerCase().includes(lower)
      );
      if (match?.subRole) return match.subRole;

      if (lower.includes("jan dale") || lower.includes("dale") || lower.includes("circulation")) {
        return "Circulation Librarian";
      }
      if (lower.includes("yana") || lower.includes("palmares") || lower.includes("technical")) {
        return "Technical Librarian";
      }
      if (lower.includes("maria") || lower.includes("santos")) {
        return "Circulation Librarian";
      }
      if (lower.includes("joseph") || lower.includes("tan")) {
        return "Technical Librarian";
      }
      if (lower.includes("villanueva") || lower.includes("ryan")) {
        return "Circulation Librarian";
      }
      return "Technical Librarian";
    },
    [librarianStats, user]
  );

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
        const enriched = data.books.map((b: any) => {
          const coverUri =
            b.coverImage ||
            b.coverImg ||
            b.coverUrl ||
            b.cover_img ||
            extractEmbeddedCoverUri(b.rawText || b.raw_text) ||
            undefined;
          if (coverUri) {
            registerUploadedBookCover({
              id: b.id,
              isbn: sanitizeIsbn(b.isbn),
              title: b.title,
              coverUri,
            });
          }
          return {
            ...b,
            coverImage: coverUri,
            coverImg: coverUri,
            rawText: stripEmbeddedCoverUri(b.rawText || b.raw_text || ""),
          };
        });
        setDigitizedBooks(enriched);
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
    const attachedCover =
      book.coverImage ||
      book.coverImg ||
      book.coverUrl ||
      book.cover_img ||
      extractEmbeddedCoverUri(book.rawText || book.raw_text) ||
      "";

    const initialReview = {
      title: book.title || "",
      author: book.author || "",
      isbn: sanitizeIsbn(book.isbn),
      department: (book.department && departmentOptions.includes(book.department as any) ? book.department : "Circulation") as Department,
      genres: book.genre || book.category || "General",
      category: book.category || book.genre || "General",
      copies: Math.max(1, Number(book.copies || 1)),
      edition: book.edition || "Single Edition / None",
      volume: book.volume || "Single Volume / None",
      series: book.series || "",
      price: book.price ? formatPriceWithCommas(String(book.price)) : "",
      publisher: book.publisher || "",
      publishedDate: pubDate,
      summary: book.summary || "",
      shelfLocation: book.shelfLocation || "",
      accessionNumber: book.accessionNumber || "",
      coverImg: attachedCover,
    };

    const rawAuthor = String(book.author || "").trim();
    let initialAuthors: string[] = [""];
    if (rawAuthor) {
      const split = rawAuthor.split(/[,;&]|\band\b/i).map((s: string) => s.trim()).filter(Boolean);
      initialAuthors = split.length > 0 ? split : [rawAuthor];
    }
    setReviewAuthors(initialAuthors);

    const generatedCall = generateCallNumber(initialReview);
    const generatedAcc = generateAccessionNumber(initialReview);

    setReviewForm({
      ...initialReview,
      shelfLocation: book.shelfLocation || generatedCall,
      accessionNumber: book.accessionNumber || generatedAcc,
    });
    setShowReviewModal(true);
  };

  const handleAddReviewAuthor = () => {
    setReviewAuthors((prev) => [...prev, ""]);
  };

  const handleRemoveReviewAuthor = (index: number) => {
    setReviewAuthors((prev) => {
      if (prev.length <= 1) return [""];
      const next = prev.filter((_, i) => i !== index);
      const joined = next.map((a) => a.trim()).filter(Boolean).join(", ");
      handleReviewFieldChange("author", joined);
      return next;
    });
  };

  const handleReviewAuthorChange = (index: number, val: string) => {
    setReviewAuthors((prev) => {
      const next = [...prev];
      next[index] = val;
      const joined = next.map((a) => a.trim()).filter(Boolean).join(", ");
      handleReviewFieldChange("author", joined);
      return next;
    });
  };

  const handleSaveDigitizedChanges = async () => {
    if (!selectedDigitizedForReview || !reviewForm) return;
    setIsSavingChanges(true);
    try {
      const combinedAuthors =
        reviewAuthors.map((a) => a.trim()).filter(Boolean).join(", ") ||
        reviewForm.author ||
        "Unknown Author";
      const payload = {
        ...reviewForm,
        author: combinedAuthors,
        scannedBy:
          selectedDigitizedForReview.scannedBy ||
          selectedDigitizedForReview.scanned_by ||
          user?.name ||
          "Yana Brich R. Palmares",
        isbn: sanitizeIsbn(reviewForm.isbn),
        price: reviewForm.price ? Number(String(reviewForm.price).replace(/,/g, "")) : 0,
      };
      const res = await fetch(`/api/records/digitized/${selectedDigitizedForReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to save digitized record changes.");
      }
      setDigitizedBooks((prev) =>
        prev.map((b) =>
          b.id === selectedDigitizedForReview.id
            ? {
                ...b,
                ...payload,
              }
            : b
        )
      );
      const savedTitle = reviewForm.title || "Digitized Record";
      setShowReviewModal(false);
      setSelectedDigitizedForReview(null);
      setCatalogSuccessModal({
        open: true,
        title: "Changes Saved!",
        bookTitle: savedTitle,
        message: `Changes for "${savedTitle}" have been successfully saved to the digitized queue.`,
        type: "saved",
      });
    } catch (err: any) {
      alert("Save Error: " + (err.message || String(err)));
    } finally {
      setIsSavingChanges(false);
    }
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
      const coverToSave =
        reviewForm.coverImg ||
        selectedDigitizedForReview.coverImage ||
        selectedDigitizedForReview.coverImg ||
        extractEmbeddedCoverUri(selectedDigitizedForReview.rawText || selectedDigitizedForReview.raw_text) ||
        "";
      if (coverToSave) {
        registerUploadedBookCover({
          isbn: sanitizeIsbn(reviewForm.isbn),
          title: reviewForm.title,
          coverUri: coverToSave,
        });
      }
      const combinedAuthors =
        reviewAuthors.map((a) => a.trim()).filter(Boolean).join(", ") ||
        reviewForm.author ||
        "Unknown Author";
      const payload = {
        ...reviewForm,
        author: combinedAuthors,
        scannedBy:
          selectedDigitizedForReview.scannedBy ||
          selectedDigitizedForReview.scanned_by ||
          user?.name ||
          "Yana Brich R. Palmares",
        isbn: sanitizeIsbn(reviewForm.isbn),
        price: reviewForm.price ? Number(String(reviewForm.price).replace(/,/g, "")) : 0,
        coverImg: coverToSave,
        coverImage: coverToSave,
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

      const approvedTitle = reviewForm.title || "Cataloged Book";
      setDigitizedBooks(prev => prev.filter(b => b.id !== selectedDigitizedForReview.id));
      setShowReviewModal(false);
      setSelectedDigitizedForReview(null);

      void loadBooks();
      void fetchDailyAdded();
      setCatalogSuccessModal({
        open: true,
        title: "Successfully Cataloged!",
        bookTitle: approvedTitle,
        message: `"${approvedTitle}" is now officially published to the library catalog.`,
        type: "success",
      });
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
    void fetchDailyAdded();
        void fetchDailyAdded();
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

  const fetchDailyAdded = useCallback(async () => {
    try {
      const res = await fetch("/api/records/daily-count");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.librarians)) {
          setLibrarianStats(data.librarians);

          // Find current user's personal today count
          const myStat = user?.name
            ? data.librarians.find(
                (l: any) =>
                  (user.id && l.id === user.id) ||
                  (l.name && user.name && l.name.toLowerCase().includes(user.name.toLowerCase())) ||
                  (user.name && l.name && user.name.toLowerCase().includes(l.name.toLowerCase()))
              )
            : null;

          if (myStat) {
            setDailyBooksAdded(myStat.todayBooksAdded);
          } else if (typeof data.personalCount === "number") {
            setDailyBooksAdded(data.personalCount);
          } else if (typeof data.count === "number") {
            setDailyBooksAdded(data.count);
          }
        } else if (typeof data.count === "number") {
          setDailyBooksAdded(data.count);
        }
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    void fetchDailyAdded();
  }, [fetchDailyAdded]);

  const loadBooks = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        search: deferredSearch,
        searchField,
        department,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/records?${params}`);
      if (!res.ok) return;
      const payload = (await res.json()) as { books: BookRecord[]; total: number; addedToday?: number };
      startTransition(() => {
        setBooks(Array.isArray(payload.books) ? payload.books : []);
        setTotalBooks(typeof payload.total === "number" ? payload.total : 0);
      });
    } catch (err) {
      console.warn("Records loadBooks fetch notice:", err);
    }
  }, [deferredSearch, searchField, department, page]);

  useEffect(() => { void loadBooks(); }, [loadBooks]);

  // Grouped rows: alphabetical letter sections when browsing, direct relevance sorting when searching
  const groupedRows = useMemo(() => {
    let sorted = [...books];
    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      sorted.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        if (aTitle === q && bTitle !== q) return -1;
        if (bTitle === q && aTitle !== q) return 1;
        if (aTitle.startsWith(q) && !bTitle.startsWith(q)) return -1;
        if (bTitle.startsWith(q) && !aTitle.startsWith(q)) return 1;
        return aTitle.localeCompare(bTitle);
      });
      return sorted.map((book) => ({ type: "book" as const, book }));
    }

    sorted.sort((a, b) => a.title.localeCompare(b.title));
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
  }, [books, deferredSearch]);

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
    const combinedAuthor = authors.map((a) => a.trim()).filter(Boolean).join(", ") || form.author.trim();
    const actorLabel = user ? `${user.role} ${user.name}` : undefined;
    await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        author: combinedAuthor,
        price: form.price ? Number(String(form.price).replace(/,/g, "")) : 0,
        availability: normalizeStatus(form.availability),
        actor: actorLabel,
        actorName: actorLabel,
      }),
    });
    setForm(emptyBookForm);
    setAuthors([""]);
    setShowModal(false);
    await loadBooks();
    void fetchDailyAdded();
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/records/${id}`, { method: "DELETE" });
      await loadBooks();
      void fetchDailyAdded();
    } catch (err) {
      console.warn("Records delete error:", err);
    }
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
          {/* Daily Ingestion Log Counter with Librarian Activity Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div
              onClick={() => {
                if (canCatalogDropdown) {
                  setIsDropdownOpen((prev) => !prev);
                  void fetchDailyAdded();
                }
              }}
              role={canCatalogDropdown ? "button" : undefined}
              aria-haspopup={canCatalogDropdown ? "true" : undefined}
              aria-expanded={canCatalogDropdown ? isDropdownOpen : undefined}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-2xs transition-all select-none",
                canCatalogDropdown ? "cursor-pointer" : "cursor-default",
                isLight
                  ? canCatalogDropdown
                    ? "bg-emerald-50/90 border-emerald-300 text-emerald-800 hover:bg-emerald-100/90 hover:border-emerald-400"
                    : "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                  : canCatalogDropdown
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              )}
              title={
                canCatalogDropdown
                  ? `Click to view books added by librarians. Today's total: ${dailyBooksAdded}`
                  : `Today's total books added: ${dailyBooksAdded}`
              }
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                {dailyBooksAdded}
              </span>
              <span className="hidden sm:inline font-bold">
                {dailyBooksAdded === 1 ? "Book Added Today" : "Books Added Today"}
              </span>
              <span className="sm:hidden font-bold">Today</span>

              {/* Extended Dropdown Indicator: only shown if dropdown restriction is lifted */}
              {canCatalogDropdown && (
                <>
                  <span
                    className={cn(
                      "h-3.5 w-[1px] ml-0.5 shrink-0",
                      isLight ? "bg-emerald-300/80" : "bg-emerald-500/30"
                    )}
                  />
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      isLight ? "text-emerald-700" : "text-emerald-300",
                      isDropdownOpen && "rotate-180"
                    )}
                  />
                </>
              )}
            </div>

            {/* Dropdown Menu for all librarians - only rendered if permission allowed */}
            {canCatalogDropdown && isDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute right-0 top-full mt-2 w-84 sm:w-96 rounded-2xl border shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl",
                  isLight
                    ? "bg-white/98 border-slate-200 shadow-slate-300/60 text-slate-800"
                    : "bg-[#0b1626]/98 border-white/10 shadow-black/90 text-white"
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-inherit">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl shrink-0 shadow-2xs",
                        isLight ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-300"
                      )}
                    >
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider leading-none">
                        Books Added by Librarian
                      </h4>
                      <p
                        className={cn(
                          "text-[10px] mt-1 font-semibold leading-none",
                          isLight ? "text-slate-500" : "text-slate-400"
                        )}
                      >
                        {librarianStats.length}{" "}
                        {librarianStats.length === 1
                          ? "cataloger with active access"
                          : "catalogers with active access"}
                      </p>
                    </div>
                  </div>

                  {/* Filter Toggle: All Time vs Today */}
                  <div
                    className={cn(
                      "flex items-center p-0.5 rounded-lg border text-[11px] font-bold",
                      isLight ? "bg-slate-100 border-slate-200" : "bg-white/5 border-white/10"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatTimeframe("all");
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all cursor-pointer font-extrabold text-[10px] uppercase tracking-wide",
                        statTimeframe === "all"
                          ? isLight
                            ? "bg-white text-emerald-700 shadow-xs"
                            : "bg-emerald-500/25 text-emerald-300 shadow-xs"
                          : isLight
                          ? "text-slate-500 hover:text-slate-800"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      All Time
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatTimeframe("today");
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all cursor-pointer font-extrabold text-[10px] uppercase tracking-wide",
                        statTimeframe === "today"
                          ? isLight
                            ? "bg-white text-emerald-700 shadow-xs"
                            : "bg-emerald-500/25 text-emerald-300 shadow-xs"
                          : isLight
                          ? "text-slate-500 hover:text-slate-800"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Today
                    </button>
                  </div>
                </div>

                {/* Librarian List */}
                <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
                  {librarianStats.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No librarians with cataloging permission found.
                    </div>
                  ) : (
                    librarianStats.map((lib) => {
                      const count = statTimeframe === "today" ? lib.todayBooksAdded : lib.booksAdded;
                      const initials =
                        lib.name
                          .split(" ")
                          .filter((p) => p && !p.endsWith("."))
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase())
                          .join("") || "LIB";

                      return (
                        <div
                          key={lib.id}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl transition-all border",
                            isLight
                              ? "bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/80 hover:border-slate-300"
                              : "bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/10"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            {/* Initials Badge */}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF300] text-xs font-black text-[#0274BB] shadow-2xs">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-xs font-bold truncate leading-tight",
                                  isLight ? "text-slate-900" : "text-white"
                                )}
                                title={lib.name}
                              >
                                {lib.name}
                              </p>
                              <p
                                className={cn(
                                  "text-[10px] truncate leading-tight mt-0.5",
                                  isLight ? "text-sky-700 font-semibold" : "text-sky-300 font-medium"
                                )}
                              >
                                {lib.subRole || "Librarian"}
                              </p>
                            </div>
                          </div>

                          {/* Number Counter Badge Beside Name */}
                          <div className="flex flex-col items-end shrink-0 pl-1">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black border tabular-nums shadow-2xs",
                                count > 0
                                  ? isLight
                                    ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                                    : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                                  : isLight
                                  ? "bg-slate-100 border-slate-200 text-slate-500"
                                  : "bg-white/5 border-white/10 text-slate-400"
                              )}
                              title={`${count} books added ${statTimeframe === "today" ? "today" : "in total"}`}
                            >
                              <BookOpen className="h-3 w-3 shrink-0 opacity-80" />
                              <span>{count}</span>
                            </span>
                            <span
                              className={cn(
                                "text-[9px] mt-0.5 font-medium",
                                isLight ? "text-slate-400" : "text-slate-500"
                              )}
                            >
                              {statTimeframe === "today"
                                ? `${lib.booksAdded} total`
                                : lib.todayBooksAdded > 0
                                ? `+${lib.todayBooksAdded} today`
                                : "books added"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Note */}
                <div
                  className={cn(
                    "mt-3 pt-2.5 border-t border-inherit flex items-center justify-between text-[10px] font-medium",
                    isLight ? "text-slate-400" : "text-slate-500"
                  )}
                >
                  <span>Librarian Activity Overview</span>
                  <span>All Registered Librarians</span>
                </div>
              </div>
            )}
          </div>

          {/* Records & Digitized Segmented Toggle - Placed immediately after Daily Counter */}
          {canDigitized && (
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
          )}

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
          {/* ── Search Bar & Department Filter ──────────── */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <div className={cn(
                "flex items-center h-[42px] rounded-xl border transition-all shadow-2xs overflow-hidden",
                isLight
                  ? "border-slate-300 bg-white focus-within:border-[#0274BB] focus-within:ring-2 focus-within:ring-[#0274BB]/15"
                  : "border-white/10 bg-white/5 focus-within:border-[#FCD400]/50 focus-within:ring-2 focus-within:ring-[#FCD400]/20"
              )}>
                {/* Search Text Input */}
                <div className="relative flex-1 flex items-center h-full">
                  <Search className={cn(
                    "absolute left-3.5 h-4 w-4 pointer-events-none transition-colors",
                    isLight ? "text-slate-400" : "text-slate-500"
                  )} />
                  <input
                    suppressHydrationWarning
                    className={cn(
                      "w-full h-full bg-transparent py-2 pl-10 pr-9 text-sm focus:outline-none transition-all",
                      isLight
                        ? "text-slate-900 placeholder:text-slate-400"
                        : "text-white placeholder:text-slate-500"
                    )}
                    placeholder="Search by book title (e.g. His Life, Java, Calculus)…"
                    value={search}
                    onChange={(e) => {
                      setPage(1);
                      setSearch(e.target.value);
                    }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                      }}
                      className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
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

            {/* Refresh Button - height 42px matching Department dropdown */}
            <button
              type="button"
              onClick={async () => {
                setIsRefreshingCatalog(true);
                try {
                  void refreshUser();
                  await loadBooks();
                  if (canDigitized) void fetchDigitizedBooks();
                } finally {
                  setIsRefreshingCatalog(false);
                }
              }}
              disabled={isRefreshingCatalog}
              className={cn(
                "flex items-center gap-2 h-[42px] px-4 rounded-xl text-sm font-semibold shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50",
                isLight
                  ? "border border-slate-300 bg-white text-slate-700 hover:border-[#0274BB] hover:text-[#0274BB] hover:bg-slate-50"
                  : "border border-white/20 bg-white/5 text-slate-200 hover:border-[#FCD400] hover:text-[#FCD400] hover:bg-white/10"
              )}
              title="Refresh Catalog and Permissions"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshingCatalog && "animate-spin text-[#0274BB]")} />
              <span>Refresh</span>
            </button>
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
                    <td className="px-5 py-4 max-w-[330px]">
                      <div className="flex items-center gap-3.5">
                        <BookCoverImage book={book} size="sm" />
                        <div className="min-w-0 flex-1">
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
                        </div>
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
                          "record-archive-btn rounded-lg p-2 transition-all active:scale-95 inline-flex items-center justify-center",
                          isLight
                            ? "border border-orange-300 bg-orange-100/70 text-orange-700 hover:bg-orange-500 hover:text-white hover:border-orange-500 shadow-2xs"
                            : "border border-orange-500/20 bg-orange-500/5 text-orange-400 hover:bg-orange-500/15 hover:border-orange-500/30"
                        )}
                        title="Archive"
                      >
                        <Archive className={cn("h-4 w-4", isLight ? "text-orange-700" : "text-orange-400")} />
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

            {/* Refresh Button - height 42px matching the dropdown with visible stroke */}
            <button
              onClick={() => void fetchDigitizedBooks()}
              disabled={digitizedLoading}
              className={cn(
                "flex items-center gap-2 h-[42px] px-4 rounded-xl border-2 text-sm font-semibold transition active:scale-95 cursor-pointer shadow-xs",
                isLight
                  ? "border-slate-400/90 bg-white text-slate-800 hover:border-[#0274BB] hover:text-[#0274BB] hover:bg-slate-50"
                  : "border-white/30 bg-white/5 text-slate-200 hover:border-[#FCD400] hover:text-[#FCD400] hover:bg-white/10"
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
                    <th className="px-5 py-3.5 text-left">Librarian</th>
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
                    const rawScannedBy = (book.scannedBy || book.scanned_by || "").trim();
                    const librariansList: string[] = (() => {
                      if (Array.isArray(book.librarians) && book.librarians.length > 0) {
                        return book.librarians.map((l: any) => String(l).trim()).filter(Boolean);
                      }
                      if (!rawScannedBy || rawScannedBy.toLowerCase().includes("mobile app") || rawScannedBy.toLowerCase().includes("scanner")) {
                        return [user?.name || "Yana Brich R. Palmares"];
                      }
                      if (rawScannedBy.includes(",")) {
                        return rawScannedBy.split(",").map((s: string) => s.trim()).filter(Boolean);
                      }
                      return [rawScannedBy];
                    })();

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
                        {/* 0. Librarian Fullname(s) (Captured & submitted by) */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            {librariansList.map((libName, idx) => {
                              const role = getLibrarianRole(libName);
                              return (
                                <div key={`lib-row-${book.id}-${idx}`} className="flex items-center gap-2.5">
                                  <div className="sidebar-profile-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF300] text-xs font-black text-[#0274BB] shadow-sm">
                                    {(libName || "L").charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className={cn(
                                      "font-bold text-[13px] leading-snug line-clamp-1",
                                      isLight ? "text-slate-800" : "text-white"
                                    )}>
                                      {libName}
                                    </div>
                                    <div className={cn(
                                      "text-[10px] font-bold uppercase tracking-wider",
                                      isLight ? "text-[#0274BB]" : "text-sky-200"
                                    )}>
                                      {role}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* 1. Book / Author (Exact Picture 2 & 3 placement with Cover Preview on left) */}
                        <td className="px-5 py-4 max-w-[330px]">
                          <div className="flex items-center gap-3.5">
                            <BookCoverImage book={book} size="sm" />
                            <div className="min-w-0 flex-1">
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
                            </div>
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

                        {/* 7. Action */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenReviewModal(book); }}
                              className={cn(
                                "rounded-xl p-2 transition-all active:scale-95 inline-flex items-center justify-center cursor-pointer shadow-xs",
                                isLight
                                  ? "border border-sky-400/60 bg-[#0274BB] text-white hover:bg-[#02629e] hover:shadow-sky-500/20"
                                  : "border border-sky-400/30 bg-[#0274BB] text-white hover:brightness-110 hover:shadow-sky-500/20"
                              )}
                              title="Review & Complete Cataloging"
                              aria-label="Review & Complete Cataloging"
                            >
                              <Pencil className="h-4 w-4" />
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
                      <td colSpan={8} className={cn("py-20 text-center", isLight ? "text-slate-500" : "text-slate-400")}>
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
              {/* Row 0: Book Cover Picture Preview (Synced from Librarian Mobile App) */}
              <div
                className={cn(
                  "rounded-2xl border p-4 transition-colors",
                  isLight
                    ? "border-sky-200 bg-sky-50/60"
                    : "border-white/10 bg-white/[0.03]"
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className={cn("h-4 w-4", isLight ? "text-[#0274BB]" : "text-[#FCD400]")} />
                    <span className={cn("text-[11px] font-extrabold uppercase tracking-wider", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                      Book Cover Picture
                    </span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                      reviewForm.coverImg
                        ? isLight
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                        : isLight
                        ? "border-sky-200 bg-white text-[#0274BB]"
                        : "border-white/15 bg-white/5 text-slate-300"
                    )}
                  >
                    {reviewForm.coverImg ? "Uploaded via Mobile" : "Synced Cover Preview"}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-4 rounded-xl border p-3.5",
                    isLight
                      ? "border-slate-200/90 bg-white shadow-xs"
                      : "border-white/10 bg-[#0B1622]/90"
                  )}
                >
                  <BookCoverImage
                    uri={reviewForm.coverImg}
                    book={{
                      ...selectedDigitizedForReview,
                      title: reviewForm.title,
                      author: reviewForm.author,
                      isbn: reviewForm.isbn,
                      department: reviewForm.department,
                      category: reviewForm.genres || reviewForm.category,
                      coverImg: reviewForm.coverImg,
                    }}
                    size="md"
                    className="w-16 h-[92px] shadow-md"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                      <p className={cn("text-sm font-bold", isLight ? "text-slate-900" : "text-white")}>
                        {reviewForm.coverImg ? "Cover Picture Attached" : "Book Cover Preview Attached"}
                      </p>
                    </div>
                    <p className={cn("mt-1 text-xs leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                      {reviewForm.coverImg
                        ? "Captured and uploaded by the librarian via Librarian Mobile App. Will be displayed with this book in catalog & details."
                        : "Will be displayed with this book across all web system dashboards and mobile applications."}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <label
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                          isLight
                            ? "border-sky-200 bg-sky-50 text-[#0274BB] hover:bg-sky-100"
                            : "border-white/15 bg-white/5 text-[#FCD400] hover:bg-white/10"
                        )}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{reviewForm.coverImg ? "Change Picture" : "Upload Custom Picture"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === "string") {
                                handleReviewFieldChange("coverImg", reader.result);
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      {reviewForm.coverImg && (
                        <button
                          type="button"
                          onClick={() => handleReviewFieldChange("coverImg", "")}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                            isLight
                              ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                              : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

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
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                      Author <span className="text-red-500">*</span>
                    </span>
                    {reviewAuthors.length > 1 && (
                      <span className={cn("text-[10px] font-medium", isLight ? "text-slate-500" : "text-slate-400")}>
                        {reviewAuthors.filter(Boolean).length} author{reviewAuthors.filter(Boolean).length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {reviewAuthors.map((authorName, index) => (
                      <div key={`review-author-${index}`} className="relative flex items-center">
                        <input
                          required={index === 0}
                          className="modal-input pr-9"
                          value={authorName}
                          onChange={(e) => handleReviewAuthorChange(index, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleAddReviewAuthor();
                            }
                          }}
                          placeholder={index === 0 ? "e.g. Robert C. Martin" : `Co-author ${index + 1}`}
                        />
                        {index === 0 ? (
                          <button
                            type="button"
                            onClick={handleAddReviewAuthor}
                            className="absolute right-2 p-1.5 rounded-lg text-[#FCD400] hover:bg-white/10 transition cursor-pointer"
                            title="Add another author"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveReviewAuthor(index)}
                            className="absolute right-2 p-1.5 rounded-lg text-rose-400 hover:bg-white/10 transition cursor-pointer"
                            title="Remove author"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
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

              {/* Row 3: Section & Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Section <span className="text-red-500">*</span>
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
                    Classification <span className="text-red-500">*</span>
                  </span>
                  <select
                    required
                    className="modal-input"
                    value={reviewForm.genres || reviewForm.category || ""}
                    onChange={(e) => handleReviewFieldChange("genres", e.target.value)}
                  >
                    <option value="" disabled>-- Select Classification --</option>
                    {reviewGenreOptions.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Row 4: Publisher & Pub. Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Publisher
                  </span>
                  <input
                    className="modal-input"
                    value={reviewForm.publisher || ""}
                    onChange={(e) => handleReviewFieldChange("publisher", e.target.value)}
                    placeholder="e.g. Pearson, O'Reilly Media, Scholastic Press"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Pub. Date
                  </span>
                  <input
                    type="date"
                    className="modal-input"
                    value={reviewForm.publishedDate}
                    onChange={(e) => handleReviewFieldChange("publishedDate", e.target.value)}
                  />
                </label>
              </div>

              {/* Row 5: Volume, Series & Edition (3 equal columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Volume
                  </span>
                  <select
                    className="modal-input"
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
                    Series
                  </span>
                  <input
                    className="modal-input"
                    value={reviewForm.series || ""}
                    onChange={(e) => handleReviewFieldChange("series", e.target.value)}
                    placeholder="e.g. Series name / No."
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Edition
                  </span>
                  <select
                    className="modal-input"
                    value={reviewForm.edition}
                    onChange={(e) => handleReviewFieldChange("edition", e.target.value)}
                  >
                    {EDITION_OPTIONS.map(ed => (
                      <option key={ed} value={ed}>{ed}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Row 6: Call Number & Accession Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                      Call Number / Shelf Location <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10px] text-[#0274BB] dark:text-[#FCD400] font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Auto
                    </span>
                  </div>
                  <input
                    required
                    className="modal-input font-mono font-bold"
                    value={reviewForm.shelfLocation}
                    onChange={(e) => handleReviewFieldChange("shelfLocation", e.target.value)}
                    placeholder="Auto-generated e.g. QA 76.73 .P98 2026"
                  />
                </label>
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-bold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                      Accession Number
                    </span>
                    <span className="text-[10px] text-[#0274BB] dark:text-[#FCD400] font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Auto
                    </span>
                  </div>
                  <input
                    className="modal-input font-mono"
                    value={reviewForm.accessionNumber}
                    onChange={(e) => handleReviewFieldChange("accessionNumber", e.target.value)}
                    placeholder="Auto e.g. ACC-2026-0042"
                  />
                </label>
              </div>

              {/* Row 7: Copies & Price (PHP) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    Price (PHP)
                  </span>
                  <div className="relative flex items-center">
                    <span className={cn(
                      "absolute left-3 text-sm pointer-events-none select-none z-10 leading-none",
                      isLight ? "text-slate-600 font-normal" : "text-white font-normal"
                    )}>
                      ₱
                    </span>
                    <input
                      suppressHydrationWarning
                      type="text"
                      inputMode="decimal"
                      style={{ paddingLeft: "34px" }}
                      className="modal-input !pl-[34px] font-normal"
                      value={reviewForm.price || ""}
                      onChange={(e) => {
                        const formatted = formatPriceWithCommas(e.target.value);
                        handleReviewFieldChange("price", formatted);
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </label>
              </div>

              {/* Row 8: Synopsis / Summary */}
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
                  type="button"
                  onClick={handleSaveDigitizedChanges}
                  disabled={isSavingChanges || isApproving}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs disabled:opacity-60",
                    isLight
                      ? "border-sky-300 bg-sky-50 text-[#0274BB] hover:bg-sky-100"
                      : "border-sky-500/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
                  )}
                  title="Save edited fields and assigned librarians to the digitized queue without publishing to catalog yet"
                >
                  {isSavingChanges ? "Saving..." : "Save Changes"}
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

      {/* ── Cataloging Success / Confirmation Pop-Up Modal ─────────────────────────────── */}
      {catalogSuccessModal?.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setCatalogSuccessModal(null)}
          />

          {/* Modal Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative z-10 w-full max-w-md rounded-3xl border p-6 sm:p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200",
              isLight
                ? "bg-white border-slate-200 text-slate-800 shadow-slate-400/30"
                : "bg-[#0B1520] border-white/10 text-white shadow-black/80"
            )}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setCatalogSuccessModal(null)}
              className={cn(
                "absolute right-4 top-4 rounded-xl p-2 transition cursor-pointer",
                isLight ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700" : "text-slate-400 hover:bg-white/10 hover:text-white"
              )}
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div
              className={cn(
                "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm",
                catalogSuccessModal.type === "saved"
                  ? isLight
                    ? "bg-sky-50 border-sky-200 text-[#0274BB]"
                    : "bg-sky-500/15 border-sky-500/30 text-sky-300"
                  : isLight
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              )}
            >
              {catalogSuccessModal.type === "saved" ? (
                <Check className="h-8 w-8 stroke-[2.5]" />
              ) : (
                <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
              )}
            </div>

            {/* Sub-badge */}
            <span
              className={cn(
                "inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider mb-2 border",
                catalogSuccessModal.type === "saved"
                  ? isLight
                    ? "bg-sky-100/80 border-sky-300 text-[#0274BB]"
                    : "bg-sky-500/20 border-sky-500/30 text-sky-200"
                  : isLight
                  ? "bg-emerald-100/80 border-emerald-300 text-emerald-800"
                  : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
              )}
            >
              {catalogSuccessModal.type === "saved" ? "Queue Record Updated" : "Official Catalog Publication"}
            </span>

            {/* Title */}
            <h3 className="text-xl font-black tracking-tight mb-2">
              {catalogSuccessModal.title}
            </h3>

            {/* Message */}
            <p className={cn("text-xs sm:text-sm leading-relaxed mb-6 font-medium", isLight ? "text-slate-600" : "text-slate-300")}>
              {catalogSuccessModal.type === "saved" ? (
                <span>{catalogSuccessModal.message}</span>
              ) : (
                <>
                  <span className="font-bold underline decoration-emerald-500/60 decoration-2">
                    {catalogSuccessModal.bookTitle}
                  </span>{" "}
                  is now officially published to the library catalog and accessible to all students and faculty.
                </>
              )}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              {catalogSuccessModal.type === "success" && (
                <button
                  type="button"
                  onClick={() => {
                    setCatalogSuccessModal(null);
                    setActiveTab("records");
                  }}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-95 shadow-2xs",
                    isLight
                      ? "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  )}
                >
                  View in Records
                </button>
              )}
              <button
                type="button"
                onClick={() => setCatalogSuccessModal(null)}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl text-xs font-bold shadow-md active:scale-95 transition cursor-pointer",
                  "bg-[#0274BB] hover:bg-[#025a91] text-white"
                )}
              >
                {catalogSuccessModal.type === "success" ? "Done" : "Continue"}
              </button>
            </div>
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
          <div className={cn(
            "relative z-10 w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-auto",
            isLight
              ? "border-slate-200 bg-white shadow-slate-900/20 text-slate-900"
              : "border-white/12 bg-[#0F1D29] shadow-black/70 text-white"
          )}>
            {/* Header */}
            <div className={cn(
              "flex items-center justify-between border-b px-6 py-4",
              isLight ? "border-slate-200 bg-slate-50/80" : "border-white/8 bg-white/2"
            )}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD400]/15">
                  <BookOpen className="h-4 w-4 text-[#FCD400]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#FCD400] uppercase">Catalog</p>
                  <h2 className={cn("text-base font-black", isLight ? "text-slate-900" : "text-white")}>Add New Book</h2>
                </div>
              </div>
              <button
                suppressHydrationWarning
                onClick={() => {
                  setShowModal(false);
                  setForm(emptyBookForm);
                  setAuthors([""]);
                }}
                className={cn(
                  "rounded-lg p-1.5 transition cursor-pointer",
                  isLight ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700" : "text-slate-400 hover:bg-white/8 hover:text-white"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form
              ref={addBookFormRef}
              onSubmit={handleSubmit}
              className="px-6 py-5 grid gap-3.5 max-h-[82vh] overflow-y-auto overflow-x-hidden modal-scroll"
            >
              {/* Row 1: Title */}
              <label className="grid gap-1.5">
                <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                  Title
                </span>
                <input
                  suppressHydrationWarning
                  required
                  className="modal-input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Clean Code"
                />
              </label>

              {/* Row 2: Author & ISBN (Multiple Authors supported with + icon) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                      Author{authors.length > 1 ? "s" : ""}
                    </span>
                    {authors.length > 1 && (
                      <span className="text-[10px] text-[#FCD400] font-semibold">
                        {authors.length} Authors
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {authors.map((authorName, index) => (
                      <div key={`author-${index}`} className="relative flex items-center">
                        <input
                          suppressHydrationWarning
                          required={index === 0}
                          className="modal-input pr-9"
                          value={authorName}
                          onChange={(e) => handleAuthorChange(index, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleAddAuthor();
                            }
                          }}
                          placeholder={index === 0 ? "e.g. Robert C. Martin" : `Co-author ${index + 1}`}
                        />
                        {index === 0 ? (
                          <button
                            type="button"
                            onClick={handleAddAuthor}
                            className="absolute right-2 p-1.5 rounded-lg text-[#FCD400] hover:bg-white/10 transition cursor-pointer"
                            title="Add another author"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveAuthor(index)}
                            className="absolute right-2 p-1.5 rounded-lg text-rose-400 hover:bg-white/10 transition cursor-pointer"
                            title="Remove author"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    ISBN
                  </span>
                  <input
                    suppressHydrationWarning
                    className="modal-input"
                    value={form.isbn}
                    onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
                    placeholder="e.g. 978-0132350884"
                  />
                </label>
              </div>

              {/* Row 3: Section & Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomSelect
                  label="Section"
                  value={form.department}
                  options={departmentOptions.filter((d) => d !== "All")}
                  onChange={(val) => setForm((f) => ({ ...f, department: val as Department }))}
                />
                <CustomSelect
                  label="Classification"
                  subLabel="Alphabetical (A-Z)"
                  value={form.genres}
                  options={sortedGenres}
                  onChange={(val) => setForm((f) => ({ ...f, genres: val }))}
                  placeholder="-- Select Classification (A-Z) --"
                />
              </div>

              {/* Row 4: Publisher & Pub. Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Publisher
                  </span>
                  <input
                    suppressHydrationWarning
                    className="modal-input"
                    value={form.publisher}
                    onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                    placeholder="e.g. Pearson, O'Reilly Media, Scholastic Press"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Pub. Date
                  </span>
                  <input
                    suppressHydrationWarning
                    type="date"
                    className="modal-input"
                    value={form.publicationDate}
                    onChange={(e) => setForm((f) => ({ ...f, publicationDate: e.target.value }))}
                  />
                </label>
              </div>

              {/* Row 5: Volume, Series & Edition (Divided equally into 3 input fields) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
                <CustomSelect
                  label="Volume"
                  value={form.volume}
                  options={VOLUME_OPTIONS}
                  onChange={(val) => setForm((f) => ({ ...f, volume: val }))}
                />
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Series
                  </span>
                  <input
                    suppressHydrationWarning
                    className="modal-input"
                    value={form.series}
                    onChange={(e) => setForm((f) => ({ ...f, series: e.target.value }))}
                    placeholder="e.g. Series name / No."
                  />
                </label>
                <CustomSelect
                  label="Edition"
                  value={form.edition}
                  options={EDITION_OPTIONS}
                  onChange={(val) => setForm((f) => ({ ...f, edition: val }))}
                />
              </div>

              {/* Row 6: Call Number & Accession Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                      Call Number
                    </span>
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
                <label className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                      Accession Number
                    </span>
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

              {/* Row 7: Copies & Price (Clear Peso sign, user types actual price, no arrows) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Copies
                  </span>
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
                  <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                    Price (PHP)
                  </span>
                  <div className="relative flex items-center">
                    <span className={cn(
                      "absolute left-3 text-sm pointer-events-none select-none z-10 leading-none",
                      isLight ? "text-slate-600 font-normal" : "text-white font-normal"
                    )}>
                      ₱
                    </span>
                    <input
                      suppressHydrationWarning
                      type="text"
                      inputMode="decimal"
                      style={{ paddingLeft: "34px" }}
                      className="modal-input !pl-[34px] font-normal"
                      value={form.price}
                      onChange={(e) => {
                        const formatted = formatPriceWithCommas(e.target.value);
                        setForm((f) => ({ ...f, price: formatted }));
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </label>
              </div>

              {/* Row 8: Summary */}
              <label className="grid gap-1.5">
                <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isLight ? "text-slate-600" : "text-slate-400")}>
                  Summary
                </span>
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
                  onClick={() => {
                    setShowModal(false);
                    setForm(emptyBookForm);
                    setAuthors([""]);
                  }}
                  className={cn(
                    "rounded-xl border px-5 py-2.5 text-sm font-semibold transition cursor-pointer",
                    isLight
                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  )}
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
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.05);
          padding-top: 8px;
          padding-bottom: 8px;
          padding-left: 12px;
          padding-right: 12px;
          font-size: 13px;
          color: #fff;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        textarea.modal-input {
          height: auto !important;
          min-height: 80px;
        }
        .modal-input:focus {
          border-color: rgba(252,212,0,0.5);
          box-shadow: 0 0 0 2px rgba(252,212,0,0.15);
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
          box-shadow: 0 0 0 2px rgba(2, 116, 187, 0.15);
        }
        html[data-theme="light"] .modal-input option {
          background: #ffffff;
          color: #000000;
        }

        /* Remove up/down spinner arrows from number inputs */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        input[type="number"] {
          -moz-appearance: textfield !important;
        }

        .modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .modal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 9999px;
        }
        .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.30);
        }
        html[data-theme="light"] .modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.18);
        }
        html[data-theme="light"] .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.30);
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
        html[data-theme="light"] .record-archive-btn {
          border: 1px solid #fdba74 !important;
          background-color: #fff7ed !important;
          color: #c2410c !important;
        }
        html[data-theme="light"] .record-archive-btn svg {
          color: #c2410c !important;
          stroke: #c2410c !important;
        }
        html[data-theme="light"] .record-archive-btn:hover {
          background-color: #ea580c !important;
          border-color: #ea580c !important;
          color: #ffffff !important;
        }
        html[data-theme="light"] .record-archive-btn:hover svg {
          color: #ffffff !important;
          stroke: #ffffff !important;
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

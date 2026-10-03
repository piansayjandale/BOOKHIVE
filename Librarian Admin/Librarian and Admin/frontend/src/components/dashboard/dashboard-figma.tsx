"use client";

// Force evaluation trigger
import React, { useEffect, useState, startTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search as SearchIcon,
  MoreVertical,
  Sparkles,
  Paperclip,
  User,
  BookOpen,
  X,
  Megaphone,
  Plus,
  RefreshCcw,
  Users,
  ClipboardList,
  BellRing,
  History as HistoryIcon,
  FileUp,
  Tag,
  ChevronRight,
  Clock,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, LabelList } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import type { SearchResult, Department, BookRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { transformDepartmentData, type DepartmentData } from "@/lib/department-transformer";
import { generateCallNumber, generateAccessionNumber, ALL_SYSTEM_GENRES, VOLUME_OPTIONS, EDITION_OPTIONS } from "@/lib/catalog/call-number";
import { CustomSelect } from "@/components/ui/custom-select";
import { dashboardSocket } from "@/lib/socket";

// Figma Design Color Palette
const colors = {
  darkNavy: "#0F1D29", // RGB(15, 29, 41)
  headerBlue: "#002D3B", // RGB(0, 32, 59)
  containerBlue: "#264258", // RGB(38, 66, 88)
  steelBlue: "#647483", // RGB(100, 116, 139)
  activeBlue: "#3A5F78", // RGB(58, 95, 120)
  accentGold: "#FCD400", // RGB(252, 212, 0)
  textWhite: "#FFFFFF", // RGB(255, 255, 255)
  textGray: "#94A3B8", // RGB(148, 163, 184)
  lightBg: "#F1F5F9", // RGB(241, 245, 249)
};

// Warm Amber/Orange Palette matching System Accent & Most Active Books Chart
const amberPalette = ["#FF9F1C", "#F39C12", "#E67E22", "#D35400", "#FFB703", "#FB8500", "#B45309"];

const emptyBookForm = {
  title: "",
  author: "",
  isbn: "",
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

const emptyAnnouncementForm = {
  title: "",
  content: "",
  audience: "All Users" as const,
  priority: "Normal" as const,
  published: true,
  durationDays: 0,
};

interface DashboardProps {
  variant?: "librarian" | "admin" | "technical" | "circulation";
}

export function DashboardFigma({ variant = "librarian" }: DashboardProps) {
  const router = useRouter();
  const { user, logout } = useSession();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const allowRecords = !user?.permissions || user.permissions.records !== false;
  const allowTransactions = !user?.permissions || user.permissions.transactions !== false;
  const allowReminders = !user?.permissions || user.permissions.reminders !== false;
  const allowHistory = !user?.permissions || user.permissions.history !== false;

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState({
    totalBooks: 0,
    totalUsers: 0,
    pendingRequests: 0,
    activeBorrowedBooks: 0,
  });
  const [departmentUsage, setDepartmentUsage] = useState<any[]>([]);
  const [topBooks, setTopBooks] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [newUsers, setNewUsers] = useState<any[]>([]);
  const [latestTransactions, setLatestTransactions] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState({
    status: "NOMINAL",
    lastIndexing: "2024-10-24T04:12:00.000Z",
    storageUsed: 84.2,
    storageTotal: 128,
  });

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const PAGE_SIZE = 6;

  // Pop-up modal states
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncementForm);
  const [submittingBook, setSubmittingBook] = useState(false);
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [noticeFeedback, setNoticeFeedback] = useState<string | null>(null);
  const [dashboardGenres, setDashboardGenres] = useState<string[]>([]);

  // Fetch dynamic system genres from database catalog
  useEffect(() => {
    let isMounted = true;
    async function fetchGenres() {
      try {
        const res = await fetch("/api/records/genres");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data?.genres && Array.isArray(data.genres)) {
          setDashboardGenres(data.genres);
        }
      } catch {
        // fallback
      }
    }
    void fetchGenres();
    return () => { isMounted = false; };
  }, []);

  const sortedFigmaGenres = useMemo(() => {
    const set = new Set<string>();
    ALL_SYSTEM_GENRES.forEach((g) => { if (g) set.add(g.trim()); });
    dashboardGenres.forEach((g) => { if (g) set.add(g.trim()); });
    if (bookForm.genres && bookForm.genres.trim()) {
      set.add(bookForm.genres.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [dashboardGenres, bookForm.genres]);

  // Automatic Call Number & Accession Number generation when input fields change
  useEffect(() => {
    if (!showAddBookModal) return;
    const generatedCall = generateCallNumber({
      title: bookForm.title,
      author: bookForm.author,
      isbn: bookForm.isbn,
      publicationDate: bookForm.publicationDate,
      department: bookForm.department,
      genres: bookForm.genres,
      volume: bookForm.volume,
      edition: bookForm.edition,
      copies: bookForm.copies,
    });
    const generatedAcc = generateAccessionNumber({
      title: bookForm.title,
      author: bookForm.author,
      isbn: bookForm.isbn,
      publicationDate: bookForm.publicationDate,
      department: bookForm.department,
      copies: bookForm.copies,
    });
    setBookForm((prev) => ({ ...prev, shelfLocation: generatedCall, accessionNumber: generatedAcc }));
  }, [
    showAddBookModal,
    bookForm.title,
    bookForm.author,
    bookForm.isbn,
    bookForm.publicationDate,
    bookForm.department,
    bookForm.genres,
    bookForm.volume,
    bookForm.edition,
    bookForm.copies,
  ]);

  const loadAnnouncementStats = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      if (data.announcements) {
        setAnnouncementsList(data.announcements);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncementStats();
  }, [loadAnnouncementStats]);

  const annStats = useMemo(() => {
    return {
      published: announcementsList.filter((a) => a.published).length,
      drafts: announcementsList.filter((a) => !a.published).length,
      urgent: announcementsList.filter((a) => a.priority === "Urgent").length,
    };
  }, [announcementsList]);

  const formattedDepartments = useMemo(() => {
    return transformDepartmentData(departmentUsage);
  }, [departmentUsage]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [dashRes, txRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/transactions?status=All&type=All"),
      ]);

      let calculatedTopBooks: any[] = [];
      if (txRes.ok) {
        const txPayload = await txRes.json();
        const txList: any[] = Array.isArray(txPayload?.transactions)
          ? txPayload.transactions
          : Array.isArray(txPayload)
          ? txPayload
          : [];

        if (txList.length > 0) {
          const borrowMap = new Map<string, { title: string; count: number; author?: string; department?: string; isbn?: string }>();
          for (const tx of txList) {
            const typeStr = (tx.type || tx.action || "").toLowerCase();
            if (typeStr === "borrow" || typeStr === "return") {
              const titleKey = (tx.resourceTitle || tx.title || "").trim();
              if (titleKey) {
                const curr = borrowMap.get(titleKey) || {
                  title: titleKey,
                  count: 0,
                  author: tx.author,
                  department: tx.department,
                  isbn: tx.isbn,
                };
                curr.count += 1;
                borrowMap.set(titleKey, curr);
              }
            }
          }

          calculatedTopBooks = Array.from(borrowMap.values())
            .sort((a, b) => b.count - a.count)
            .map((b, i) => ({
              id: `book-tx-${i}`,
              title: b.title,
              author: b.author || "STI Library",
              category: "Circulation",
              department: b.department || "Circulation",
              shelfLocation: "CIR-01A.1",
              availability: "Available",
              borrowCount: b.count,
            }));
        }
      }

      if (dashRes.ok) {
        const data = await dashRes.json();
        if (data.summary) {
          setSummary({
            totalBooks: data.summary.totalBooks || 0,
            totalUsers: data.summary.totalUsers || 0,
            pendingRequests: data.summary.pendingRequests || 0,
            activeBorrowedBooks: data.summary.activeBorrowedBooks || 0,
          });
        }
        if (data.departmentUsage) setDepartmentUsage(data.departmentUsage);
        if (data.topBooks && data.topBooks.length > 0) {
          setTopBooks(data.topBooks);
        } else if (calculatedTopBooks.length > 0) {
          setTopBooks(calculatedTopBooks);
        }
        if (data.recentActivities) setRecentActivities(data.recentActivities);
        if (data.newUsers) setNewUsers(data.newUsers);
        if (data.latestTransactions) setLatestTransactions(data.latestTransactions);
        if (data.systemHealth) setSystemHealth(data.systemHealth);
      }
    } catch (err) {
      console.warn("Error fetching dashboard:", err);
    }
  }, []);

  const [newArrivals, setNewArrivals] = useState<any[]>([]);
  const [trendingTab, setTrendingTab] = useState<"trending" | "new">("trending");
  const [bookViewMode, setBookViewMode] = useState<"columns" | "ranked">("columns");

  const totalStudents = useMemo(() => {
    return formattedDepartments.reduce((acc, curr) => acc + (curr.count || 0), 0);
  }, [formattedDepartments]);

  const activeCollegesCount = useMemo(() => {
    return formattedDepartments.filter((d) => d.count > 0).length;
  }, [formattedDepartments]);

  const displayTopBooks = useMemo(() => {
    if (topBooks && topBooks.length > 0) {
      const sorted = [...topBooks].sort((a, b) => Number(b.borrowCount ?? b.borrows ?? 0) - Number(a.borrowCount ?? a.borrows ?? 0));
      return sorted.slice(0, 4).map((b, i) => ({
        id: b.id || `book-${i}`,
        title: b.title || b.resourceTitle || `Book ${i + 1}`,
        author: b.author || "STI Library",
        category: b.category || b.department || "Circulation",
        department: b.department || "Circulation",
        borrowCount: Number(b.borrowCount ?? b.borrows ?? 0),
      }));
    }
    return [
      { id: "1", title: "1984", author: "George Orwell", category: "Classics", department: "Circulation", borrowCount: 0 },
      { id: "2", title: "A Game of Thrones", author: "George R.R. Martin", category: "Fantasy", department: "Circulation", borrowCount: 0 },
      { id: "3", title: "Angels & Demons", author: "Dan Brown", category: "Fiction", department: "Circulation", borrowCount: 0 },
      { id: "4", title: "Animal Farm", author: "George Orwell", category: "Classics", department: "Circulation", borrowCount: 0 },
    ];
  }, [topBooks]);

  const totalBorrowsCount = useMemo(() => {
    return displayTopBooks.reduce((acc, curr) => acc + (curr.borrowCount || 0), 0);
  }, [displayTopBooks]);

  const fetchNewArrivals = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/books?page=1&pageSize=5&sortBy=recent");
      if (res.ok) {
        const data = await res.json();
        if (data.books) {
          setNewArrivals(data.books);
        }
      }
    } catch (err) {
      console.error("Failed to fetch new arrivals:", err);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
    if (variant !== "admin") {
      void fetchNewArrivals();
    }

    // Subscribe to real-time transaction & announcement updates
    const unsubBorrow = dashboardSocket.subscribeToBorrowRequest(() => {
      void fetchDashboardData();
    });
    const unsubNotif = dashboardSocket.subscribeToNotification(() => {
      void fetchDashboardData();
      void loadAnnouncementStats();
    });
    const handleTxUpdate = () => {
      void fetchDashboardData();
      void loadAnnouncementStats();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("transaction-updated", handleTxUpdate);
      window.addEventListener("announcement-updated", handleTxUpdate);
    }

    const intervalId = setInterval(() => {
      void fetchDashboardData();
    }, 6000);

    return () => {
      unsubBorrow();
      unsubNotif();
      clearInterval(intervalId);
      if (typeof window !== "undefined") {
        window.removeEventListener("transaction-updated", handleTxUpdate);
      }
    };
  }, [fetchDashboardData, fetchNewArrivals, variant]);

  function runSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!searchQuery.trim()) {
      return;
    }
    const basePath = variant === "admin" ? "/admin" : "/librarian";
    router.push(
      `${basePath}/ai-prompt-search?query=${encodeURIComponent(searchQuery)}&department=${encodeURIComponent(
        selectedCategory,
      )}`,
    );
  }

  async function handleBookSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingBook(true);
    try {
      await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookForm),
      });
      setBookForm(emptyBookForm);
      setShowAddBookModal(false);
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingBook(false);
    }
  }

  async function handleAnnouncementSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAnnouncement(true);
    try {
      await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(announcementForm),
      });
      setAnnouncementForm(emptyAnnouncementForm);
      setShowAnnouncementModal(false);
      await loadAnnouncementStats();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAnnouncement(false);
    }
  }

  const categories = [
    "Circulation",
    "General Reference",
    "Filipiniana",
    "Reserve",
    "Periodical",
    "Special Collections",
  ];

  const commandActions = [
    {
      icon: "📚",
      title: variant !== "admin" ? "BOOKHIVE LIBRARIAN" : "SYSTEM ADMIN",
      count: "3 pending requests",
    },
    {
      icon: "📊",
      title: variant !== "admin" ? "INVENTORY REPORTS" : "ANALYTICS DASHBOARD",
      count: "12 new insights",
    },
  ];

  const visibleResults = results ? results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : null;

  return (
    <>
      {/* Active Campus Announcements Live Banner for Librarians and Admins */}
      {(() => {
        const isAdmin = variant === "admin" || (user?.role && ["Admin", "Super Admin", "SUPER_ADMIN", "ADMIN"].includes(user.role));
        const activeAnnouncements = announcementsList.filter((a) => a.published);

        // If not an admin and there are no active notices, don't show an empty banner
        if (!isAdmin && activeAnnouncements.length === 0) {
          return null;
        }

        const announcementsHref = "/admin/announcements";

        return (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              "mb-8 overflow-hidden rounded-2xl p-5 relative transition-all",
              isLight
                ? "border border-[#0274BB]/20 bg-gradient-to-r from-sky-50/70 via-white to-blue-50/50 shadow-md"
                : "border border-[#FCD400]/40 bg-gradient-to-r from-[#14293E] via-[#0F2236] to-[#0B1A2C] shadow-2xl"
            )}
          >
            <div className={cn("flex flex-wrap items-center justify-between gap-3 pb-3", isLight ? "border-b border-[#0274BB]/15" : "border-b border-white/10")}>
              <div className="flex items-center gap-2.5">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl shadow-sm", isLight ? "bg-[#FFF300] text-[#0274BB]" : "bg-[#FCD400]/20 text-[#FCD400]")}>
                  <Megaphone className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <span className={cn("text-[10px] font-extrabold tracking-[0.2em] uppercase", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                    Active Campus Notice
                  </span>
                  <h3 className={cn("text-sm font-bold", isLight ? "text-[#0274BB]" : "text-white")}>
                    System Announcements ({activeAnnouncements.length} Active)
                  </h3>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAnnouncementModal(true)}
                    className={cn(
                      "text-xs font-bold flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-xl border transition shadow-sm",
                      isLight
                        ? "bg-[#FFF300] text-[#0274BB] border-[#ebd000] hover:bg-[#ebd000]"
                        : "bg-[#FCD400] text-[#0F1D29] border-[#FCD400] hover:bg-[#e0bc00]"
                    )}
                    title="Post a new announcement immediately"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Post Notice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push(announcementsHref)}
                    className={cn(
                      "text-xs font-bold flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-xl border transition",
                      isLight
                        ? "bg-white text-[#0274BB] border-[#0274BB]/25 hover:bg-slate-50 shadow-sm"
                        : "text-[#FCD400] hover:underline bg-white/5 hover:bg-white/10 border-white/10"
                    )}
                  >
                    <span>Manage Announcements Board</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Announcement Cards */}
            {activeAnnouncements.length > 0 ? (
              <div className="mt-3.5 grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {activeAnnouncements.slice(0, 3).map((ann) => (
                  <div
                    key={ann.id}
                    onClick={() => setSelectedNotice(ann)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-xl p-4 transition-all duration-200 shadow-sm cursor-pointer",
                      isLight
                        ? "border border-slate-200/90 bg-white hover:border-[#0274BB] hover:shadow-md hover:-translate-y-0.5"
                        : "border border-white/10 bg-[#0B1724]/90 hover:border-[#FCD400] hover:shadow-lg hover:-translate-y-0.5"
                    )}
                    style={{
                      borderLeftColor: ann.priority === "Urgent" ? "#EF4444" : ann.priority === "Important" ? (isLight ? "#0274BB" : "#FCD400") : (isLight ? "#0274BB" : "#38BDF8"),
                      borderLeftWidth: 4,
                    }}
                    title="Click to view full notice and manage"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          ann.priority === "Urgent"
                            ? (isLight ? "bg-red-50 text-red-700 border border-red-200" : "bg-red-500/20 text-red-300 border border-red-500/40")
                            : ann.priority === "Important"
                            ? (isLight ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-amber-500/20 text-amber-300 border border-amber-500/40")
                            : (isLight ? "bg-blue-50 text-[#0274BB] border border-blue-200" : "bg-sky-500/20 text-sky-300 border border-sky-500/40")
                        }`}>
                          {ann.priority}
                        </span>
                        <span className={cn("text-[10px] font-medium", isLight ? "text-slate-500" : "text-slate-400")}>To: {ann.audience}</span>
                      </div>

                      <h4 className={cn("text-sm font-bold line-clamp-1 group-hover:text-[#0274BB] dark:group-hover:text-[#FCD400] transition-colors", isLight ? "text-[#0274BB]" : "text-white")}>
                        {ann.title}
                      </h4>
                      <p className={cn("text-xs line-clamp-2 leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>{ann.content}</p>
                    </div>

                    <div className={cn("mt-3 pt-2.5 flex items-center justify-between text-[11px]", isLight ? "border-t border-slate-100 text-slate-500" : "border-t border-white/5 text-slate-400")}>
                      <span className={cn("font-semibold", isLight ? "text-slate-700" : "text-slate-300")}>By {ann.author}</span>
                      <span className="flex items-center gap-1 font-medium">
                        <span>{ann.durationDays ? `${ann.durationDays}d limit` : "Live Notice"}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 font-bold text-[10px] text-[#0274BB] dark:text-[#FCD400]">
                          • View
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : isAdmin ? (
              <div className={cn(
                "mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 border border-dashed",
                isLight ? "border-slate-300 bg-white/70" : "border-white/15 bg-white/5"
              )}>
                <span className={cn("text-xs", isLight ? "text-slate-600" : "text-slate-300")}>
                  No campus announcements are currently active. Click &quot;Post Notice&quot; to notify students and staff.
                </span>
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(true)}
                  className={cn("text-xs font-bold hover:underline", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}
                >
                  + Post First Announcement
                </button>
              </div>
            ) : null}
          </motion.div>
        );
      })()}

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn(
          "rounded-[24px] p-8 md:p-10 mb-8 transition-all panel-hero",
          isLight
            ? "border border-[#0274BB]/20 bg-gradient-to-r from-sky-50/70 via-white to-blue-50/50 shadow-md"
            : "bg-[#14293E] shadow-xl"
        )}
      >
        {/* Section Label */}
        <div className={cn("flex items-center gap-2 mb-4", isLight ? "text-[#0274BB]" : "text-[#FFD600]")}>
          <Sparkles className="h-4 w-4 fill-current" />
          <span className="text-xs font-bold tracking-widest uppercase">ASK BOOKHIVE</span>
        </div>

        {/* Main Heading */}
        <h1 className={cn("mb-8 text-[32px] font-bold tracking-tight md:text-[36px]", isLight ? "text-[#0274BB]" : "text-white")}>
          Find resources across the entire STI WNU digital ecosystem.
        </h1>

        {/* AI Prompt Search Box */}
        <form onSubmit={runSearch}>
          <div className={cn("flex w-full items-center gap-3 rounded-full px-4 py-3 mb-2 transition-all", isLight ? "border border-slate-300/90 bg-white shadow-sm" : "border border-white/10 bg-[#0B1724] shadow-inner")}>
            <SearchIcon className={cn("h-5 w-5 ml-2", isLight ? "text-slate-400" : "text-slate-400")} />
            <input
              type="text"
              suppressHydrationWarning
              placeholder="Search by Title, Author, ISBN, or ask a question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("flex-1 bg-transparent text-[15px] outline-none", isLight ? "text-[#0274BB] placeholder:text-slate-400 font-medium" : "text-white placeholder-slate-500")}
            />

            <div className="flex items-center gap-2">
              <label
                className={cn("cursor-pointer p-2 transition rounded-full", isLight ? "text-slate-500 hover:text-[#0274BB] hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/5")}
                title="Upload Attachment"
              >
                <Paperclip className="h-5 w-5" />
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                  multiple
                  onChange={(e) => setUploadedFiles(Array.from(e.target.files ?? []))}
                />
              </label>

              <button
                type="submit"
                suppressHydrationWarning
                disabled={searching}
                className={cn(
                  "rounded-full px-6 py-2.5 text-sm font-bold tracking-wide transition hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100",
                  isLight
                    ? "bg-[#FFF300] text-[#0274BB] border border-[#ebd000] hover:bg-[#ebd000] shadow-sm"
                    : "bg-[#FFD600] text-[#0A1624] hover:bg-[#FCD400]/90"
                )}
              >
                {searching ? "ANALYZING..." : "ANALYZE"}
              </button>
            </div>
          </div>
        </form>
        {uploadedFiles.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {uploadedFiles.map((file, idx) => (
              <span
                key={`${file.name}-${file.size}-${idx}`}
                className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs", isLight ? "border border-blue-200 bg-blue-50 text-[#0274BB] font-medium" : "border border-white/10 bg-black/20 text-white/65")}
              >
                <span className="max-w-[200px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className={cn("rounded-full p-0.5 transition-all flex items-center justify-center cursor-pointer", isLight ? "hover:bg-blue-100 text-[#0274BB]/60 hover:text-[#0274BB]" : "hover:bg-white/15 text-white/40 hover:text-white")}
                  title="Remove file"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </motion.section>

      <AnimatePresence mode="wait">
        {results === null ? null : results.length === 0 ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className={cn("mb-8 flex items-center justify-center gap-3 rounded-[24px] px-4 py-8 text-sm shadow-sm", isLight ? "border border-red-200 bg-red-50 text-red-700 font-medium" : "border border-red-500/20 bg-[#14293E] text-red-400 shadow-xl")}
          >
            No matching records found. Try adjusting your search prompt.
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="mb-8 flex flex-col gap-6 text-left"
          >
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleResults?.map((result) => {
                const relevance = result.relevance;
                const isHigh = relevance >= 90;
                const isMedium = relevance >= 75;
                const relevanceBadgeClass = isHigh
                  ? "border border-emerald-500/35 bg-emerald-500/10 text-emerald-400 font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.15)] rounded-full px-2.5 py-1 text-xs"
                  : isMedium
                  ? "border border-amber-500/35 bg-amber-500/10 text-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.15)] rounded-full px-2.5 py-1 text-xs"
                  : "border border-slate-500/35 bg-slate-500/10 text-slate-300 font-extrabold rounded-full px-2.5 py-1 text-xs";

                return (
                  <motion.button
                    key={result.id}
                    type="button"
                    onClick={() => setSelectedBook(result)}
                    whileHover={{ y: -4, scale: 1.015 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={cn(
                      "flex flex-col justify-between w-full text-left p-6 rounded-[24px] transition-all duration-300 group",
                      isLight
                        ? "bg-white border border-slate-200/90 shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                        : "bg-gradient-to-br from-[#1E3A5F]/35 to-[#0B1A2C]/65 backdrop-blur-md border border-white/[0.06] hover:border-white/10 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.5)]"
                    )}
                  >
                    <div className="space-y-4">
                      {/* Top bar with category & relevance */}
                      <div className="flex items-center justify-between gap-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.15em] uppercase",
                          isLight
                            ? "bg-blue-50 border border-blue-200 text-[#0274BB]"
                            : "bg-white/5 border border-white/5 text-[#FFD600]"
                        )}>
                          <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse", isLight ? "bg-[#0274BB]" : "bg-[#FFD600]")}></span>
                          {result.department}
                        </span>
                        <span className={relevanceBadgeClass}>{relevance}% MATCH</span>
                      </div>

                      {/* Title & Metadata */}
                      <div>
                        <h3 className={cn("text-[17px] font-bold tracking-tight line-clamp-2 leading-snug transition-colors", isLight ? "text-[#0274BB] group-hover:text-blue-700" : "text-white group-hover:text-[#FFD600]")}>
                          {result.title}
                        </h3>
                        <div className="mt-2.5 space-y-1.5">
                          <p className={cn("flex items-center gap-1.5 text-xs", isLight ? "text-slate-600" : "text-white/70")}>
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            By <span className={cn("font-semibold", isLight ? "text-slate-800" : "text-white/90")}>{result.author}</span>
                          </p>
                          <div className="flex items-center flex-wrap gap-2 text-[11px]">
                            <span className={cn("font-mono px-1.5 py-0.5 rounded", isLight ? "bg-slate-100 border border-slate-200 text-slate-700" : "bg-white/5 border border-white/5 text-white/40")}>
                              ISBN: {result.isbn}
                            </span>
                            {result.language && (
                              <span className={cn("px-1.5 py-0.5 rounded uppercase font-bold tracking-wider text-[9px]", isLight ? "bg-blue-50 border border-blue-200 text-[#0274BB]" : "bg-white/5 border border-white/5 text-white/40")}>
                                🌐 {result.language}
                              </span>
                            )}
                            {typeof result.rating === "number" && result.rating > 0 && (
                              <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold", isLight ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-white/5 border border-white/5 text-[#FFD600]")}>
                                ⭐ {result.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Book Summary */}
                      <p className={cn("text-xs leading-relaxed line-clamp-4 pt-3.5 italic", isLight ? "text-slate-600 border-t border-slate-100" : "text-white/60 border-t border-white/[0.04]")}>
                        "{result.summary}"
                      </p>
                    </div>

                    {/* Matched explanation details */}
                    {result.matchedBy && result.matchedBy.length > 0 && (
                      <div className={cn("mt-4 flex flex-wrap gap-1 pt-3.5", isLight ? "border-t border-slate-100" : "border-t border-white/[0.04]")}>
                        {result.matchedBy.map((match) => (
                          <span
                            key={match}
                            className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wide uppercase text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/10 px-2 py-0.5 rounded-full"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                            {match}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {results.length > 0 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className={cn("flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold transition", isLight ? "border border-slate-200 bg-white text-[#0274BB] hover:bg-slate-50 disabled:opacity-40" : "border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-[#0A1624]")}
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(results.length / PAGE_SIZE) }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const isActive = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "h-8 w-8 rounded-full text-xs font-bold transition flex items-center justify-center",
                          isActive
                            ? isLight ? "bg-[#FFF300] text-[#0274BB] border border-[#ebd000]" : "bg-[#FFD600] text-[#0A1624]"
                            : isLight ? "border border-slate-200 bg-white text-[#0274BB] hover:bg-slate-50" : "border border-white/10 bg-white/5 text-white hover:bg-white/10",
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage === Math.ceil(results.length / PAGE_SIZE)}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(Math.ceil(results.length / PAGE_SIZE), prev + 1))
                  }
                  className={cn("flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold transition", isLight ? "border border-slate-200 bg-white text-[#0274BB] hover:bg-slate-50 disabled:opacity-40" : "border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-[#0A1624]")}
                >
                  Next
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analytics & System Health Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Metric 1 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={cn(
            "flex flex-col justify-center overflow-hidden rounded-2xl border border-l-[6px] px-6 py-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1",
            isLight
              ? "border-slate-200/90 border-l-[#FFF300] bg-white shadow-sm hover:border-[#0274BB]/30 hover:shadow-md"
              : "border-white/10 border-l-[#FCD400] bg-[#152E47]/80 shadow-lg hover:bg-[#1E3445]"
          )}
        >
          <div className={cn("mb-1 text-[11px] font-bold tracking-[0.15em]", isLight ? "text-slate-600" : "text-[#94A3B8]")}>TOTAL_BOOKS</div>
          <div className={cn("text-[32px] font-black tracking-tight", isLight ? "text-[#0274BB]" : "text-white")}>{summary.totalBooks.toLocaleString()}</div>
        </motion.div>

        {/* Metric 2 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={cn(
            "flex flex-col justify-center overflow-hidden rounded-2xl border border-l-[6px] px-6 py-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1",
            isLight
              ? "border-slate-200/90 border-l-[#0274BB] bg-white shadow-sm hover:border-[#0274BB]/30 hover:shadow-md"
              : "border-white/10 border-l-[#38BDF8] bg-[#152E47]/80 shadow-lg hover:bg-[#1E3445]"
          )}
        >
          <div className={cn("mb-1 text-[11px] font-bold tracking-[0.15em]", isLight ? "text-slate-600" : "text-[#94A3B8]")}>ACTIVE_USERS</div>
          <div className={cn("text-[32px] font-black tracking-tight", isLight ? "text-[#0274BB]" : "text-white")}>{summary.totalUsers.toLocaleString()}</div>
        </motion.div>

        {/* Metric 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={cn(
            "flex flex-col justify-center overflow-hidden rounded-2xl border border-l-[6px] px-6 py-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1",
            isLight
              ? "border-slate-200/90 border-l-amber-500 bg-white shadow-sm hover:border-[#0274BB]/30 hover:shadow-md"
              : "border-white/10 border-l-[#F97316] bg-[#152E47]/80 shadow-lg hover:bg-[#1E3445]"
          )}
        >
          <div className={cn("mb-1 text-[11px] font-bold tracking-[0.15em]", isLight ? "text-slate-600" : "text-[#94A3B8]")}>PENDING_REQ</div>
          <div className={cn("text-[32px] font-black tracking-tight", isLight ? "text-[#0274BB]" : "text-white")}>{summary.pendingRequests.toLocaleString()}</div>
        </motion.div>

        {/* Metric 4 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className={cn(
            "flex flex-col justify-center overflow-hidden rounded-2xl border border-l-[6px] px-6 py-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1",
            isLight
              ? "border-slate-200/90 border-l-rose-500 bg-white shadow-sm hover:border-[#0274BB]/30 hover:shadow-md"
              : "border-white/10 border-l-[#EF4444] bg-[#152E47]/80 shadow-lg hover:bg-[#1E3445]"
          )}
        >
          <div className={cn("mb-1 text-[11px] font-bold tracking-[0.15em]", isLight ? "text-slate-600" : "text-[#94A3B8]")}>ACTIVE_BORROWS</div>
          <div className={cn("text-[32px] font-black tracking-tight", isLight ? "text-rose-600" : "text-[#EF4444]")}>
            {summary.activeBorrowedBooks.toLocaleString()}
          </div>
        </motion.div>

        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className={cn(
            "group flex flex-col justify-between overflow-hidden rounded-2xl p-6 transition-all duration-300",
            isLight
              ? "border border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/30 hover:shadow-md"
              : "bg-[#041E30] shadow-sm hover:shadow-xl hover:shadow-[#041E30]/20"
          )}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className={cn("text-xs font-bold tracking-widest", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>SYSTEM_HEALTH</div>
            <div
              className={`flex items-center gap-2 text-[10px] font-bold ${
                systemHealth.status === "NOMINAL"
                  ? isLight ? "text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-full" : "text-[#10B981]"
                  : systemHealth.status === "DEGRADED"
                  ? isLight ? "text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-full" : "text-[#F59E0B]"
                  : isLight ? "text-rose-700 bg-rose-50 border border-rose-200/90 px-2 py-0.5 rounded-full" : "text-[#EF4444]"
              }`}
            >
              <div
                className={`h-2 w-2 animate-pulse rounded-full ${
                  systemHealth.status === "NOMINAL"
                    ? "bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    : systemHealth.status === "DEGRADED"
                    ? "bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                    : "bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                }`}
              ></div>
              {systemHealth.status}
            </div>
          </div>

          <div>
            <div className={cn("mb-1 flex justify-between text-[10px] font-bold", isLight ? "text-slate-600" : "text-[#64748B]")}>
              <span>LAST INDEXING</span>
              <span>STORAGE USED</span>
            </div>

            <div className={cn("mb-4 flex justify-between text-xs font-bold", isLight ? "text-[#0274BB]" : "text-white")}>
              <span>
                {new Date(systemHealth.lastIndexing)
                  .toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
                  .replace(/-/g, ".")}{" "}
                {new Date(systemHealth.lastIndexing).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>
                {systemHealth.storageUsed.toFixed(1)} / {systemHealth.storageTotal} GB
              </span>
            </div>

            <div className={cn("h-1.5 w-full overflow-hidden rounded-full", isLight ? "bg-slate-100 border border-slate-200" : "bg-[#1E3445]")}>
              <div
                className={cn("h-full rounded-full transition-all duration-1000", isLight ? "bg-[#0274BB]" : "bg-[#FCD400]")}
                style={{
                  width: `${Math.min(
                    100,
                    ...[Math.max(0, (systemHealth.storageUsed / systemHealth.storageTotal) * 100)],
                  )}%`,
                }}
              ></div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (Span 2) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Most Active Departments */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className={cn("text-[22px] font-bold tracking-wide", isLight ? "text-[#0274BB]" : "text-white")}>Most Active Departments</h2>
                  <p className={cn("mt-1 text-[13px] font-normal", isLight ? "text-slate-600" : "text-slate-300")}>Student enrollment count by academic college.</p>
                </div>
                <div className={cn("rounded-full px-3 py-1 text-xs font-bold shadow-sm", isLight ? "border border-blue-200/80 bg-blue-50 text-[#0274BB]" : "border border-white/10 bg-[#132337] text-[#FCD400]")}>
                  {activeCollegesCount} Active
                </div>
              </div>

              <div className="h-[280px] w-full flex flex-row items-center justify-between gap-3">
                {/* Left: Donut Chart with Centered Info matching Picture 1 */}
                <div className="relative h-full w-[170px] shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={totalStudents === 0 ? [{ value: 1 }] : formattedDepartments}
                        dataKey={totalStudents === 0 ? "value" : "count"}
                        nameKey="code"
                        innerRadius={54}
                        outerRadius={80}
                        paddingAngle={totalStudents === 0 ? 0 : 3}
                        stroke={isLight ? "#FFFFFF" : "#0F1D29"}
                        strokeWidth={2}
                        isAnimationActive={true}
                      >
                        {totalStudents === 0 ? (
                          <Cell fill={isLight ? "#E2E8F0" : "#182A3C"} stroke={isLight ? "#CBD5E1" : "#22394F"} strokeWidth={2} />
                        ) : (
                          formattedDepartments.map((entry: DepartmentData) => (
                            <Cell key={`cell-${entry.code}`} fill={entry.color} />
                          ))
                        )}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Text inside the Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                    <span className={cn("text-3xl font-black leading-none", isLight ? "text-[#0274BB]" : "text-white")}>{totalStudents}</span>
                    <span className={cn("text-[10px] font-extrabold tracking-widest uppercase mt-1", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>STUDENTS</span>
                    <span className={cn("text-[9.5px] font-medium mt-0.5 leading-tight whitespace-nowrap", isLight ? "text-slate-500 font-semibold" : "text-slate-400")}>7 College Departments</span>
                  </div>
                </div>

                {/* Right: 7 College List Items matching Picture 1 */}
                <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-full pr-0.5 justify-center">
                  {formattedDepartments.map((item: DepartmentData) => {
                    const pct = totalStudents > 0 ? Math.round((item.count / totalStudents) * 100) : 0;
                    return (
                      <div
                        key={item.code}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 transition-all",
                          isLight
                            ? "border border-slate-200/80 bg-slate-50/90 hover:bg-sky-50 hover:border-blue-300"
                            : "border border-white/5 bg-[#122335]/75 hover:bg-[#122335] hover:border-white/10"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn("text-xs font-bold", isLight ? "text-[#0274BB]" : "text-white")}>{item.code}</span>
                            <span className={cn("text-[11px] font-normal truncate max-w-[62px]", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>
                              {item.mascot}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-xs font-bold font-mono", isLight ? "text-[#0274BB]" : "text-white")}>{item.count}</span>
                          <div className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono", isLight ? "border border-[#ebd000] bg-[#FFF300] text-[#0274BB]" : "border border-[#FCD400]/40 bg-[#FCD400]/10 text-[#FCD400]")}>
                            {pct}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.section>

            {/* Most Borrowed Books matching Picture 1 with High Visibility & Real-Time Sync */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className={cn("text-[22px] font-bold tracking-wide", isLight ? "text-[#0274BB]" : "text-white")}>Most Borrowed Books</h2>
                  <p className={cn("mt-1 text-[13px] font-normal", isLight ? "text-slate-600" : "text-slate-300")}>Live borrow transaction metrics by title.</p>
                </div>
                {/* Segmented Button [ Columns | Ranked ] */}
                <div className={cn("flex items-center rounded-full p-0.5", isLight ? "bg-slate-100 border border-slate-200" : "bg-[#132337] border border-white/10")}>
                  <button
                    type="button"
                    onClick={() => setBookViewMode("columns")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold transition-all",
                      bookViewMode === "columns"
                        ? isLight
                          ? "bg-[#FFF300] text-[#0274BB] shadow font-extrabold"
                          : "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                        : isLight
                        ? "text-slate-600 hover:text-[#0274BB]"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Columns
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookViewMode("ranked")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold transition-all",
                      bookViewMode === "ranked"
                        ? isLight
                          ? "bg-[#FFF300] text-[#0274BB] shadow font-extrabold"
                          : "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                        : isLight
                        ? "text-slate-600 hover:text-[#0274BB]"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Ranked
                  </button>
                </div>
              </div>

              <div className="h-[250px] w-full">
                {bookViewMode === "columns" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={displayTopBooks}
                      margin={{ top: 26, right: 15, left: -22, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="barGrad0" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FCD400" />
                          <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                        <linearGradient id="barGrad1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FB923C" />
                          <stop offset="100%" stopColor="#C2410C" />
                        </linearGradient>
                        <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F97316" />
                          <stop offset="100%" stopColor="#9A3412" />
                        </linearGradient>
                        <linearGradient id="barGrad3" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38BDF8" />
                          <stop offset="100%" stopColor="#0369A1" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255,255,255,0.06)"} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="title"
                        stroke={isLight ? "rgba(0, 0, 0, 0.3)" : "rgba(255,255,255,0.4)"}
                        tick={{ fill: isLight ? "#000000" : "#FFFFFF", fontSize: 11, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={{ stroke: isLight ? "rgba(0, 0, 0, 0.25)" : "rgba(255,255,255,0.1)" }}
                        interval={0}
                        angle={-15}
                        dy={10}
                        textAnchor="end"
                        tickFormatter={(value) =>
                          value.length > 14 ? value.substring(0, 13) + "..." : value
                        }
                      />
                      <YAxis
                        stroke={isLight ? "rgba(0, 0, 0, 0.3)" : "rgba(255,255,255,0.4)"}
                        tick={{ fill: isLight ? "#000000" : "#94A3B8", fontSize: 10, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isLight ? "#FFFFFF" : "#0F1D29",
                          border: isLight ? "1px solid rgba(0, 0, 0, 0.12)" : "1px solid rgba(255,255,255,0.15)",
                          color: isLight ? "#000000" : "#fff",
                          borderRadius: "12px",
                          fontSize: "12px",
                          boxShadow: isLight ? "0 10px 25px rgba(0, 0, 0, 0.1)" : "0 10px 25px rgba(0,0,0,0.5)",
                          padding: "10px 14px",
                        }}
                        cursor={{ fill: isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255,255,255,0.05)" }}
                        formatter={(value: any, _name: any, props: any) => [
                          `${value} Borrow Transactions`,
                          `${props?.payload?.author ?? "STI Library"} • ${props?.payload?.category ?? "General"}`,
                        ]}
                      />
                      <Bar
                        dataKey="borrowCount"
                        radius={[6, 6, 0, 0]}
                        barSize={38}
                        shape={(props: any) => {
                          const { x, y, width, height, index, value } = props;
                          const gradId = `url(#barGrad${index % 4})`;
                          const badgeWidth = 28;
                          const badgeHeight = 18;
                          const badgeX = x + width / 2 - badgeWidth / 2;
                          const badgeY = value > 0 ? y - badgeHeight - 6 : y - badgeHeight - 6;

                          return (
                            <g>
                              {/* Top Badge pill */}
                              <rect
                                x={badgeX}
                                y={badgeY}
                                width={badgeWidth}
                                height={badgeHeight}
                                rx={5}
                                ry={5}
                                fill={isLight ? "#FFF300" : "#0B1A2C"}
                                stroke={isLight ? "#0274BB" : "#FCD400"}
                                strokeWidth={1}
                              />
                              <text
                                x={x + width / 2}
                                y={badgeY + 13}
                                fill={isLight ? "#0274BB" : "#FCD400"}
                                textAnchor="middle"
                                fontSize={11}
                                fontWeight="900"
                                fontFamily="monospace"
                              >
                                {value}
                              </text>

                              {/* Bar with gradient if > 0 or clean baseline if 0 */}
                              {value > 0 ? (
                                <path
                                  d={`M${x},${y + height} L${x},${y + 6} Q${x},${y} ${x + 6},${y} L${x + width - 6},${y} Q${x + width},${y} ${x + width},${y + 6} L${x + width},${y + height} Z`}
                                  fill={gradId}
                                />
                              ) : (
                                <rect
                                  x={x}
                                  y={y - 3}
                                  width={width}
                                  height={4}
                                  rx={2}
                                  fill={isLight ? "rgba(2, 116, 187, 0.15)" : "rgba(252, 212, 0, 0.25)"}
                                />
                              )}
                            </g>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  /* Ranked List View */
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-full pr-1">
                    {displayTopBooks.map((book: any, idx: number) => (
                      <div
                        key={book.title + idx}
                        onClick={() => {
                          const fullBook = topBooks.find((t) => (t.id && t.id === book.id) || (t.title && t.title.toLowerCase() === book.title.toLowerCase())) || book;
                          setSelectedBook(fullBook);
                        }}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl p-2.5 transition cursor-pointer",
                          isLight
                            ? "border border-slate-200/80 bg-slate-50/90 hover:bg-sky-50 hover:border-blue-300"
                            : "border border-white/5 bg-[#122335]/70 hover:bg-[#122335] hover:border-[#FCD400]/40"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black font-mono shadow-sm",
                              idx === 0
                                ? (isLight ? "bg-[#FFF300] text-[#0274BB]" : "bg-[#FCD400] text-[#0B1A2C]")
                                : idx === 1
                                ? (isLight ? "bg-slate-200 text-slate-800" : "bg-slate-300 text-[#0B1A2C]")
                                : idx === 2
                                ? "bg-amber-500 text-white"
                                : (isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-slate-300")
                            )}
                          >
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("truncate text-xs font-bold", isLight ? "text-[#0274BB]" : "text-white")}>{book.title}</p>
                            <p className={cn("truncate text-[10px]", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>
                              {book.author} • <span className={isLight ? "text-[#0274BB] font-semibold" : "text-[#FCD400]/80"}>{book.category}</span>
                            </p>
                          </div>
                        </div>
                        <div className={cn("rounded-md px-2 py-0.5 text-xs font-bold font-mono shrink-0", isLight ? "border border-[#ebd000] bg-[#FFF300] text-[#0274BB]" : "border border-[#FCD400]/40 bg-[#FCD400]/10 text-[#FCD400]")}>
                          {book.borrowCount} borrows
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Real-Time Telemetry Bar */}
              <div className={cn("flex items-center justify-between text-[11px] px-1 pt-2.5 mt-1", isLight ? "border-t border-slate-200" : "border-t border-white/5")}>
                <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Real-time Database Sync
                </div>
                <div className={cn("font-mono text-[11px]", isLight ? "text-slate-600 font-medium" : "text-slate-300")}>
                  <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>{totalBorrowsCount}</span> Total Borrows
                </div>
              </div>
            </motion.section>
          </div>

          {/* Command Shortcuts */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <h2 className={cn("mb-4 text-[10px] font-bold tracking-[0.15em]", isLight ? "text-[#0274BB]" : "text-slate-400")}>COMMAND_SHORTCUTS</h2>
            <div className={variant === "admin" ? "grid grid-cols-4 gap-4" : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"}>
              {variant === "admin" ? (
                <>
                  <button
                    suppressHydrationWarning
                    onClick={() => setShowAddBookModal(true)}
                    className={cn(
                      "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                      isLight
                        ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                        : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                    <div className={cn(
                      "z-10 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                      isLight
                        ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                        : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                    )}>
                      <Plus className={cn("h-6 w-6", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                    </div>
                    <span className={cn(
                      "z-10 text-[10px] tracking-[0.2em] transition-colors duration-300",
                      isLight
                        ? "font-extrabold text-[#0274BB]"
                        : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                    )}>
                      ADD_BOOK
                    </span>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={() => router.push("/admin/catalog")}
                    className={cn(
                      "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                      isLight
                        ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                        : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                    <div className={cn(
                      "z-10 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                      isLight
                        ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                        : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                    )}>
                      <ClipboardList className={cn("h-6 w-6", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                    </div>
                    <span className={cn(
                      "z-10 text-[10px] tracking-[0.2em] transition-colors duration-300",
                      isLight
                        ? "font-extrabold text-[#0274BB]"
                        : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                    )}>
                      VIEW_CATALOG
                    </span>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={() => router.push("/admin/analytics")}
                    className={cn(
                      "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                      isLight
                        ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                        : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                    <div className={cn(
                      "z-10 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                      isLight
                        ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                        : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                    )}>
                      <Sparkles className={cn("h-6 w-6", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                    </div>
                    <span className={cn(
                      "z-10 text-[10px] tracking-[0.2em] transition-colors duration-300",
                      isLight
                        ? "font-extrabold text-[#0274BB]"
                        : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                    )}>
                      ANALYTICS
                    </span>
                  </button>

                  <button
                    suppressHydrationWarning
                    onClick={() => setShowAnnouncementModal(true)}
                    className={cn(
                      "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                      isLight
                        ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                        : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                    <div className={cn(
                      "z-10 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                      isLight
                        ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                        : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                    )}>
                      <Megaphone className={cn("h-6 w-6", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                    </div>
                    <span className={cn(
                      "z-10 text-[10px] tracking-[0.2em] transition-colors duration-300",
                      isLight
                        ? "font-extrabold text-[#0274BB]"
                        : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                    )}>
                      ANNOUNCEMENTS
                    </span>
                  </button>
                </>
              ) : (
                <>
                  {/* ADD_BOOK */}
                  {allowRecords && (
                    <button
                      suppressHydrationWarning
                      onClick={() => setShowAddBookModal(true)}
                      className={cn(
                        "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                        isLight
                          ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                          : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                      <div className={cn(
                        "z-10 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                        isLight
                          ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                          : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                      )}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]"}
                        >
                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                          <line x1="12" y1="8" x2="12" y2="14" />
                          <line x1="9" y1="11" x2="15" y2="11" />
                        </svg>
                      </div>
                      <span className={cn(
                        "z-10 text-[9px] tracking-[0.15em] transition-colors duration-300",
                        isLight
                          ? "font-extrabold text-[#0274BB]"
                          : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                      )}>
                        ADD_BOOK
                      </span>
                    </button>
                  )}

                  {/* VIEW_RECORDS */}
                  {allowRecords && (
                    <button
                      suppressHydrationWarning
                      onClick={() => router.push("/librarian/records")}
                      className={cn(
                        "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                        isLight
                          ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                          : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                      <div className={cn(
                        "z-10 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                        isLight
                          ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                          : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                      )}>
                        <ClipboardList className={cn("h-5 w-5", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                      </div>
                      <span className={cn(
                        "z-10 text-[9px] tracking-[0.15em] transition-colors duration-300",
                        isLight
                          ? "font-extrabold text-[#0274BB]"
                          : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                      )}>
                        VIEW_RECORDS
                      </span>
                    </button>
                  )}

                  {/* CIRCULATION */}
                  {allowTransactions && (
                    <button
                      suppressHydrationWarning
                      onClick={() => router.push("/librarian/transactions")}
                      className={cn(
                        "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                        isLight
                          ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                          : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                      <div className={cn(
                        "z-10 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                        isLight
                          ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                          : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                      )}>
                        <Sparkles className={cn("h-5 w-5", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                      </div>
                      <span className={cn(
                        "z-10 text-[9px] tracking-[0.15em] transition-colors duration-300",
                        isLight
                          ? "font-extrabold text-[#0274BB]"
                          : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                      )}>
                        CIRCULATION
                      </span>
                    </button>
                  )}

                  {/* BATCH_IMPORT */}
                  {allowRecords && (
                    <button
                      suppressHydrationWarning
                      onClick={() => router.push("/librarian/records?action=import")}
                      className={cn(
                        "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                        isLight
                          ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                          : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                      <div className={cn(
                        "z-10 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                        isLight
                          ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                          : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                      )}>
                        <FileUp className={cn("h-5 w-5", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                      </div>
                      <span className={cn(
                        "z-10 text-[9px] tracking-[0.15em] transition-colors duration-300",
                        isLight
                          ? "font-extrabold text-[#0274BB]"
                          : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                      )}>
                        BATCH_IMPORT
                      </span>
                    </button>
                  )}

                  {/* REMINDERS */}
                  {allowReminders && (
                    <button
                      suppressHydrationWarning
                      onClick={() => router.push("/librarian/reminders")}
                      className={cn(
                        "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                        isLight
                          ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                          : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                      <div className={cn(
                        "z-10 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                        isLight
                          ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                          : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                      )}>
                        <BellRing className={cn("h-5 w-5", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                      </div>
                      <span className={cn(
                        "z-10 text-[9px] tracking-[0.15em] transition-colors duration-300",
                        isLight
                          ? "font-extrabold text-[#0274BB]"
                          : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                      )}>
                        REMINDERS
                      </span>
                    </button>
                  )}

                  {/* HISTORY */}
                  {allowHistory && (
                    <button
                      suppressHydrationWarning
                      onClick={() => router.push("/librarian/history")}
                      className={cn(
                        "group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1",
                        isLight
                          ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/40 hover:shadow-md"
                          : "border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                      <div className={cn(
                        "z-10 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                        isLight
                          ? "bg-blue-50/80 text-[#0274BB] group-hover:bg-[#FFF300] group-hover:text-[#0274BB]"
                          : "bg-white/5 text-slate-400 shadow-inner group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]"
                      )}>
                        <HistoryIcon className={cn("h-5 w-5", isLight ? "text-[#0274BB]" : "text-slate-400 group-hover:text-[#FCD400]")} />
                      </div>
                      <span className={cn(
                        "z-10 text-[9px] tracking-[0.15em] transition-colors duration-300",
                        isLight
                          ? "font-extrabold text-[#0274BB]"
                          : "font-bold text-slate-400 group-hover:text-[#FCD400]"
                      )}>
                        HISTORY
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.section>

          {/* Librarian Widgets */}
          {variant !== "admin" && (
            <>
              {/* Trending Books & New Arrivals Tabs */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
              >
                <div className={cn("flex items-center justify-between pb-4 mb-4", isLight ? "border-b border-[#0274BB]/15" : "border-b border-white/5")}>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setTrendingTab("trending")}
                      className={cn(
                        "pb-2 text-sm font-bold tracking-wide transition-all relative",
                        trendingTab === "trending"
                          ? isLight ? "text-[#0274BB] font-extrabold" : "text-white font-extrabold"
                          : isLight ? "text-slate-600 hover:text-[#0274BB]" : "text-slate-400 hover:text-white"
                      )}
                    >
                      Trending Books
                      {trendingTab === "trending" && <div className={cn("absolute bottom-0 left-0 right-0 h-[2px]", isLight ? "bg-[#0274BB]" : "bg-[var(--accent)]")} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendingTab("new")}
                      className={cn(
                        "pb-2 text-sm font-bold tracking-wide transition-all relative",
                        trendingTab === "new"
                          ? isLight ? "text-[#0274BB] font-extrabold" : "text-white font-extrabold"
                          : isLight ? "text-slate-600 hover:text-[#0274BB]" : "text-slate-400 hover:text-white"
                      )}
                    >
                      New Arrivals
                      {trendingTab === "new" && <div className={cn("absolute bottom-0 left-0 right-0 h-[2px]", isLight ? "bg-[#0274BB]" : "bg-[var(--accent)]")} />}
                    </button>
                  </div>
                  <span className={cn("text-[10px] font-bold tracking-widest uppercase", isLight ? "text-[#0274BB]" : "text-[var(--accent)]")}>DISCOVER</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className={cn("text-[10px] font-bold uppercase tracking-wider pb-2", isLight ? "text-slate-500 border-b border-slate-200" : "text-slate-500 border-b border-white/5")}>
                        <th className="pb-2">Book</th>
                        <th className="pb-2">Section</th>
                        <th className="pb-2">Shelf</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className={isLight ? "divide-y divide-slate-100" : "divide-y divide-white/5"}>
                        {trendingTab === "trending" ? (
                          topBooks.slice(0, 5).map((book, idx) => {
                            const rawStatus = (book.availability || book.status || "Available").toString();
                            const isAvail = rawStatus.toLowerCase() === "available";
                            const isRes = rawStatus.toLowerCase() === "reserved";
                            const shelfText = book.shelfLocation || book.shelf || book.callNumber || "—";
                            return (
                              <tr
                                key={book.id || idx}
                                onClick={() => setSelectedBook(book)}
                                className={cn("cursor-pointer transition-colors group", isLight ? "hover:bg-sky-50/50" : "hover:bg-white/[0.04]")}
                              >
                                <td className="py-3 pr-4">
                                  <p className={cn("font-semibold truncate max-w-[200px] transition-colors", isLight ? "text-[#0274BB] group-hover:text-blue-700" : "text-white group-hover:text-[#FCD400]")} title={book.title}>
                                    {book.title}
                                  </p>
                                  <p className={cn("text-[10px] truncate mt-0.5", isLight ? "text-slate-600 font-medium" : "text-slate-400")} title={book.author}>
                                    {book.author || "STI Library"}
                                  </p>
                                </td>
                                <td className={cn("py-3", isLight ? "text-slate-700 font-medium" : "text-slate-300")}>{book.department || "Circulation"}</td>
                                <td className={cn("py-3 font-mono", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>{shelfText}</td>
                                <td className="py-3 text-right">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                                      isAvail
                                        ? isLight ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                        : isRes
                                        ? isLight ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                        : isLight ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        isAvail ? isLight ? "bg-emerald-600 animate-pulse" : "bg-emerald-400 animate-pulse" : isRes ? isLight ? "bg-amber-600" : "bg-amber-400" : isLight ? "bg-rose-600" : "bg-rose-400"
                                      )}
                                    />
                                    {isAvail ? "AVAILABLE" : isRes ? "RESERVED" : "UNAVAILABLE"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          newArrivals.slice(0, 5).map((book, idx) => {
                            const rawStatus = (book.availability || book.status || "Available").toString();
                            const isAvail = rawStatus.toLowerCase() === "available";
                            const isRes = rawStatus.toLowerCase() === "reserved";
                            const shelfText = book.shelfLocation || book.shelf || book.callNumber || "—";
                            return (
                              <tr
                                key={book.id || idx}
                                onClick={() => setSelectedBook(book)}
                                className={cn("cursor-pointer transition-colors group", isLight ? "hover:bg-sky-50/50" : "hover:bg-white/[0.04]")}
                              >
                                <td className="py-3 pr-4">
                                  <p className={cn("font-semibold truncate max-w-[200px] transition-colors", isLight ? "text-[#0274BB] group-hover:text-blue-700" : "text-white group-hover:text-[#FCD400]")} title={book.title}>
                                    {book.title}
                                  </p>
                                  <p className={cn("text-[10px] truncate mt-0.5", isLight ? "text-slate-600 font-medium" : "text-slate-400")} title={book.author}>
                                    {book.author || "STI Library"}
                                  </p>
                                </td>
                                <td className={cn("py-3", isLight ? "text-slate-700 font-medium" : "text-slate-300")}>{book.department || "Circulation"}</td>
                                <td className={cn("py-3 font-mono", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>{shelfText}</td>
                                <td className="py-3 text-right">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                                      isAvail
                                        ? isLight ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                        : isRes
                                        ? isLight ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                        : isLight ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        isAvail ? isLight ? "bg-emerald-600 animate-pulse" : "bg-emerald-400 animate-pulse" : isRes ? isLight ? "bg-amber-600" : "bg-amber-400" : isLight ? "bg-rose-600" : "bg-rose-400"
                                      )}
                                    />
                                    {isAvail ? "AVAILABLE" : isRes ? "RESERVED" : "UNAVAILABLE"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}


                      {((trendingTab === "trending" && topBooks.length === 0) || 
                        (trendingTab === "new" && newArrivals.length === 0)) && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 italic">
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.section>


            </>
          )}
        </div>

        {/* Right Column (Span 1) */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Library Sections Reference Widget */}
          {variant !== "admin" && (
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className={cn("text-base font-bold tracking-wide", isLight ? "text-[#0274BB]" : "text-white")}>Shelving Reference Cheat Sheet</h3>
                  <p className={cn("text-[11px] font-light mt-1", isLight ? "text-slate-500" : "text-slate-400")}>Guide for categorizing and shelving books.</p>
                </div>
                <span className={cn("text-[10px] font-bold tracking-widest uppercase", isLight ? "text-slate-400" : "text-slate-500")}>GUIDE</span>
              </div>

              <div className="space-y-3.5">
                {[
                  { name: "Circulation", prefix: "CIR-*", rule: "7-day checkouts, standard circulation rules" },
                  { name: "Filipiniana", prefix: "FIL-*", rule: "Local literature, library use only" },
                  { name: "General Reference", prefix: "REF-*", rule: "Dictionaries & ency., library use only" },
                  { name: "Reserve", prefix: "RES-*", rule: "Textbooks, library use / overnight loans" },
                  { name: "Periodical", prefix: "PER-*", rule: "Journals & newspapers, library use only" },
                  { name: "Special Collections", prefix: "SPC-*", rule: "Rare books & archives, research use only" },
                ].map((sec) => {
                  const targetPath =
                    variant === "circulation" || user?.role?.toLowerCase().includes("circulation")
                      ? "/circulation/records"
                      : variant === "technical" || user?.role?.toLowerCase().includes("technical")
                      ? "/technical/records"
                      : "/librarian/records";

                  return (
                    <div
                      key={sec.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`${targetPath}?department=${encodeURIComponent(sec.name)}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`${targetPath}?department=${encodeURIComponent(sec.name)}`);
                        }
                      }}
                      title={`View ${sec.name} books in Add & Manage Books`}
                      className={cn(
                        "group flex flex-col gap-1 p-3 rounded-xl transition-all cursor-pointer select-none active:scale-[0.99]",
                        isLight
                          ? "border border-slate-200/80 bg-slate-50/70 hover:bg-sky-50/80 hover:border-[#0274BB]/40 hover:shadow-sm"
                          : "border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-[#FCD400]/40 hover:shadow-lg hover:shadow-black/20"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-xs font-bold transition-colors",
                            isLight ? "text-[#0274BB] group-hover:text-[#015488]" : "text-white group-hover:text-[#FCD400]"
                          )}>
                            {sec.name}
                          </span>
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all",
                            isLight ? "text-[#0274BB]" : "text-[#FCD400]"
                          )} />
                        </div>
                        <span className={cn(
                          "font-mono text-[10px] px-1.5 py-0.5 rounded font-bold transition-all",
                          isLight
                            ? "bg-[#FFF300] text-[#0274BB] border border-[#ebd000] group-hover:bg-[#ebd000]"
                            : "bg-white/5 border border-white/10 text-[var(--accent)] group-hover:border-[#FCD400]/40 group-hover:bg-[#FCD400]/10"
                        )}>
                          {sec.prefix}
                        </span>
                      </div>
                      <span className={cn("text-[10px] leading-normal", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>{sec.rule}</span>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* Trending Records */}
          {variant === "admin" && (
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
            <div className="mb-4 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isLight ? "#0274BB" : "#FCD400"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <h2 className={cn("text-lg font-black tracking-wide", isLight ? "text-[#0274BB]" : "text-white")}>TRENDING RECORDS</h2>
            </div>

            <div className="flex flex-col gap-3">
              {topBooks.slice(0, 3).map((book, idx) => (
                <div
                  key={book.id || idx}
                  onClick={() => setSelectedBook(book)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border px-5 py-4 backdrop-blur-md transition-all hover:-translate-y-1",
                    isLight
                      ? "border-slate-200/90 bg-white shadow-sm hover:border-[#0274BB]/30 hover:shadow-md"
                      : idx === 0
                      ? "border-white/10 border-r-[6px] border-r-[#FCD400] bg-[#152E47]/80 shadow-lg hover:bg-[#1E3445]"
                      : "border-white/10 border-r-[6px] border-r-transparent bg-[#152E47]/60 shadow-md hover:bg-[#1E3445]"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        "text-xs font-black transition-colors",
                        isLight
                          ? "text-[#0274BB]"
                          : idx === 0
                          ? "text-slate-500 group-hover:text-[#FCD400]"
                          : "text-slate-600 group-hover:text-slate-400"
                      )}
                    >
                      0{idx + 1}
                    </span>
                    <span className={cn("text-sm font-black", isLight ? "text-[#0274BB]" : "text-white")}>{book.title.toUpperCase()}</span>
                  </div>
                  <div
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[10px] font-bold tracking-widest transition-colors",
                      isLight
                        ? "bg-blue-50 text-[#0274BB] border border-blue-200"
                        : "bg-[#0F1D29] text-slate-400 group-hover:bg-[#FCD400]/10 group-hover:text-[#FCD400]"
                    )}
                  >
                    {book.borrowCount} REQ
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
          )}

          {/* Live Terminal Activity */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-2"
          >
            <div className="mb-4 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isLight ? "#0274BB" : "white"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h2 className={cn("text-lg font-black tracking-wide", isLight ? "text-[#0274BB]" : "text-white")}>LIVE TERMINAL ACTIVITY</h2>
            </div>

            <div className={cn(
              "min-h-[220px] rounded-2xl p-6 flex flex-col gap-4 transition-all",
              isLight
                ? "border border-slate-200 bg-white shadow-sm"
                : "border border-white/10 bg-[#0F1D29] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
            )}>
              {recentActivities.slice(0, 4).map((activity, idx) => (
                <div key={activity.id || idx} className="flex gap-4">
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                  <div>
                    <div className="mb-1 text-[10px] font-bold tracking-widest text-slate-500">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </div>
                    <div className={cn("font-mono text-[13px] font-medium leading-relaxed", isLight ? "text-slate-700" : "text-slate-300")}>
                      <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-white")}>{activity.actor}</span> {activity.message}
                    </div>
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="text-sm text-slate-500 italic">No recent activity.</div>
              )}
            </div>
          </motion.section>
        </div>
      </div>

      <BookDetailModal open={Boolean(selectedBook)} book={selectedBook} onClose={() => setSelectedBook(null)} />

      {/* ── Add Book Modal ─────────────────────────────────── */}
      {showAddBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddBookModal(false)} />
          <div className={cn("relative z-10 w-full max-w-lg rounded-2xl shadow-2xl", isLight ? "border border-slate-200 bg-white shadow-xl" : "border border-white/12 bg-[#0F1D29] shadow-black/60")}>
            {/* Header */}
            <div className={cn("flex items-center justify-between px-6 py-4", isLight ? "border-b border-slate-100" : "border-b border-white/8")}>
              <div className="flex items-center gap-3">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", isLight ? "bg-[#FFF300] text-[#0274BB]" : "bg-[#FCD400]/15 text-[#FCD400]")}>
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <p className={cn("text-[10px] font-bold tracking-widest uppercase", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>Catalog</p>
                  <h2 className={cn("text-base font-black", isLight ? "text-[#0274BB]" : "text-white")}>Add New Book</h2>
                </div>
              </div>
              <button
                suppressHydrationWarning
                onClick={() => setShowAddBookModal(false)}
                className={cn("rounded-lg p-1.5 transition", isLight ? "text-slate-400 hover:bg-slate-100 hover:text-[#0274BB]" : "text-slate-400 hover:bg-white/8 hover:text-white")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleBookSubmit} className="px-6 py-5 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Title</span>
                <input
                  suppressHydrationWarning
                  required
                  className="modal-input"
                  value={bookForm.title}
                  onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Author</span>
                  <input
                    suppressHydrationWarning
                    required
                    className="modal-input"
                    value={bookForm.author}
                    onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">ISBN</span>
                  <input
                    suppressHydrationWarning
                    className="modal-input"
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))}
                  />
                </label>
              </div>

              {/* Row 3: Department Loc. & Genre */}
              <div className="grid grid-cols-2 gap-4">
                <CustomSelect
                  label="Department Loc."
                  value={bookForm.department}
                  options={["Circulation", "General Reference", "Filipiniana", "Reserve", "Periodical", "Special Collections"]}
                  onChange={(val) => setBookForm((f) => ({ ...f, department: val as Department }))}
                />
                <CustomSelect
                  label="Genre"
                  subLabel="Alphabetical (A-Z)"
                  value={bookForm.genres}
                  options={sortedFigmaGenres}
                  onChange={(val) => setBookForm((f) => ({ ...f, genres: val }))}
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
                    value={bookForm.publicationDate}
                    onChange={(e) => setBookForm((f) => ({ ...f, publicationDate: e.target.value }))}
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
                    className={cn("modal-input font-mono", isLight ? "border-blue-200 bg-blue-50/50 text-[#0274BB] focus:border-[#0274BB]" : "bg-white/[0.04] border-[#FCD400]/40 text-[#FCD400] focus:border-[#FCD400]")}
                    value={bookForm.shelfLocation}
                    onChange={(e) => setBookForm((f) => ({ ...f, shelfLocation: e.target.value }))}
                    placeholder="Auto-generated e.g. QA 76.73 .P98 2026"
                  />
                </label>
              </div>

              {/* Row 5: Volume & Edition */}
              <div className="grid grid-cols-2 gap-4">
                <CustomSelect
                  label="Volume"
                  value={bookForm.volume}
                  options={VOLUME_OPTIONS}
                  onChange={(val) => setBookForm((f) => ({ ...f, volume: val }))}
                />
                <CustomSelect
                  label="Edition"
                  value={bookForm.edition}
                  options={EDITION_OPTIONS}
                  onChange={(val) => setBookForm((f) => ({ ...f, edition: val }))}
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
                    value={bookForm.copies}
                    onChange={(e) => setBookForm((f) => ({ ...f, copies: parseInt(e.target.value) || 1 }))}
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
                    className={cn("modal-input font-mono", isLight ? "border-blue-200 bg-blue-50/50 text-[#0274BB] focus:border-[#0274BB]" : "bg-white/[0.04] border-[#FCD400]/40 text-[#FCD400] focus:border-[#FCD400]")}
                    value={bookForm.accessionNumber}
                    onChange={(e) => setBookForm((f) => ({ ...f, accessionNumber: e.target.value }))}
                    placeholder="Auto e.g. ACC-2026-00421"
                  />
                </label>
              </div>

              {/* Row 7: Summary */}
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Summary</span>
                <textarea
                  suppressHydrationWarning
                  rows={3}
                  className="modal-input resize-none"
                  value={bookForm.summary}
                  onChange={(e) => setBookForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Enter brief synopsis or summary..."
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() => setShowAddBookModal(false)}
                  className={cn("rounded-xl border px-5 py-2.5 text-sm font-semibold transition cursor-pointer", isLight ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}
                >
                  Cancel
                </button>
                <button
                  suppressHydrationWarning
                  type="submit"
                  disabled={submittingBook}
                  className={cn("rounded-xl px-6 py-2.5 text-sm font-bold shadow-lg transition cursor-pointer", isLight ? "bg-[#FFF300] text-[#0274BB] border border-[#ebd000] hover:bg-[#ebd000]" : "bg-[#FCD400] text-[#0b1c2c] shadow-[#FCD400]/20 hover:brightness-110 disabled:opacity-60")}
                >
                  {submittingBook ? "Saving…" : "Add Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Compose Announcement Modal ────────────────────── */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAnnouncementModal(false)} />
          <div className={cn("relative z-10 w-full max-w-lg rounded-2xl shadow-2xl", isLight ? "border border-slate-200 bg-white shadow-xl" : "border border-white/12 bg-[#0F1D29] shadow-black/60")}>
            {/* Header */}
            <div className={cn("flex items-center justify-between px-6 py-4", isLight ? "border-b border-slate-100" : "border-b border-white/8")}>
              <div className="flex items-center gap-3">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", isLight ? "bg-[#FFF300] text-[#0274BB]" : "bg-[#6EE7B7]/15 text-[#6EE7B7]")}>
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <p className={cn("text-[10px] font-bold tracking-widest uppercase", isLight ? "text-[#0274BB]" : "text-[#6EE7B7]")}>Publish Notice</p>
                  <h2 className={cn("text-base font-black", isLight ? "text-[#0274BB]" : "text-white")}>Compose a new announcement</h2>
                </div>
              </div>
              <button
                suppressHydrationWarning
                onClick={() => setShowAnnouncementModal(false)}
                className={cn("rounded-lg p-1.5 transition", isLight ? "text-slate-400 hover:bg-slate-100 hover:text-[#0274BB]" : "text-slate-400 hover:bg-white/8 hover:text-white")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAnnouncementSubmit} className="px-6 py-5 grid gap-4">
              <p className={cn("text-xs", isLight ? "text-slate-600" : "text-slate-400")}>
                Changes are stored in the shared backend and logged under {user?.name ?? "Yana Brich R. Palmares"} session.
              </p>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Announcement Title</span>
                <input
                  suppressHydrationWarning
                  required
                  placeholder="Enter title..."
                  className="modal-input"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Announcement Body</span>
                <textarea
                  suppressHydrationWarning
                  required
                  rows={4}
                  placeholder="Enter message details..."
                  className="modal-input resize-none"
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm((f) => ({ ...f, content: e.target.value }))}
                />
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Audience</span>
                  <select
                    suppressHydrationWarning
                    className="modal-input"
                    value={announcementForm.audience}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, audience: e.target.value as any }))}
                  >
                    {["All Users", "Students", "Staff"].map((a) => (
                      <option key={a} value={a} className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Priority</span>
                  <select
                    suppressHydrationWarning
                    className="modal-input"
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, priority: e.target.value as any }))}
                  >
                    {["Normal", "Important", "Urgent"].map((p) => (
                      <option key={p} value={p} className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Duration</span>
                  <select
                    suppressHydrationWarning
                    className="modal-input"
                    value={announcementForm.durationDays || 0}
                    onChange={(e) =>
                      setAnnouncementForm((f: any) => ({ ...f, durationDays: parseInt(e.target.value, 10) || 0 }))
                    }
                  >
                    <option value={0} className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                      Permanent
                    </option>
                    <option value={1} className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                      1 Day
                    </option>
                    <option value={2} className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                      2 Days
                    </option>
                    <option value={3} className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                      3 Days
                    </option>
                    <option value={7} className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                      7 Days
                    </option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Visibility</span>
                  <select
                    suppressHydrationWarning
                    className="modal-input"
                    value={announcementForm.published ? "Published" : "Draft"}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({ ...f, published: e.target.value === "Published" }))
                    }
                  >
                    <option value="Published" className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                      Published
                    </option>
                    <option value="Draft" className={isLight ? "bg-white text-[#0274BB]" : "bg-[#0F1D29] text-white"}>
                      Draft
                    </option>
                  </select>
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  suppressHydrationWarning
                  type="submit"
                  disabled={submittingAnnouncement}
                  className={cn("rounded-xl px-6 py-2.5 text-sm font-bold shadow-lg transition", isLight ? "bg-[#FFF300] text-[#0274BB] border border-[#ebd000] hover:bg-[#ebd000]" : "bg-[#FCD400] text-[#0b1c2c] shadow-[#FCD400]/20 hover:brightness-110 disabled:opacity-60")}
                >
                  {submittingAnnouncement ? "Creating…" : "+ Create Notice"}
                </button>
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() => setAnnouncementForm(emptyAnnouncementForm)}
                  className={cn("rounded-xl border px-5 py-2.5 text-sm font-semibold transition", isLight ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}
                >
                  Reset
                </button>
              </div>

              {/* Stats capsules row */}
              <div className={cn("mt-4 grid gap-3 grid-cols-3 pt-4", isLight ? "border-t border-slate-100" : "border-t border-white/8")}>
                {[
                  { label: "Published", value: annStats.published.toString(), color: "#10B981" },
                  { label: "Drafts", value: annStats.drafts.toString(), color: "#94A3B8" },
                  { label: "Urgent", value: annStats.urgent.toString(), color: "#EF4444" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-xl px-4 py-3 backdrop-blur",
                      isLight
                        ? "border border-slate-200/80 bg-slate-50"
                        : "border border-white/8 bg-[#152E47]/60"
                    )}
                    style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
                  >
                    <p className={cn("text-[9px] font-bold tracking-[0.18em] uppercase", isLight ? "text-slate-500" : "text-slate-400")}>{item.label}</p>
                    <p className={cn("mt-0.5 text-base font-black", isLight ? "text-[#0274BB]" : "text-white")}>{item.value}</p>
                  </div>
                ))}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Active Announcement Detail & Quick Actions Modal ── */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setSelectedNotice(null)}
          />
          <div
            className={cn(
              "relative z-10 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
              isLight ? "border border-slate-200 bg-white" : "border border-white/12 bg-[#0F1D29]"
            )}
          >
            {/* Modal Header */}
            <div
              className={cn(
                "flex items-center justify-between px-6 py-4 border-b",
                isLight ? "border-slate-100 bg-slate-50/70" : "border-white/8 bg-white/5"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    selectedNotice.priority === "Urgent"
                      ? "bg-red-500/20 text-red-400"
                      : selectedNotice.priority === "Important"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-[#0274BB]/20 text-[#0274BB] dark:bg-[#FCD400]/20 dark:text-[#FCD400]"
                  )}
                >
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                        selectedNotice.priority === "Urgent"
                          ? "bg-red-500/15 text-red-500 border border-red-500/30"
                          : selectedNotice.priority === "Important"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
                          : "bg-blue-500/15 text-blue-600 dark:text-sky-300 border border-blue-500/30"
                      )}
                    >
                      {selectedNotice.priority}
                    </span>
                    <span className={cn("text-xs font-semibold", isLight ? "text-slate-600" : "text-slate-300")}>
                      To: {selectedNotice.audience}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedNotice(null)}
                className={cn(
                  "rounded-lg p-1.5 transition",
                  isLight ? "text-slate-400 hover:bg-slate-100" : "text-slate-400 hover:bg-white/10 text-white"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <h3 className={cn("text-lg font-black tracking-tight", isLight ? "text-[#0274BB]" : "text-white")}>
                  {selectedNotice.title}
                </h3>
                <p className={cn("mt-2 text-sm leading-relaxed whitespace-pre-line", isLight ? "text-slate-700" : "text-slate-200")}>
                  {selectedNotice.content}
                </p>
              </div>

              {/* Metadata Box */}
              <div
                className={cn(
                  "rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs",
                  isLight ? "bg-slate-100/80 text-slate-600" : "bg-white/5 text-slate-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">Author:</span>
                  <span>{selectedNotice.author}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{selectedNotice.durationDays ? `${selectedNotice.durationDays} Days Duration` : "Permanent Notice"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      selectedNotice.published
                        ? (isLight ? "bg-emerald-100 text-emerald-800" : "bg-emerald-500/20 text-emerald-300")
                        : (isLight ? "bg-slate-200 text-slate-700" : "bg-white/10 text-slate-400")
                    )}
                  >
                    {selectedNotice.published ? "Active Broadcast" : "Draft"}
                  </span>
                </div>
              </div>

              {noticeFeedback && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{noticeFeedback}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div
              className={cn(
                "px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-t",
                isLight ? "border-slate-100 bg-slate-50" : "border-white/8 bg-[#0B1724]"
              )}
            >
              {variant === "admin" || (user?.role && ["Admin", "Super Admin", "SUPER_ADMIN", "ADMIN"].includes(user.role)) ? (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          const nextStatus = !selectedNotice.published;
                          const res = await fetch(`/api/announcements/${selectedNotice.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ published: nextStatus }),
                          });
                          if (res.ok) {
                            setSelectedNotice((prev: any) => (prev ? { ...prev, published: nextStatus } : null));
                            await loadAnnouncementStats();
                            setNoticeFeedback(nextStatus ? "Announcement published to campus!" : "Announcement moved to drafts.");
                            setTimeout(() => setNoticeFeedback(null), 3000);
                          }
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className={cn(
                        "text-xs font-bold px-3 py-2 rounded-xl border transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50",
                        selectedNotice.published
                          ? (isLight ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100" : "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25")
                          : (isLight ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25")
                      )}
                    >
                      {selectedNotice.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{selectedNotice.published ? "Unpublish Notice" : "Publish Live"}</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to permanently delete "${selectedNotice.title}"?`)) return;
                        setActionLoading(true);
                        try {
                          const res = await fetch(`/api/announcements/${selectedNotice.id}`, {
                            method: "DELETE",
                          });
                          if (res.ok) {
                            setSelectedNotice(null);
                            await loadAnnouncementStats();
                          }
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className={cn(
                        "text-xs font-bold px-3 py-2 rounded-xl border transition flex items-center gap-1.5 cursor-pointer text-red-500 hover:bg-red-500/10 border-red-500/20 disabled:opacity-50"
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNotice(null);
                        router.push("/admin/announcements");
                      }}
                      className={cn(
                        "text-xs font-bold px-3.5 py-2 rounded-xl border transition flex items-center gap-1.5 cursor-pointer",
                        isLight
                          ? "bg-[#0274BB] text-white border-[#0274BB] hover:bg-[#025a92]"
                          : "bg-[#FCD400] text-[#0B1A2C] border-[#FCD400] hover:bg-[#e0bc00]"
                      )}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open in Board</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedNotice(null)}
                      className={cn(
                        "text-xs font-medium px-3 py-2 rounded-xl border transition",
                        isLight
                          ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                      )}
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs text-slate-400 italic">Official Campus Notice • View Only</span>
                  <button
                    type="button"
                    onClick={() => setSelectedNotice(null)}
                    className={cn(
                      "text-xs font-bold px-4 py-2 rounded-xl border transition cursor-pointer",
                      isLight
                        ? "bg-[#0274BB] text-white border-[#0274BB] hover:bg-[#025a92]"
                        : "bg-[#FCD400] text-[#0B1A2C] border-[#FCD400] hover:bg-[#e0bc00]"
                    )}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
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
      `}</style>
    </>
  );
}

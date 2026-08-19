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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, LabelList } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import type { SearchResult, Department, BookRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";
import { transformDepartmentData, type DepartmentData } from "@/lib/department-transformer";

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
  publicationDate: "2025-01-01",
  department: "Circulation" as Department,
  shelfLocation: "",
  summary: "",
  availability: "Available" as BookRecord["availability"],
  genres: "",
  copies: 1,
};

const emptyAnnouncementForm = {
  title: "",
  content: "",
  audience: "All Users" as const,
  priority: "Normal" as const,
  published: true,
};

interface DashboardProps {
  variant?: "librarian" | "admin" | "technical" | "circulation";
}

export function DashboardFigma({ variant = "librarian" }: DashboardProps) {
  const router = useRouter();
  const { user, logout } = useSession();

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
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const PAGE_SIZE = 6;

  // Pop-up modal states
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncementForm);
  const [submittingBook, setSubmittingBook] = useState(false);
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);

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
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        console.warn("Failed to fetch dashboard data, status:", res.status);
        return;
      }
      const data = await res.json();
      if (data.summary) {
        setSummary({
          totalBooks: data.summary.totalBooks || 0,
          totalUsers: data.summary.totalUsers || 0,
          pendingRequests: data.summary.pendingRequests || 0,
          activeBorrowedBooks: data.summary.activeBorrowedBooks || 0,
        });
      }
      if (data.departmentUsage) setDepartmentUsage(data.departmentUsage);
      if (data.topBooks) setTopBooks(data.topBooks);
      if (data.recentActivities) setRecentActivities(data.recentActivities);
      if (data.newUsers) setNewUsers(data.newUsers);
      if (data.latestTransactions) setLatestTransactions(data.latestTransactions);
      if (data.systemHealth) setSystemHealth(data.systemHealth);
    } catch (err) {
      console.warn("Error fetching dashboard:", err);
    }
  }, []);

  const [newArrivals, setNewArrivals] = useState<any[]>([]);
  const [trendingTab, setTrendingTab] = useState<"trending" | "new">("trending");


  const fetchNewArrivals = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/books?page=1&pageSize=5");
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
    if (variant === "librarian") {
      void fetchNewArrivals();
    }
  }, [fetchDashboardData, fetchNewArrivals, variant]);

  function runSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!searchQuery.trim()) {
      return;
    }
    const basePath =
      variant === "admin"
        ? "/admin"
        : variant === "technical"
        ? "/technical"
        : variant === "circulation"
        ? "/circulation"
        : "/librarian";
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
      title: variant === "librarian" ? "BOOKHIVE LIBRARIAN" : "SYSTEM ADMIN",
      count: "3 pending requests",
    },
    {
      icon: "📊",
      title: variant === "librarian" ? "INVENTORY REPORTS" : "ANALYTICS DASHBOARD",
      count: "12 new insights",
    },
  ];

  const visibleResults = results ? results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : null;

  return (
    <>
      {/* Header - TopAppBar removed as it is now provided by AppShell */}

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="rounded-[24px] bg-[#14293E] p-8 md:p-10 mb-8 shadow-xl panel-hero"
      >
        {/* Section Label */}
        <div className="flex items-center gap-2 text-[#FFD600] mb-4">
          <Sparkles className="h-4 w-4 fill-current" />
          <span className="text-xs font-bold tracking-widest uppercase">ASK BOOKHIVE</span>
        </div>

        {/* Main Heading */}
        <h1 className="mb-8 text-[32px] font-bold tracking-tight text-white md:text-[36px]">
          Find resources across the entire STI WNU digital ecosystem.
        </h1>

        {/* AI Prompt Search Box */}
        <form onSubmit={runSearch}>
          <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-[#0B1724] px-4 py-3 shadow-inner mb-2">
            <SearchIcon className="h-5 w-5 text-slate-400 ml-2" />
            <input
              type="text"
              suppressHydrationWarning
              placeholder="Search by Title, Author, ISBN, or ask a question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-white placeholder-slate-500 outline-none"
            />

            <div className="flex items-center gap-2">
              <label
                className="cursor-pointer p-2 text-slate-400 hover:text-white transition rounded-full hover:bg-white/5"
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
                className="rounded-full bg-[#FFD600] px-6 py-2.5 text-sm font-bold tracking-wide text-[#0A1624] transition hover:bg-[#FCD400]/90 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
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
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/65"
              >
                <span className="max-w-[200px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="rounded-full p-0.5 hover:bg-white/15 text-white/40 hover:text-white transition-all flex items-center justify-center cursor-pointer"
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
            className="mb-8 flex items-center justify-center gap-3 rounded-[24px] border border-red-500/20 bg-[#14293E] px-4 py-8 text-sm text-red-400 shadow-xl"
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
                    className="flex flex-col justify-between w-full text-left p-6 bg-gradient-to-br from-[#1E3A5F]/35 to-[#0B1A2C]/65 backdrop-blur-md rounded-[24px] border border-white/[0.06] hover:border-white/10 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-300 group"
                  >
                    <div className="space-y-4">
                      {/* Top bar with category & relevance */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center rounded-full bg-white/5 border border-white/5 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.15em] text-[#FFD600] uppercase">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFD600] mr-1.5 animate-pulse"></span>
                          {result.department}
                        </span>
                        <span className={relevanceBadgeClass}>{relevance}% MATCH</span>
                      </div>

                      {/* Title & Metadata */}
                      <div>
                        <h3 className="text-[17px] font-bold tracking-tight text-white group-hover:text-[#FFD600] transition-colors line-clamp-2 leading-snug">
                          {result.title}
                        </h3>
                        <div className="mt-2.5 space-y-1.5">
                          <p className="flex items-center gap-1.5 text-xs text-white/70">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            By <span className="font-semibold text-white/90">{result.author}</span>
                          </p>
                          <div className="flex items-center flex-wrap gap-2 text-[11px] text-white/40">
                            <span className="font-mono bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                              ISBN: {result.isbn}
                            </span>
                            {result.language && (
                              <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider text-[9px]">
                                🌐 {result.language}
                              </span>
                            )}
                            {typeof result.rating === "number" && result.rating > 0 && (
                              <span className="inline-flex items-center gap-0.5 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-[#FFD600] font-semibold">
                                ⭐ {result.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Book Summary */}
                      <p className="text-xs text-white/60 leading-relaxed line-clamp-4 border-t border-white/[0.04] pt-3.5 italic">
                        "{result.summary}"
                      </p>
                    </div>

                    {/* Matched explanation details */}
                    {result.matchedBy && result.matchedBy.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1 pt-3.5 border-t border-white/[0.04]">
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
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-[#0A1624]"
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
                            ? "bg-[#FFD600] text-[#0A1624]"
                            : "border border-white/10 bg-white/5 text-white hover:bg-white/10",
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
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-[#0A1624]"
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
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#FCD400] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">TOTAL_BOOKS</div>
          <div className="text-[32px] font-black tracking-tight text-white">{summary.totalBooks.toLocaleString()}</div>
        </motion.div>

        {/* Metric 2 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#38BDF8] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">ACTIVE_USERS</div>
          <div className="text-[32px] font-black tracking-tight text-white">{summary.totalUsers.toLocaleString()}</div>
        </motion.div>

        {/* Metric 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#F97316] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">PENDING_REQ</div>
          <div className="text-[32px] font-black tracking-tight text-white">{summary.pendingRequests.toLocaleString()}</div>
        </motion.div>

        {/* Metric 4 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#EF4444] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">ACTIVE_BORROWS</div>
          <div className="text-[32px] font-black tracking-tight text-[#EF4444]">
            {summary.activeBorrowedBooks.toLocaleString()}
          </div>
        </motion.div>

        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-[#041E30] p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-[#041E30]/20"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="text-xs font-bold tracking-widest text-[#FCD400]">SYSTEM_HEALTH</div>
            <div
              className={`flex items-center gap-2 text-[10px] font-bold ${
                systemHealth.status === "NOMINAL"
                  ? "text-[#10B981]"
                  : systemHealth.status === "DEGRADED"
                  ? "text-[#F59E0B]"
                  : "text-[#EF4444]"
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
            <div className="mb-1 flex justify-between text-[10px] font-bold text-[#64748B]">
              <span>LAST INDEXING</span>
              <span>STORAGE USED</span>
            </div>

            <div className="mb-4 flex justify-between text-xs font-bold text-white">
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

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1E3445]">
              <div
                className="h-full rounded-full bg-[#FCD400] transition-all duration-1000"
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
              <div className="mb-6">
                <h2 className="text-[22px] font-bold text-white tracking-wide">Most Active Departments</h2>
                <p className="mt-1 text-[15px] font-light text-slate-300">Student enrollment count by department.</p>
              </div>

              <div className="h-[280px] w-full flex flex-row items-center justify-between gap-4">
                <div className="h-full flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formattedDepartments}
                        dataKey="count"
                        nameKey="code"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={3}
                        stroke="#0F1D29"
                        strokeWidth={2}
                        isAnimationActive={true}
                      >
                        {formattedDepartments.map((entry: DepartmentData) => (
                          <Cell key={`cell-${entry.code}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any, props: any) => [
                          `${value} Students`,
                          `${props?.payload?.code ?? name} (${props?.payload?.mascot ?? ""})`,
                        ]}
                        contentStyle={{
                          backgroundColor: "#0F1D29",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#fff",
                          borderRadius: "12px",
                          fontSize: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                        }}
                        itemStyle={{ color: "#fff", fontWeight: "bold" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend list beside the chart matching Picture 2 layout */}
                <div className="w-[195px] flex flex-col gap-2.5 overflow-y-auto max-h-full pr-1 border-l border-white/10 pl-4 justify-center self-center">
                  {formattedDepartments.map((item: DepartmentData) => (
                    <div key={item.code} className="flex items-start gap-2.5">
                      <div
                        className="h-3 w-3 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white leading-none truncate">
                          {item.code}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal mt-1 truncate">
                          {item.mascot} ({item.count})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* Most Active Books */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
            >
              <div className="mb-8">
                <h2 className="text-[22px] font-bold text-white tracking-wide">Most Active Books</h2>
                <p className="mt-2 text-[15px] font-light text-slate-300">Top performers by borrow volume.</p>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={topBooks.length > 0 ? topBooks : [{ title: "No Data", borrowCount: 0 }]}
                    margin={{ top: 25, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis
                      dataKey="title"
                      stroke="var(--muted)"
                      tick={{ fill: "#94A3B8", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) =>
                        value.length > 12 ? value.substring(0, 12) + "..." : value
                      }
                    />
                    <YAxis stroke="var(--muted)" tick={{ fill: "#94A3B8", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F1D29",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar dataKey="borrowCount" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32}>
                      <LabelList 
                        dataKey="borrowCount" 
                        position="top" 
                        fill="var(--foreground)" 
                        fontSize={10} 
                        fontWeight="bold" 
                        offset={8}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          </div>

          {/* Command Shortcuts */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <h2 className="mb-4 text-[10px] font-bold tracking-[0.15em] text-slate-400">COMMAND_SHORTCUTS</h2>
            <div className="grid grid-cols-4 gap-4">
              <button
                suppressHydrationWarning
                onClick={() => setShowAddBookModal(true)}
                className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    <line x1="12" y1="8" x2="12" y2="14" />
                    <line x1="9" y1="11" x2="15" y2="11" />
                  </svg>
                </div>
                <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">
                  ADD_BOOK
                </span>
              </button>

              {variant === "admin" ? (
                <button
                  suppressHydrationWarning
                  onClick={() => router.push("/admin/management?tab=users")}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                    <Users className="h-6 w-6 text-slate-400 group-hover:text-[#FCD400]" />
                  </div>
                  <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">
                    MANAGE_USERS
                  </span>
                </button>
              ) : (
                <button
                  suppressHydrationWarning
                  onClick={() => router.push("/librarian/records")}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                    <ClipboardList className="h-6 w-6 text-slate-400 group-hover:text-[#FCD400]" />
                  </div>
                  <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">
                    VIEW_RECORDS
                  </span>
                </button>
              )}

              {variant === "technical" ? (
                <button
                  suppressHydrationWarning
                  onClick={() => router.push("/technical/records?action=import")}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                    <FileUp className="h-6 w-6 text-slate-400 group-hover:text-[#FCD400]" />
                  </div>
                  <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">
                    BATCH_IMPORT
                  </span>
                </button>
              ) : (
                <button
                  suppressHydrationWarning
                  onClick={() => router.push(variant === "admin" ? "/admin/transactions" : "/librarian/transactions")}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                    <Sparkles className="h-6 w-6 text-slate-400 group-hover:text-[#FCD400]" />
                  </div>
                  <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">
                    CIRCULATION
                  </span>
                </button>
              )}

              {variant === "admin" ? (
                <button
                  suppressHydrationWarning
                  onClick={() => setShowAnnouncementModal(true)}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m3 11 18-5v12L3 14v-3z" />
                      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                    </svg>
                  </div>
                  <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">
                    ANNOUNCEMENTS
                  </span>
                </button>
              ) : variant === "technical" ? (
                <button
                  suppressHydrationWarning
                  onClick={() => router.push("/technical/records")}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                    <Tag className="h-6 w-6 text-slate-400 group-hover:text-[#FCD400]" />
                  </div>
                  <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">
                    CATALOG_METADATA
                  </span>
                </button>
              ) : (
                <button
                  suppressHydrationWarning
                  onClick={() => router.push("/librarian/history")}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                    <HistoryIcon className="h-6 w-6 text-slate-400 group-hover:text-[#FCD400]" />
                  </div>
                  <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">
                    HISTORY
                  </span>
                </button>
              )}
            </div>
          </motion.section>

          {/* Librarian Widgets */}
          {variant === "librarian" && (
            <>
              {/* Trending Books & New Arrivals Tabs */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setTrendingTab("trending")}
                      className={cn(
                        "pb-2 text-sm font-bold tracking-wide transition-all relative",
                        trendingTab === "trending" ? "text-white" : "text-slate-400 hover:text-white"
                      )}
                    >
                      Trending Books
                      {trendingTab === "trending" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendingTab("new")}
                      className={cn(
                        "pb-2 text-sm font-bold tracking-wide transition-all relative",
                        trendingTab === "new" ? "text-white" : "text-slate-400 hover:text-white"
                      )}
                    >
                      New Arrivals
                      {trendingTab === "new" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />}
                    </button>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--accent)] tracking-widest uppercase">DISCOVER</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-white/5 pb-2">
                        <th className="pb-2">Book</th>
                        <th className="pb-2">Section</th>
                        <th className="pb-2">Shelf</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {trendingTab === "trending" ? (
                        topBooks.slice(0, 5).map((book, idx) => (
                          <tr key={book.id || idx} className="hover:bg-white/[0.01]">
                            <td className="py-3 pr-4">
                              <p className="font-semibold text-white truncate max-w-[200px]" title={book.title}>{book.title}</p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{book.author}</p>
                            </td>
                            <td className="py-3 text-slate-300">{book.department}</td>
                            <td className="py-3 font-mono text-slate-400">{book.shelfLocation}</td>
                            <td className="py-3 text-right">
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                                book.availability === "Available" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                book.availability === "Reserved" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {book.availability}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        newArrivals.slice(0, 5).map((book, idx) => (
                          <tr key={book.id || idx} className="hover:bg-white/[0.01]">
                            <td className="py-3 pr-4">
                              <p className="font-semibold text-white truncate max-w-[200px]" title={book.title}>{book.title}</p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">{book.author}</p>
                            </td>
                            <td className="py-3 text-slate-300">{book.department}</td>
                            <td className="py-3 font-mono text-slate-400">{book.shelfLocation}</td>
                            <td className="py-3 text-right">
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                                book.availability === "Available" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                book.availability === "Reserved" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                "bg-red-500/10 text-red-400 border-red-500/20"
                              )}>
                                {book.availability}
                              </span>
                            </td>
                          </tr>
                        ))
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
          {variant === "librarian" && (
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">Shelving Reference Cheat Sheet</h3>
                  <p className="text-[11px] font-light text-slate-400 mt-1">Guide for categorizing and shelving books.</p>
                </div>
                <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">GUIDE</span>
              </div>

              <div className="space-y-3.5">
                {[
                  { name: "Circulation", prefix: "CIR-*", rule: "7-day checkouts, standard circulation rules" },
                  { name: "Filipiniana", prefix: "FIL-*", rule: "Local literature, library use only" },
                  { name: "General Reference", prefix: "REF-*", rule: "Dictionaries & ency., library use only" },
                  { name: "Reserve", prefix: "RES-*", rule: "Textbooks, library use / overnight loans" },
                  { name: "Periodical", prefix: "PER-*", rule: "Journals & newspapers, library use only" },
                  { name: "Special Collections", prefix: "SPC-*", rule: "Rare books & archives, research use only" },
                ].map((sec) => (
                  <div key={sec.name} className="flex flex-col gap-1 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{sec.name}</span>
                      <span className="font-mono text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[var(--accent)]">{sec.prefix}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-normal">{sec.rule}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Trending Records */}
          {variant !== "librarian" && (
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
                stroke="#FCD400"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <h2 className="text-lg font-black tracking-wide text-white">TRENDING RECORDS</h2>
            </div>

            <div className="flex flex-col gap-3">
              {topBooks.slice(0, 3).map((book, idx) => (
                <div
                  key={book.id || idx}
                  className={`group flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-white/10 ${
                    idx === 0
                      ? "border-r-[6px] border-r-[#FCD400] bg-[#152E47]/80 shadow-lg"
                      : "border-r-[6px] border-r-transparent bg-[#152E47]/60 shadow-md"
                  } px-5 py-4 backdrop-blur-md transition-all hover:-translate-y-1 hover:bg-[#1E3445] hover:shadow-[0_10px_20px_rgba(0,0,0,0.3)]`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs font-black ${
                        idx === 0
                          ? "text-slate-500 transition-colors group-hover:text-[#FCD400]"
                          : "text-slate-600 transition-colors group-hover:text-slate-400"
                      }`}
                    >
                      0{idx + 1}
                    </span>
                    <span className="text-sm font-black text-white">{book.title.toUpperCase()}</span>
                  </div>
                  <div
                    className={`rounded-full bg-[#0F1D29] px-3 py-1.5 text-[10px] font-bold tracking-widest ${
                      idx === 0
                        ? "text-slate-400 transition-colors group-hover:bg-[#FCD400]/10 group-hover:text-[#FCD400]"
                        : "text-slate-400 transition-colors group-hover:bg-slate-700 group-hover:text-white"
                    }`}
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
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h2 className="text-lg font-black tracking-wide text-white">LIVE TERMINAL ACTIVITY</h2>
            </div>

            <div className="min-h-[220px] rounded-2xl border border-white/10 bg-[#0F1D29] p-6 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-4">
              {recentActivities.slice(0, 4).map((activity, idx) => (
                <div key={activity.id || idx} className="flex gap-4">
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                  <div>
                    <div className="mb-1 text-[10px] font-bold tracking-widest text-slate-500">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="font-mono text-[13px] font-medium leading-relaxed text-slate-300">
                      <span className="font-bold text-white">{activity.actor}</span> {activity.message}
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
                onClick={() => setShowAddBookModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition"
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

              <div className="grid grid-cols-3 gap-4">
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
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Department</span>
                  <select
                    suppressHydrationWarning
                    className="modal-input"
                    value={bookForm.department}
                    onChange={(e) => setBookForm((f) => ({ ...f, department: e.target.value as Department }))}
                  >
                    {["Circulation", "General Reference", "Filipiniana", "Reserve", "Periodical", "Special Collections"].map((d) => (
                      <option key={d} value={d} className="bg-[#0F1D29]">
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Status</span>
                  <select
                    suppressHydrationWarning
                    className="modal-input"
                    value={bookForm.availability}
                    onChange={(e) => setBookForm((f) => ({ ...f, availability: e.target.value as BookRecord["availability"] }))}
                  >
                    {["Available", "Limited", "Reserved"].map((s) => (
                      <option key={s} value={s} className="bg-[#0F1D29]">
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Shelf Location</span>
                <input
                  suppressHydrationWarning
                  className="modal-input"
                  value={bookForm.shelfLocation}
                  onChange={(e) => setBookForm((f) => ({ ...f, shelfLocation: e.target.value }))}
                />
              </label>

              <div className="grid grid-cols-3 gap-4">
                <label className="grid gap-1.5 col-span-2">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Genre</span>
                  <input
                    suppressHydrationWarning
                    className="modal-input"
                    value={bookForm.genres}
                    onChange={(e) => setBookForm((f) => ({ ...f, genres: e.target.value }))}
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
                    value={bookForm.copies}
                    onChange={(e) => setBookForm((f) => ({ ...f, copies: parseInt(e.target.value) || 1 }))}
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Summary</span>
                <textarea
                  suppressHydrationWarning
                  rows={3}
                  className="modal-input resize-none"
                  value={bookForm.summary}
                  onChange={(e) => setBookForm((f) => ({ ...f, summary: e.target.value }))}
                />
              </label>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() => setShowAddBookModal(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  suppressHydrationWarning
                  type="submit"
                  disabled={submittingBook}
                  className="rounded-xl bg-[#FCD400] px-6 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 hover:brightness-110 disabled:opacity-60 transition"
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
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/12 bg-[#0F1D29] shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6EE7B7]/15">
                  <Megaphone className="h-4 w-4 text-[#6EE7B7]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#6EE7B7] uppercase">Publish Notice</p>
                  <h2 className="text-base font-black text-white">Compose a new announcement</h2>
                </div>
              </div>
              <button
                suppressHydrationWarning
                onClick={() => setShowAnnouncementModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAnnouncementSubmit} className="px-6 py-5 grid gap-4">
              <p className="text-xs text-slate-400">
                Changes are stored in the shared backend and logged under {user?.name ?? "Joseph Tan"} session.
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

              <div className="grid grid-cols-3 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Audience</span>
                  <select
                    suppressHydrationWarning
                    className="modal-input"
                    value={announcementForm.audience}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, audience: e.target.value as any }))}
                  >
                    {["All Users", "Students", "Staff"].map((a) => (
                      <option key={a} value={a} className="bg-[#0F1D29]">
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
                      <option key={p} value={p} className="bg-[#0F1D29]">
                        {p}
                      </option>
                    ))}
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
                    <option value="Published" className="bg-[#0F1D29]">
                      Published
                    </option>
                    <option value="Draft" className="bg-[#0F1D29]">
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
                  className="rounded-xl bg-[#FCD400] px-6 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 hover:brightness-110 disabled:opacity-60 transition"
                >
                  {submittingAnnouncement ? "Creating…" : "+ Create Notice"}
                </button>
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() =>
                    setAnnouncementForm({
                      title: "",
                      content: "",
                      audience: "All Users",
                      priority: "Normal",
                      published: true,
                    })
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition"
                >
                  Reset
                </button>
              </div>

              {/* Stats capsules row */}
              <div className="mt-4 grid gap-3 grid-cols-3 border-t border-white/8 pt-4">
                {[
                  { label: "Published", value: annStats.published.toString(), color: "#6EE7B7" },
                  { label: "Drafts", value: annStats.drafts.toString(), color: "#94A3B8" },
                  { label: "Urgent", value: annStats.urgent.toString(), color: "#FCA5A5" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/8 bg-[#152E47]/60 px-4 py-3 backdrop-blur"
                    style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
                  >
                    <p className="text-[9px] font-bold tracking-[0.18em] text-slate-400 uppercase">{item.label}</p>
                    <p className="mt-0.5 text-base font-black text-white">{item.value}</p>
                  </div>
                ))}
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
    </>
  );
}

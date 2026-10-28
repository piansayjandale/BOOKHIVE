"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Sparkles,
  QrCode,
  Clock,
  Bell,
  LogOut,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  FileCheck,
  ExternalLink,
  ChevronRight,
  Filter,
  Bookmark,
  RefreshCw,
  X,
  CreditCard,
  Upload,
} from "lucide-react";

interface StudentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  idNumber?: string;
  studentId?: string;
  department?: string;
  course?: string;
  yearLevel?: string;
  section?: string;
  qrCode?: string;
  avatar?: string;
  schoolIdFront?: string;
  schoolIdBack?: string;
}

interface BookItem {
  id: string;
  title: string;
  author: string;
  isbn: string;
  department: string;
  category: string;
  copies: number;
  availableCopies: number;
  shelfLocation?: string;
  summary?: string;
  coverImg?: string;
}

interface TransactionItem {
  id: string;
  resourceTitle: string;
  isbn: string;
  type: string;
  status: string;
  createdAt: string;
  dueDate?: string;
  returnDate?: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  date?: string;
  priority?: string;
  createdAt?: string;
}

const DEPARTMENTS = [
  "All",
  "CICT",
  "CAS",
  "CBA",
  "CTE",
  "CCJE",
  "General Collection",
];

export function StudentView() {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalog" | "loans" | "card" | "announcements">("catalog");

  // Catalog State
  const [books, setBooks] = useState<BookItem[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [selectedDept, setSelectedDept] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  // Borrow/Reserve Modal State
  const [selectedBookForAction, setSelectedBookForAction] = useState<BookItem | null>(null);
  const [actionType, setActionType] = useState<"borrow" | "reserve">("borrow");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Loans State
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);

  // Announcements State
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);

  // Fetch Current Student User
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser({
            ...data.user,
            studentId: data.user.idNumber || data.user.studentId || "653705",
            department: data.user.department || "CICT",
            course: data.user.course || "BSIT",
          });
        } else {
          // Fallback to sample student session if not logged in
          setUser({
            id: "std-001",
            name: "Jandale Piansay",
            email: "jandale.653705@wnu.sti.edu.ph",
            role: "Student",
            idNumber: "653705",
            studentId: "653705",
            department: "CICT",
            course: "BSIT",
            qrCode: "e1a10001-6537-4050-8000-000000000001",
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingUser(false));
  }, []);

  // Fetch Catalog Books
  const fetchBooks = () => {
    setIsLoadingBooks(true);
    const deptParam = selectedDept !== "All" ? `&department=${encodeURIComponent(selectedDept)}` : "";
    fetch(`/api/student/books?limit=80${deptParam}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.books && Array.isArray(data.books)) {
          setBooks(data.books);
        } else if (Array.isArray(data)) {
          setBooks(data);
        }
      })
      .catch((err) => console.error("Error fetching books:", err))
      .finally(() => setIsLoadingBooks(false));
  };

  useEffect(() => {
    fetchBooks();
  }, [selectedDept]);

  // Fetch Loans/Transactions
  const fetchLoans = () => {
    if (!user) return;
    setIsLoadingLoans(true);
    const studentIdentifier = user.studentId || user.idNumber || user.email || "";
    fetch(`/api/student/borrow-history?studentId=${encodeURIComponent(studentIdentifier)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.history && Array.isArray(data.history)) {
          setTransactions(data.history);
        } else if (Array.isArray(data)) {
          setTransactions(data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingLoans(false));
  };

  useEffect(() => {
    if (activeTab === "loans") {
      fetchLoans();
    }
  }, [activeTab, user]);

  // Fetch Announcements
  useEffect(() => {
    if (activeTab === "announcements") {
      setIsLoadingAnnouncements(true);
      fetch("/api/announcements")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data)) {
            setAnnouncements(data);
          } else if (data?.announcements) {
            setAnnouncements(data.announcements);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingAnnouncements(false));
    }
  }, [activeTab]);

  // Filtered Books
  const filteredBooks = useMemo(() => {
    let list = books;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q) ||
          (b.category && b.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [books, searchQuery]);

  // Handle Borrow / Reserve Request
  const handleSubmitAction = async () => {
    if (!selectedBookForAction || !user) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const endpoint = actionType === "borrow" ? "/api/student/borrow" : "/api/student/reserve";
    const payload = {
      bookId: selectedBookForAction.id,
      resourceTitle: selectedBookForAction.title,
      isbn: selectedBookForAction.isbn,
      department: selectedBookForAction.department || user.department || "Circulation",
      studentName: user.name,
      studentId: user.studentId || user.idNumber || "653705",
      type: actionType === "borrow" ? "Borrow" : "Reserve",
      durationDays: 7,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setActionSuccess(
          `Success! Your ${actionType} request for "${selectedBookForAction.title}" has been submitted.`
        );
        setTimeout(() => {
          setSelectedBookForAction(null);
          setActionSuccess(null);
          fetchLoans();
        }, 1800);
      } else {
        setActionError(data.message || `Failed to submit ${actionType} request.`);
      }
    } catch (err) {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.assign("/login");
  };

  return (
    <div className="min-h-screen bg-[#090E1A] text-slate-100 flex flex-col justify-between selection:bg-amber-300 selection:text-slate-950 font-sans">
      {/* Top Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-gradient-to-b from-amber-500/10 via-sky-500/5 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0C1527]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 shadow-md shadow-black/40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF200] p-1.5 flex items-center justify-center shadow-md shadow-amber-500/15">
              <img src="/sti-logo.png" alt="STI Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-white tracking-tight">BookHive</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Student
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block -mt-0.5 font-medium">
                STI West Negros University Library
              </span>
            </div>
          </div>

          {/* User Profile Chip & Logout */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-1.5">
                <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    ID: {user.studentId || user.idNumber} • {user.department || "CICT"}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Sign Out of BookHive"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-6xl mx-auto mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "catalog"
                ? "bg-[#FFD700] text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Books Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("loans")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "loans"
                ? "bg-[#FFD700] text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>My Loans &amp; Reservations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("card")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "card"
                ? "bg-[#FFD700] text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Digital Library Pass</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("announcements")}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "announcements"
                ? "bg-[#FFD700] text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Announcements</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        {/* =================================================================== */}
        {/* TAB 1: BOOKS CATALOG & AI PROMPT SEARCH                             */}
        {/* =================================================================== */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            {/* Search Header Banner */}
            <div className="bg-gradient-to-r from-[#111A2E] via-[#142340] to-[#111A2E] border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-bold mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> Google Gemini AI Powered
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Discover Campus Library Resources
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                  Search by title, author, course code, or type natural language prompts to locate reference materials, Filipiniana volumes, and course modules.
                </p>

                {/* Search Inputs */}
                <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title, author, or ISBN..."
                      className="w-full h-12 bg-[#090E1A] border border-slate-700/80 rounded-2xl pl-11 pr-4 text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Department Filters */}
                <div className="mt-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {DEPARTMENTS.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setSelectedDept(dept)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        selectedDept === dept
                          ? "bg-sky-500 text-white shadow-xs"
                          : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700"
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Catalog Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  <span>Library Collection</span>
                  <span className="text-xs font-bold text-slate-400">
                    ({filteredBooks.length} titles available)
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={fetchBooks}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {isLoadingBooks ? (
                <div className="py-20 text-center">
                  <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Loading catalog titles...</p>
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="py-16 text-center bg-[#111A2E]/60 border border-slate-800 rounded-3xl p-6">
                  <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-300">No books found matching your criteria</p>
                  <p className="text-xs text-slate-500 mt-1">Try searching another title, keyword, or clear your filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {filteredBooks.map((book) => {
                    const isAvailable = (book.availableCopies ?? book.copies ?? 1) > 0;
                    return (
                      <div
                        key={book.id || book.isbn}
                        className="bg-[#111A2E] border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-400/50 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 group"
                      >
                        <div>
                          {/* Department & Copies Tag */}
                          <div className="flex items-center justify-between gap-1 mb-2.5">
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[10px] font-bold">
                              {book.department || "Circulation"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                isAvailable
                                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                                  : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                              }`}
                            >
                              {isAvailable ? "Available" : "Checked Out"}
                            </span>
                          </div>

                          {/* Title & Author */}
                          <h4 className="font-black text-sm text-white line-clamp-2 leading-snug group-hover:text-amber-300 transition-colors">
                            {book.title}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 font-medium line-clamp-1">
                            by {book.author || "Unknown Author"}
                          </p>

                          <div className="mt-3 text-[11px] text-slate-400 space-y-0.5">
                            <div>ISBN: <span className="text-slate-300 font-mono">{book.isbn}</span></div>
                            {book.shelfLocation && (
                              <div>Shelf: <span className="text-slate-300">{book.shelfLocation}</span></div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-700/60 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBookForAction(book);
                              setActionType("borrow");
                            }}
                            className="flex-1 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all shadow-xs cursor-pointer text-center"
                          >
                            Borrow
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBookForAction(book);
                              setActionType("reserve");
                            }}
                            className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer text-center"
                          >
                            Reserve
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: MY BORROWINGS & RESERVATIONS                                 */}
        {/* =================================================================== */}
        {activeTab === "loans" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  My Borrowings &amp; Active Requests
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Track your borrowed books, active holds, return deadlines, and library circulation status.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchLoans}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
              </button>
            </div>

            {isLoadingLoans ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading your borrowing records...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                  <Bookmark className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-lg text-white">No active borrowings on record</h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  You currently have no active borrow or reservation requests. Head over to the Books Catalog tab to discover and borrow titles.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("catalog")}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#ffe033] text-slate-950 font-black text-xs transition-all cursor-pointer"
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((txn) => {
                  const isReturned = txn.status.toLowerCase() === "returned";
                  const isBorrowed = txn.status.toLowerCase() === "borrowed";
                  const isPending = txn.status.toLowerCase().includes("pending");

                  return (
                    <div
                      key={txn.id}
                      className="bg-[#111A2E] border border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isBorrowed
                                ? "bg-sky-500/15 border border-sky-500/30 text-sky-300"
                                : isReturned
                                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                                : "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                            }`}
                          >
                            {txn.status}
                          </span>
                          <span className="text-xs text-slate-400">
                            Type: <strong className="text-slate-200">{txn.type}</strong>
                          </span>
                        </div>
                        <h4 className="font-black text-base text-white">{txn.resourceTitle}</h4>
                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span>ISBN: <strong className="text-slate-300 font-mono">{txn.isbn}</strong></span>
                          <span>Requested: {new Date(txn.createdAt).toLocaleDateString()}</span>
                          {txn.dueDate && (
                            <span>Due Date: <strong className="text-amber-300">{new Date(txn.dueDate).toLocaleDateString()}</strong></span>
                          )}
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0">
                        {isBorrowed && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5" /> Return before deadline
                          </div>
                        )}
                        {isReturned && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Successfully Returned
                          </div>
                        )}
                        {isPending && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5" /> Awaiting Librarian Desk Approval
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: DIGITAL STUDENT QR LIBRARY PASS                              */}
        {/* =================================================================== */}
        {activeTab === "card" && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-black text-white tracking-tight">
                Digital Student Library Card
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Present this digital QR pass at the library circulation desk or scanning kiosks to authenticate transactions.
              </p>
            </div>

            {/* Official Card Visual */}
            <div className="bg-gradient-to-b from-[#17233D] to-[#0D1527] border-2 border-amber-400/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF200] p-1.5 flex items-center justify-center shadow-md">
                    <img src="/sti-logo.png" alt="STI Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">STI West Negros University</h3>
                    <p className="text-[11px] text-amber-300 font-extrabold uppercase tracking-wider">
                      Official Library Pass • Student Card
                    </p>
                  </div>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Active Verified" />
              </div>

              {/* QR Code Section */}
              <div className="my-6 flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl shadow-xl border-4 border-amber-300 flex items-center justify-center">
                  {/* Generated QR Placeholder */}
                  <div className="w-44 h-44 bg-slate-900 rounded-xl flex flex-col items-center justify-center p-2 text-center text-white relative overflow-hidden">
                    <QrCode className="w-32 h-32 text-amber-300 stroke-[1.5]" />
                    <div className="text-[9px] font-mono tracking-tight text-slate-300 mt-1">
                      {user?.qrCode || `e1a10001-${user?.studentId || "653705"}`}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-2">
                  PASS CODE: {user?.studentId || user?.idNumber || "653705"}
                </span>
              </div>

              {/* Student Details */}
              <div className="bg-[#090E1A]/80 border border-slate-700/60 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cardholder:</span>
                  <strong className="text-white font-extrabold">{user?.name || "Student"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Student ID:</span>
                  <strong className="text-amber-300 font-mono">{user?.studentId || user?.idNumber || "653705"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Department:</span>
                  <strong className="text-slate-200">{user?.department || "CICT"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Course / Program:</span>
                  <strong className="text-slate-200">{user?.course || "BS in Information Technology"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Account Status:</span>
                  <span className="inline-flex items-center gap-1 font-extrabold text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Active Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: ANNOUNCEMENTS                                                */}
        {/* =================================================================== */}
        {activeTab === "announcements" && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Library Bulletins &amp; Announcements
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Official notices, exam week operating schedules, holiday hours, and catalog updates from the library team.
              </p>
            </div>

            {isLoadingAnnouncements ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading bulletins...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="space-y-4">
                <div className="bg-[#111A2E] border border-slate-700/60 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase">
                      General Advisory
                    </span>
                    <span className="text-[11px] text-slate-400">Campus Library Operations</span>
                  </div>
                  <h4 className="font-black text-base text-white">BookHive Mobile App Update v1.1.0 Released</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    The latest version of the official BookHive Student Mobile Companion (v1.1.0) is now live! Existing students now only require their School ID (Front and Back) for profile verification. Library cards are exclusively required when completing book borrow and reservation transactions.
                  </p>
                </div>

                <div className="bg-[#111A2E] border border-slate-700/60 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-black uppercase">
                      Operating Hours
                    </span>
                    <span className="text-[11px] text-slate-400">Circulation Desk Schedule</span>
                  </div>
                  <h4 className="font-black text-base text-white">STI West Negros University Library Desk Hours</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Monday to Friday: 8:00 AM – 6:00 PM. Saturday: 8:00 AM – 12:00 PM. Please return all borrowed materials before due dates to keep your borrowing privileges in good standing.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#111A2E] border border-slate-700/60 rounded-2xl p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase">
                        {item.priority || "Announcement"}
                      </span>
                      {item.createdAt && (
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h4 className="font-black text-base text-white">{item.title}</h4>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Borrow / Reserve Modal */}
      {selectedBookForAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBookForAction(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-[#111A2E] border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/60 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white capitalize">
                    {actionType} Book Request
                  </h3>
                  <p className="text-[11px] text-slate-400">STI WNU Circulation Desk</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookForAction(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {actionSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">{actionSuccess}</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {actionError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold text-center">
                    {actionError}
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-[#090E1A] border border-slate-700/70 space-y-1">
                  <h4 className="font-black text-sm text-white">{selectedBookForAction.title}</h4>
                  <p className="text-slate-400">Author: {selectedBookForAction.author}</p>
                  <p className="text-slate-400 font-mono">ISBN: {selectedBookForAction.isbn}</p>
                  <p className="text-slate-400">Department: {selectedBookForAction.department}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Student Name:</span>
                    <strong className="text-white">{user?.name}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Student ID Number:</span>
                    <strong className="text-amber-300 font-mono">{user?.studentId || user?.idNumber}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Loan Duration:</span>
                    <strong className="text-slate-200">7 Days Standard</strong>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Due Date:</span>
                    <strong className="text-amber-400">
                      {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  By submitting this request, you agree to take proper care of institutional library resources and return them on or before the due date.
                </p>

                <div className="mt-5 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedBookForAction(null)}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitAction}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#ffe033] text-slate-950 font-black text-xs cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
                  >
                    {actionLoading ? (
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      `Confirm ${actionType === "borrow" ? "Borrow" : "Reservation"}`
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center text-[11px] text-slate-500 font-medium border-t border-slate-800/60 mt-8">
        STI West Negros University • BookHive Student Companion • Digital Library System
      </footer>
    </div>
  );
}

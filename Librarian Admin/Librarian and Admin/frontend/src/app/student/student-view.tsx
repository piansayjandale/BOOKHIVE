"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Home,
  Search,
  BookOpen,
  CreditCard,
  QrCode,
  Bell,
  Sun,
  Moon,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  Copy,
  Calendar,
  Building2,
  FileText,
  LogOut,
  Camera,
  RotateCcw,
  User,
  ShieldCheck,
  Check,
  Info,
} from "lucide-react";

interface BookItem {
  id: string;
  title: string;
  author: string;
  isbn: string;
  department: string;
  category: string;
  genre?: string;
  genres?: string;
  copies: number;
  totalCopies?: number;
  availableCopies: number;
  unavailableCopies?: number;
  reservedCopies?: number;
  borrowedCount?: number;
  reservedCount?: number;
  shelfLocation?: string;
  shelf?: string;
  summary?: string;
  description?: string;
  coverImg?: string;
  coverImage?: string;
  coverUrl?: string;
  rating?: number | string;
  publicationDate?: string;
  publishedDate?: string;
  year?: string;
  pages?: number | string;
  publisher?: string;
  edition?: string;
  volume?: string;
  accessionNumber?: string;
  status?: string;
  availability?: string;
  isAvailable?: boolean;
}

interface TransactionItem {
  id: string;
  resourceTitle?: string;
  title?: string;
  isbn: string;
  type: string;
  status: string;
  requestedAt?: string;
  createdAt?: string;
  dueDate?: string;
  due_date?: string;
  returnDate?: string;
  studentName?: string;
  studentId?: string;
}

export function StudentView() {
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "search" | "books" | "card">("home");

  // User State
  const [user, setUser] = useState<any>({
    id: "933ce1ed-60e7-4951-9590-683a348ffb2b",
    name: "Jan Dale Piansay",
    studentId: "23-1653-705",
    idNumber: "23-1653-705",
    email: "piansay.653705@wnu.sti.edu.ph",
    department: "College of Information and Communications Technology",
    course: "BSIT - 4TH Year",
    section: "H",
    qrCode: "e1a10002-6537-4050-8000-000000000002",
  });

  // Catalog State
  const [books, setBooks] = useState<BookItem[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");

  // Transactions State
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [myBooksFilter, setMyBooksFilter] = useState<"all" | "borrowed" | "reserved" | "returned">("all");
  const [libraryCardSubTab, setLibraryCardSubTab] = useState<"card" | "reserved">("card");

  // Modals
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);

  // Borrow Flow Form
  const [borrowDuration, setBorrowDuration] = useState("7");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load User & Theme
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("bookhive_theme");
      if (savedTheme === "light") setIsDarkMode(false);

      const savedUser = localStorage.getItem("bookhive_student_user");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.name) {
            setUser((prev: any) => ({
              ...prev,
              ...parsed,
              studentId: parsed.id_number || parsed.idNumber || parsed.studentId || prev.studentId,
              course: parsed.course || (parsed.department ? `${parsed.department} - 4TH Year` : prev.course),
            }));
          }
        } catch {}
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("bookhive_theme", next ? "dark" : "light");
      }
      return next;
    });
  };

  // Fetch Live Books Catalog
  const fetchLiveBooks = async () => {
    setIsLoadingBooks(true);
    try {
      const res = await fetch("/api/student/books?limit=100");
      if (res.ok) {
        const data = await res.json();
        const bookList: BookItem[] = (data.books || []).map((b: any) => {
          const totalCopies = Math.max(1, Number(b.copies || b.totalCopies || 1));
          const borrowedCount = Math.max(Number(b.borrowedCount || 0), Number(b.borrowed_count || 0));
          const reservedCount = Math.max(Number(b.reservedCount || 0), Number(b.reserved_count || 0));
          const unavailableCopies = Math.min(totalCopies, borrowedCount);
          const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), reservedCount);
          const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
          const isAvail = availableCopies > 0;
          const status = isAvail ? "Available" : (reservedCount > 0 ? "Reserved" : "Unavailable");

          return {
            ...b,
            copies: totalCopies,
            totalCopies,
            borrowedCount,
            reservedCount,
            unavailableCopies,
            reservedCopies,
            availableCopies,
            isAvailable: isAvail,
            status,
            availability: status,
            genre: b.genre || b.genres || b.category || b.department || "General",
          };
        });
        setBooks(bookList);
      }
    } catch (e) {
      console.warn("Failed to fetch live books:", e);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  // Fetch Live Student Transactions
  const fetchTransactions = async () => {
    try {
      const targetId = user?.studentId || user?.idNumber || "23-1653-705";
      const res = await fetch(`/api/student/borrow-history?studentId=${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.warn("Failed to fetch transactions:", e);
    }
  };

  useEffect(() => {
    fetchLiveBooks();
    fetchTransactions();
    const interval = setInterval(() => {
      fetchLiveBooks();
      fetchTransactions();
    }, 15000);
    return () => clearInterval(interval);
  }, [user?.studentId]);

  // Derived Counts
  const activeBorrowedCount = useMemo(() => {
    return transactions.filter((t) => {
      const st = String(t.status || "").toLowerCase();
      const tp = String(t.type || "").toLowerCase();
      return tp === "borrow" && ["approved", "borrowed", "overdue", "pending"].includes(st);
    }).length;
  }, [transactions]);

  const activeReservedCount = useMemo(() => {
    return transactions.filter((t) => {
      const st = String(t.status || "").toLowerCase();
      const tp = String(t.type || "").toLowerCase();
      return (tp === "reserve" || tp === "reservation") && ["approved", "pending"].includes(st);
    }).length;
  }, [transactions]);

  // Carousels for Home Screen
  const newArrivals = useMemo(() => {
    return books.slice(0, 10);
  }, [books]);

  const recommendedBooks = useMemo(() => {
    return books.slice(10, 20).length > 0 ? books.slice(10, 20) : books.slice(0, 10);
  }, [books]);

  const circulationBooks = useMemo(() => {
    return books.filter((b) => (b.department || "").toLowerCase().includes("circulation") || (b.category || "").toLowerCase().includes("circulation")).slice(0, 10);
  }, [books]);

  // Search Screen Filtered
  const filteredSearchBooks = useMemo(() => {
    let list = books;
    if (selectedDept !== "All") {
      list = list.filter((b) => (b.department || "").toLowerCase() === selectedDept.toLowerCase() || (b.category || "").toLowerCase() === selectedDept.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.isbn && b.isbn.toLowerCase().includes(q)) ||
        (b.genre && b.genre.toLowerCase().includes(q))
      );
    }
    return list;
  }, [books, selectedDept, searchQuery]);

  // My Books Filtered
  const filteredMyBooks = useMemo(() => {
    return transactions.filter((t) => {
      const st = String(t.status || "").toLowerCase();
      const tp = String(t.type || "").toLowerCase();
      if (myBooksFilter === "borrowed") {
        return tp === "borrow" && ["approved", "borrowed", "overdue", "pending"].includes(st);
      }
      if (myBooksFilter === "reserved") {
        return (tp === "reserve" || tp === "reservation") && ["approved", "pending"].includes(st);
      }
      if (myBooksFilter === "returned") {
        return st === "returned";
      }
      return true;
    });
  }, [transactions, myBooksFilter]);

  // Handle Book Borrow Submission
  const handleBorrowSubmit = async () => {
    if (!selectedBook) return;
    setIsSubmittingTx(true);
    setActionMessage(null);

    try {
      const res = await fetch("/api/student/borrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: user?.studentId || user?.idNumber || "23-1653-705",
          studentName: user?.name || "Jan Dale Piansay",
          bookTitle: selectedBook.title,
          isbn: selectedBook.isbn,
          department: selectedBook.department || "Circulation",
          durationDays: parseInt(borrowDuration, 10) || 7,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: "error", text: data.message || "Borrow request could not be processed." });
        setIsSubmittingTx(false);
        return;
      }

      setActionMessage({ type: "success", text: "Borrow request submitted! Present your Library Card QR to the circulation counter for pickup." });
      setIsSubmittingTx(false);
      setTimeout(() => {
        setShowBorrowModal(false);
        setActionMessage(null);
        fetchTransactions();
        fetchLiveBooks();
      }, 1800);
    } catch {
      setActionMessage({ type: "error", text: "Network error submitting request. Please try again." });
      setIsSubmittingTx(false);
    }
  };

  // Handle Book Reserve Submission
  const handleReserveSubmit = async () => {
    if (!selectedBook) return;
    setIsSubmittingTx(true);
    setActionMessage(null);

    try {
      const res = await fetch("/api/student/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: user?.studentId || user?.idNumber || "23-1653-705",
          studentName: user?.name || "Jan Dale Piansay",
          bookTitle: selectedBook.title,
          isbn: selectedBook.isbn,
          department: selectedBook.department || "Circulation",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: "error", text: data.message || "Reservation could not be processed." });
        setIsSubmittingTx(false);
        return;
      }

      setActionMessage({ type: "success", text: "Book reserved successfully! You will be notified once a copy is available." });
      setIsSubmittingTx(false);
      setTimeout(() => {
        setShowReserveModal(false);
        setActionMessage(null);
        fetchTransactions();
        fetchLiveBooks();
      }, 1800);
    } catch {
      setActionMessage({ type: "error", text: "Network error submitting reservation. Please try again." });
      setIsSubmittingTx(false);
    }
  };

  const studentQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    user?.qrCode || user?.studentId || "e1a10002-6537-4050-8000-000000000002"
  )}`;

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-between font-sans transition-colors duration-200 select-none ${
        isDarkMode ? "bg-[#060B14] text-slate-100" : "bg-[#F4F6F9] text-slate-900"
      }`}
    >
      {/* Mobile Shell Container (Full viewport on phone, sleek mobile aspect ratio on desktop) */}
      <div className="w-full max-w-[480px] min-h-screen flex flex-col bg-transparent relative shadow-2xl">
        {/* ========================================================================= */}
        {/* TOP STATUS HEADER (BookHive Monitor)                                     */}
        {/* ========================================================================= */}
        <header
          className={`sticky top-0 z-40 px-4 py-3.5 flex items-center justify-between backdrop-blur-md border-b ${
            isDarkMode
              ? "bg-[#080E1A]/95 border-slate-800/80"
              : "bg-white/95 border-slate-200"
          }`}
        >
          {/* Left: Avatar Circle */}
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 flex items-center justify-center shadow-md shadow-amber-500/20 cursor-pointer active:scale-95 transition-transform"
            title="View Profile & ID Cards"
          >
            <div className="w-full h-full rounded-full bg-[#0E1728] flex items-center justify-center text-amber-400 font-black text-xs">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "JD"}
            </div>
          </button>

          {/* Center: Title "BookHive Monitor" with gold ribbon icon */}
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveTab("home")}>
            <Bookmark className="w-4 h-4 text-[#FFCC00] fill-[#FFCC00]" />
            <span className="font-extrabold text-base tracking-tight text-white">
              BookHive Monitor
            </span>
          </div>

          {/* Right: Theme Toggle & Notifications Bell */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isDarkMode ? "text-amber-400 hover:bg-slate-800" : "text-amber-600 hover:bg-slate-100"
              }`}
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-600" />}
            </button>

            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-slate-300" />
              {activeBorrowedCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* TAB 1: HOME SCREEN                                                        */}
        {/* ========================================================================= */}
        {activeTab === "home" && (
          <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-6 animate-in fade-in duration-200">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Borrowed Counter Card */}
              <div
                onClick={() => {
                  setMyBooksFilter("borrowed");
                  setActiveTab("books");
                }}
                className={`p-4 rounded-2xl border cursor-pointer active:scale-98 transition-all ${
                  isDarkMode
                    ? "bg-[#0E1728] border-slate-800/90 shadow-lg shadow-black/40"
                    : "bg-white border-slate-200 shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Borrowed
                  </span>
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-3xl font-black mt-2 text-white">
                  {activeBorrowedCount}
                </div>
                <div className="text-[10px] font-semibold text-emerald-400 mt-0.5">
                  Active Loans
                </div>
              </div>

              {/* Reserved Counter Card */}
              <div
                onClick={() => {
                  setLibraryCardSubTab("reserved");
                  setActiveTab("card");
                }}
                className={`p-4 rounded-2xl border cursor-pointer active:scale-98 transition-all ${
                  isDarkMode
                    ? "bg-[#0E1728] border-slate-800/90 shadow-lg shadow-black/40"
                    : "bg-white border-slate-200 shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Reserved
                  </span>
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-3xl font-black mt-2 text-white">
                  {activeReservedCount}
                </div>
                <div className="text-[10px] font-semibold text-amber-400 mt-0.5">
                  Pending Holds
                </div>
              </div>
            </div>

            {/* Carousel 1: New Arrivals */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold text-base">✨</span>
                  <h2 className="text-base font-extrabold text-white tracking-tight">
                    New Arrivals
                  </h2>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    NEW
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDept("All");
                    setActiveTab("search");
                  }}
                  className="flex items-center gap-0.5 text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  <span>See All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                {newArrivals.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className={`w-[126px] shrink-0 p-2 rounded-2xl border cursor-pointer active:scale-95 transition-all flex flex-col justify-between ${
                      isDarkMode
                        ? "bg-[#0E1728] border-slate-800/80 hover:border-slate-700"
                        : "bg-white border-slate-200 shadow-sm"
                    }`}
                  >
                    {/* Book Cover */}
                    <div className="w-full h-[154px] rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 relative flex items-center justify-center p-2 text-center shadow-inner">
                      {book.coverImg || book.coverImage ? (
                        <img
                          src={book.coverImg || book.coverImage}
                          alt={book.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-between p-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 text-center">
                          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
                            {book.category || "BookHive"}
                          </span>
                          <span className="text-xs font-black text-white leading-tight line-clamp-3">
                            {book.title}
                          </span>
                          <span className="text-[9px] font-medium text-slate-400 line-clamp-1">
                            by {book.author}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Book Metadata */}
                    <div className="mt-2 space-y-0.5">
                      <h3 className="text-xs font-extrabold text-white leading-tight line-clamp-2">
                        {book.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {book.author}
                      </p>
                      {/* Genre / Classification Badge (Picture 5 Update) */}
                      <p className="text-[9.5px] font-bold text-[#38BDF8] line-clamp-1 capitalize pt-0.5">
                        {book.genre || book.category || book.department || "General"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Carousel 2: Recommended Books */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 font-bold text-base">🔥</span>
                  <h2 className="text-base font-extrabold text-white tracking-tight">
                    Recommended Books
                  </h2>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    TOP PICK
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDept("All");
                    setActiveTab("search");
                  }}
                  className="flex items-center gap-0.5 text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  <span>See All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                {recommendedBooks.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className={`w-[126px] shrink-0 p-2 rounded-2xl border cursor-pointer active:scale-95 transition-all flex flex-col justify-between ${
                      isDarkMode
                        ? "bg-[#0E1728] border-slate-800/80 hover:border-slate-700"
                        : "bg-white border-slate-200 shadow-sm"
                    }`}
                  >
                    <div className="w-full h-[154px] rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 relative flex items-center justify-center p-2 text-center shadow-inner">
                      {book.coverImg || book.coverImage ? (
                        <img
                          src={book.coverImg || book.coverImage}
                          alt={book.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-between p-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 text-center">
                          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
                            {book.category || "BookHive"}
                          </span>
                          <span className="text-xs font-black text-white leading-tight line-clamp-3">
                            {book.title}
                          </span>
                          <span className="text-[9px] font-medium text-slate-400 line-clamp-1">
                            by {book.author}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 space-y-0.5">
                      <h3 className="text-xs font-extrabold text-white leading-tight line-clamp-2">
                        {book.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {book.author}
                      </p>
                      <p className="text-[9.5px] font-bold text-[#38BDF8] line-clamp-1 capitalize pt-0.5">
                        {book.genre || book.category || book.department || "General"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Carousel 3: Circulation Department */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold text-base">📖</span>
                  <h2 className="text-base font-extrabold text-white tracking-tight">
                    Circulation
                  </h2>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    MAIN
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDept("Circulation");
                    setActiveTab("search");
                  }}
                  className="flex items-center gap-0.5 text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  <span>See All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                {(circulationBooks.length > 0 ? circulationBooks : books.slice(0, 8)).map((book) => (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className={`w-[126px] shrink-0 p-2 rounded-2xl border cursor-pointer active:scale-95 transition-all flex flex-col justify-between ${
                      isDarkMode
                        ? "bg-[#0E1728] border-slate-800/80 hover:border-slate-700"
                        : "bg-white border-slate-200 shadow-sm"
                    }`}
                  >
                    <div className="w-full h-[154px] rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 relative flex items-center justify-center p-2 text-center shadow-inner">
                      {book.coverImg || book.coverImage ? (
                        <img
                          src={book.coverImg || book.coverImage}
                          alt={book.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-between p-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 text-center">
                          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
                            {book.category || "BookHive"}
                          </span>
                          <span className="text-xs font-black text-white leading-tight line-clamp-3">
                            {book.title}
                          </span>
                          <span className="text-[9px] font-medium text-slate-400 line-clamp-1">
                            by {book.author}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 space-y-0.5">
                      <h3 className="text-xs font-extrabold text-white leading-tight line-clamp-2">
                        {book.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {book.author}
                      </p>
                      <p className="text-[9.5px] font-bold text-[#38BDF8] line-clamp-1 capitalize pt-0.5">
                        {book.genre || book.category || book.department || "General"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SEARCH SCREEN                                                      */}
        {/* ========================================================================= */}
        {activeTab === "search" && (
          <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4 animate-in fade-in duration-200">
            {/* Search Input Box */}
            <div
              className={`h-12 rounded-2xl border px-3.5 flex items-center gap-2.5 transition-all ${
                isDarkMode ? "bg-[#0E1728] border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, author, or ISBN..."
                className="w-full bg-transparent border-0 outline-hidden text-xs sm:text-sm font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Department Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
              {["All", "CICT", "CAS", "CBA", "CTE", "CCJE", "Circulation", "Filipiniana", "Special Collections"].map(
                (dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedDept === dept
                        ? "bg-[#FFCC00] text-[#080E1A] shadow-md shadow-amber-500/20"
                        : isDarkMode
                        ? "bg-[#0E1728] text-slate-300 border border-slate-800/80 hover:bg-slate-800"
                        : "bg-white text-slate-700 border border-slate-200 shadow-xs"
                    }`}
                  >
                    {dept}
                  </button>
                )
              )}
            </div>

            {/* Results Counter */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
              <span>Found {filteredSearchBooks.length} books</span>
              <button
                type="button"
                onClick={fetchLiveBooks}
                className="flex items-center gap-1 text-amber-400 font-bold hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Books Vertical List / Grid */}
            <div className="space-y-3">
              {filteredSearchBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => setSelectedBook(book)}
                  className={`p-3 rounded-2xl border cursor-pointer active:scale-98 transition-all flex gap-3.5 items-center ${
                    isDarkMode
                      ? "bg-[#0E1728] border-slate-800/90 hover:border-slate-700"
                      : "bg-white border-slate-200 shadow-xs"
                  }`}
                >
                  {/* Thumbnail Cover */}
                  <div className="w-16 h-22 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800 flex items-center justify-center text-center p-1">
                    {book.coverImg || book.coverImage ? (
                      <img
                        src={book.coverImg || book.coverImage}
                        alt={book.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-[10px] font-black text-amber-400 uppercase leading-tight">
                        {book.category?.slice(0, 4) || "BOOK"}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/20">
                        {book.department || "Circulation"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border ${
                          book.availableCopies > 0
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {book.availableCopies > 0 ? "Available" : "Unavailable"}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-white leading-tight line-clamp-1">
                      {book.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      by {book.author}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      ISBN: {book.isbn || "N/A"} &bull; Shelf: {book.shelfLocation || book.shelf || "Catalog Shelf"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MY BOOKS (Active Loans & Deadlines)                                */}
        {/* ========================================================================= */}
        {activeTab === "books" && (
          <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4 animate-in fade-in duration-200">
            {/* Filter Pills */}
            <div className="flex gap-2">
              {[
                { id: "all", label: "All" },
                { id: "borrowed", label: "Borrowed (Active)" },
                { id: "reserved", label: "Reserved" },
                { id: "returned", label: "Returned" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMyBooksFilter(f.id as any)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                    myBooksFilter === f.id
                      ? "bg-[#FFCC00] text-[#080E1A] shadow-md shadow-amber-500/20"
                      : isDarkMode
                      ? "bg-[#0E1728] text-slate-300 border border-slate-800"
                      : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Loans List */}
            {filteredMyBooks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-bold text-white">No books found in this tab.</p>
                <p className="text-xs">Your active book borrow and reservation transactions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMyBooks.map((tx) => {
                  const isReturned = tx.status === "Returned";
                  const dueDateObj = tx.dueDate || tx.due_date ? new Date(tx.dueDate || tx.due_date!) : null;
                  const isOverdue = dueDateObj && dueDateObj.getTime() < Date.now() && !isReturned;

                  return (
                    <div
                      key={tx.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 ${
                        isDarkMode
                          ? "bg-[#0E1728] border-slate-800/90 shadow-md"
                          : "bg-white border-slate-200 shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isReturned
                                ? "bg-slate-500/20 text-slate-400 border-slate-500/30"
                                : isOverdue
                                ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            }`}
                          >
                            {isReturned ? "Returned" : isOverdue ? "Overdue" : tx.status || "Active Loan"}
                          </span>
                          <h3 className="text-sm font-extrabold text-white leading-tight">
                            {tx.resourceTitle || tx.title || "Book Title"}
                          </h3>
                          <p className="text-xs text-slate-400">
                            ISBN: {tx.isbn || "N/A"}
                          </p>
                        </div>

                        {/* Status Icon */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isReturned
                              ? "bg-slate-500/10 text-slate-400"
                              : isOverdue
                              ? "bg-rose-500/15 text-rose-400"
                              : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {isReturned ? <CheckCircle2 className="w-4 h-4" /> : isOverdue ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Due Return Countdown Banner */}
                      <div
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          isReturned
                            ? "bg-slate-900/50 border-slate-800 text-slate-400"
                            : isOverdue
                            ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
                            : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                        }`}
                      >
                        <span className="font-semibold">
                          {isReturned
                            ? "Book returned to circulation counter"
                            : isOverdue
                            ? "Due Return Date Passed"
                            : "Return Deadline"}
                        </span>
                        <span className="font-black">
                          {dueDateObj
                            ? dueDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "7 Days Loan"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DIGITAL LIBRARY CARD & RESERVATIONS                                */}
        {/* ========================================================================= */}
        {activeTab === "card" && (
          <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4 animate-in fade-in duration-200">
            {/* Top Subtabs: [Library Card] [Reserved Books] (Matching Picture 1) */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLibraryCardSubTab("card")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  libraryCardSubTab === "card"
                    ? "bg-[#FFCC00] text-[#080E1A] shadow-md shadow-amber-500/20"
                    : isDarkMode
                    ? "bg-[#0E1728] text-slate-300 border border-slate-800"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                Library Card
              </button>
              <button
                type="button"
                onClick={() => setLibraryCardSubTab("reserved")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  libraryCardSubTab === "reserved"
                    ? "bg-[#FFCC00] text-[#080E1A] shadow-md shadow-amber-500/20"
                    : isDarkMode
                    ? "bg-[#0E1728] text-slate-300 border border-slate-800"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                Reserved Books
              </button>
            </div>

            {libraryCardSubTab === "card" ? (
              /* OFFICIAL DIGITAL STI LIBRARY CARD */
              <div
                className={`rounded-3xl border p-4 sm:p-5 relative shadow-xl space-y-4 ${
                  isDarkMode
                    ? "bg-[#0B1527] border-slate-800/90 shadow-black/60"
                    : "bg-white border-slate-200 shadow-md"
                }`}
              >
                {/* Card Title Header */}
                <div className="flex items-center justify-between border-b pb-3 border-slate-800/80">
                  <span className="text-sm font-black tracking-widest text-white uppercase">
                    LIBRARY CARD
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>

                {/* Student Info Grid */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Fullname:
                    </span>
                    <p className="font-extrabold text-white truncate">
                      {user?.name || "Jan Dale Piansay"}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Course & Section:
                    </span>
                    <p className="font-extrabold text-white truncate">
                      {user?.course || "BSIT - 4TH Year"}
                    </p>
                  </div>
                </div>

                {/* Scannable Pass QR Code */}
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-center">
                  <img
                    src={studentQrUrl}
                    alt="Student Library Pass QR"
                    className="w-36 h-36 rounded-xl bg-white p-2 shadow-md shadow-black/50"
                  />
                  <p className="text-[10.5px] font-bold text-slate-300">
                    ID: {user?.studentId || user?.idNumber || "23-1653-705"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Present this QR code to the circulation counter to check out or return books.
                  </p>
                </div>

                {/* Transaction Ledger Table (Picture 1 1:1 Parity) */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Borrow & Return Ledger</span>
                    <span className="text-[10px] text-slate-500">{transactions.length} Records</span>
                  </div>

                  <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60 text-[11px]">
                    <div className="grid grid-cols-3 bg-slate-950 p-2 font-bold text-slate-400 border-b border-slate-800">
                      <span>Borrow Date</span>
                      <span>Due Date</span>
                      <span>Book Title</span>
                    </div>

                    <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
                      {transactions.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-xs">
                          No transactions recorded on this card.
                        </div>
                      ) : (
                        transactions.map((t) => {
                          const borrowD = t.requestedAt || t.createdAt ? new Date(t.requestedAt || t.createdAt!).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) : "-";
                          const dueD = t.dueDate || t.due_date ? new Date(t.dueDate || t.due_date!).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) : "-";
                          const isOver = t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== "Returned";

                          return (
                            <div key={t.id} className="grid grid-cols-3 p-2 font-medium text-slate-200 items-center">
                              <span className="text-slate-400 text-[10px]">{borrowD}</span>
                              <span className={`text-[10px] font-bold ${isOver ? "text-rose-400" : "text-emerald-400"}`}>
                                {dueD}
                              </span>
                              <span className="truncate font-semibold">{t.resourceTitle || t.title || "Book"}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Status Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Green: Borrow (Active)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      Red: Due to Return
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      Violet: Reservation
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* RESERVED BOOKS LIST */
              <div className="space-y-3">
                {transactions.filter((t) => t.type?.toLowerCase().includes("reserve")).length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Clock className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-white">No active reservations.</p>
                    <p className="text-xs">Books currently reserved will show up here awaiting librarian release.</p>
                  </div>
                ) : (
                  transactions
                    .filter((t) => t.type?.toLowerCase().includes("reserve"))
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="p-4 rounded-2xl border bg-[#0E1728] border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Reservation Hold
                            </span>
                            <h3 className="text-sm font-extrabold text-white mt-1">
                              {tx.resourceTitle || tx.title}
                            </h3>
                            <p className="text-xs text-slate-400">ISBN: {tx.isbn}</p>
                          </div>
                          <Clock className="w-5 h-5 text-purple-400 shrink-0" />
                        </div>
                        <p className="text-xs text-slate-300 bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
                          Awaiting librarian pickup verification at the circulation counter.
                        </p>
                      </div>
                    ))
                )}
              </div>
            )}
          </main>
        )}

        {/* ========================================================================= */}
        {/* BOTTOM NAVIGATION BAR (Matching Student Mobile App)                      */}
        {/* ========================================================================= */}
        <nav
          className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 px-4 py-2 flex items-center justify-around backdrop-blur-xl border-t ${
            isDarkMode
              ? "bg-[#070E1A]/95 border-slate-800/90 text-slate-400"
              : "bg-white/95 border-slate-200 text-slate-600"
          }`}
        >
          {/* Tab 1: Home */}
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 py-1 cursor-pointer transition-colors ${
              activeTab === "home" ? "text-[#FFCC00]" : "hover:text-white"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold">Home</span>
          </button>

          {/* Tab 2: Search */}
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex flex-col items-center gap-1 py-1 cursor-pointer transition-colors ${
              activeTab === "search" ? "text-[#FFCC00]" : "hover:text-white"
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-bold">Search</span>
          </button>

          {/* Center Floating Action Button (FAB): QR Scanner */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="w-13 h-13 rounded-full bg-[#FFCC00] hover:bg-[#F59E0B] text-[#080E1A] flex items-center justify-center shadow-lg shadow-amber-500/30 cursor-pointer active:scale-95 transition-transform"
              title="QR Library Pass & Scanner"
            >
              <QrCode className="w-6 h-6 stroke-[2.2]" />
            </button>
          </div>

          {/* Tab 3: My Books */}
          <button
            type="button"
            onClick={() => setActiveTab("books")}
            className={`flex flex-col items-center gap-1 py-1 cursor-pointer transition-colors ${
              activeTab === "books" ? "text-[#FFCC00]" : "hover:text-white"
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] font-bold">My Books</span>
          </button>

          {/* Tab 4: Library Card */}
          <button
            type="button"
            onClick={() => {
              setLibraryCardSubTab("card");
              setActiveTab("card");
            }}
            className={`flex flex-col items-center gap-1 py-1 cursor-pointer transition-colors ${
              activeTab === "card" ? "text-[#FFCC00]" : "hover:text-white"
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px] font-bold">Library Card</span>
          </button>
        </nav>

        {/* ========================================================================= */}
        {/* MODAL 1: FULL BOOK DETAILS MODAL (1:1 with book-details.tsx)              */}
        {/* ========================================================================= */}
        {selectedBook && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end items-center animate-in fade-in duration-200">
            <div className="w-full max-w-[480px] max-h-[92vh] overflow-y-auto bg-[#0A1322] border-t border-slate-800 rounded-t-3xl p-5 space-y-5 shadow-2xl">
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-extrabold text-white text-sm tracking-wider uppercase">
                  BOOK DETAILS
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cover & Main Info */}
              <div className="flex gap-4 items-start">
                <div className="w-24 h-34 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 shadow-md">
                  {selectedBook.coverImg || selectedBook.coverImage ? (
                    <img
                      src={selectedBook.coverImg || selectedBook.coverImage}
                      alt={selectedBook.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-800">
                      <span className="text-[10px] font-black text-amber-400 uppercase">
                        {selectedBook.category || "BookHive"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      selectedBook.availableCopies > 0
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {selectedBook.availableCopies > 0 ? "● Available" : "● Unavailable / On Loan"}
                  </span>
                  <h2 className="text-base font-extrabold text-white leading-tight">
                    {selectedBook.title}
                  </h2>
                  <p className="text-xs text-slate-400">
                    by {selectedBook.author}
                  </p>
                  <p className="text-xs text-amber-400 font-bold">
                    ★ {selectedBook.rating || "4.8"} (218 reviews)
                  </p>
                </div>
              </div>

              {/* COPY INVENTORY & AVAILABILITY BOX (Picture 2 from previous turn) */}
              <div className="p-4 rounded-2xl bg-[#070D18] border border-amber-400/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      COPY INVENTORY & AVAILABILITY
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 text-[11px] font-extrabold text-slate-200">
                    {selectedBook.availableCopies} of {selectedBook.copies} Available
                  </span>
                </div>

                {/* 4 Metric Cards */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/25">
                    <span className="text-[9px] font-black text-sky-400 uppercase">TOTAL</span>
                    <p className="text-base font-black text-white">{selectedBook.copies}</p>
                    <span className="text-[8px] text-slate-400">In System</span>
                  </div>

                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                    <span className="text-[9px] font-black text-emerald-400 uppercase">AVAIL</span>
                    <p className="text-base font-black text-emerald-400">{selectedBook.availableCopies}</p>
                    <span className="text-[8px] text-emerald-500">Checkout</span>
                  </div>

                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25">
                    <span className="text-[9px] font-black text-amber-400 uppercase">HOLD</span>
                    <p className="text-base font-black text-amber-400">{selectedBook.reservedCopies || 0}</p>
                    <span className="text-[8px] text-amber-500">Reserved</span>
                  </div>

                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/25">
                    <span className="text-[9px] font-black text-rose-400 uppercase">ON LOAN</span>
                    <p className="text-base font-black text-rose-400">{selectedBook.unavailableCopies || 0}</p>
                    <span className="text-[8px] text-rose-500">Borrowed</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>Stock Allocation</span>
                    <span className="text-emerald-400">
                      {Math.round((selectedBook.availableCopies / Math.max(1, selectedBook.copies)) * 100)}% Circulation Ready
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{
                        width: `${Math.round((selectedBook.availableCopies / Math.max(1, selectedBook.copies)) * 100)}%`,
                      }}
                    />
                    <div
                      className="h-full bg-rose-500 transition-all"
                      style={{
                        width: `${Math.round(((selectedBook.unavailableCopies || 0) / Math.max(1, selectedBook.copies)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Metadata Cards Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase">ISBN</span>
                  <p className="font-extrabold text-white">{selectedBook.isbn || "N/A"}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase">SECTION</span>
                  <p className="font-extrabold text-white">{selectedBook.department || "Circulation"}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase">CLASSIFICATION</span>
                  <p className="font-extrabold text-cyan-400">{selectedBook.genre || selectedBook.category || "General"}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase">SHELF LOCATION</span>
                  <p className="font-extrabold text-white truncate">{selectedBook.shelfLocation || selectedBook.shelf || "CIR 101.4"}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {selectedBook.availableCopies > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowBorrowModal(true)}
                    className="w-full py-3.5 rounded-2xl bg-[#FFCC00] hover:bg-[#F59E0B] text-[#080E1A] font-black text-sm tracking-wide shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                  >
                    Borrow This Book
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReserveModal(true)}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#080E1A] font-black text-sm tracking-wide shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                  >
                    Reserve / Place on Hold
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: BORROW CONFIRMATION MODAL                                        */}
        {/* ========================================================================= */}
        {showBorrowModal && selectedBook && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-[420px] bg-[#0E1728] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-extrabold text-white">
                  Confirm Borrow Request
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBorrowModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-bold text-white text-sm">{selectedBook.title}</p>
                <p className="text-slate-400">ISBN: {selectedBook.isbn}</p>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Loan Duration:</span>
                  <select
                    value={borrowDuration}
                    onChange={(e) => setBorrowDuration(e.target.value)}
                    className="w-full bg-[#080E1A] text-white border border-slate-700 rounded-lg p-2 text-xs font-semibold outline-hidden"
                  >
                    <option value="7">7 Days (Standard Student Loan)</option>
                    <option value="14">14 Days (Extended Academic Loan)</option>
                    <option value="3">3 Days (Quick Review Loan)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="terms" className="text-slate-300 text-[11px] font-medium leading-tight">
                    I agree to return this book on or before the due date to avoid library penalty fines.
                  </label>
                </div>
              </div>

              {actionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold leading-relaxed ${
                    actionMessage.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBorrowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!agreeTerms || isSubmittingTx}
                  onClick={handleBorrowSubmit}
                  className="flex-1 py-3 rounded-xl bg-[#FFCC00] text-[#080E1A] font-extrabold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmittingTx ? "Submitting..." : "Confirm Borrow"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: RESERVE CONFIRMATION MODAL                                       */}
        {/* ========================================================================= */}
        {showReserveModal && selectedBook && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-[420px] bg-[#0E1728] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-extrabold text-white">
                  Place on Reservation Hold
                </h3>
                <button
                  type="button"
                  onClick={() => setShowReserveModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-bold text-white text-sm">{selectedBook.title}</p>
                <p className="text-slate-400">All physical copies are currently on loan.</p>
                <p className="text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  Placing a hold will queue you for the next returned copy. You will be given a 24-hour claim window to collect the book once returned.
                </p>
              </div>

              {actionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold leading-relaxed ${
                    actionMessage.type === "success"
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReserveModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingTx}
                  onClick={handleReserveSubmit}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-[#080E1A] font-extrabold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmittingTx ? "Reserving..." : "Confirm Hold"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 4: CENTER QR FAB ACTION MODAL                                       */}
        {/* ========================================================================= */}
        {showQrModal && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-[420px] bg-[#0E1728] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-extrabold text-white">
                  Student Library Pass
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-center">
                <img
                  src={studentQrUrl}
                  alt="Student Pass QR"
                  className="w-48 h-48 rounded-xl bg-white p-2 shadow-lg shadow-black/60"
                />
                <p className="text-xs font-black text-white pt-1">
                  {user?.name || "Jan Dale Piansay"}
                </p>
                <p className="text-xs font-bold text-amber-400">
                  ID: {user?.studentId || user?.idNumber || "23-1653-705"}
                </p>
                <p className="text-[11px] text-slate-400">
                  Present this QR code to the librarian or scan kiosk at the circulation desk.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowQrModal(false);
                  setLibraryCardSubTab("card");
                  setActiveTab("card");
                }}
                className="w-full py-3 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                View Full Digital Library Card
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 5: PROFILE & ID CARD MODAL                                          */}
        {/* ========================================================================= */}
        {showProfileModal && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-[420px] bg-[#0E1728] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-extrabold text-white">
                  Student Profile
                </h3>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-[#0E1728] flex items-center justify-center text-amber-400 font-black text-base">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : "JD"}
                  </div>
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-white text-sm truncate">
                    {user?.name || "Jan Dale Piansay"}
                  </h4>
                  <p className="text-xs text-amber-400 font-bold">
                    ID: {user?.studentId || user?.idNumber || "23-1653-705"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {user?.course || "BSIT - 4TH Year"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-bold text-white truncate max-w-[200px]">{user?.department || "CICT"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-bold text-white truncate max-w-[200px]">{user?.email || "piansay@wnu.sti.edu.ph"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Library Status:</span>
                  <span className="font-bold text-emerald-400">Active & Good Standing</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("bookhive_student_user");
                    localStorage.removeItem("bookhive_token");
                  }
                  window.location.assign("/login");
                }}
                className="w-full py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-xs hover:bg-rose-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 6: NOTIFICATIONS MODAL                                              */}
        {/* ========================================================================= */}
        {showNotificationsModal && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-[420px] bg-[#0E1728] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Library Notifications</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNotificationsModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-white">Welcome to BookHive</span>
                    <span className="text-[10px] text-slate-500">Just now</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Your digital student library companion is synchronized with the STI WNU circulation desk.
                  </p>
                </div>

                {activeBorrowedCount > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-amber-300">Active Book Loans</span>
                      <span className="text-[10px] text-amber-400 font-bold">Active</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80">
                      You currently have {activeBorrowedCount} active book loan(s). Check your My Books tab for upcoming return deadlines.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

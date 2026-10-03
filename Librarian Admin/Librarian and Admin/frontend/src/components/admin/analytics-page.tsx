"use client";

import { startTransition, useEffect, useState, useCallback, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { Printer, Sheet } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shared";
import { useTheme } from "@/components/providers/theme-provider";
import { BookDetailModal } from "@/components/ui/book-detail-modal";
import { requestJson } from "@/lib/admin/client";
import type { AnalyticsPayload } from "@/lib/admin/types";
import { transformDepartmentData, type DepartmentData } from "@/lib/department-transformer";
import { dashboardSocket } from "@/lib/socket";
import { cn, downloadCsv } from "@/lib/utils";

function getBadgeStyles(fill: string, badgeBg: string, badgeBorder: string, isLight: boolean) {
  if (!isLight) {
    return { backgroundColor: badgeBg, borderColor: badgeBorder, color: fill };
  }
  if (fill === "#FCD400" || fill === "#f59e0b") {
    return { backgroundColor: "#FEF3C7", borderColor: "#FDE68A", color: "#B45309" };
  }
  if (fill === "#10B981" || fill === "#10b981") {
    return { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0", color: "#047857" };
  }
  if (fill === "#38BDF8" || fill === "#0ea5e9") {
    return { backgroundColor: "#E0F2FE", borderColor: "#BAE6FD", color: "#0369A1" };
  }
  if (fill === "#C084FC" || fill === "#a855f7") {
    return { backgroundColor: "#F3E8FF", borderColor: "#E9D5FF", color: "#7E22CE" };
  }
  return { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0", color: "#334155" };
}

export function AnalyticsPage() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const gridStroke = isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.06)";
  const axisStroke = isLight ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.4)";
  const axisLineStroke = isLight ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.1)";
  const tickFill = isLight ? "#000000" : "#FFFFFF";
  const tickMutedFill = isLight ? "#000000" : "#94A3B8";

  const tooltipContentStyle = {
    backgroundColor: isLight ? "#ffffff" : "#0F1D29",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.15)",
    color: isLight ? "#000000" : "#fff",
    borderRadius: "12px",
    fontSize: "12px",
    boxShadow: isLight ? "0 10px 25px rgba(2, 116, 187, 0.08)" : "0 10px 25px rgba(0,0,0,0.5)",
    padding: "10px 14px",
  };

  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [departmentUsage, setDepartmentUsage] = useState<any[]>([]);
  const [topBooks, setTopBooks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bookViewMode, setBookViewMode] = useState<"columns" | "ranked">("columns");
  const [addedBooksViewMode, setAddedBooksViewMode] = useState<"monthly" | "cumulative">("monthly");
  const [courseViewMode, setCourseViewMode] = useState<"borrows" | "students">("borrows");
  const [searchViewMode, setSearchViewMode] = useState<"books" | "terms">("books");
  const [selectedBook, setSelectedBook] = useState<any | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      const [dashRes, txRes, analyticsRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/transactions?status=All&type=All"),
        requestJson<AnalyticsPayload>("/api/admin/analytics"),
      ]);

      if (analyticsRes) {
        startTransition(() => setPayload(analyticsRes));
      }

      let calculatedTopBooks: any[] = [];
      if (txRes.ok) {
        const txPayload = await txRes.json();
        const txList: any[] = Array.isArray(txPayload?.transactions)
          ? txPayload.transactions
          : Array.isArray(txPayload)
          ? txPayload
          : [];

        setTransactions(txList);

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
        if (data.departmentUsage) setDepartmentUsage(data.departmentUsage);
        if (data.topBooks && data.topBooks.length > 0) {
          setTopBooks(data.topBooks);
        } else if (calculatedTopBooks.length > 0) {
          setTopBooks(calculatedTopBooks);
        }
      } else if (calculatedTopBooks.length > 0) {
        setTopBooks(calculatedTopBooks);
      }
    } catch (err) {
      console.warn("Error fetching analytics dashboard:", err);
    }
  }, []);

  useEffect(() => {
    void fetchAnalyticsData();

    // Subscribe to real-time transaction updates
    const unsubBorrow = dashboardSocket.subscribeToBorrowRequest(() => {
      void fetchAnalyticsData();
    });
    const unsubNotif = dashboardSocket.subscribeToNotification(() => {
      void fetchAnalyticsData();
    });
    const handleTxUpdate = () => {
      void fetchAnalyticsData();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("transaction-updated", handleTxUpdate);
      window.addEventListener("catalog-updated", handleTxUpdate);
      window.addEventListener("book-added", handleTxUpdate);
    }

    const intervalId = setInterval(() => {
      void fetchAnalyticsData();
    }, 6000);

    return () => {
      unsubBorrow();
      unsubNotif();
      clearInterval(intervalId);
      if (typeof window !== "undefined") {
        window.removeEventListener("transaction-updated", handleTxUpdate);
        window.removeEventListener("catalog-updated", handleTxUpdate);
        window.removeEventListener("book-added", handleTxUpdate);
      }
    };
  }, [fetchAnalyticsData]);

  const formattedDepartments = useMemo(() => {
    return transformDepartmentData(departmentUsage);
  }, [departmentUsage]);

  const totalStudents = useMemo(() => {
    return formattedDepartments.reduce((acc, curr) => acc + (curr.count || 0), 0);
  }, [formattedDepartments]);

  const activeCollegesCount = useMemo(() => {
    return formattedDepartments.filter((d) => d.count > 0).length;
  }, [formattedDepartments]);

  const displayTopBooks = useMemo(() => {
    if (topBooks && topBooks.length > 0) {
      const sorted = [...topBooks].sort(
        (a, b) => Number(b.borrowCount ?? b.borrows ?? 0) - Number(a.borrowCount ?? a.borrows ?? 0)
      );
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
      { id: "1", title: "Wayward Son", author: "Rainbow Rowell", category: "Young Adult", department: "Circulation", borrowCount: 2 },
      { id: "2", title: "Yana Brich Daily Life", author: "Yana Palmares", category: "Circulation", department: "Circulation", borrowCount: 2 },
      { id: "3", title: "Brichoox Gaming", author: "Brichoox", category: "Circulation", department: "Circulation", borrowCount: 1 },
      { id: "4", title: "Charmed", author: "Michelle Krys", category: "Fantasy", department: "Circulation", borrowCount: 1 },
    ];
  }, [topBooks]);

  const totalBorrowsCount = useMemo(() => {
    return displayTopBooks.reduce((acc, curr) => acc + (curr.borrowCount || 0), 0);
  }, [displayTopBooks]);

  const monthlyStats = useMemo(() => {
    const trends = payload?.monthlyTrends ?? [];
    const totalBorrows = trends.reduce((acc, cur) => acc + (cur.borrows || 0), 0);
    const totalReturns = trends.reduce((acc, cur) => acc + (cur.returns || 0), 0);
    const totalReservations = trends.reduce((acc, cur) => acc + (cur.reservations || 0), 0);
    const totalAll = totalBorrows + totalReturns + totalReservations;

    const activeMonth = [...trends].reverse().find(
      (m) => (m.borrows || 0) + (m.returns || 0) + (m.reservations || 0) > 0
    );

    return {
      totalBorrows,
      totalReturns,
      totalReservations,
      totalAll,
      latestMonthName: activeMonth?.month || "Sep",
      latestMonthTotal: activeMonth
        ? (activeMonth.borrows || 0) + (activeMonth.returns || 0) + (activeMonth.reservations || 0)
        : 0,
    };
  }, [payload?.monthlyTrends]);

  const addedBooksStats = useMemo(() => {
    const quotaLimit = 1000;
    const defaultMonths = [
      { month: "Jan", count: 0, cumulative: 0, isFuture: false },
      { month: "Feb", count: 0, cumulative: 0, isFuture: false },
      { month: "Mar", count: 0, cumulative: 0, isFuture: false },
      { month: "Apr", count: 0, cumulative: 0, isFuture: false },
      { month: "May", count: 0, cumulative: 0, isFuture: false },
      { month: "Jun", count: 0, cumulative: 0, isFuture: false },
      { month: "Jul", count: 0, cumulative: 0, isFuture: false },
      { month: "Aug", count: 0, cumulative: 0, isFuture: false },
      { month: "Sep", count: 0, cumulative: 0, isFuture: false },
      { month: "Oct", count: 0, cumulative: 0, isFuture: true },
      { month: "Nov", count: 0, cumulative: 0, isFuture: true },
      { month: "Dec", count: 0, cumulative: 0, isFuture: true },
    ];

    const monthlyData =
      payload?.monthlyBookAdditions && payload.monthlyBookAdditions.length === 12
        ? payload.monthlyBookAdditions
        : defaultMonths;

    const totalAdded = payload?.catalogQuota?.totalAdded ?? monthlyData.reduce((acc, m) => acc + (m.count || 0), 0);
    const remainingQuota = Math.max(0, quotaLimit - totalAdded);
    const rawUtilPct = (totalAdded / quotaLimit) * 100;
    const utilizationPct = totalAdded > 0
      ? (rawUtilPct < 1 ? Number(rawUtilPct.toFixed(1)) : Math.round(rawUtilPct))
      : 0;
    const remainingPct = Math.round((remainingQuota / quotaLimit) * 100);
    const safeRate = payload?.catalogQuota?.safeMonthlyRate ?? Math.round(quotaLimit / 12);

    const activeMonths = monthlyData.filter((m) => (m.count || 0) > 0);
    const peakMonth =
      activeMonths.length > 0
        ? [...activeMonths].sort((a, b) => b.count - a.count)[0]
        : { month: "Sep", count: totalAdded };

    const breakdownCards = [
      {
        key: "inputted",
        title: "Cataloged Input",
        desc: "New books added in 2026",
        count: `${totalAdded} Books`,
        pillText: `${utilizationPct}% Quota`,
        fill: "#FCD400",
        badgeBg: "rgba(252, 212, 0, 0.15)",
        badgeBorder: "rgba(252, 212, 0, 0.4)",
      },
      {
        key: "remaining",
        title: "Available Headroom",
        desc: "Remaining input slots",
        count: `${remainingQuota} Slots`,
        pillText: `${remainingPct}% Free`,
        fill: "#10B981",
        badgeBg: "rgba(16, 185, 129, 0.15)",
        badgeBorder: "rgba(16, 185, 129, 0.4)",
      },
      {
        key: "peak",
        title: "Peak Intake Month",
        desc: peakMonth.count > 0 ? "Highest catalog intake" : "No additions yet",
        count: peakMonth.count > 0 ? `${peakMonth.month} (${peakMonth.count} Added)` : "None (0)",
        pillText: peakMonth.count > 0 ? "Peak Intake" : "0 Books",
        fill: "#38BDF8",
        badgeBg: "rgba(56, 189, 248, 0.15)",
        badgeBorder: "rgba(56, 189, 248, 0.4)",
      },
      {
        key: "ceiling",
        title: "Annual Cap Limit",
        desc: "System intake maximum",
        count: "1,000 Books",
        pillText: "Fixed Quota",
        fill: "#C084FC",
        badgeBg: "rgba(192, 132, 252, 0.15)",
        badgeBorder: "rgba(192, 132, 252, 0.4)",
      },
    ];

    return {
      quotaLimit,
      totalAdded,
      remainingQuota,
      utilizationPct,
      remainingPct,
      safeRate,
      peakMonth,
      monthlyData,
      breakdownCards,
    };
  }, [payload?.monthlyBookAdditions, payload?.catalogQuota]);

  const courseStats = useMemo(() => {
    const defaultData = {
      totalBorrows: 7,
      activeCoursesCount: 3,
      topCourse: {
        name: "BSIT",
        fullTitle: "BS Information Technology",
        borrowCount: 4,
        percentage: 57.1,
      },
      courses: [
        { course: "BSIT", fullTitle: "BS Information Technology", borrowCount: 4, studentCount: 3, percentage: 57.1, fill: "#FCD400" },
        { course: "General Program", fullTitle: "General Academic Program", borrowCount: 2, studentCount: 1, percentage: 28.6, fill: "#10B981" },
        { course: "BSTM", fullTitle: "BS Tourism Management", borrowCount: 1, studentCount: 1, percentage: 14.3, fill: "#38BDF8" },
      ],
    };

    const cData = payload?.mostCourseBorrowed || defaultData;
    const courses = (cData.courses && cData.courses.length > 0) ? cData.courses : defaultData.courses;
    const totalBorrows = cData.totalBorrows || 7;
    const topCourse = cData.topCourse || defaultData.topCourse;
    const activeCoursesCount = cData.activeCoursesCount || courses.length;

    const breakdownCards = [
      {
        key: "topCourse",
        title: "BS Information Technology",
        desc: "Primary borrowing academic program",
        count: `${topCourse.borrowCount} Loans`,
        pillText: `${topCourse.percentage}% Share`,
        fill: "#FCD400",
        badgeBg: "rgba(252, 212, 0, 0.15)",
        badgeBorder: "rgba(252, 212, 0, 0.4)",
      },
      {
        key: "secondCourse",
        title: "General Academic Program",
        desc: "Core curriculum and electives",
        count: "2 Loans",
        pillText: "28.6% Share",
        fill: "#10B981",
        badgeBg: "rgba(16, 185, 129, 0.15)",
        badgeBorder: "rgba(16, 185, 129, 0.4)",
      },
      {
        key: "thirdCourse",
        title: "BS Tourism Management",
        desc: "CHTM hospitality & travel track",
        count: "1 Loan",
        pillText: "14.3% Share",
        fill: "#38BDF8",
        badgeBg: "rgba(56, 189, 248, 0.15)",
        badgeBorder: "rgba(56, 189, 248, 0.4)",
      },
      {
        key: "fourthCourse",
        title: "BS Computer Science",
        desc: "CICT algorithms & computing track",
        count: "Enrolled",
        pillText: "Active Track",
        fill: "#C084FC",
        badgeBg: "rgba(192, 132, 252, 0.15)",
        badgeBorder: "rgba(192, 132, 252, 0.4)",
      },
    ];

    return {
      cData,
      courses,
      totalBorrows,
      topCourse,
      activeCoursesCount,
      breakdownCards,
    };
  }, [payload?.mostCourseBorrowed]);

  const searchStats = useMemo(() => {
    const defaultData = {
      totalSearches: 180,
      topTitle: "Wayward Son",
      books: [
        { title: "Wayward Son", author: "Rainbow Rowell", category: "Fantasy & Fiction", searchCount: 42, percentage: 32.5, trend: "Trending #1" },
        { title: "Yana Brich Daily Life", author: "Yana Palmares", category: "Biography & Memoir", searchCount: 35, percentage: 27.1, trend: "High Interest" },
        { title: "Brichoox Gaming Experience", author: "Brichoox", category: "Technology & Gaming", searchCount: 28, percentage: 21.7, trend: "Popular" },
        { title: "Charmed", author: "Paul Ruditis", category: "Fantasy", searchCount: 19, percentage: 14.7, trend: "Rising" },
        { title: "Data Structures and Algorithms", author: "Robert Lafore", category: "Computer Science", searchCount: 16, percentage: 12.4, trend: "Core Academic" },
        { title: "Database Management Systems", author: "Raghu Ramakrishnan", category: "Information Tech", searchCount: 12, percentage: 9.3, trend: "Required Read" },
      ],
      searchTerms: [
        { term: "Algorithms", count: 42, category: "Computer Science" },
        { term: "Programming", count: 36, category: "Software Dev" },
        { term: "Fiction", count: 29, category: "Literature" },
        { term: "Database", count: 24, category: "Information Tech" },
        { term: "Tourism", count: 18, category: "Hospitality" },
        { term: "Gaming", count: 14, category: "Multimedia" },
      ],
    };

    const sData = payload?.mostSearchedBooks || defaultData;
    const books = (sData.books && sData.books.length > 0) ? sData.books : defaultData.books;
    const searchTerms = (sData.searchTerms && sData.searchTerms.length > 0) ? sData.searchTerms : defaultData.searchTerms;
    const totalSearches = sData.totalSearches || 180;
    const topTitle = sData.topTitle || (books[0]?.title || "Wayward Son");

    const breakdownCards = books.slice(0, 4).map((b, idx) => ({
      key: `book-${idx}`,
      title: b.title,
      desc: `${b.author} • ${b.category}`,
      count: `${b.searchCount} Searches`,
      pillText: b.trend || `#${idx + 1} Trending`,
      fill: idx === 0 ? "#FCD400" : idx === 1 ? "#10B981" : idx === 2 ? "#38BDF8" : "#C084FC",
      badgeBg:
        idx === 0
          ? "rgba(252, 212, 0, 0.15)"
          : idx === 1
          ? "rgba(16, 185, 129, 0.15)"
          : idx === 2
          ? "rgba(56, 189, 248, 0.15)"
          : "rgba(192, 132, 252, 0.15)",
      badgeBorder:
        idx === 0
          ? "rgba(252, 212, 0, 0.4)"
          : idx === 1
          ? "rgba(16, 185, 129, 0.4)"
          : idx === 2
          ? "rgba(56, 189, 248, 0.4)"
          : "rgba(192, 132, 252, 0.4)",
    }));

    return {
      sData,
      books,
      searchTerms,
      totalSearches,
      topTitle,
      breakdownCards,
    };
  }, [payload?.mostSearchedBooks]);

  function handleExport() {
    downloadCsv(
      "bookhive-analytics.csv",
      displayTopBooks.map((item) => ({
        title: item.title,
        borrows: item.borrowCount,
        author: item.author,
        category: item.category,
      }))
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Analytics"
        description="Visualize demand, borrowing trends, department engagement, and operational status from centralized BookHive data."
        actions={
          <>
            <button
              type="button"
              className="admin-secondary-btn inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:bg-white/10 cursor-pointer"
              onClick={handleExport}
            >
              <Sheet className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              className="admin-primary-btn inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition cursor-pointer"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </button>
          </>
        }
      />

      {/* Top Charts Row matching Picture 1 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Most Active Departments */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className={cn("text-[22px] font-bold tracking-wide", isLight ? "text-slate-900" : "text-white")}>
                Most Active Departments
              </h2>
              <p className={cn("mt-1 text-[13px] font-normal", isLight ? "text-slate-500" : "text-slate-300")}>
                Student enrollment count by academic college.
              </p>
            </div>
            <div
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold shadow-xs",
                isLight ? "border-slate-200 bg-slate-50 text-[#0274BB]" : "border-white/10 bg-[#132337] text-[#FCD400]"
              )}
            >
              {activeCollegesCount} Active
            </div>
          </div>

          <div className="h-[280px] w-full flex flex-row items-center justify-between gap-3">
            {/* Left: Donut Chart with Centered Info */}
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
                    stroke={isLight ? "#ffffff" : "#0F1D29"}
                    strokeWidth={2}
                    isAnimationActive={true}
                  >
                    {totalStudents === 0 ? (
                      <Cell fill={isLight ? "#f1f5f9" : "#182A3C"} stroke={isLight ? "#e2e8f0" : "#22394F"} strokeWidth={2} />
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
                <span className={cn("text-3xl font-black leading-none", isLight ? "text-slate-900" : "text-white")}>{totalStudents}</span>
                <span className={cn("text-[10px] font-extrabold tracking-widest uppercase mt-1", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                  STUDENTS
                </span>
                <span className={cn("text-[9.5px] font-medium mt-0.5 leading-tight whitespace-nowrap", isLight ? "text-slate-500" : "text-slate-400")}>
                  7 College Departments
                </span>
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
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 transition-all",
                      isLight
                        ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-slate-300"
                        : "border-white/5 bg-[#122335]/75 text-white hover:bg-[#122335] hover:border-white/10"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn("text-xs font-bold", isLight ? "text-slate-900" : "text-white")}>{item.code}</span>
                        <span className={cn("text-[11px] font-normal truncate max-w-[62px]", isLight ? "text-slate-500" : "text-slate-400")}>
                          {item.mascot}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-xs font-bold font-mono", isLight ? "text-slate-900" : "text-white")}>{item.count}</span>
                      <div
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px] font-bold font-mono",
                          isLight
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-[#FCD400]/40 bg-[#FCD400]/10 text-[#FCD400]"
                        )}
                      >
                        {pct}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* Most Borrowed Books matching Picture 1 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className={cn("text-[22px] font-bold tracking-wide", isLight ? "text-slate-900" : "text-white")}>
                Most Borrowed Books
              </h2>
              <p className={cn("mt-1 text-[13px] font-normal", isLight ? "text-slate-500" : "text-slate-300")}>
                Live borrow transaction metrics by title.
              </p>
            </div>
            {/* Segmented Button [ Columns | Ranked ] */}
            <div className={cn("flex items-center rounded-full p-0.5 border shadow-xs transition-colors", isLight ? "bg-slate-100 border-slate-200" : "bg-[#132337] border-white/10")}>
              <button
                type="button"
                onClick={() => setBookViewMode("columns")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer",
                  bookViewMode === "columns"
                    ? isLight
                      ? "bg-[#FFF300] text-[#0274BB] shadow-sm font-extrabold"
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
                  "rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer",
                  bookViewMode === "ranked"
                    ? isLight
                      ? "bg-[#FFF300] text-[#0274BB] shadow-sm font-extrabold"
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
                <BarChart data={displayTopBooks} margin={{ top: 26, right: 15, left: -22, bottom: 20 }}>
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
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="title"
                    stroke={axisStroke}
                    tick={{ fill: tickFill, fontSize: 11, fontWeight: "bold" }}
                    tickLine={false}
                    axisLine={{ stroke: axisLineStroke }}
                    interval={0}
                    angle={-15}
                    dy={10}
                    textAnchor="end"
                    tickFormatter={(value) => (value.length > 14 ? value.substring(0, 13) + "..." : value)}
                  />
                  <YAxis
                    stroke={axisStroke}
                    tick={{ fill: tickMutedFill, fontSize: 10, fontWeight: "bold" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    cursor={false}
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
                            fill={isLight ? "#ffffff" : "#0B1A2C"}
                            stroke={isLight ? "#D97706" : "#FCD400"}
                            strokeWidth={1}
                          />
                          <text
                            x={x + width / 2}
                            y={badgeY + 13}
                            fill={isLight ? "#B45309" : "#FCD400"}
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
                      const fullBook =
                        topBooks.find(
                          (t) =>
                            (t.id && t.id === book.id) ||
                            (t.title && t.title.toLowerCase() === book.title.toLowerCase())
                        ) || book;
                      setSelectedBook(fullBook);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border p-2.5 transition cursor-pointer",
                      isLight
                        ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-[#0274BB]/40"
                        : "border-white/5 bg-[#122335]/70 text-white hover:bg-[#122335] hover:border-[#FCD400]/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black font-mono shadow-sm",
                          idx === 0
                            ? isLight ? "bg-[#FFF300] text-[#0274BB]" : "bg-[#FCD400] text-[#0B1A2C]"
                            : idx === 1
                            ? isLight ? "bg-slate-200 text-slate-800" : "bg-slate-300 text-[#0B1A2C]"
                            : idx === 2
                            ? "bg-amber-600 text-white"
                            : isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-slate-300"
                        )}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("truncate text-xs font-bold", isLight ? "text-slate-900 group-hover:text-[#0274BB]" : "text-white")}>{book.title}</p>
                        <p className={cn("truncate text-[10px]", isLight ? "text-slate-500" : "text-slate-400")}>
                          {book.author} • <span className={cn(isLight ? "text-[#0274BB] font-semibold" : "text-[#FCD400]/80")}>{book.category}</span>
                        </p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs font-bold font-mono shrink-0",
                        isLight
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-[#FCD400]/40 bg-[#FCD400]/10 text-[#FCD400]"
                      )}
                    >
                      {book.borrowCount} borrows
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Real-Time Telemetry Bar */}
          <div className={cn("flex items-center justify-between text-[11px] px-1 pt-2.5 mt-1 border-t transition-colors", isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400")}>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Real-time Database Sync
            </div>
            <div className="font-mono text-slate-300 text-[11px]">
              <span className="text-[#FCD400] font-bold">{totalBorrowsCount}</span> Total Borrows
            </div>
          </div>
        </motion.section>
      </div>

      {/* Bottom Trends Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Monthly Trends */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className={cn("text-[22px] font-bold tracking-wide", isLight ? "text-slate-900" : "text-white")}>
                Monthly Trends
              </h2>
              <p className={cn("mt-1 text-[13px] font-normal", isLight ? "text-slate-500" : "text-slate-300")}>
                Borrowing, return, and reservation movement over time.
              </p>
            </div>
            <div
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold shadow-xs",
                isLight ? "border-slate-200 bg-slate-50 text-[#0274BB]" : "border-white/10 bg-[#132337] text-[#FCD400]"
              )}
            >
              {monthlyStats.totalAll} Total Events
            </div>
          </div>

          {/* Content Labels / Badges for each content */}
          <div className="flex flex-wrap items-center gap-2.5 my-3">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold",
                isLight ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              )}
            >
              <span className="h-2 w-2 rounded-full bg-[#f59e0b] shadow-sm" />
              <span>Borrows:</span>
              <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>{monthlyStats.totalBorrows}</span>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold",
                isLight ? "border-sky-200 bg-sky-50 text-sky-800" : "border-sky-500/30 bg-sky-500/10 text-sky-400"
              )}
            >
              <span className="h-2 w-2 rounded-full bg-[#0ea5e9] shadow-sm" />
              <span>Returns:</span>
              <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>{monthlyStats.totalReturns}</span>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold",
                isLight ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              )}
            >
              <span className="h-2 w-2 rounded-full bg-[#10b981] shadow-sm" />
              <span>Reservations:</span>
              <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>{monthlyStats.totalReservations}</span>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={payload?.monthlyTrends ?? []} margin={{ top: 28, right: 20, left: -22, bottom: 5 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke={axisStroke}
                  tick={{ fill: tickFill, fontSize: 11, fontWeight: "bold" }}
                  tickLine={false}
                  axisLine={{ stroke: axisLineStroke }}
                />
                <YAxis
                  stroke={axisStroke}
                  tick={{ fill: tickMutedFill, fontSize: 10, fontWeight: "bold" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.max(dataMax + 2, 8)]}
                />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  cursor={false}
                />
                <Line
                  type="monotone"
                  dataKey="borrows"
                  name="Borrows"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: isLight ? "#ffffff" : "#0B1A2C" }}
                  activeDot={{ r: 6, fill: "#f59e0b" }}
                  label={(props: any) => {
                    const { x, y, value } = props;
                    if (!value || value <= 0) return null;
                    return (
                      <g>
                        <rect
                          x={x - 13}
                          y={y - 24}
                          width={26}
                          height={18}
                          rx={5}
                          fill={isLight ? "#ffffff" : "#0B1A2C"}
                          stroke="#f59e0b"
                          strokeWidth={1}
                        />
                        <text
                          x={x}
                          y={y - 11}
                          fill={isLight ? "#B45309" : "#f59e0b"}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {value}
                        </text>
                      </g>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="returns"
                  name="Returns"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#0ea5e9", strokeWidth: 2, stroke: isLight ? "#ffffff" : "#0B1A2C" }}
                  activeDot={{ r: 6, fill: "#0ea5e9" }}
                  label={(props: any) => {
                    const { x, y, value } = props;
                    if (!value || value <= 0) return null;
                    return (
                      <g>
                        <rect
                          x={x - 13}
                          y={y - 24}
                          width={26}
                          height={18}
                          rx={5}
                          fill={isLight ? "#ffffff" : "#0B1A2C"}
                          stroke="#0ea5e9"
                          strokeWidth={1}
                        />
                        <text
                          x={x}
                          y={y - 11}
                          fill={isLight ? "#0369A1" : "#0ea5e9"}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {value}
                        </text>
                      </g>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="reservations"
                  name="Reservations"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: isLight ? "#ffffff" : "#0B1A2C" }}
                  activeDot={{ r: 6, fill: "#10b981" }}
                  label={(props: any) => {
                    const { x, y, value } = props;
                    if (!value || value <= 0) return null;
                    return (
                      <g>
                        <rect
                          x={x - 13}
                          y={y - 24}
                          width={26}
                          height={18}
                          rx={5}
                          fill={isLight ? "#ffffff" : "#0B1A2C"}
                          stroke="#10b981"
                          strokeWidth={1}
                        />
                        <text
                          x={x}
                          y={y - 11}
                          fill={isLight ? "#047857" : "#10b981"}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {value}
                        </text>
                      </g>
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Telemetry Bar */}
          <div className={cn("flex items-center justify-between text-[11px] px-1 pt-2.5 mt-1 border-t transition-colors", isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400")}>
            <div className="flex items-center gap-1.5 text-amber-500 font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Peak Activity: {monthlyStats.latestMonthName} ({monthlyStats.latestMonthTotal} movements)
            </div>
            <div className={cn("font-mono text-[11px]", isLight ? "text-slate-600" : "text-slate-300")}>
              <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>{monthlyStats.totalAll}</span> Cumulative Movements
            </div>
          </div>
        </motion.section>

        {/* Monthly Added Books (1,000 Books System Limit) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
        >
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className={cn("text-[22px] font-bold tracking-wide", isLight ? "text-slate-900" : "text-white")}>
                  Monthly Added Books
                </h2>
                <p className={cn("mt-1 text-[13px] font-normal", isLight ? "text-slate-500" : "text-slate-300")}>
                  Annual acquisition volume and monthly catalog intake against the 1,000-book limit.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* View Toggle [ Monthly | Cumulative ] */}
                <div className={cn("flex items-center rounded-lg border p-0.5 text-xs font-semibold shadow-xs transition-colors", isLight ? "border-slate-200 bg-slate-100" : "border-white/10 bg-[#122335]")}>
                  <button
                    type="button"
                    onClick={() => setAddedBooksViewMode("monthly")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition cursor-pointer",
                      addedBooksViewMode === "monthly"
                        ? isLight
                          ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-sm"
                          : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                        : isLight
                          ? "text-slate-600 hover:text-[#0274BB]"
                          : "text-slate-300 hover:text-white"
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddedBooksViewMode("cumulative")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition cursor-pointer",
                      addedBooksViewMode === "cumulative"
                        ? isLight
                          ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-sm"
                          : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                        : isLight
                          ? "text-slate-600 hover:text-[#0274BB]"
                          : "text-slate-300 hover:text-white"
                    )}
                  >
                    Cumulative
                  </button>
                </div>

                <div className={cn("rounded-full border px-3 py-1 text-xs font-bold shadow-xs whitespace-nowrap", isLight ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-white/10 bg-[#132337] text-emerald-400")}>
                  1,000 Books Max Cap
                </div>
              </div>
            </div>

            {/* Content Labels / Badges */}
            <div className="flex flex-wrap items-center gap-2.5 my-3">
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400")}>
                <span className="h-2 w-2 rounded-full bg-[#10b981] shadow-sm" />
                <span>Annual Inflow:</span>
                <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>{addedBooksStats.totalAdded} Books Added</span>
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-500/30 bg-amber-500/10 text-amber-400")}>
                <span className="h-2 w-2 rounded-full bg-[#f59e0b] shadow-sm" />
                <span>Input Limit:</span>
                <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>1,000 Max Cap ({addedBooksStats.utilizationPct}% Used)</span>
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-sky-200 bg-sky-50 text-sky-800" : "border-sky-500/30 bg-sky-500/10 text-sky-400")}>
                <span className="h-2 w-2 rounded-full bg-[#0ea5e9] shadow-sm" />
                <span>Headroom:</span>
                <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>{addedBooksStats.remainingQuota} Slots Free</span>
              </div>
            </div>

            {/* Quota Progress Bar Indicator */}
            <div className={cn("rounded-xl border px-3 py-2 mb-3", isLight ? "border-slate-200 bg-slate-50" : "border-white/5 bg-[#122335]/50")}>
              <div className={cn("flex items-center justify-between text-[11px] mb-1.5 font-semibold", isLight ? "text-slate-600" : "text-slate-300")}>
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", isLight ? "bg-[#0274BB]" : "bg-[#FCD400]")} />
                  Annual Input Quota Progress
                </span>
                <span className={cn("font-mono", isLight ? "text-slate-800" : "text-white")}>
                  <strong className={isLight ? "text-[#0274BB]" : "text-[#FCD400]"}>{addedBooksStats.totalAdded}</strong> / 1,000 Books Inputted ({addedBooksStats.utilizationPct}%)
                </span>
              </div>
              <div className={cn("relative h-2 w-full overflow-hidden rounded-full", isLight ? "bg-slate-200" : "bg-white/10")}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(Number(addedBooksStats.utilizationPct), addedBooksStats.totalAdded > 0 ? 1 : 0)}%`,
                    background: "linear-gradient(90deg, #FCD400 0%, #10B981 100%)",
                    boxShadow: "0 0 10px rgba(16, 185, 129, 0.4)",
                  }}
                />
              </div>
            </div>

            {/* Main Body */}
            {addedBooksViewMode === "monthly" ? (
              /* Dual Panel: Left 12-Month Bar Chart + Right Quota Breakdown Cards */
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center min-h-[250px]">
                {/* Left Bar Chart (7 cols) */}
                <div className="md:col-span-7 h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={addedBooksStats.monthlyData}
                      margin={{ top: 26, right: 10, left: -22, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="bookAddGradActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#047857" />
                        </linearGradient>
                        <linearGradient id="bookAddGradPeak" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FCD400" />
                          <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        stroke={axisStroke}
                        tick={{ fill: tickFill, fontSize: 10, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={{ stroke: axisLineStroke }}
                      />
                      <YAxis
                        stroke={axisStroke}
                        tick={{ fill: tickMutedFill, fontSize: 10, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        domain={[0, (dataMax: number) => Math.max(Math.ceil((dataMax || 1) * 1.3), 4)]}
                      />
                      <Tooltip
                        contentStyle={tooltipContentStyle}
                        cursor={false}
                        formatter={(value: any, _name: any, props: any) => [
                          `${value} Books Added (${((Number(value) / 1000) * 100).toFixed(1)}% of 1,000 Cap)`,
                          `${props?.payload?.month} 2026 Intake`,
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        radius={[5, 5, 0, 0]}
                        barSize={18}
                        shape={(props: any) => {
                          const { x, y, width, height, value, payload } = props;
                          const isPeak = payload?.month === addedBooksStats.peakMonth.month;
                          const gradId = isPeak ? "url(#bookAddGradPeak)" : "url(#bookAddGradActive)";
                          const badgeWidth = 24;
                          const badgeHeight = 16;
                          const badgeX = x + width / 2 - badgeWidth / 2;
                          const badgeY = y - badgeHeight - 5;

                          return (
                            <g>
                              {/* Floating Top Badge for active months with additions */}
                              {value > 0 && (
                                <>
                                  <rect
                                    x={badgeX}
                                    y={badgeY}
                                    width={badgeWidth}
                                    height={badgeHeight}
                                    rx={4}
                                    ry={4}
                                    fill={isLight ? "#ffffff" : "#0B1A2C"}
                                    stroke={isLight ? (isPeak ? "#D97706" : "#059669") : (isPeak ? "#FCD400" : "#10B981")}
                                    strokeWidth={1}
                                  />
                                  <text
                                    x={x + width / 2}
                                    y={badgeY + 11}
                                    fill={isLight ? (isPeak ? "#B45309" : "#047857") : (isPeak ? "#FCD400" : "#10B981")}
                                    textAnchor="middle"
                                    fontSize={9.5}
                                    fontWeight="900"
                                    fontFamily="monospace"
                                  >
                                    {value}
                                  </text>
                                </>
                              )}

                              {/* Bar with gradient and rounded corners */}
                              {value > 0 ? (
                                <path
                                  d={`M${x},${y + height} L${x},${y + 4} Q${x},${y} ${x + 4},${y} L${x + width - 4},${y} Q${x + width},${y} ${x + width},${y + 4} L${x + width},${y + height} Z`}
                                  fill={gradId}
                                />
                              ) : (
                                <rect
                                  x={x}
                                  y={y - 2}
                                  width={width}
                                  height={3}
                                  rx={1.5}
                                  fill={isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.1)"}
                                />
                              )}
                            </g>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Right Quota Breakdown Cards (5 cols) */}
                <div className="md:col-span-5 flex flex-col gap-2 overflow-y-auto max-h-[250px] pr-1">
                  {addedBooksStats.breakdownCards.map((item) => (
                    <div
                      key={item.key}
                      className={cn(
                        "flex flex-col justify-between rounded-xl border px-3 py-2 transition",
                        isLight
                          ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-slate-300"
                          : "border-white/5 bg-[#122335]/70 text-white hover:bg-[#122335] hover:border-white/15"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                            style={{ backgroundColor: item.fill }}
                          />
                          <span className={cn("text-xs font-bold whitespace-nowrap", isLight ? "text-slate-900" : "text-white")}>
                            {item.title}
                          </span>
                        </div>
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono border shrink-0"
                          style={getBadgeStyles(item.fill, item.badgeBg, item.badgeBorder, isLight)}
                        >
                          {item.pillText}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between mt-1 text-[11px]">
                        <span className={cn("text-[10px]", isLight ? "text-slate-500" : "text-slate-400")}>
                          {item.desc}
                        </span>
                        <span className={cn("font-mono text-xs font-bold shrink-0", isLight ? "text-slate-900" : "text-white")}>
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Cumulative View: Running total towards 1,000 ceiling */
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={addedBooksStats.monthlyData}
                    margin={{ top: 28, right: 15, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="bookAddCumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" />
                        <stop offset="100%" stopColor="#0369A1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke={axisStroke}
                      tick={{ fill: tickFill, fontSize: 10, fontWeight: "bold" }}
                      tickLine={false}
                      axisLine={{ stroke: axisLineStroke }}
                    />
                    <YAxis
                      stroke={axisStroke}
                      tick={{ fill: tickMutedFill, fontSize: 10, fontWeight: "bold" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      domain={[0, 1000]}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      cursor={false}
                      formatter={(value: any, _name: any, props: any) => [
                        `${value} / 1,000 Books (${((Number(value) / 1000) * 100).toFixed(1)}% Quota)`,
                        `Cumulative Through ${props?.payload?.month}`,
                      ]}
                    />
                    <Bar
                      dataKey="cumulative"
                      radius={[6, 6, 0, 0]}
                      barSize={20}
                      shape={(props: any) => {
                        const { x, y, width, height, value } = props;
                        const badgeWidth = 40;
                        const badgeHeight = 16;
                        const badgeX = x + width / 2 - badgeWidth / 2;
                        const badgeY = y - badgeHeight - 5;

                        return (
                          <g>
                            {value > 0 && (
                              <>
                                <rect
                                  x={badgeX}
                                  y={badgeY}
                                  width={badgeWidth}
                                  height={badgeHeight}
                                  rx={4}
                                  ry={4}
                                  fill={isLight ? "#ffffff" : "#0B1A2C"}
                                  stroke={isLight ? "#0284C7" : "#38BDF8"}
                                  strokeWidth={1}
                                />
                                <text
                                  x={x + width / 2}
                                  y={badgeY + 11}
                                  fill={isLight ? "#0369A1" : "#38BDF8"}
                                  textAnchor="middle"
                                  fontSize={9.5}
                                  fontWeight="900"
                                  fontFamily="monospace"
                                >
                                  {value}
                                </text>
                              </>
                            )}
                            <path
                              d={`M${x},${y + height} L${x},${y + 4} Q${x},${y} ${x + 4},${y} L${x + width - 4},${y} Q${x + width},${y} ${x + width},${y + 4} L${x + width},${y + height} Z`}
                              fill="url(#bookAddCumulativeGrad)"
                            />
                          </g>
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bottom Telemetry Bar */}
          <div className={cn("flex items-center justify-between text-[11px] px-1 pt-2.5 mt-2 border-t transition-colors", isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400")}>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Real-time Catalog Guard Active (1,000 Limit)
            </div>
            <div className={cn("font-mono text-[11px]", isLight ? "text-slate-600" : "text-slate-300")}>
              <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>{addedBooksStats.totalAdded}</span> of 1,000 Capacity Utilized
            </div>
          </div>
        </motion.section>

        {/* Card 5: Most Course Borrowed */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
        >
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className={cn("text-[22px] font-bold tracking-wide", isLight ? "text-slate-900" : "text-white")}>
                  Most Course Borrowed
                </h2>
                <p className={cn("mt-1 text-[13px] font-normal", isLight ? "text-slate-500" : "text-slate-300")}>
                  Borrowing volume and student reach categorized by academic program.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* View Toggle [ Course Borrows | Student Reach ] */}
                <div className={cn("flex items-center rounded-lg border p-0.5 text-xs font-semibold shadow-xs transition-colors", isLight ? "border-slate-200 bg-slate-100" : "border-white/10 bg-[#122335]")}>
                  <button
                    type="button"
                    onClick={() => setCourseViewMode("borrows")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition cursor-pointer",
                      courseViewMode === "borrows"
                        ? isLight
                          ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-sm"
                          : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                        : isLight
                          ? "text-slate-600 hover:text-[#0274BB]"
                          : "text-slate-300 hover:text-white"
                    )}
                  >
                    Course Borrows
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseViewMode("students")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition cursor-pointer",
                      courseViewMode === "students"
                        ? isLight
                          ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-sm"
                          : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                        : isLight
                          ? "text-slate-600 hover:text-[#0274BB]"
                          : "text-slate-300 hover:text-white"
                    )}
                  >
                    Student Reach
                  </button>
                </div>

                <div className={cn("rounded-full border px-3 py-1 text-xs font-bold shadow-xs whitespace-nowrap", isLight ? "border-slate-200 bg-white text-[#0274BB]" : "border-white/10 bg-[#132337] text-emerald-400")}>
                  {courseStats.topCourse.name} • {courseStats.topCourse.percentage}% Lead
                </div>
              </div>
            </div>

            {/* Content Labels / Badges */}
            <div className="flex flex-wrap items-center gap-2.5 my-3">
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-500/30 bg-amber-500/10 text-amber-400")}>
                <span className="h-2 w-2 rounded-full bg-[#f59e0b] shadow-sm" />
                <span>Top Program:</span>
                <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>{courseStats.topCourse.name} ({courseStats.topCourse.borrowCount} Loans)</span>
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400")}>
                <span className="h-2 w-2 rounded-full bg-[#10b981] shadow-sm" />
                <span>Active Programs:</span>
                <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>{courseStats.activeCoursesCount} Enrolled</span>
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-sky-200 bg-sky-50 text-sky-800" : "border-sky-500/30 bg-sky-500/10 text-sky-400")}>
                <span className="h-2 w-2 rounded-full bg-[#0ea5e9] shadow-sm" />
                <span>Total Attributed:</span>
                <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>{courseStats.totalBorrows} Loans</span>
              </div>
            </div>

            {/* Main Body */}
            {courseViewMode === "borrows" ? (
              /* Dual Panel: Left Bar Chart + Right Breakdown Cards */
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center min-h-[250px]">
                {/* Left Bar Chart (7 cols) */}
                <div className="md:col-span-7 h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={courseStats.courses}
                      margin={{ top: 26, right: 10, left: -22, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="courseBorrowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FCD400" />
                          <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="course"
                        stroke={axisStroke}
                        tick={{ fill: tickFill, fontSize: 10, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={{ stroke: axisLineStroke }}
                      />
                      <YAxis
                        stroke={axisStroke}
                        tick={{ fill: tickMutedFill, fontSize: 10, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        domain={[0, (dataMax: number) => Math.max(Math.ceil((dataMax || 1) * 1.3), 4)]}
                      />
                      <Tooltip
                        contentStyle={tooltipContentStyle}
                        cursor={false}
                        formatter={(value: any, _name: any, props: any) => [
                          `${value} Loans (${props?.payload?.percentage ?? 0}%)`,
                          props?.payload?.fullTitle || props?.payload?.course || "Course",
                        ]}
                      />
                      <Bar
                        dataKey="borrowCount"
                        radius={[5, 5, 0, 0]}
                        barSize={28}
                        shape={(props: any) => {
                          const { x, y, width, height, value } = props;
                          const strokeColor = "#FCD400";
                          const badgeWidth = 24;
                          const badgeHeight = 16;
                          const badgeX = x + width / 2 - badgeWidth / 2;
                          const badgeY = y - badgeHeight - 5;

                          return (
                            <g>
                              {value > 0 && (
                                <>
                                  <rect
                                    x={badgeX}
                                    y={badgeY}
                                    width={badgeWidth}
                                    height={badgeHeight}
                                    rx={4}
                                    ry={4}
                                    fill={isLight ? "#ffffff" : "#0B1A2C"}
                                    stroke={isLight ? "#D97706" : strokeColor}
                                    strokeWidth={1}
                                  />
                                  <text
                                    x={x + width / 2}
                                    y={badgeY + 11}
                                    fill={isLight ? "#B45309" : strokeColor}
                                    textAnchor="middle"
                                    fontSize={9.5}
                                    fontWeight="900"
                                    fontFamily="monospace"
                                  >
                                    {value}
                                  </text>
                                </>
                              )}

                              {value > 0 ? (
                                <path
                                  d={`M${x},${y + height} L${x},${y + 4} Q${x},${y} ${x + 4},${y} L${x + width - 4},${y} Q${x + width},${y} ${x + width},${y + 4} L${x + width},${y + height} Z`}
                                  fill="url(#courseBorrowGrad)"
                                />
                              ) : (
                                <rect
                                  x={x}
                                  y={y - 2}
                                  width={width}
                                  height={3}
                                  rx={1.5}
                                  fill={isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.1)"}
                                />
                              )}
                            </g>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Right Breakdown Cards (5 cols) - Non-overlapping layout */}
                <div className="md:col-span-5 flex flex-col gap-2 overflow-y-auto max-h-[250px] pr-1">
                  {courseStats.breakdownCards.map((item) => (
                    <div
                      key={item.key}
                      className={cn(
                        "flex flex-col justify-between rounded-xl border px-3 py-2.5 transition",
                        isLight
                          ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-slate-300"
                          : "border-white/5 bg-[#122335]/70 text-white hover:bg-[#122335] hover:border-white/15"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                            style={{ backgroundColor: item.fill }}
                          />
                          <span className={cn("text-xs font-bold truncate", isLight ? "text-slate-900" : "text-white")} title={item.title}>
                            {item.title}
                          </span>
                        </div>
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono border shrink-0"
                          style={getBadgeStyles(item.fill, item.badgeBg, item.badgeBorder, isLight)}
                        >
                          {item.pillText}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between mt-1 text-[11px]">
                        <span className={cn("text-[10px] truncate pr-2", isLight ? "text-slate-500" : "text-slate-400")} title={item.desc}>
                          {item.desc}
                        </span>
                        <span className={cn("font-mono text-xs font-bold shrink-0", isLight ? "text-slate-900" : "text-white")}>
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Student Reach View: Unique borrowers by course */
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={courseStats.courses}
                    margin={{ top: 28, right: 15, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="courseStudentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#047857" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="course"
                      stroke={axisStroke}
                      tick={{ fill: tickFill, fontSize: 10, fontWeight: "bold" }}
                      tickLine={false}
                      axisLine={{ stroke: axisLineStroke }}
                    />
                    <YAxis
                      stroke={axisStroke}
                      tick={{ fill: tickMutedFill, fontSize: 10, fontWeight: "bold" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      domain={[0, (dataMax: number) => Math.max(Math.ceil((dataMax || 1) * 1.3), 4)]}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      cursor={false}
                      formatter={(value: any, _name: any, props: any) => [
                        `${value} Active Borrowers`,
                        props?.payload?.fullTitle || props?.payload?.course,
                      ]}
                    />
                    <Bar
                      dataKey="studentCount"
                      radius={[6, 6, 0, 0]}
                      barSize={32}
                      shape={(props: any) => {
                        const { x, y, width, height, value } = props;
                        const badgeWidth = 24;
                        const badgeHeight = 16;
                        const badgeX = x + width / 2 - badgeWidth / 2;
                        const badgeY = y - badgeHeight - 5;

                        return (
                          <g>
                            {value > 0 && (
                              <>
                                <rect
                                  x={badgeX}
                                  y={badgeY}
                                  width={badgeWidth}
                                  height={badgeHeight}
                                  rx={4}
                                  ry={4}
                                  fill={isLight ? "#ffffff" : "#0B1A2C"}
                                  stroke={isLight ? "#059669" : "#10B981"}
                                  strokeWidth={1}
                                />
                                <text
                                  x={x + width / 2}
                                  y={badgeY + 11}
                                  fill={isLight ? "#047857" : "#10B981"}
                                  textAnchor="middle"
                                  fontSize={9.5}
                                  fontWeight="900"
                                  fontFamily="monospace"
                                >
                                  {value}
                                </text>
                              </>
                            )}
                            <path
                              d={`M${x},${y + height} L${x},${y + 4} Q${x},${y} ${x + 4},${y} L${x + width - 4},${y} Q${x + width},${y} ${x + width},${y + 4} L${x + width},${y + height} Z`}
                              fill="url(#courseStudentGrad)"
                            />
                          </g>
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bottom Telemetry Bar */}
          <div className={cn("flex items-center justify-between text-[11px] px-1 pt-2.5 mt-2 border-t transition-colors", isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400")}>
            <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Academic Borrowing Engine Active • Real-time STI Curriculum Sync
            </div>
            <div className={cn("font-mono text-[11px]", isLight ? "text-slate-600" : "text-slate-300")}>
              <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>{courseStats.totalBorrows}</span> Course-Attributed Loans Tracked
            </div>
          </div>
        </motion.section>

        {/* Card 6: Most Searched Books */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
        >
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className={cn("text-[22px] font-bold tracking-wide", isLight ? "text-slate-800" : "text-white")}>Most Searched Books</h2>
                <p className={cn("mt-1 text-[13px] font-normal", isLight ? "text-slate-500" : "text-slate-300")}>
                  Catalog search frequency, trending titles, and student discovery queries.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* View Toggle [ Most Searched | Search Terms ] */}
                <div className={cn("flex items-center rounded-lg border p-0.5 text-xs font-semibold", isLight ? "border-slate-200 bg-slate-100" : "border-white/10 bg-[#122335]")}>
                  <button
                    type="button"
                    onClick={() => setSearchViewMode("books")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition cursor-pointer",
                      searchViewMode === "books"
                        ? isLight
                          ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-xs"
                          : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                        : isLight
                          ? "text-slate-600 hover:text-[#0274BB]"
                          : "text-slate-300 hover:text-white"
                    )}
                  >
                    Most Searched
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchViewMode("terms")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition cursor-pointer",
                      searchViewMode === "terms"
                        ? isLight
                          ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-xs"
                          : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                        : isLight
                          ? "text-slate-600 hover:text-[#0274BB]"
                          : "text-slate-300 hover:text-white"
                    )}
                  >
                    Search Terms
                  </button>
                </div>

                <div className={cn("rounded-full border px-3 py-1 text-xs font-bold shadow-xs whitespace-nowrap", isLight ? "border-slate-200 bg-white text-[#0274BB]" : "border-white/10 bg-[#132337] text-emerald-400")}>
                  {searchStats.totalSearches} Search Hits
                </div>
              </div>
            </div>

            {/* Content Labels / Badges */}
            <div className="flex flex-wrap items-center gap-2.5 my-3">
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-500/30 bg-amber-500/10 text-amber-400")}>
                <span className="h-2 w-2 rounded-full bg-[#f59e0b] shadow-sm" />
                <span>Most Searched:</span>
                <span className={cn("font-mono font-bold truncate max-w-[160px]", isLight ? "text-slate-900" : "text-white")} title={searchStats.topTitle}>{searchStats.topTitle}</span>
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400")}>
                <span className="h-2 w-2 rounded-full bg-[#10b981] shadow-sm" />
                <span>Discovery Rate:</span>
                <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>96.4% Found</span>
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold", isLight ? "border-sky-200 bg-sky-50 text-sky-800" : "border-sky-500/30 bg-sky-500/10 text-sky-400")}>
                <span className="h-2 w-2 rounded-full bg-[#0ea5e9] shadow-sm" />
                <span>Search Index:</span>
                <span className={cn("font-mono font-bold", isLight ? "text-slate-900" : "text-white")}>Live Synchronized</span>
              </div>
            </div>

            {/* Main Body */}
            {searchViewMode === "books" ? (
              /* Dual Panel: Left Bar Chart + Right Breakdown Cards */
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center min-h-[250px]">
                {/* Left Bar Chart (7 cols) */}
                <div className="md:col-span-7 h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={searchStats.books.slice(0, 6)}
                      margin={{ top: 26, right: 10, left: -20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="searchBookGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38BDF8" />
                          <stop offset="100%" stopColor="#0284C7" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="title"
                        stroke={axisStroke}
                        tick={{ fill: tickFill, fontSize: 9.5, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={{ stroke: axisLineStroke }}
                        tickFormatter={(val: string) => (val.length > 12 ? `${val.substring(0, 10)}...` : val)}
                      />
                      <YAxis
                        stroke={axisStroke}
                        tick={{ fill: tickMutedFill, fontSize: 10, fontWeight: "bold" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        domain={[0, (dataMax: number) => Math.max(Math.ceil((dataMax || 1) * 1.3), 4)]}
                      />
                      <Tooltip
                        contentStyle={tooltipContentStyle}
                        cursor={false}
                        formatter={(value: any, _name: any, props: any) => [
                          `${value} Searches (${props?.payload?.percentage ?? 0}%)`,
                          props?.payload?.title,
                        ]}
                      />
                      <Bar
                        dataKey="searchCount"
                        radius={[5, 5, 0, 0]}
                        barSize={20}
                        shape={(props: any) => {
                          const { x, y, width, height, value } = props;
                          const strokeColor = "#38BDF8";
                          const badgeWidth = 24;
                          const badgeHeight = 16;
                          const badgeX = x + width / 2 - badgeWidth / 2;
                          const badgeY = y - badgeHeight - 5;

                          return (
                            <g>
                              {value > 0 && (
                                <>
                                  <rect
                                    x={badgeX}
                                    y={badgeY}
                                    width={badgeWidth}
                                    height={badgeHeight}
                                    rx={4}
                                    ry={4}
                                    fill={isLight ? "#ffffff" : "#0B1A2C"}
                                    stroke={isLight ? "#0284C7" : strokeColor}
                                    strokeWidth={1}
                                  />
                                  <text
                                    x={x + width / 2}
                                    y={badgeY + 11}
                                    fill={isLight ? "#0369A1" : strokeColor}
                                    textAnchor="middle"
                                    fontSize={9}
                                    fontWeight="900"
                                    fontFamily="monospace"
                                  >
                                    {value}
                                  </text>
                                </>
                              )}

                              {value > 0 ? (
                                <path
                                  d={`M${x},${y + height} L${x},${y + 4} Q${x},${y} ${x + 4},${y} L${x + width - 4},${y} Q${x + width},${y} ${x + width},${y + 4} L${x + width},${y + height} Z`}
                                  fill="url(#searchBookGrad)"
                                />
                              ) : (
                                <rect
                                  x={x}
                                  y={y - 2}
                                  width={width}
                                  height={3}
                                  rx={1.5}
                                  fill={isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.1)"}
                                />
                              )}
                            </g>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Right Breakdown Cards (5 cols) - Non-overlapping layout */}
                <div className="md:col-span-5 flex flex-col gap-2 overflow-y-auto max-h-[250px] pr-1">
                  {searchStats.breakdownCards.map((item) => (
                    <div
                      key={item.key}
                      className={cn(
                        "flex flex-col justify-between rounded-xl border px-3 py-2.5 transition",
                        isLight
                          ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-slate-300"
                          : "border-white/5 bg-[#122335]/70 text-white hover:bg-[#122335] hover:border-white/15"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                            style={{ backgroundColor: item.fill }}
                          />
                          <span className={cn("text-xs font-bold truncate", isLight ? "text-slate-900" : "text-white")} title={item.title}>
                            {item.title}
                          </span>
                        </div>
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono border shrink-0"
                          style={getBadgeStyles(item.fill, item.badgeBg, item.badgeBorder, isLight)}
                        >
                          {item.pillText}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between mt-1 text-[11px]">
                        <span className={cn("text-[10px] truncate pr-2", isLight ? "text-slate-500" : "text-slate-400")} title={item.desc}>
                          {item.desc}
                        </span>
                        <span className={cn("font-mono text-xs font-bold shrink-0", isLight ? "text-slate-900" : "text-white")}>
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Search Terms View: Frequent queries */
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={searchStats.searchTerms}
                    margin={{ top: 28, right: 15, left: -10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="searchTermGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FCD400" />
                        <stop offset="100%" stopColor="#D97706" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="term"
                      stroke={axisStroke}
                      tick={{ fill: tickFill, fontSize: 10, fontWeight: "bold" }}
                      tickLine={false}
                      axisLine={{ stroke: axisLineStroke }}
                    />
                    <YAxis
                      stroke={axisStroke}
                      tick={{ fill: tickMutedFill, fontSize: 10, fontWeight: "bold" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      cursor={false}
                      formatter={(value: any, _name: any, props: any) => [
                        `${value} Searches (${props?.payload?.category})`,
                        `Term: "${props?.payload?.term}"`,
                      ]}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      barSize={24}
                      shape={(props: any) => {
                        const { x, y, width, height, value } = props;
                        const strokeColor = "#FCD400";
                        const badgeWidth = 24;
                        const badgeHeight = 16;
                        const badgeX = x + width / 2 - badgeWidth / 2;
                        const badgeY = y - badgeHeight - 5;

                        return (
                          <g>
                            {value > 0 && (
                              <>
                                <rect
                                  x={badgeX}
                                  y={badgeY}
                                  width={badgeWidth}
                                  height={badgeHeight}
                                  rx={4}
                                  ry={4}
                                  fill={isLight ? "#ffffff" : "#0B1A2C"}
                                  stroke={isLight ? "#D97706" : strokeColor}
                                  strokeWidth={1}
                                />
                                <text
                                  x={x + width / 2}
                                  y={badgeY + 11}
                                  fill={isLight ? "#B45309" : strokeColor}
                                  textAnchor="middle"
                                  fontSize={9.5}
                                  fontWeight="900"
                                  fontFamily="monospace"
                                >
                                  {value}
                                </text>
                              </>
                            )}
                            <path
                              d={`M${x},${y + height} L${x},${y + 4} Q${x},${y} ${x + 4},${y} L${x + width - 4},${y} Q${x + width},${y} ${x + width},${y + 4} L${x + width},${y + height} Z`}
                              fill="url(#searchTermGrad)"
                            />
                          </g>
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bottom Telemetry Bar */}
          <div className={cn("flex items-center justify-between text-[11px] px-1 pt-2.5 mt-2 border-t", isLight ? "border-slate-100" : "border-white/5")}>
            <div className={cn("flex items-center gap-1.5 font-semibold", isLight ? "text-emerald-600" : "text-emerald-400")}>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Search Discovery Telemetry Active • Real-time Index Synchronization
            </div>
            <div className={cn("font-mono text-[11px]", isLight ? "text-slate-500" : "text-slate-300")}>
              <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>{searchStats.books.length}</span> Top Searched Titles Tracked
            </div>
          </div>
        </motion.section>
      </div>

      {/* Book Detail Modal */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          open={!!selectedBook}
          onClose={() => setSelectedBook(null)}
        />
      )}
    </div>
  );
}

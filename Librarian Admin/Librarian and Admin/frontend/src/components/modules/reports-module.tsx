"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Filter,
  Layers,
  PieChart as PieIcon,
  Printer,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { cn, downloadCsv } from "@/lib/utils";
import type { Department, ReportsPayload } from "@/lib/types";
import { useSession } from "@/components/providers/session-provider";
import dashboardSocket from "@/lib/socket";

/* ── Color Themes ────────────────────────────────────────────────────────── */
const PALETTE = {
  emerald: "#10B981",
  sky: "#38BDF8",
  blue: "#38BDF8",
  amber: "#F59E0B",
  rose: "#F43F5E",
  purple: "#A855F7",
  indigo: "#6366F1",
  teal: "#14B8A6",
  yellow: "#FCD400",
};

// Colors strictly matched to Transactions Status cards (1st picture)
const STATUS_COLORS: Record<string, string> = {
  Pending: "#FBBF24",      // Yellow (Pending card)
  Approved: "#10B981",     // Emerald Green (Approved card)
  Declined: "#EF4444",     // Red (Declined card)
  Returned: "#38BDF8",     // Blue (Returned card)
  Reservations: "#8B5CF6", // Purple (Reservations card)
  Cancelled: "#F43F5E",    // Rose/Red
};

const DEPT_COLORS: Record<string, string> = {
  Circulation: "#FCD400",
  "General Reference": "#38BDF8",
  Filipiniana: "#10B981",
  Reserve: "#F59E0B",
  Periodical: "#A855F7",
  "Special Collections": "#EC4899",
};

export const COLLEGE_COLORS: Record<string, string> = {
  CICT: "#EF4444",
  COE: "#FF6B00",
  CBMA: "#EAB308",
  CAS: "#10B981",
  CED: "#3B82F6",
  CHTM: "#EC4899",
  CCJE: "#8B5CF6",
};

export const STANDARDIZED_COLLEGES = [
  { code: "CICT", name: "CICT", mascot: "Red Sentinels", color: "#EF4444" },
  { code: "COE", name: "COE", mascot: "Orange Erudites", color: "#FF6B00" },
  { code: "CBMA", name: "CBMA", mascot: "Yellow Tycoons", color: "#EAB308" },
  { code: "CAS", name: "CAS", mascot: "Green Titans", color: "#10B981" },
  { code: "CED", name: "CED", mascot: "Blue Guardians", color: "#3B82F6" },
  { code: "CHTM", name: "CHTM", mascot: "Pink Vikings", color: "#EC4899" },
  { code: "CCJE", name: "CCJE", mascot: "Purple Wizards", color: "#8B5CF6" },
];

function resolveCollege(str?: string | null): string {
  if (!str) return "CICT";
  const s = String(str).toUpperCase().trim();
  if (s.includes("CICT") || s.includes("INFORMATION") || s.includes("BSIT") || s.includes("CS") || s.includes("TECH") || s.includes("TIME TRAVEL") || s.includes("COMPUTER")) return "CICT";
  if (s.includes("COE") || s.includes("ENGINEERING") || s.includes("BSCE") || s.includes("CPE") || s.includes("CIVIL") || s.includes("ELECTRICAL") || s.includes("MECHANICAL")) return "COE";
  if (s.includes("CBMA") || s.includes("BUSINESS") || s.includes("ACCOUNTANCY") || s.includes("BSA") || s.includes("BSBA") || s.includes("MANAGEMENT") || s.includes("MARKETING")) return "CBMA";
  if (s.includes("CAS") || s.includes("ARTS") || s.includes("SCIENCES") || s.includes("COMM") || s.includes("BACOMM") || s.includes("PSYCH") || s.includes("POLITICAL")) return "CAS";
  if (s.includes("CED") || s.includes("EDUCATION") || s.includes("BSED") || s.includes("BEED") || s.includes("TEACHER")) return "CED";
  if (s.includes("CHTM") || s.includes("HOSPITALITY") || s.includes("TOURISM") || s.includes("BSTM") || s.includes("BSHM") || s.includes("HOTEL") || s.includes("RESTAURANT")) return "CHTM";
  if (s.includes("CCJE") || s.includes("CRIMINAL") || s.includes("JUSTICE") || s.includes("CRIM") || s.includes("BSCRIM") || s.includes("LAW ENFORCEMENT")) return "CCJE";
  return "CICT";
}

/* ── Custom Interactive Tooltip ─────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-white/15 bg-[#0A1624]/95 p-3.5 shadow-2xl backdrop-blur-md select-none pointer-events-none">
        {label && <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">{label}</p>}
        <div className="mt-2 space-y-1.5">
          {payload.map((p: any) => {
            const dotColor =
              COLLEGE_COLORS[p.name] ||
              COLLEGE_COLORS[p.payload?.code] ||
              DEPT_COLORS[p.name] ||
              DEPT_COLORS[p.payload?.department] ||
              STATUS_COLORS[p.name] ||
              p.color ||
              p.fill ||
              PALETTE.emerald;

            let formattedVal =
              p.unit
                ? `${Number(p.value).toLocaleString()}${p.unit}`
                : p.name === "Demand Share"
                ? `${Number(p.value).toLocaleString()}%`
                : Number(p.value).toLocaleString();

            const displayName =
              p.payload?.mascot && p.payload?.code
                ? `${p.payload.code} (${p.payload.mascot})`
                : p.name;

            if (
              p.payload?.percentage !== undefined &&
              (p.name === "Borrows" || p.dataKey === "borrows" || p.payload?.department || p.payload?.code)
            ) {
              formattedVal = `${Number(p.value).toLocaleString()} ${Number(p.value) === 1 ? "loan" : "loans"} (${p.payload.percentage}%)`;
            } else if (p.payload?.percentage !== undefined) {
              formattedVal = `${Number(p.value).toLocaleString()} (${p.payload.percentage}%)`;
            } else if (p.name === "Demand Share" && p.payload?.count !== undefined) {
              const c = p.payload.count;
              formattedVal = `${Number(p.value).toLocaleString()}% (${c} ${c === 1 ? "circulation action" : "circulation actions"})`;
            } else if (p.name === "Borrows" || p.dataKey === "borrows") {
              const b = Number(p.value);
              formattedVal = `${b} ${b === 1 ? "loan" : "loans"}`;
            }

            return (
              <div key={p.name} className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: dotColor }}
                  />
                  {displayName}:
                </span>
                <span className="font-mono font-bold text-white">{formattedVal}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

export function ReportsModule() {
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "trends" | "distribution" | "leaderboard">("all");
  const [timeframe, setTimeframe] = useState<"6m" | "30d" | "year">("6m");
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [deptViewMode, setDeptViewMode] = useState<"breakdown" | "chart">("breakdown");
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  const { user } = useSession();
  const lastPayloadRef = useRef<string>("");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDeptDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const [response, txRes] = await Promise.all([
        fetch("/api/reports"),
        fetch("/api/transactions?status=All&type=All"),
      ]);

      if (!response.ok) return;
      let payload = (await response.json()) as ReportsPayload;

      // Real-time synchronization from live transactions matching Transactions Module exactly
      if (txRes.ok) {
        const txData = await txRes.json();
        const txList: any[] = Array.isArray(txData?.transactions)
          ? txData.transactions
          : Array.isArray(txData)
          ? txData
          : [];

        if (txList.length > 0) {
          const isPendingBorrow = (tx: any) => {
            const type = (tx.type || tx.action || "").toLowerCase();
            const status = (tx.status || "").toLowerCase();
            return type === "borrow" && status === "pending";
          };

          const isApprovedBorrow = (tx: any) => {
            const type = (tx.type || tx.action || "").toLowerCase();
            const status = (tx.status || "").toLowerCase();
            return type === "borrow" && status === "approved";
          };

          const isDeclinedRecord = (tx: any) => {
            const status = (tx.status || "").toLowerCase();
            return status === "declined";
          };

          const isReturnedBorrow = (tx: any) => {
            const type = (tx.type || tx.action || "").toLowerCase();
            const status = (tx.status || "").toLowerCase();
            return type === "borrow" && status === "returned";
          };

          const isActiveReservation = (tx: any) => {
            const type = (tx.type || tx.action || "").toLowerCase();
            const status = (tx.status || "").toLowerCase();
            return (
              type === "reservation" &&
              ["pending", "approved", "active", "waitlisted"].includes(status)
            );
          };

          const isCancelledRecord = (tx: any) => {
            const status = (tx.status || "").toLowerCase();
            return status === "cancelled";
          };

          const pendingCount = txList.filter(isPendingBorrow).length;
          const approvedCount = txList.filter(isApprovedBorrow).length;
          const declinedCount = txList.filter(isDeclinedRecord).length;
          const returnedCount = txList.filter(isReturnedBorrow).length;
          const reservationsCount = txList.filter(isActiveReservation).length;

          // Strictly the 5 circulation queue metrics from Transactions page (1:1 sync):
          const totalTx = pendingCount + approvedCount + declinedCount + returnedCount + reservationsCount;

          const realTimeStatusBreakdown = [
            {
              status: "Pending",
              count: pendingCount,
              percentage: totalTx > 0 ? Math.round((pendingCount / totalTx) * 100) : 0,
            },
            {
              status: "Approved",
              count: approvedCount,
              percentage: totalTx > 0 ? Math.round((approvedCount / totalTx) * 100) : 0,
            },
            {
              status: "Declined",
              count: declinedCount,
              percentage: totalTx > 0 ? Math.round((declinedCount / totalTx) * 100) : 0,
            },
            {
              status: "Returned",
              count: returnedCount,
              percentage: totalTx > 0 ? Math.round((returnedCount / totalTx) * 100) : 0,
            },
            {
              status: "Reservations",
              count: reservationsCount,
              percentage: totalTx > 0 ? Math.round((reservationsCount / totalTx) * 100) : 0,
            },
          ];

          // Real-time Academic Section Demand Share from transactions
          const ALL_DEPTS: Department[] = ["Circulation", "General Reference", "Filipiniana", "Reserve", "Periodical", "Special Collections"];
          const deptCounts: Record<string, number> = {
            Circulation: 0,
            "General Reference": 0,
            Filipiniana: 0,
            Reserve: 0,
            Periodical: 0,
            "Special Collections": 0,
          };

          let totalDeptActions = 0;
          txList.forEach((tx: any) => {
            const rawBookDept = tx.bookDepartment || tx.section || "";
            const matchedDept =
              ALL_DEPTS.find((d) => d.toLowerCase() === rawBookDept.toLowerCase()) ||
              ALL_DEPTS.find((d) => d.toLowerCase() === (tx.department || "").toLowerCase()) ||
              (String(tx.resourceTitle || "").toLowerCase().includes("brichoox") ? "Special Collections" :
               String(tx.resourceTitle || "").toLowerCase().includes("yana") ? "Filipiniana" : "Circulation");

            if (matchedDept && deptCounts[matchedDept] !== undefined) {
              deptCounts[matchedDept]++;
              totalDeptActions++;
            }
          });

          const realTimeDeptUsage = ALL_DEPTS.map((dept) => {
            const count = deptCounts[dept] || 0;
            return {
              department: dept,
              usage: totalDeptActions > 0 ? Math.round((count / totalDeptActions) * 100) : 0,
              count,
            };
          });

          // Real-time Department Borrowed Books (loans) from transactions
          const deptBorrowCounts: Record<string, number> = {
            Circulation: 0,
            "General Reference": 0,
            Filipiniana: 0,
            Reserve: 0,
            Periodical: 0,
            "Special Collections": 0,
          };

          let totalDeptBorrows = 0;
          txList.forEach((tx: any) => {
            const type = (tx.type || tx.action || "").toLowerCase();
            if (type === "borrow") {
              const rawBookDept = tx.bookDepartment || tx.section || "";
              const matchedDept =
                ALL_DEPTS.find((d) => d.toLowerCase() === rawBookDept.toLowerCase()) ||
                ALL_DEPTS.find((d) => d.toLowerCase() === (tx.department || "").toLowerCase()) ||
                (String(tx.resourceTitle || "").toLowerCase().includes("brichoox") ? "Special Collections" :
                 String(tx.resourceTitle || "").toLowerCase().includes("yana") || String(tx.resourceTitle || "").toLowerCase().includes("adarna") ? "Filipiniana" : "Circulation");

              if (matchedDept && deptBorrowCounts[matchedDept] !== undefined) {
                deptBorrowCounts[matchedDept]++;
                totalDeptBorrows++;
              }
            }
          });

          const realTimeDeptLoans = ALL_DEPTS.map((dept) => {
            const borrows = deptBorrowCounts[dept] || 0;
            return {
              department: dept,
              borrows,
              percentage: totalDeptBorrows > 0 ? Math.round((borrows / totalDeptBorrows) * 100) : 0,
            };
          });

          // Real-time Academic College Borrow Counts (CICT, COE, CBMA, CAS, CED, CHTM, CCJE)
          const liveCollegeCounts: Record<string, number> = {
            CICT: 0, COE: 0, CBMA: 0, CAS: 0, CED: 0, CHTM: 0, CCJE: 0,
          };
          let totalCollegeBorrows = 0;
          txList.forEach((tx: any) => {
            const type = (tx.type || tx.action || "").toLowerCase();
            if (type === "borrow") {
              const code =
                resolveCollege(tx.userDepartment) ||
                resolveCollege(tx.userCourse) ||
                resolveCollege(tx.department) ||
                "CICT";
              if (liveCollegeCounts[code] !== undefined) {
                liveCollegeCounts[code]++;
                totalCollegeBorrows++;
              }
            }
          });

          const realTimeCollegeLoans = STANDARDIZED_COLLEGES.map((c) => ({
            ...c,
            borrows: liveCollegeCounts[c.code] || 0,
            percentage: totalCollegeBorrows > 0 ? Math.round(((liveCollegeCounts[c.code] || 0) / totalCollegeBorrows) * 100) : 0,
          }));

          payload = {
            ...payload,
            statusBreakdown: realTimeStatusBreakdown,
            departmentUsage: realTimeDeptUsage,
            departmentLoans: realTimeDeptLoans,
            collegeLoans: realTimeCollegeLoans,
          };
        }
      }

      const serialized = JSON.stringify(payload);
      if (lastPayloadRef.current !== serialized) {
        lastPayloadRef.current = serialized;
        startTransition(() => {
          setReports(payload);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.warn("Failed to load reports:", err);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();

    // Live socket subscriptions for instant real-time data sync
    const unsubBorrow = dashboardSocket.subscribeToBorrowRequest(() => void loadReports());
    const unsubReturn = dashboardSocket.subscribeToReturn(() => void loadReports());
    const unsubCancel = dashboardSocket.subscribeToCancelRequest(() => void loadReports());
    const unsubNotif = dashboardSocket.subscribeToNotification(() => void loadReports());

    // Continuous heartbeat polling to ensure live updates across all sessions
    const interval = setInterval(() => {
      void loadReports();
    }, 4000);

    return () => {
      clearInterval(interval);
      unsubBorrow?.();
      unsubReturn?.();
      unsubCancel?.();
      unsubNotif?.();
    };
  }, [loadReports]);

  /* ── Computed Metrics & Data Formatting ────────────────────────────────── */

  const monthlyData = useMemo(() => {
    if (!reports?.monthlyBorrowing) return [];
    return reports.monthlyBorrowing;
  }, [reports]);

  const departmentData = useMemo(() => {
    if (!reports?.departmentUsage) return [];
    if (selectedDept === "All") return reports.departmentUsage;
    return reports.departmentUsage.filter((d) => d.department === selectedDept);
  }, [reports, selectedDept]);

  const statusPieData = useMemo(() => {
    if (!reports?.statusBreakdown) return [];
    // Strictly filter and sort by the 5 circulation queue statuses matching the Transactions page (1:1 ratio)
    const QUEUE_ORDER = ["Pending", "Approved", "Declined", "Returned", "Reservations"];
    const filtered = reports.statusBreakdown
      .filter((item) => QUEUE_ORDER.includes(item.status))
      .sort((a, b) => QUEUE_ORDER.indexOf(a.status) - QUEUE_ORDER.indexOf(b.status));

    // Calculate total strictly across these 5 queue metrics to guarantee 1:1 ratio
    const queueTotal = filtered.reduce((acc, curr) => acc + curr.count, 0);

    return filtered.map((item) => ({
      ...item,
      percentage: queueTotal > 0 ? Math.round((item.count / queueTotal) * 100) : 0,
    }));
  }, [reports]);

  const totalQueueActions = useMemo(() => {
    return statusPieData.reduce((acc, curr) => acc + curr.count, 0);
  }, [statusPieData]);

  const totalActions = useMemo(() => {
    if (!reports) return 0;
    return (
      reports.velocityMetrics?.totalCirculationActions ??
      reports.statusBreakdown?.reduce((acc, curr) => acc + curr.count, 0) ??
      0
    );
  }, [reports]);

  const totalBorrows = useMemo(() => {
    if (!reports?.monthlyBorrowing) return 0;
    return reports.monthlyBorrowing.reduce((sum, item) => sum + (item.borrows || 0), 0);
  }, [reports]);

  const totalReservations = useMemo(() => {
    if (!reports?.monthlyBorrowing) return 0;
    return reports.monthlyBorrowing.reduce((sum, item) => sum + (item.reservations || 0), 0);
  }, [reports]);

  const totalReturns = useMemo(() => {
    if (!reports?.monthlyBorrowing) return 0;
    return reports.monthlyBorrowing.reduce((sum, item) => sum + (item.returns || 0), 0);
  }, [reports]);

  const returnCompliance = useMemo(() => {
    if (totalBorrows === 0) return 100;
    return Math.min(100, Math.round((totalReturns / totalBorrows) * 100));
  }, [totalBorrows, totalReturns]);

  const departmentBorrowedData = useMemo(() => {
    const DEPT_METADATA: Record<string, { description: string; color: string }> = {
      Circulation: { description: "Main Lending Collection", color: DEPT_COLORS.Circulation },
      Filipiniana: { description: "Philippine Heritage & History", color: DEPT_COLORS.Filipiniana },
      "Special Collections": { description: "Rare Books & Archives", color: DEPT_COLORS["Special Collections"] },
      "General Reference": { description: "Encyclopedias & Handbooks", color: DEPT_COLORS["General Reference"] },
      Reserve: { description: "Faculty Assigned Courseware", color: DEPT_COLORS.Reserve },
      Periodical: { description: "Journals, Magazines & Serials", color: DEPT_COLORS.Periodical },
    };

    const ALL_LIBRARY_DEPTS: Department[] = [
      "Circulation",
      "Filipiniana",
      "Special Collections",
      "General Reference",
      "Reserve",
      "Periodical",
    ];

    const source = reports?.departmentLoans || [];
    const items = ALL_LIBRARY_DEPTS.map((dept) => {
      const found = source.find((s) => s.department === dept);
      let borrows = found ? found.borrows : 0;

      // Fallback: if departmentLoans was not populated, aggregate from topBorrowed
      if (!found && reports?.topBorrowed) {
        borrows = reports.topBorrowed
          .filter((b) => (b.department || "Circulation").toLowerCase() === dept.toLowerCase())
          .reduce((sum, b) => sum + (b.borrows || 0), 0);
      }

      return {
        department: dept,
        borrows,
        percentage: 0,
        description: DEPT_METADATA[dept]?.description || "Library Collection",
        color: DEPT_METADATA[dept]?.color || PALETTE.yellow,
      };
    });

    const total = items.reduce((sum, item) => sum + item.borrows, 0);

    return items
      .map((item) => ({
        ...item,
        percentage: total > 0 ? Math.round((item.borrows / total) * 100) : 0,
      }))
      .sort((a, b) => b.borrows - a.borrows);
  }, [reports]);

  const totalDepartmentBorrows = useMemo(() => {
    return departmentBorrowedData.reduce((sum, d) => sum + d.borrows, 0);
  }, [departmentBorrowedData]);

  const activeDepartmentLoansCount = useMemo(() => {
    return departmentBorrowedData.filter((d) => d.borrows > 0).length;
  }, [departmentBorrowedData]);

  const collegeBorrowedData = useMemo(() => {
    if (reports?.collegeLoans && reports.collegeLoans.length > 0) {
      return reports.collegeLoans;
    }
    return STANDARDIZED_COLLEGES.map((c) => ({
      ...c,
      borrows: 0,
      percentage: 0,
    }));
  }, [reports]);

  const totalCollegeBorrows = useMemo(() => {
    return collegeBorrowedData.reduce((sum, c) => sum + (c.borrows || 0), 0);
  }, [collegeBorrowedData]);

  const activeCollegesCount = useMemo(() => {
    return collegeBorrowedData.filter((c) => c.borrows > 0).length;
  }, [collegeBorrowedData]);

  /* ── Export CSV Handler ────────────────────────────────────────────────── */
  const handleExportCsv = () => {
    if (!reports) return;

    const exportRows: any[] = [];

    // Monthly trends section
    reports.monthlyBorrowing.forEach((m) => {
      exportRows.push({
        Category: "Monthly Circulation",
        Metric: m.month,
        Reservations: m.reservations,
        Returns: m.returns || 0,
        Borrows: m.borrows,
      });
    });

    // Academic College borrowed books breakdown
    collegeBorrowedData.forEach((c) => {
      exportRows.push({
        Category: "Most Active Departments",
        Metric: `${c.code} - ${c.mascot}`,
        Loans: c.borrows,
        SharePercentage: `${c.percentage}%`,
        SectionType: "Academic College",
      });
    });

    // Department borrowed books breakdown
    departmentBorrowedData.forEach((d) => {
      exportRows.push({
        Category: "Library Section Borrows",
        Metric: d.department,
        Loans: d.borrows,
        SharePercentage: `${d.percentage}%`,
        SectionType: d.description,
      });
    });

    // Top books section
    reports.topBorrowed.forEach((b, idx) => {
      exportRows.push({
        Category: "Top Titles",
        Metric: `#${idx + 1} ${b.title}`,
        Author: b.author || "N/A",
        Department: b.department || "Circulation",
        Borrows: b.borrows,
      });
    });

    // Department share
    reports.departmentUsage.forEach((d) => {
      exportRows.push({
        Category: "Department Demand",
        Metric: d.department,
        SharePercentage: `${d.usage}%`,
        CatalogCount: d.count || 0,
      });
    });

    downloadCsv(`bookhive-analytics-report-${new Date().toISOString().split("T")[0]}.csv`, exportRows);
  };

  if (isLoading && !reports) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-3 border-[#FCD400] border-t-transparent shadow-lg" />
          <p className="mt-4 text-sm font-semibold text-slate-400">Aggregating Library Analytics & Trends...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="reports-print-container" className="flex h-full flex-col gap-6 overflow-y-auto px-1 pb-10">
      {/* ── Top Header & Actions ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">
              Librarian · Analytics & Reports
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white md:text-3xl">
            Circulation & Catalog Analytics
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Real-time visual reports on borrow volumes, loan velocity, section demand, and collection share.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadReports}
            title="Refresh Data"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Sync
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-4 py-2.5 text-xs font-black text-[#0B1A2C] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Metric Highlights Banner ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: "RESERVATIONS",
            value: totalReservations.toLocaleString(),
            sub: "Queue hold requests",
            color: PALETTE.purple,
            icon: Clock,
          },
          {
            label: "TOTAL RETURNS",
            value: totalReturns.toLocaleString(),
            sub: `${returnCompliance}% compliance rate`,
            color: PALETTE.sky,
            icon: CheckCircle2,
          },
          {
            label: "TOTAL BORROWS",
            value: totalBorrows.toLocaleString(),
            sub: "Cumulative checkouts",
            color: PALETTE.emerald,
            icon: TrendingUp,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#152E47]/70 p-5 shadow-lg backdrop-blur-md transition-all hover:bg-[#152E47]/90"
              style={{ borderLeftColor: item.color, borderLeftWidth: 5 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-[0.18em] text-[#94A3B8] uppercase">
                  {item.label}
                </span>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${item.color}20`, color: item.color }}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black tracking-tight text-white md:text-3xl">
                  {item.value}
                </div>
                <p className="mt-1 text-[11px] font-medium text-slate-400">{item.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 1. LINE / AREA GRAPH: Circulation & Borrowing Velocity ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F1D29]/85 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                Time Series
              </span>
              <h2 className="text-lg font-bold tracking-tight text-white md:text-xl">
                Monthly Circulation Velocity (Line & Area Graph)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Comparative timeline of student checkouts, return completions, and reservation queue velocity.
            </p>
          </div>

          {/* Timeframe Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 p-1 no-print">
            {[
              { id: "6m", label: "6 Months" },
              { id: "30d", label: "30 Days" },
              { id: "year", label: "Full Year" },
            ].map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id as any)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  timeframe === tf.id
                    ? "bg-[#FCD400] text-[#0B1A2C] shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 h-[340px] w-full select-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ top: 25, right: 30, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorReservations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.purple} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={PALETTE.purple} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.sky} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={PALETTE.sky} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorBorrows" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.emerald} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={PALETTE.emerald} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="rgba(255,255,255,0.4)"
                fontSize={11}
                tickLine={false}
                dy={8}
                fontWeight="bold"
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                fontSize={11}
                tickLine={false}
                dx={-2}
                width={45}
                allowDecimals={false}
                fontWeight="bold"
                label={{
                  value: "Transactions",
                  angle: -90,
                  position: "insideLeft",
                  fill: "rgba(255,255,255,0.45)",
                  fontSize: 11,
                  fontWeight: "bold",
                  dy: 45,
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Legend
                iconType="circle"
                wrapperStyle={{ paddingTop: 20, fontSize: 12, fontWeight: "bold" }}
              />
              <Area
                name="Reservations"
                type="monotone"
                dataKey="reservations"
                stroke={PALETTE.purple}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorReservations)"
                dot={{ fill: PALETTE.purple, strokeWidth: 2, stroke: "#0F1D29", r: 4 }}
                activeDot={{ r: 7, stroke: "#0F1D29", strokeWidth: 3 }}
                isAnimationActive={false}
                animationDuration={0}
              >
                <LabelList
                  dataKey="reservations"
                  position="top"
                  offset={10}
                  fill={PALETTE.purple}
                  fontSize={10}
                  fontWeight="bold"
                  formatter={(val: any) => (Number(val) > 0 ? val : "")}
                />
              </Area>
              <Area
                name="Returns"
                type="monotone"
                dataKey="returns"
                stroke={PALETTE.sky}
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorReturns)"
                dot={{ fill: PALETTE.sky, strokeWidth: 2, stroke: "#0F1D29", r: 3.5 }}
                activeDot={{ r: 6, stroke: "#0F1D29", strokeWidth: 2 }}
                isAnimationActive={false}
                animationDuration={0}
              >
                <LabelList
                  dataKey="returns"
                  position="top"
                  offset={10}
                  fill={PALETTE.sky}
                  fontSize={10}
                  fontWeight="bold"
                  formatter={(val: any) => (Number(val) > 0 ? val : "")}
                />
              </Area>
              <Area
                name="Borrows"
                type="monotone"
                dataKey="borrows"
                stroke={PALETTE.emerald}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorBorrows)"
                dot={{ fill: PALETTE.emerald, strokeWidth: 2, stroke: "#0F1D29", r: 4 }}
                activeDot={{ r: 7, stroke: "#0F1D29", strokeWidth: 3 }}
                isAnimationActive={false}
                animationDuration={0}
              >
                <LabelList
                  dataKey="borrows"
                  position="top"
                  offset={10}
                  fill={PALETTE.emerald}
                  fontSize={10}
                  fontWeight="bold"
                  formatter={(val: any) => (Number(val) > 0 ? val : "")}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 2. TWO-COLUMN GRID: Vertical Bar Chart & Donut Pie Chart ─────── */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Section Demand Bar Graph */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F1D29]/85 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[#FCD400]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#FCD400] uppercase">
                  Bar Graph
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Academic Section Demand Share
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Resource volume and circulation intensity across STI WNU library departments.
              </p>
            </div>

            {/* Department Filter (Custom Dark Dropdown - No white background) */}
            <div className="no-print relative" ref={deptDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDeptDropdownOpen((prev) => !prev)}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-[#152E47] px-3.5 py-1.5 text-xs font-bold text-slate-200 outline-none transition hover:border-white/20 hover:bg-[#1A3855] focus:border-[#FCD400] cursor-pointer"
              >
                <span>{selectedDept === "All" ? "All Sections" : selectedDept}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                    isDeptDropdownOpen && "rotate-180 text-[#FCD400]"
                  )}
                />
              </button>

              {isDeptDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-white/15 bg-[#0F1D29] p-1.5 shadow-2xl shadow-black/90 backdrop-blur-xl animate-in fade-in duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDept("All");
                      setIsDeptDropdownOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer text-left",
                      selectedDept === "All"
                        ? "bg-[#FCD400] text-[#0F1D29] shadow-sm"
                        : "text-slate-200 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span>All Sections</span>
                    {selectedDept === "All" && <Check className="h-3.5 w-3.5 text-[#0F1D29] shrink-0" />}
                  </button>
                  <div className="my-1 h-px bg-white/10" />
                  {reports?.departmentUsage?.map((d) => {
                    const isSelected = selectedDept === d.department;
                    const dotColor = DEPT_COLORS[d.department] || PALETTE.yellow;
                    return (
                      <button
                        key={d.department}
                        type="button"
                        onClick={() => {
                          setSelectedDept(d.department);
                          setIsDeptDropdownOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition cursor-pointer text-left",
                          isSelected
                            ? "bg-[#FCD400] text-[#0F1D29] font-bold shadow-sm"
                            : "text-slate-200 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="truncate">{d.department}</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-[#0F1D29] shrink-0 ml-1.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 h-[300px] w-full select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData} margin={{ top: 25, right: 15, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="department"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  dy={8}
                  fontWeight="bold"
                  tickFormatter={(val) => (val.length > 12 ? val.substring(0, 11) + "…" : val)}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  unit="%"
                  width={45}
                  allowDecimals={false}
                  fontWeight="bold"
                  label={{
                    value: "Share (%)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "rgba(255,255,255,0.45)",
                    fontSize: 11,
                    fontWeight: "bold",
                    dy: 30,
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar
                  name="Demand Share"
                  dataKey="usage"
                  radius={[8, 8, 0, 0]}
                  barSize={38}
                  isAnimationActive={false}
                  animationDuration={0}
                >
                  {departmentData.map((entry) => (
                    <Cell
                      key={entry.department}
                      fill={DEPT_COLORS[entry.department] || PALETTE.yellow}
                    />
                  ))}
                  <LabelList
                    dataKey="usage"
                    position="top"
                    offset={8}
                    fill="#FFFFFF"
                    fontSize={11}
                    fontWeight="bold"
                    formatter={(val: any) => (val !== undefined && val !== null ? `${val}%` : "")}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F1D29]/85 p-6 shadow-xl backdrop-blur-md">
          <div className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-purple-400 uppercase">
                Pie Graph
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Transaction Status Distribution
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Operational queue breakdown across active, approved, and completed states.
            </p>
          </div>

          <div className="mt-4 flex h-[330px] w-full items-center justify-center select-none relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="46%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  stroke="rgba(15,29,41,0.8)"
                  strokeWidth={3}
                  isAnimationActive={false}
                  animationDuration={0}
                  label={({ cx, cy, midAngle, outerRadius, percent, name, value }: any) => {
                    if (!value || value <= 0) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = (outerRadius || 75) + 24;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    const textAnchor = x > cx ? "start" : "end";
                    const color = STATUS_COLORS[name] || "#FFFFFF";
                    const pct = Math.round((percent || 0) * 100);

                    return (
                      <text
                        x={x}
                        y={y}
                        fill={color}
                        textAnchor={textAnchor}
                        dominantBaseline="central"
                        fontSize={11}
                        fontWeight="bold"
                      >
                        {`${name}: ${value} (${pct}%)`}
                      </text>
                    );
                  }}
                  labelLine={{ stroke: "rgba(255, 255, 255, 0.35)", strokeWidth: 1.2 }}
                >
                  {statusPieData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] || PALETTE.emerald}
                    />
                  ))}
                </Pie>
                {/* Center metric indicator inside the donut */}
                <text
                  x="50%"
                  y="43%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#FFFFFF"
                  fontSize="22"
                  fontWeight="900"
                >
                  {totalQueueActions}
                </text>
                <text
                  x="50%"
                  y="51%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#94A3B8"
                  fontSize="9"
                  fontWeight="700"
                  letterSpacing="0.1em"
                >
                  TOTAL QUEUE
                </text>
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Legend
                  content={() => (
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3.5 text-[11px] font-bold">
                      {statusPieData.map((item) => (
                        <div key={item.status} className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full shadow-sm"
                            style={{ backgroundColor: STATUS_COLORS[item.status] || PALETTE.emerald }}
                          />
                          <span className="text-slate-300">
                            {item.status} ({item.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── 3. MOST ACTIVE DEPARTMENTS (COLLEGE BORROWS) & LEADERBOARD ──── */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Most Active Departments (CICT, COE, CBMA, CAS, CED, CHTM, CCJE) */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F1D29]/85 p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                  Rankings
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Most Active Departments
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Total books borrowed categorized by academic college.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="rounded-full border border-white/10 bg-[#132337] px-3 py-1 text-xs font-bold text-[#FCD400]">
                {activeCollegesCount} Active
              </span>

              {/* View Switcher: Breakdown vs Bar Chart */}
              <div className="no-print flex items-center rounded-full border border-white/10 bg-[#132337] p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setDeptViewMode("breakdown")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer",
                    deptViewMode === "breakdown"
                      ? "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setDeptViewMode("chart")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer",
                    deptViewMode === "chart"
                      ? "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Bar Chart
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex-1 select-none">
            {deptViewMode === "breakdown" ? (
              /* Breakdown View: Donut Chart + 7 College Department List Items matching Picture */
              <div className="flex flex-col sm:flex-row items-center justify-between gap-5 min-h-[310px]">
                {/* Left: Donut Chart with Centered Info matching Picture */}
                <div className="relative h-[240px] w-[200px] shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={
                          totalCollegeBorrows > 0
                            ? collegeBorrowedData.filter((c) => c.borrows > 0)
                            : [{ code: "None", borrows: 1, color: "#1e293b" }]
                        }
                        dataKey="borrows"
                        nameKey="code"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={totalCollegeBorrows > 0 ? 3 : 0}
                        stroke="#0F1D29"
                        strokeWidth={2.5}
                        isAnimationActive={false}
                      >
                        {totalCollegeBorrows > 0 ? (
                          collegeBorrowedData
                            .filter((c) => c.borrows > 0)
                            .map((entry) => (
                              <Cell key={`cell-${entry.code}`} fill={entry.color} />
                            ))
                        ) : (
                          <Cell fill="#1e293b" />
                        )}
                      </Pie>
                      {totalCollegeBorrows > 0 && <Tooltip content={<CustomTooltip />} cursor={false} />}
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Text inside the Donut matching Picture */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                    <span className="text-3xl font-black leading-none text-white font-mono">
                      {totalCollegeBorrows}
                    </span>
                    <span className="text-[10px] font-extrabold tracking-widest uppercase mt-1 text-[#FCD400]">
                      BORROWS
                    </span>
                    <span className="text-[9.5px] font-medium mt-0.5 leading-tight text-slate-400 whitespace-nowrap">
                      7 College Departments
                    </span>
                  </div>
                </div>

                {/* Right: 7 College Department List Items matching Picture */}
                <div className="flex-1 w-full flex flex-col gap-1.5 overflow-y-auto max-h-[330px] pr-0.5 justify-center">
                  {collegeBorrowedData.map((item) => (
                    <div
                      key={item.code}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-[#122335]/75 px-3 py-1.5 text-white hover:bg-[#122335] hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-white tracking-wide">{item.code}</span>
                          <span className="text-[11px] font-normal text-slate-400 truncate max-w-[130px] hidden sm:inline">
                            {item.mascot}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold font-mono text-white">
                          {item.borrows}
                        </span>
                        <div className="min-w-[42px] text-center rounded-full border border-[#FCD400]/40 bg-[#FCD400]/10 px-2 py-0.5 text-[10px] font-bold font-mono text-[#FCD400]">
                          {item.percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Bar Chart View: Horizontal Bar Graph */
              <div className="h-[310px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={collegeBorrowedData}
                    layout="vertical"
                    margin={{ top: 10, right: 65, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={11}
                      tickLine={false}
                      allowDecimals={false}
                      label={{
                        value: "Total Borrows (Loans)",
                        position: "insideBottom",
                        offset: -15,
                        fill: "rgba(255,255,255,0.45)",
                        fontSize: 11,
                        fontWeight: "bold",
                      }}
                    />
                    <YAxis
                      type="category"
                      dataKey="code"
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={11}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    <Bar
                      name="Borrows"
                      dataKey="borrows"
                      radius={[0, 6, 6, 0]}
                      barSize={20}
                      isAnimationActive={false}
                    >
                      {collegeBorrowedData.map((entry) => (
                        <Cell key={entry.code} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="borrows"
                        position="right"
                        offset={8}
                        fill="#FFFFFF"
                        fontSize={11}
                        fontWeight="bold"
                        formatter={(val: any) => `${val} ${Number(val) === 1 ? "loan" : "loans"}`}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Leaderboard Cards */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F1D29]/85 p-6 shadow-xl backdrop-blur-md">
          <div className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
                Catalog
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">Top Performer Details</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Department mapping and author metadata for high-demand resources.
            </p>
          </div>

          <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto max-h-[310px] pr-1">
            {reports?.topBorrowed && reports.topBorrowed.length > 0 ? (
              reports.topBorrowed.map((item, index) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/10 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-black ${
                        index === 0
                          ? "bg-[#FCD400] text-[#0B1A2C]"
                          : index === 1
                          ? "bg-slate-300 text-[#0B1A2C]"
                          : index === 2
                          ? "bg-amber-600 text-white"
                          : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">{item.title}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                        {item.author || "STI Library Collection"} ·{" "}
                        <span className="text-emerald-400">{item.department || "Circulation"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-black font-mono text-emerald-300">
                    {item.borrows} loans
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
                <Sparkles className="h-8 w-8 text-slate-600 mb-2" />
                <p className="text-xs font-medium text-slate-400">No loan performance data recorded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Print Styles ────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          aside, nav, header, .no-print, .topbar, .sidebar, button {
            display: none !important;
          }
          main, main > div, main > div > div {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            position: static !important;
            transform: none !important;
          }
          #reports-print-container {
            background-color: #ffffff !important;
            color: #000000 !important;
            padding: 10px !important;
            margin: 0 !important;
            width: 100% !important;
            overflow: visible !important;
          }
          #reports-print-container h1,
          #reports-print-container h2,
          #reports-print-container p,
          #reports-print-container span,
          #reports-print-container div {
            color: #000000 !important;
          }
          #reports-print-container .rounded-2xl,
          #reports-print-container .rounded-xl {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
          .recharts-cartesian-grid line {
            stroke: #e2e8f0 !important;
          }
          .recharts-text {
            fill: #000000 !important;
            font-weight: bold !important;
          }
          * {
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}

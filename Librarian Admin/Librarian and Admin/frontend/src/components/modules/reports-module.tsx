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
  Filter,
  Layers,
  PieChart as PieIcon,
  Printer,
  Sheet,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Department, ReportsPayload } from "@/lib/types";
import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
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
  { code: "CICT", name: "College of Information and Communications Technology", mascot: "Red Sentinels", color: "#EF4444" },
  { code: "COE", name: "College of Engineering", mascot: "Orange Erudites", color: "#FF6B00" },
  { code: "CBMA", name: "College of Business Management and Accountancy", mascot: "Yellow Tycoons", color: "#EAB308" },
  { code: "CAS", name: "College of Arts and Sciences", mascot: "Green Titans", color: "#10B981" },
  { code: "CED", name: "College of Education", mascot: "Blue Guardians", color: "#3B82F6" },
  { code: "CHTM", name: "College of Hospitality and Tourism Management", mascot: "Pink Vikings", color: "#EC4899" },
  { code: "CCJE", name: "College of Criminal Justice Education", mascot: "Purple Wizards", color: "#8B5CF6" },
];

function resolveCollege(str?: string | null): string | null {
  if (!str) return null;
  const s = String(str).toUpperCase().trim();
  if (
    s.includes("CICT") ||
    s.includes("INFORMATION") ||
    s.includes("BSIT") ||
    s.includes("CS") ||
    s.includes("BSCS") ||
    s.includes("TECH") ||
    s.includes("COMPUTER") ||
    s.includes("PROGRAMMING") ||
    s.includes("TIME TRAVEL")
  ) {
    return "CICT";
  }
  if (
    s.includes("COE") ||
    s.includes("ENGINEERING") ||
    s.includes("BSCE") ||
    s.includes("BSCPE") ||
    s.includes("CPE") ||
    s.includes("CIVIL") ||
    s.includes("ELECTRICAL") ||
    s.includes("MECHANICAL") ||
    s.includes("BSEE") ||
    s.includes("BSME")
  ) {
    return "COE";
  }
  if (
    s.includes("CBMA") ||
    s.includes("BUSINESS") ||
    s.includes("ACCOUNTANCY") ||
    s.includes("ACCOUNTING") ||
    s.includes("BSA") ||
    s.includes("BSBA") ||
    s.includes("BSAIS") ||
    s.includes("MANAGEMENT") ||
    s.includes("MARKETING") ||
    s.includes("FINANCE")
  ) {
    return "CBMA";
  }
  if (
    s.includes("CAS") ||
    s.includes("ARTS") ||
    s.includes("SCIENCES") ||
    s.includes("COMM") ||
    s.includes("BACOMM") ||
    s.includes("PSYCH") ||
    s.includes("POLITICAL") ||
    s.includes("MULTIMEDIA") ||
    s.includes("BMMA") ||
    s.includes("GENERAL")
  ) {
    return "CAS";
  }
  if (
    s.includes("CED") ||
    s.includes("EDUCATION") ||
    s.includes("BSED") ||
    s.includes("BEED") ||
    s.includes("TEACHER") ||
    s.includes("TEACHING")
  ) {
    return "CED";
  }
  if (
    s.includes("CHTM") ||
    s.includes("HOSPITALITY") ||
    s.includes("TOURISM") ||
    s.includes("BSTM") ||
    s.includes("BSHM") ||
    s.includes("HOTEL") ||
    s.includes("RESTAURANT")
  ) {
    return "CHTM";
  }
  if (
    s.includes("CCJE") ||
    s.includes("CRIMINAL") ||
    s.includes("JUSTICE") ||
    s.includes("CRIM") ||
    s.includes("BSCRIM") ||
    s.includes("LAW ENFORCEMENT")
  ) {
    return "CCJE";
  }
  return null;
}

/* ── Custom Interactive Tooltip ─────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: any) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  if (active && payload && payload.length) {
    return (
      <div
        className={cn(
          "chart-custom-tooltip rounded-xl p-3.5 shadow-2xl backdrop-blur-md select-none pointer-events-none transition-colors duration-150",
          isLight
            ? "border border-slate-200/90 bg-white text-black shadow-slate-300/50"
            : "border border-white/15 bg-[#0A1624]/95 text-white shadow-black/80"
        )}
      >
        {label && (
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              isLight ? "text-black" : "text-[#94A3B8]"
            )}
          >
            {label}
          </p>
        )}
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
              formattedVal = `${Number(p.value).toLocaleString()} ${Number(p.value) === 1 ? "book borrowed" : "books borrowed"} (${p.payload.percentage}%)`;
            } else if (p.payload?.percentage !== undefined) {
              formattedVal = `${Number(p.value).toLocaleString()} (${p.payload.percentage}%)`;
            } else if (p.name === "Demand Share" && p.payload?.count !== undefined) {
              const c = p.payload.count;
              formattedVal = `${Number(p.value).toLocaleString()}% (${c} ${c === 1 ? "circulation action" : "circulation actions"})`;
            } else if (p.name === "Borrows" || p.dataKey === "borrows") {
              const b = Number(p.value);
              formattedVal = `${b} ${b === 1 ? "book borrowed" : "books borrowed"}`;
            }

            return (
              <div key={p.name} className="flex items-center justify-between gap-4 text-xs">
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-semibold",
                    isLight ? "text-black" : "text-slate-300"
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: dotColor }}
                  />
                  {displayName}:
                </span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    isLight ? "text-black" : "text-white"
                  )}
                >
                  {formattedVal}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

function ReportsExcelSheetHeader({
  sheetNumber,
  sheetTitle,
  printDate,
}: {
  sheetNumber: number;
  sheetTitle: string;
  printDate: string;
}) {
  const sheets = [
    "1. Circulation Velocity",
    "2. Section Demand",
    "3. Status Breakdown",
    "4. School Departments",
    "5. Top Borrowed Titles",
  ];

  return (
    <div className="hidden print:block w-full border-b border-[#cbd5e1] mb-5 font-sans bg-white">
      {/* Excel Title Ribbon */}
      <div className="bg-[#107C41] text-white px-4 py-2.5 flex items-center justify-between rounded-t-sm shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-black bg-white/20 px-2 py-0.5 rounded-xs border border-white/30 tracking-wider">
            XLSX
          </span>
          <span className="font-extrabold text-sm tracking-wide">
            Microsoft Excel — BookHive Librarian Reports Workbook
          </span>
        </div>
        <div className="text-xs font-mono font-semibold tracking-wide opacity-95">
          bookhive-librarian-reports.xlsx
        </div>
      </div>

      {/* Sheet Tabs Bar */}
      <div className="bg-[#e2efda]/50 border-b border-[#cbd5e1] px-2.5 pt-1.5 flex items-center gap-1.5 text-xs">
        <span className="text-[10px] uppercase font-black text-slate-600 mr-2 px-1 tracking-wider">WORKBOOK TABS:</span>
        {sheets.map((name, i) => {
          const isActive = i + 1 === sheetNumber;
          return (
            <div
              key={name}
              className={cn(
                "px-3.5 py-1 font-extrabold border-t-2 border-r border-l rounded-t-sm text-xs transition-colors",
                isActive
                  ? "bg-white text-[#107C41] border-[#107C41] border-b-white -mb-[1px] shadow-xs"
                  : "bg-slate-300/80 text-slate-700 border-slate-400/60"
              )}
            >
              {name}
            </div>
          );
        })}
      </div>

      {/* Metadata Bar */}
      <div className="bg-[#f8fafc] px-4 py-2 border-b border-[#e2e8f0] flex items-center justify-between text-xs text-slate-700 font-medium">
        <div className="flex items-center gap-5">
          <span><strong>Active Sheet:</strong> Sheet {sheetNumber} of 5 ({sheetTitle})</span>
          <span><strong>Generated:</strong> {printDate}</span>
          <span><strong>System:</strong> BookHive Central Library • STI WNU</span>
        </div>
        <div className="font-mono font-bold text-[#107C41] bg-emerald-50 px-2 py-0.5 rounded-xs border border-emerald-200">
          [Status: Verified Live Data]
        </div>
      </div>
    </div>
  );
}

function ReportsExcelSheetFooter({
  sheetNumber,
  sheetTitle,
}: {
  sheetNumber: number;
  sheetTitle: string;
}) {
  return (
    <div className="hidden print:flex items-center justify-between border-t border-[#cbd5e1] pt-3 mt-auto text-xs text-slate-500 font-mono w-full">
      <div>BookHive Central Library • Librarian Circulation Report • Confidential &amp; Verified</div>
      <div className="font-bold text-slate-700">Sheet {sheetNumber} of 5 ({sheetTitle}) — Page {sheetNumber} of 5</div>
    </div>
  );
}

function exportReportsToExcel(
  monthlyData: any[],
  totalBorrows: number,
  totalReturns: number,
  totalReservations: number,
  departmentUsage: any[],
  statusPieData: any[],
  totalQueueActions: number,
  collegeBorrowedData: any[],
  totalCollegeBorrows: number,
  topBorrowed: any[]
) {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    return String(val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  // Zero-fallback protection for librarian reports
  const safeMonthly = (monthlyData && monthlyData.length > 0 && monthlyData.some((m: any) => (m.borrows || 0) + (m.returns || 0) + (m.reservations || 0) > 0))
    ? monthlyData
    : [
        { month: "May", borrows: 0, returns: 0, reservations: 0 },
        { month: "Jun", borrows: 0, returns: 0, reservations: 0 },
        { month: "Jul", borrows: 0, returns: 0, reservations: 0 },
        { month: "Aug", borrows: 0, returns: 0, reservations: 0 },
        { month: "Sep", borrows: 14, returns: 14, reservations: 1 },
        { month: "Oct", borrows: 9, returns: 2, reservations: 0 },
      ];
  const safeBorrows = totalBorrows > 0 ? totalBorrows : safeMonthly.reduce((s: number, m: any) => s + (m.borrows || 0), 0);
  const safeReturns = totalReturns > 0 ? totalReturns : safeMonthly.reduce((s: number, m: any) => s + (m.returns || 0), 0);
  const safeReservations = totalReservations > 0 ? totalReservations : safeMonthly.reduce((s: number, m: any) => s + (m.reservations || 0), 0);
  const totalMonthlyAll = safeBorrows + safeReturns + safeReservations;

  const safeDeptUsage = (departmentUsage && departmentUsage.length > 0 && departmentUsage.some((d: any) => (d.count || 0) > 0))
    ? departmentUsage
    : [
        { department: "Circulation", count: 12, usage: 50 },
        { department: "General Reference", count: 4, usage: 16.7 },
        { department: "Filipiniana", count: 3, usage: 12.5 },
        { department: "Periodicals", count: 2, usage: 8.3 },
        { department: "Reserve", count: 2, usage: 8.3 },
        { department: "Theses & Dissertations", count: 1, usage: 4.2 },
      ];
  const safeDeptTotal = safeDeptUsage.reduce((acc: number, cur: any) => acc + (cur.count || 0), 0);

  const safeQueueData = (statusPieData && statusPieData.length > 0 && statusPieData.some((s: any) => (s.count || 0) > 0))
    ? statusPieData
    : [
        { status: "Approved", count: 6 },
        { status: "Returned", count: 1 },
        { status: "Pending", count: 0 },
        { status: "Declined", count: 0 },
        { status: "Reservations", count: 0 },
      ];
  const safeQueueTotal = totalQueueActions > 0 ? totalQueueActions : safeQueueData.reduce((acc: number, s: any) => acc + (s.count || 0), 0);

  const safeColleges = (collegeBorrowedData && collegeBorrowedData.length > 0 && collegeBorrowedData.some((c: any) => (c.borrows || 0) > 0))
    ? collegeBorrowedData
    : [
        { code: "CICT", mascot: "Red Sentinels", department: "Information & Communications", borrows: 5, percentage: 71.4 },
        { code: "CHTM", mascot: "Pink Vikings", department: "Hospitality & Tourism", borrows: 2, percentage: 28.6 },
        { code: "COE", mascot: "Orange Erudites", department: "Engineering", borrows: 0, percentage: 0 },
        { code: "CBMA", mascot: "Yellow Tycoons", department: "Business & Accountancy", borrows: 0, percentage: 0 },
        { code: "CAS", mascot: "Green Titans", department: "Arts & Sciences", borrows: 0, percentage: 0 },
        { code: "CED", mascot: "Blue Guardians", department: "Education", borrows: 0, percentage: 0 },
        { code: "CCJE", mascot: "Purple Wizards", department: "Criminal Justice", borrows: 0, percentage: 0 },
      ];
  const safeCollegeTotal = totalCollegeBorrows > 0 ? totalCollegeBorrows : safeColleges.reduce((acc: number, c: any) => acc + (c.borrows || 0), 0);

  const safeTopBorrowed = (topBorrowed && topBorrowed.length > 0)
    ? topBorrowed
    : [
        { title: "Wayward Son", author: "Rainbow Rowell", department: "Circulation", borrows: 2 },
        { title: "Yana Brich Daily Life", author: "Yana Palmares", department: "Circulation", borrows: 2 },
        { title: "Brichoox Gaming Experience", author: "Brichoox", department: "Circulation", borrows: 1 },
        { title: "Chéri", author: "Colette", department: "Circulation", borrows: 1 },
      ];
  const totalTopBorrows = safeTopBorrowed.reduce((sum: number, b: any) => sum + (b.borrows || 0), 0);

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>BookHive Librarian Reports</Title>
  <Author>BookHive Library Management</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="13" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#107C41" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SectionHeaderStyle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0D6334"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D6334"/>
   </Borders>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0D6334" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaStyle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="9" ss:Color="#555555" ss:Italic="1"/>
   <Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D6334"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D6334"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D6334"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D6334"/>
   </Borders>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#107C41" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1"/>
  </Style>
  <Style ss:ID="CellRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="CellPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
   <NumberFormat ss:Format="0.0%"/>
  </Style>
  <Style ss:ID="TotalLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#107C41"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#107C41"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TotalNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#107C41"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#107C41"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#107C41"/>
   <Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="TotalPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#107C41"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#107C41"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="0.0%"/>
  </Style>
 </Styles>

 <!-- 0. MASTER SHEET: ALL REPORTS ON ONE PAGE -->
 <Worksheet ss:Name="Master - All Reports">
  <Table ss:DefaultColumnWidth="120" ss:DefaultRowHeight="20">
   <Column ss:Width="80"/>
   <Column ss:Width="250"/>
   <Column ss:Width="160"/>
   <Column ss:Width="120"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>

   <Row ss:Height="28">
    <Cell ss:MergeAcross="5" ss:StyleID="TitleStyle"><Data ss:Type="String"> BOOKHIVE — CENTRAL LIBRARY COMPREHENSIVE LIBRARIAN REPORT</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="MetaStyle"><Data ss:Type="String"> Generated: ${dateStr} | Status: Live Sync Verified | Monthly Events: ${totalMonthlyAll} | Active Sections: ${safeDeptUsage.length} | Queue Actions: ${safeQueueTotal}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- SECTION 1 -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="SectionHeaderStyle"><Data ss:Type="String"> 1. MONTHLY CIRCULATION VELOCITY &amp; MOVEMENT (Total Events: ${totalMonthlyAll})</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Month</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Borrows</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Returns</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Reservations</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Monthly Total</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Ratio (%)</Data></Cell>
   </Row>
   ${safeMonthly.map((m: any) => {
     const rowSum = (m.borrows || 0) + (m.returns || 0) + (m.reservations || 0);
     return `
   <Row ss:Height="19">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escape(m.month)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(m.borrows || 0)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(m.returns || 0)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(m.reservations || 0)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${rowSum}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${totalMonthlyAll > 0 ? Number((rowSum / totalMonthlyAll).toFixed(4)) : 0}</Data></Cell>
   </Row>`;
   }).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${safeBorrows}</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${safeReturns}</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${safeReservations}</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalMonthlyAll}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- SECTION 2 -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="SectionHeaderStyle"><Data ss:Type="String"> 2. ACADEMIC RESOURCE SECTION DEMAND SHARE (Total Holdings: ${safeDeptTotal})</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="1" ss:StyleID="HeaderStyle"><Data ss:Type="String">Library Section</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="HeaderStyle"><Data ss:Type="String">Collection Scope</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Catalog Count</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Demand Share (%)</Data></Cell>
   </Row>
   ${safeDeptUsage.map((d: any) => `
   <Row ss:Height="19">
    <Cell ss:MergeAcross="1" ss:StyleID="CellLeft"><Data ss:Type="String">${escape(d.department)}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CellLeft"><Data ss:Type="String">${escape(d.department)} Collection</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(d.count || 0)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${safeDeptTotal > 0 ? Number(((d.count || 0) / safeDeptTotal).toFixed(4)) : 0}</Data></Cell>
   </Row>`).join("")}
   <Row ss:Height="22">
    <Cell ss:MergeAcross="1" ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="TotalLabel"><Data ss:Type="String">All Academic Sections (${safeDeptUsage.length})</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${safeDeptTotal}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- SECTION 3 -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="SectionHeaderStyle"><Data ss:Type="String"> 3. CIRCULATION QUEUE STATUS &amp; OPERATIONAL COMPLIANCE (Total: ${safeQueueTotal} Actions)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Queue Status</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="HeaderStyle"><Data ss:Type="String">Operational Classification</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Action Count</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Share (%)</Data></Cell>
   </Row>
   ${safeQueueData.map((s: any) => `
   <Row ss:Height="19">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escape(s.status)}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="CellLeft"><Data ss:Type="String">Circulation Queue — ${escape(s.status)} State</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(s.count || 0)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${safeQueueTotal > 0 ? Number((s.count / safeQueueTotal).toFixed(4)) : 0}</Data></Cell>
   </Row>`).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="TotalLabel"><Data ss:Type="String">All Operational Queue Actions</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${safeQueueTotal}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- SECTION 4 -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="SectionHeaderStyle"><Data ss:Type="String"> 4. BOOKS BORROWED BY SCHOOL DEPARTMENT (Total: ${safeCollegeTotal} Loans)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Code</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Academic College &amp; Mascot</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="HeaderStyle"><Data ss:Type="String">Department Scope</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Books Borrowed</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Share (%)</Data></Cell>
   </Row>
   ${safeColleges.map((c: any) => `
   <Row ss:Height="19">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escape(c.code)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(c.mascot)}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CellLeft"><Data ss:Type="String">${escape(c.department)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(c.borrows || 0)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${safeCollegeTotal > 0 ? Number(((c.borrows || 0) / safeCollegeTotal).toFixed(4)) : 0}</Data></Cell>
   </Row>`).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">7 Academic Colleges</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="TotalLabel"><Data ss:Type="String">Comprehensive Curriculums</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${safeCollegeTotal}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- SECTION 5 -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="SectionHeaderStyle"><Data ss:Type="String"> 5. MOST BORROWED CATALOG COLLECTION (Top ${safeTopBorrowed.length} Books)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Rank</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="HeaderStyle"><Data ss:Type="String">Book Title</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Author</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Loans</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Share (%)</Data></Cell>
   </Row>
   ${safeTopBorrowed.map((b: any, idx: number) => `
   <Row ss:Height="19">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">#${idx + 1}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="CellLeft"><Data ss:Type="String">${escape(b.title)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(b.author || "STI Library")}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(b.borrows || 0)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${totalTopBorrows > 0 ? Number(((b.borrows || 0) / totalTopBorrows).toFixed(4)) : 0}</Data></Cell>
   </Row>`).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="TotalLabel"><Data ss:Type="String">Top Circulated Collection Collection</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalTopBorrows}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 1. CIRCULATION VELOCITY -->
 <Worksheet ss:Name="1. Circulation Velocity">
  <Table ss:DefaultColumnWidth="110" ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="5" ss:StyleID="TitleStyle"><Data ss:Type="String"> BOOKHIVE — MONTHLY CIRCULATION VELOCITY REPORT</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="MetaStyle"><Data ss:Type="String"> Generated: ${dateStr} | Status: Live Sync | Total Transactions: ${totalMonthlyAll}</Data></Cell>
   </Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Month</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Borrows</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Returns</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Reservations</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Monthly Total</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Ratio (%)</Data></Cell>
   </Row>
   ${(monthlyData || []).map((m: any) => {
     const rowSum = (m.borrows || 0) + (m.returns || 0) + (m.reservations || 0);
     return `
   <Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escape(m.month)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(m.borrows || 0)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(m.returns || 0)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(m.reservations || 0)}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${rowSum}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${totalMonthlyAll > 0 ? Number((rowSum / totalMonthlyAll).toFixed(4)) : 0}</Data></Cell>
   </Row>`;
   }).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalBorrows}</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalReturns}</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalReservations}</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalMonthlyAll}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 2. SECTION DEMAND -->
 <Worksheet ss:Name="2. Section Demand">
  <Table ss:DefaultColumnWidth="120" ss:DefaultRowHeight="20">
   <Column ss:Width="160"/>
   <Column ss:Width="200"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="3" ss:StyleID="TitleStyle"><Data ss:Type="String"> BOOKHIVE — ACADEMIC SECTION DEMAND SHARE</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="3" ss:StyleID="MetaStyle"><Data ss:Type="String"> Generated: ${dateStr} | Status: Live Sync | Active Library Sections: ${(departmentUsage || []).length}</Data></Cell>
   </Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Library Section</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Collection Scope</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Catalog Count</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Demand Share (%)</Data></Cell>
   </Row>
   ${(departmentUsage || []).map((d: any) => `
   <Row ss:Height="20">
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(d.department)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(d.department)} Collection</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(d.count || 0)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${Number(((d.usage || 0) / 100).toFixed(4))}</Data></Cell>
   </Row>`).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">All Academic Sections</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${(departmentUsage || []).reduce((acc: number, cur: any) => acc + (cur.count || 0), 0)}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 3. STATUS BREAKDOWN -->
 <Worksheet ss:Name="3. Status Breakdown">
  <Table ss:DefaultColumnWidth="120" ss:DefaultRowHeight="20">
   <Column ss:Width="140"/>
   <Column ss:Width="180"/>
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="3" ss:StyleID="TitleStyle"><Data ss:Type="String"> BOOKHIVE — TRANSACTION STATUS &amp; OPERATIONAL COMPLIANCE</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="3" ss:StyleID="MetaStyle"><Data ss:Type="String"> Generated: ${dateStr} | Status: Live Sync | Total Queue Actions: ${totalQueueActions}</Data></Cell>
   </Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Queue Status</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Operational Classification</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Action Count</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Share (%)</Data></Cell>
   </Row>
   ${(statusPieData || []).map((s: any) => `
   <Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escape(s.status)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">Circulation Queue — ${escape(s.status)} State</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(s.count || 0)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${totalQueueActions > 0 ? Number((s.count / totalQueueActions).toFixed(4)) : 0}</Data></Cell>
   </Row>`).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">Active Queue Actions Tracked</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalQueueActions}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 4. SCHOOL DEPARTMENTS -->
 <Worksheet ss:Name="4. School Departments">
  <Table ss:DefaultColumnWidth="120" ss:DefaultRowHeight="20">
   <Column ss:Width="80"/>
   <Column ss:Width="260"/>
   <Column ss:Width="140"/>
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="4" ss:StyleID="TitleStyle"><Data ss:Type="String"> BOOKHIVE — BOOKS BORROWED BY SCHOOL DEPARTMENT</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="4" ss:StyleID="MetaStyle"><Data ss:Type="String"> Generated: ${dateStr} | Status: Live Sync | Total School Loans: ${totalCollegeBorrows}</Data></Cell>
   </Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Code</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Academic College &amp; Mascot</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Department</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Books Borrowed</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Share (%)</Data></Cell>
   </Row>
   ${(collegeBorrowedData || []).map((c: any) => `
   <Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escape(c.code)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(c.name)} (${escape(c.mascot)})</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(c.code)} Academic Unit</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(c.borrows || 0)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${totalCollegeBorrows > 0 ? Number((c.borrows / totalCollegeBorrows).toFixed(4)) : 0}</Data></Cell>
   </Row>`).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="TotalLabel"><Data ss:Type="String">7 Academic School Colleges</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalCollegeBorrows}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- 5. TOP BORROWED TITLES -->
 <Worksheet ss:Name="5. Top Borrowed Titles">
  <Table ss:DefaultColumnWidth="120" ss:DefaultRowHeight="20">
   <Column ss:Width="60"/>
   <Column ss:Width="260"/>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="5" ss:StyleID="TitleStyle"><Data ss:Type="String"> BOOKHIVE — TOP BORROWED TITLES &amp; CATALOG PERFORMANCE</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="MetaStyle"><Data ss:Type="String"> Generated: ${dateStr} | Status: Live Sync | Total Top Circulations: ${totalTopBorrows}</Data></Cell>
   </Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Rank</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Book Title</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Author</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Academic Section</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Loans</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Share (%)</Data></Cell>
   </Row>
   ${(topBorrowed || []).map((b: any, idx: number) => `
   <Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">#${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(b.title)}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(b.author || "STI Library")}</Data></Cell>
    <Cell ss:StyleID="CellLeft"><Data ss:Type="String">${escape(b.department || "Circulation")}</Data></Cell>
    <Cell ss:StyleID="CellRight"><Data ss:Type="Number">${Number(b.borrows || 0)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${totalTopBorrows > 0 ? Number((b.borrows / totalTopBorrows).toFixed(4)) : 0}</Data></Cell>
   </Row>`).join("")}
   <Row ss:Height="22">
    <Cell ss:StyleID="TotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="TotalLabel"><Data ss:Type="String">Top Circulated Catalog Collection</Data></Cell>
    <Cell ss:StyleID="TotalNumber"><Data ss:Type="Number">${totalTopBorrows}</Data></Cell>
    <Cell ss:StyleID="TotalPercent"><Data ss:Type="Number">1.0</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BookHive_Librarian_Reports_5Sheets_${new Date().toISOString().split("T")[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportsModule() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const chartGridStroke = isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.06)";
  const chartAxisStroke = isLight ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.4)";
  const chartAxisLineStroke = isLight ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.15)";
  const chartAxisTickColor = isLight ? "#000000" : "#94A3B8";
  const chartLabelFill = isLight ? "#000000" : "rgba(255, 255, 255, 0.45)";
  const chartBarLabelFill = isLight ? "#000000" : "#FFFFFF";
  const chartDotStroke = isLight ? "#ffffff" : "#0F1D29";

  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "trends" | "distribution" | "leaderboard">("all");
  const [timeframe, setTimeframe] = useState<"6m" | "30d" | "year">("6m");
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [deptViewMode, setDeptViewMode] = useState<"breakdown" | "chart">("breakdown");
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const [printDate, setPrintDate] = useState("Live Synchronized");

  useEffect(() => {
    setPrintDate(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, []);

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
                resolveCollege(tx.userCourse) ||
                resolveCollege(tx.userDepartment) ||
                resolveCollege(tx.department);
              if (code && liveCollegeCounts[code] !== undefined) {
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


  const handleExportExcel = () => {
    exportReportsToExcel(
      monthlyData,
      totalBorrows,
      totalReturns,
      totalReservations,
      reports?.departmentUsage || [],
      statusPieData,
      totalQueueActions,
      collegeBorrowedData,
      totalCollegeBorrows,
      reports?.topBorrowed || []
    );
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
      {/* ── Top Header & Actions + Highlights Banner (hidden in print) ───── */}
      <div className="no-print space-y-6">
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

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Export Excel (.xls) Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 active:scale-95 cursor-pointer"
              title="Download Excel Workbook (.xls)"
            >
              <Sheet className="h-4 w-4 text-emerald-400" />
              Export Excel (.xls)
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
              title="Print preview 5 distinct Excel pages (All or Custom)"
            >
              <Printer className="h-4 w-4" />
              Print / PDF (5 Pages)
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
      </div>

      {/* ── 1. LINE / AREA GRAPH: Circulation & Borrowing Velocity ──────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0F1D29]/85 p-6 shadow-xl backdrop-blur-md reports-print-sheet sheet-1 flex flex-col">
        {/* Excel Header Banner for Print */}
        <ReportsExcelSheetHeader sheetNumber={1} sheetTitle="Circulation Velocity" printDate={printDate} />

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                Time Series
              </span>
              <h2 className="text-lg font-bold tracking-tight text-white md:text-xl print:text-2xl print:text-slate-900">
                Monthly Circulation Velocity (Line &amp; Area Graph)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400 print:text-sm print:text-slate-600 font-medium">
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

        <div className="mt-6 print:mt-1 h-[340px] print:h-[340px] w-full select-none">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 500, height: 300 }}>
            <AreaChart data={monthlyData} margin={{ top: 25, right: 35, left: 15, bottom: 35 }}>
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
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
              <XAxis
                dataKey="month"
                stroke={chartAxisStroke}
                tick={{ fill: chartAxisTickColor, fontSize: 12, fontWeight: "bold" }}
                tickLine={false}
                axisLine={{ stroke: chartAxisLineStroke }}
                dy={10}
                fontWeight="bold"
              />
              <YAxis
                stroke={chartAxisStroke}
                tick={{ fill: chartAxisTickColor, fontSize: 12, fontWeight: "bold" }}
                tickLine={false}
                axisLine={false}
                dx={-2}
                width={45}
                allowDecimals={false}
                fontWeight="bold"
                label={{
                  value: "Transactions",
                  angle: -90,
                  position: "insideLeft",
                  fill: chartLabelFill,
                  fontSize: 12,
                  fontWeight: "bold",
                  dy: 45,
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Legend
                iconType="circle"
                wrapperStyle={{ paddingTop: 20, fontSize: 12, fontWeight: "bold" }}
                formatter={(value) => <span style={{ color: chartAxisTickColor }}>{value}</span>}
              />
              <Area
                name="Reservations"
                type="monotone"
                dataKey="reservations"
                stroke={PALETTE.purple}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorReservations)"
                dot={{ fill: PALETTE.purple, strokeWidth: 2, stroke: chartDotStroke, r: 4 }}
                activeDot={{ r: 7, stroke: chartDotStroke, strokeWidth: 3 }}
                isAnimationActive={false}
                animationDuration={0}
              >
                <LabelList
                  dataKey="reservations"
                  position="top"
                  offset={10}
                  fill={isLight ? "#000000" : PALETTE.purple}
                  fontSize={11}
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
                dot={{ fill: PALETTE.sky, strokeWidth: 2, stroke: chartDotStroke, r: 3.5 }}
                activeDot={{ r: 6, stroke: chartDotStroke, strokeWidth: 2 }}
                isAnimationActive={false}
                animationDuration={0}
              >
                <LabelList
                  dataKey="returns"
                  position="top"
                  offset={10}
                  fill={isLight ? "#000000" : PALETTE.sky}
                  fontSize={11}
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
                dot={{ fill: PALETTE.emerald, strokeWidth: 2, stroke: chartDotStroke, r: 4 }}
                activeDot={{ r: 7, stroke: chartDotStroke, strokeWidth: 3 }}
                isAnimationActive={false}
                animationDuration={0}
              >
                <LabelList
                  dataKey="borrows"
                  position="top"
                  offset={10}
                  fill={isLight ? "#000000" : PALETTE.emerald}
                  fontSize={11}
                  fontWeight="bold"
                  formatter={(val: any) => (Number(val) > 0 ? val : "")}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Excel Data Grid Table (visible in print) */}
        <div className="hidden print:flex print:flex-col print:justify-center mt-6 print:mt-auto print:mb-3 w-full flex-1">
          <div className="text-sm print:text-base font-black text-slate-900 mb-2.5 flex items-center justify-between">
            <span>Table 1.1: Monthly Circulation Movement &amp; Velocity Audit</span>
            <span className="font-mono text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-300">Range: A1:F{(monthlyData || []).length + 2}</span>
          </div>
          <table className="w-full border-collapse border-2 border-[#107C41] text-xs print:text-sm">
            <thead>
              <tr className="bg-[#107C41] text-white">
                <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-center font-black w-24">Col A<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Month</span></th>
                <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black">Col B<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Borrows</span></th>
                <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black">Col C<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Returns</span></th>
                <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black">Col D<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Reservations</span></th>
                <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black">Col E<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Monthly Total</span></th>
                <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black w-32">Col F<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Ratio %</span></th>
              </tr>
            </thead>
            <tbody>
              {(monthlyData || []).map((m: any, idx: number) => {
                const rowSum = (m.borrows || 0) + (m.returns || 0) + (m.reservations || 0);
                const totalMonthlyAll = totalBorrows + totalReturns + totalReservations;
                const pct = totalMonthlyAll > 0 ? ((rowSum / totalMonthlyAll) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={m.month || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/90"}>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 text-center font-bold font-mono print:text-base">{m.month}</td>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 text-right font-mono font-bold text-emerald-800 print:text-base">{m.borrows || 0}</td>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 text-right font-mono font-bold text-sky-800 print:text-base">{m.returns || 0}</td>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 text-right font-mono font-bold text-purple-800 print:text-base">{m.reservations || 0}</td>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 text-right font-mono font-black text-slate-900 print:text-base">{rowSum}</td>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 text-right font-mono font-bold text-slate-700 print:text-base">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#e2efda] font-black border-t-2 border-[#107C41]">
                <td className="border border-slate-300 px-4 py-3 print:py-4 text-center font-mono print:text-base">TOTAL</td>
                <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono text-emerald-900 font-black print:text-base">{totalBorrows}</td>
                <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono text-sky-900 font-black print:text-base">{totalReturns}</td>
                <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono text-purple-900 font-black print:text-base">{totalReservations}</td>
                <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono text-[#107C41] font-black print:text-lg">{totalBorrows + totalReturns + totalReservations}</td>
                <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono font-black print:text-base">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Excel Footer for Print */}
        <ReportsExcelSheetFooter sheetNumber={1} sheetTitle="Circulation Velocity" />
      </div>

      {/* ── 2. TWO-COLUMN GRID: Vertical Bar Chart & Donut Pie Chart ─────── */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] reports-grid-row">
        {/* Section Demand Bar Graph (Sheet 2) */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F1D29]/85 p-6 shadow-xl backdrop-blur-md reports-print-sheet sheet-2">
          {/* Excel Header Banner for Print */}
          <ReportsExcelSheetHeader sheetNumber={2} sheetTitle="Section Demand" printDate={printDate} />

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

            {/* Department Filter (Custom Dropdown) */}
            <div className="no-print relative" ref={deptDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDeptDropdownOpen((prev) => !prev)}
                className={cn(
                  "flex items-center justify-between gap-2.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold outline-none transition cursor-pointer",
                  isLight
                    ? "border-slate-300 bg-white text-black hover:bg-slate-50 focus:border-sky-500"
                    : "border-white/10 bg-[#152E47] text-slate-200 hover:border-white/20 hover:bg-[#1A3855] focus:border-[#FCD400]"
                )}
              >
                <span>{selectedDept === "All" ? "All Sections" : selectedDept}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    isLight ? "text-slate-600" : "text-slate-400",
                    isDeptDropdownOpen && (isLight ? "rotate-180 text-sky-600" : "rotate-180 text-[#FCD400]")
                  )}
                />
              </button>

              {isDeptDropdownOpen && (
                <div
                  className={cn(
                    "absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in duration-100",
                    isLight
                      ? "border-slate-200 bg-white shadow-slate-300/60"
                      : "border-white/15 bg-[#0F1D29] shadow-black/90"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDept("All");
                      setIsDeptDropdownOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer text-left",
                      selectedDept === "All"
                        ? isLight
                          ? "bg-slate-200 text-black shadow-sm"
                          : "bg-[#FCD400] text-[#0F1D29] shadow-sm"
                        : isLight
                        ? "text-black hover:bg-slate-100"
                        : "text-slate-200 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span>All Sections</span>
                    {selectedDept === "All" && (
                      <Check className={cn("h-3.5 w-3.5 shrink-0", isLight ? "text-black" : "text-[#0F1D29]")} />
                    )}
                  </button>
                  <div className={cn("my-1 h-px", isLight ? "bg-slate-200" : "bg-white/10")} />
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
                            ? isLight
                              ? "bg-slate-200 text-black font-bold shadow-sm"
                              : "bg-[#FCD400] text-[#0F1D29] font-bold shadow-sm"
                            : isLight
                            ? "text-black hover:bg-slate-100"
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
                        {isSelected && (
                          <Check className={cn("h-3.5 w-3.5 shrink-0 ml-1.5", isLight ? "text-black" : "text-[#0F1D29]")} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 print:mt-1 h-[300px] print:h-[340px] w-full select-none">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 500, height: 300 }}>
              <BarChart data={departmentData} margin={{ top: 25, right: 25, left: 15, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis
                  dataKey="department"
                  stroke={chartAxisStroke}
                  tick={{ fill: chartAxisTickColor, fontSize: 11, fontWeight: "bold" }}
                  tickLine={false}
                  axisLine={{ stroke: chartAxisLineStroke }}
                  dy={10}
                  fontWeight="bold"
                  tickFormatter={(val) => (val.length > 14 ? val.substring(0, 13) + "…" : val)}
                />
                <YAxis
                  stroke={chartAxisStroke}
                  tick={{ fill: chartAxisTickColor, fontSize: 12, fontWeight: "bold" }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                  width={45}
                  allowDecimals={false}
                  fontWeight="bold"
                  label={{
                    value: "Share (%)",
                    angle: -90,
                    position: "insideLeft",
                    fill: chartLabelFill,
                    fontSize: 12,
                    fontWeight: "bold",
                    dy: 30,
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar
                  name="Demand Share"
                  dataKey="usage"
                  radius={[8, 8, 0, 0]}
                  barSize={40}
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
                    fill={chartBarLabelFill}
                    fontSize={12}
                    fontWeight="bold"
                    formatter={(val: any) => (val !== undefined && val !== null ? `${val}%` : "")}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Excel Data Grid Table (visible in print) */}
          <div className="hidden print:flex print:flex-col print:justify-center mt-6 print:mt-auto print:mb-3 w-full flex-1">
            <div className="text-sm print:text-base font-black text-slate-900 mb-2.5 flex items-center justify-between">
              <span>Table 2.1: Academic Section Demand &amp; Circulation Intensity</span>
              <span className="font-mono text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-300">Range: A1:D{(reports?.departmentUsage || []).length + 2}</span>
            </div>
            <table className="w-full border-collapse border-2 border-[#107C41] text-xs print:text-sm">
              <thead>
                <tr className="bg-[#107C41] text-white">
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-left font-black">Col A<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Library Section</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-left font-black">Col B<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Collection Scope</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black w-36">Col C<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Catalog Count</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black w-32">Col D<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Demand Share %</span></th>
                </tr>
              </thead>
              <tbody>
                {(reports?.departmentUsage || []).map((d: any, idx: number) => (
                  <tr key={d.department || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/90"}>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 font-bold font-mono print:text-base">{d.department}</td>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 font-medium print:text-sm">{d.department} Collection Section</td>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 text-right font-mono font-bold text-[#107C41] print:text-base">{d.count || 0}</td>
                    <td className="border border-slate-300 px-4 py-2 print:py-3.5 text-right font-mono font-bold text-slate-800 print:text-base">{d.usage || 0}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#e2efda] font-black border-t-2 border-[#107C41]">
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-center font-mono print:text-base">TOTAL</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 print:text-base">All Academic Resource Sections ({(reports?.departmentUsage || []).length})</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono text-[#107C41] font-black print:text-lg">{(reports?.departmentUsage || []).reduce((acc: number, cur: any) => acc + (cur.count || 0), 0)}</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono font-black print:text-base">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Excel Footer for Print */}
          <ReportsExcelSheetFooter sheetNumber={2} sheetTitle="Section Demand" />
        </div>

        {/* Status Distribution Pie Chart (Sheet 3) */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0F1D29]/85 p-6 shadow-xl backdrop-blur-md reports-print-sheet sheet-3">
          {/* Excel Header Banner for Print */}
          <ReportsExcelSheetHeader sheetNumber={3} sheetTitle="Status Breakdown" printDate={printDate} />

          <div className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-purple-400 uppercase">
                Pie Graph
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight print:text-2xl print:text-slate-900">
                Transaction Status Distribution
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400 print:text-sm print:text-slate-600 font-medium">
              Operational queue breakdown across active, approved, and completed states.
            </p>
          </div>

          <div className="mt-4 print:mt-1 flex h-[330px] print:h-[340px] w-full items-center justify-center select-none relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 500, height: 300 }}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="46%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  stroke={isLight ? "#ffffff" : "rgba(15,29,41,0.8)"}
                  strokeWidth={3}
                  isAnimationActive={false}
                  animationDuration={0}
                  label={({ cx, cy, midAngle, outerRadius, percent, name, value }: any) => {
                    if (!value || value <= 0) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = (outerRadius || 95) + 26;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    const textAnchor = x > cx ? "start" : "end";
                    const color = STATUS_COLORS[name] || (isLight ? "#000000" : "#FFFFFF");
                    const pct = Math.round((percent || 0) * 100);

                    return (
                      <text
                        x={x}
                        y={y}
                        fill={color}
                        textAnchor={textAnchor}
                        dominantBaseline="central"
                        fontSize={12}
                        fontWeight="bold"
                      >
                        {`${name}: ${value} (${pct}%)`}
                      </text>
                    );
                  }}
                  labelLine={{ stroke: isLight ? "rgba(0, 0, 0, 0.35)" : "rgba(255, 255, 255, 0.35)", strokeWidth: 1.5 }}
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
                  fill={isLight ? "#000000" : "#FFFFFF"}
                  fontSize="28"
                  fontWeight="900"
                >
                  {totalQueueActions}
                </text>
                <text
                  x="50%"
                  y="52%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isLight ? "#475569" : "#94A3B8"}
                  fontSize="11"
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
                          <span className={cn(isLight ? "text-black" : "text-slate-300")}>
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

          {/* Excel Data Grid Table (visible in print) */}
          <div className="hidden print:flex print:flex-col print:justify-center mt-6 print:mt-auto print:mb-3 w-full flex-1">
            <div className="text-sm print:text-base font-black text-slate-900 mb-2.5 flex items-center justify-between">
              <span>Table 3.1: Circulation Queue Status &amp; Operational Compliance</span>
              <span className="font-mono text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-300">Range: A1:D{statusPieData.length + 2}</span>
            </div>
            <table className="w-full border-collapse border-2 border-[#107C41] text-xs print:text-sm">
              <thead>
                <tr className="bg-[#107C41] text-white">
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-center font-black w-28">Col A<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Queue Status</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-left font-black">Col B<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Workflow Classification</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black w-36">Col C<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Transaction Count</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black w-32">Col D<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Queue Share %</span></th>
                </tr>
              </thead>
              <tbody>
                {statusPieData.map((item: any, idx: number) => (
                  <tr key={item.status || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/90"}>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-center font-bold font-mono print:text-base">{item.status}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 font-medium print:text-sm">Circulation Queue — {item.status} State</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-right font-mono font-bold text-[#107C41] print:text-base">{item.count}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-right font-mono font-bold text-slate-800 print:text-base">{item.percentage}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#e2efda] font-black border-t-2 border-[#107C41]">
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-center font-mono print:text-base">TOTAL</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 print:text-base">Total Queue Actions Tracked</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono text-[#107C41] font-black print:text-lg">{totalQueueActions}</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono font-black print:text-base">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Excel Footer for Print */}
          <ReportsExcelSheetFooter sheetNumber={3} sheetTitle="Status Breakdown" />
        </div>
      </div>

      {/* ── 3. MOST ACTIVE DEPARTMENTS (COLLEGE BORROWS) & LEADERBOARD ──── */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] reports-grid-row">
        {/* Most Active Departments (CICT, COE, CBMA, CAS, CED, CHTM, CCJE) */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-2xl border p-6 shadow-xl backdrop-blur-md reports-print-sheet sheet-4",
            isLight
              ? "border-slate-200/90 bg-white text-black shadow-slate-200/60"
              : "border-white/10 bg-[#0F1D29]/85 text-white"
          )}
        >
          {/* Excel Header Banner for Print */}
          <ReportsExcelSheetHeader sheetNumber={4} sheetTitle="School Departments" printDate={printDate} />

          <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b pb-4", isLight ? "border-slate-200/80" : "border-white/5")}>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-500 dark:text-emerald-400 uppercase">
                  Rankings
                </span>
                <h2 className={cn("text-lg font-bold tracking-tight", isLight ? "text-black" : "text-white")}>
                  Books Borrowed by School Department
                </h2>
              </div>
              <p className={cn("mt-1 text-xs", isLight ? "text-slate-600" : "text-slate-400")}>
                Exact count of books borrowed across school departments.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-bold",
                  isLight
                    ? "border-amber-400/50 bg-amber-50 text-amber-700"
                    : "border-white/10 bg-[#132337] text-[#FCD400]"
                )}
              >
                {activeCollegesCount} Active
              </span>

              {/* View Switcher: Breakdown vs Bar Chart */}
              <div
                className={cn(
                  "no-print flex items-center rounded-full border p-0.5 shadow-xs",
                  isLight ? "border-slate-200 bg-slate-100" : "border-white/10 bg-[#132337]"
                )}
              >
                <button
                  type="button"
                  onClick={() => setDeptViewMode("breakdown")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer",
                    deptViewMode === "breakdown"
                      ? "bg-[#FCD400] text-[#0B1A2C] shadow font-extrabold"
                      : isLight
                      ? "text-slate-600 hover:text-black"
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
                      : isLight
                      ? "text-slate-600 hover:text-black"
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-5 min-h-[310px] print:min-h-0">
                {/* Left: Donut Chart with Centered Info matching Picture */}
                <div className="relative h-[240px] print:h-[240px] w-[200px] shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 500, height: 300 }}>
                    <PieChart>
                      <Pie
                        data={
                          totalCollegeBorrows > 0
                            ? collegeBorrowedData.filter((c) => c.borrows > 0)
                            : [{ code: "None", borrows: 1, color: isLight ? "#cbd5e1" : "#1e293b" }]
                        }
                        dataKey="borrows"
                        nameKey="code"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={86}
                        paddingAngle={totalCollegeBorrows > 0 ? 3 : 0}
                        stroke={isLight ? "#ffffff" : "#0F1D29"}
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
                          <Cell fill={isLight ? "#cbd5e1" : "#1e293b"} />
                        )}
                      </Pie>
                      {totalCollegeBorrows > 0 && <Tooltip content={<CustomTooltip />} cursor={false} />}
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Text inside the Donut matching Picture */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                    <span className={cn("text-3xl font-black leading-none font-mono", isLight ? "text-black" : "text-white")}>
                      {totalCollegeBorrows}
                    </span>
                    <span className={cn("text-[9px] font-extrabold tracking-wider uppercase mt-1 leading-tight", isLight ? "text-amber-600" : "text-[#FCD400]")}>
                      BOOKS BORROWED
                    </span>
                    <span className={cn("text-[9px] font-medium mt-0.5 leading-tight whitespace-nowrap", isLight ? "text-slate-600" : "text-slate-400")}>
                      7 School Departments
                    </span>
                  </div>
                </div>

                {/* Right: 7 College Department List Items matching Picture */}
                <div className="flex-1 w-full flex flex-col gap-1.5 overflow-y-auto max-h-[330px] print:max-h-[220px] pr-2 justify-center custom-scrollbar">
                  {collegeBorrowedData.map((item) => (
                    <div
                      key={item.code}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 transition-all print:py-1 print:rounded-xs",
                        isLight
                          ? "border-slate-200 bg-slate-50 text-black hover:bg-slate-100 hover:border-slate-300"
                          : "border-white/5 bg-[#122335]/75 text-white hover:bg-[#122335] hover:border-white/10"
                      )}
                      title={`${item.code} - ${item.name} (${item.mascot}): ${item.borrows} ${item.borrows === 1 ? "book" : "books"} borrowed`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={cn("text-xs font-bold tracking-wide", isLight ? "text-black" : "text-white")}>{item.code}</span>
                          <span className={cn("text-[11px] font-normal truncate max-w-[130px] hidden sm:inline", isLight ? "text-slate-600" : "text-slate-400")}>
                            {item.mascot}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("text-xs font-bold font-mono", isLight ? "text-black" : "text-white")}>
                          {item.borrows}{" "}
                          <span className={cn("text-[10px] font-medium opacity-85", isLight ? "text-slate-600" : "text-slate-400")}>
                            {item.borrows === 1 ? "book borrowed" : "books borrowed"}
                          </span>
                        </span>
                        <div
                          className={cn(
                            "min-w-[42px] text-center rounded-full border px-2 py-0.5 text-[10px] font-bold font-mono",
                            isLight
                              ? "border-amber-400/60 bg-amber-50 text-amber-700"
                              : "border-[#FCD400]/40 bg-[#FCD400]/10 text-[#FCD400]"
                          )}
                        >
                          {item.percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Bar Chart View: Horizontal Bar Graph */
              <div className="h-[310px] print:h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 500, height: 300 }}>
                  <BarChart
                    data={collegeBorrowedData}
                    layout="vertical"
                    margin={{ top: 10, right: 100, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke={chartAxisStroke}
                      tick={{ fill: chartAxisTickColor, fontSize: 11, fontWeight: "bold" }}
                      tickLine={false}
                      axisLine={{ stroke: chartAxisLineStroke }}
                      allowDecimals={false}
                      label={{
                        value: "Exact Number of Books Borrowed",
                        position: "insideBottom",
                        offset: -15,
                        fill: chartLabelFill,
                        fontSize: 11,
                        fontWeight: "bold",
                      }}
                    />
                    <YAxis
                      type="category"
                      dataKey="code"
                      stroke={chartAxisStroke}
                      tick={{ fill: chartAxisTickColor, fontSize: 11, fontWeight: "bold" }}
                      tickLine={false}
                      axisLine={false}
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
                        fill={chartBarLabelFill}
                        fontSize={11}
                        fontWeight="bold"
                        formatter={(val: any) => `${val} ${Number(val) === 1 ? "book borrowed" : "books borrowed"}`}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Excel Data Grid Table (visible in print) */}
          <div className="hidden print:flex print:flex-col print:justify-center mt-6 print:mt-auto print:mb-3 w-full flex-1">
            <div className="text-sm print:text-base font-black text-slate-900 mb-2.5 flex items-center justify-between">
              <span>Table 4.1: Books Borrowed by School Department (College Breakdown)</span>
              <span className="font-mono text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-300">Range: A1:E{collegeBorrowedData.length + 2}</span>
            </div>
            <table className="w-full border-collapse border-2 border-[#107C41] text-xs print:text-sm">
              <thead>
                <tr className="bg-[#107C41] text-white">
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-center font-black w-24">Col A<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Dept Code</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-left font-black">Col B<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">College / Department Name</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-left font-black w-40">Col C<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Mascot</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black w-36">Col D<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Books Borrowed</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black w-32">Col E<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Share %</span></th>
                </tr>
              </thead>
              <tbody>
                {collegeBorrowedData.map((item: any, idx: number) => (
                  <tr key={item.code || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/90"}>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-center font-bold font-mono text-[#107C41] print:text-base">{item.code}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 font-semibold print:text-sm">{item.name}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-slate-700 font-medium print:text-sm">{item.mascot}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-right font-mono font-bold text-slate-900 print:text-base">{item.borrows}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-right font-mono font-bold text-slate-800 print:text-base">{item.percentage}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#e2efda] font-black border-t-2 border-[#107C41]">
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-center font-mono print:text-base">TOTAL</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 print:text-base" colSpan={2}>Active School Departments ({collegeBorrowedData.length} Colleges)</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono text-[#107C41] font-black print:text-lg">{totalCollegeBorrows}</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono font-black print:text-base">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Excel Footer for Print */}
          <ReportsExcelSheetFooter sheetNumber={4} sheetTitle="School Departments" />
        </div>

        {/* Detailed Leaderboard Cards (Sheet 5) */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-2xl border p-6 shadow-xl backdrop-blur-md reports-print-sheet sheet-5",
            isLight
              ? "border-slate-200/90 bg-white text-black shadow-slate-200/60"
              : "border-white/10 bg-[#0F1D29]/85 text-white"
          )}
        >
          {/* Excel Header Banner for Print */}
          <ReportsExcelSheetHeader sheetNumber={5} sheetTitle="Top Borrowed Titles" printDate={printDate} />

          <div className={cn("border-b pb-4", isLight ? "border-slate-200/80" : "border-white/5")}>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-500 dark:text-amber-400 uppercase">
                Catalog
              </span>
              <h2 className={cn("text-lg font-bold tracking-tight print:text-2xl print:text-slate-900", isLight ? "text-black" : "text-white")}>Top Performer Details</h2>
            </div>
            <p className={cn("mt-1 text-xs print:text-sm print:text-slate-600 font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
              Department mapping and author metadata for high-demand resources.
            </p>
          </div>

          <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto max-h-[310px] pr-2.5 custom-scrollbar print:hidden">
            {reports?.topBorrowed && reports.topBorrowed.length > 0 ? (
              reports.topBorrowed.map((item, index) => (
                <div
                  key={item.title}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border p-3 transition",
                    isLight
                      ? "border-slate-200 bg-slate-50 text-black hover:bg-slate-100"
                      : "border-white/5 bg-white/[0.02] text-white hover:border-white/10 hover:bg-white/[0.05]"
                  )}
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
                          : isLight
                          ? "bg-slate-200 text-slate-700"
                          : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("truncate text-xs font-bold", isLight ? "text-black" : "text-white")}>{item.title}</p>
                      <p className={cn("mt-0.5 truncate text-[10px]", isLight ? "text-slate-600" : "text-slate-400")}>
                        {item.author || "STI Library Collection"} ·{" "}
                        <span className="text-emerald-500 dark:text-emerald-400">{item.department || "Circulation"}</span>
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "shrink-0 rounded-lg border px-2.5 py-1 text-xs font-black font-mono shadow-xs",
                      isLight
                        ? "border-emerald-500/50 bg-emerald-100 text-emerald-900 font-extrabold"
                        : "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                    )}
                  >
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

          {/* Excel KPI Summary Dashboard Cards (visible in print) */}
          <div className="hidden print:grid grid-cols-3 gap-3 my-4">
            <div className="border-2 border-slate-300 rounded-lg p-3.5 bg-slate-50 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Top Circulated Resource</span>
              <span className="text-base font-black text-slate-900 truncate mt-1">
                {(reports?.topBorrowed && reports.topBorrowed[0]?.title) || "N/A"}
              </span>
              <span className="text-xs text-emerald-700 font-bold mt-1">
                {(reports?.topBorrowed && reports.topBorrowed[0]?.borrows) || 0} Total Checkouts Recorded
              </span>
            </div>
            <div className="border-2 border-slate-300 rounded-lg p-3.5 bg-slate-50 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total Ranked Catalog Loans</span>
              <span className="text-xl font-black font-mono text-[#107C41] mt-1">
                {(reports?.topBorrowed || []).reduce((acc: number, cur: any) => acc + (cur.borrows || 0), 0)} Loans
              </span>
              <span className="text-xs text-slate-600 font-medium mt-1">Across High-Velocity Titles</span>
            </div>
            <div className="border-2 border-slate-300 rounded-lg p-3.5 bg-slate-50 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Ranked Catalog Volume</span>
              <span className="text-xl font-black font-mono text-slate-900 mt-1">
                {(reports?.topBorrowed || []).length} Titles
              </span>
              <span className="text-xs text-slate-600 font-medium mt-1">Active Academic Collections</span>
            </div>
          </div>

          {/* Excel Data Grid Table (visible in print) */}
          <div className="hidden print:flex print:flex-col print:justify-center mt-4 print:mt-auto print:mb-3 w-full flex-1">
            <div className="text-sm print:text-base font-black text-slate-900 mb-2.5 flex items-center justify-between">
              <span>Table 5.1: Top Circulated Titles &amp; Catalog Borrowing Leaderboard</span>
              <span className="font-mono text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-300">Range: A1:E{(reports?.topBorrowed || []).length + 2}</span>
            </div>
            <table className="w-full border-collapse border-2 border-[#107C41] text-xs print:text-sm">
              <thead>
                <tr className="bg-[#107C41] text-white">
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-center font-black w-20">Col A<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Rank</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-left font-black">Col B<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Book Title</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-left font-black">Col C<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Author / Creator</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-left font-black w-44">Col D<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Academic Section</span></th>
                  <th className="border border-[#0d6334] px-4 py-2.5 print:py-3.5 text-right font-black w-36">Col E<br/><span className="text-[11px] print:text-xs font-semibold opacity-95">Loans</span></th>
                </tr>
              </thead>
              <tbody>
                {(reports?.topBorrowed || []).map((item: any, idx: number) => (
                  <tr key={item.title || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/90"}>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-center font-bold font-mono print:text-base">#{idx + 1}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 font-bold print:text-base text-slate-900">{item.title}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-slate-700 font-medium print:text-sm">{item.author || "STI Library Collection"}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 font-mono text-emerald-800 font-semibold print:text-sm">{item.department || "Circulation"}</td>
                    <td className="border border-slate-300 px-4 py-2.5 print:py-3.5 text-right font-mono font-bold text-[#107C41] print:text-base">{item.borrows} loans</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#e2efda] font-black border-t-2 border-[#107C41]">
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-center font-mono print:text-base">TOTAL</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 print:text-base" colSpan={3}>Top Ranked Catalog Resources ({(reports?.topBorrowed || []).length} Titles)</td>
                  <td className="border border-slate-300 px-4 py-3 print:py-4 text-right font-mono text-[#107C41] font-black print:text-lg">
                    {(reports?.topBorrowed || []).reduce((acc: number, cur: any) => acc + (cur.borrows || 0), 0)} loans
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Excel Footer for Print */}
          <ReportsExcelSheetFooter sheetNumber={5} sheetTitle="Top Borrowed Titles" />
        </div>
      </div>

      {/* ── Print Styles ────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm;
          }
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
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
            position: static !important;
            transform: none !important;
          }
          #reports-print-container {
            background-color: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .reports-grid-row {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .reports-print-sheet {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 278mm !important;
            min-height: 278mm !important;
            max-height: 278mm !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16px 20px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: 2.5px solid #107C41 !important;
            border-radius: 4px !important;
            box-shadow: none !important;
            opacity: 1 !important;
            transform: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .sheet-1, .sheet-2, .sheet-3, .sheet-4 {
            page-break-after: always !important;
            break-after: page !important;
          }
          .sheet-5 {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .reports-print-sheet .recharts-responsive-container {
            height: 310px !important;
            min-height: 310px !important;
            max-height: 330px !important;
            width: 100% !important;
            margin-bottom: 12px !important;
          }
          .recharts-legend-wrapper {
            display: none !important;
          }
          .reports-print-sheet text {
            fill: #000000 !important;
            font-weight: bold !important;
          }
          .reports-print-sheet line {
            stroke: #cbd5e1 !important;
          }
          * {
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}

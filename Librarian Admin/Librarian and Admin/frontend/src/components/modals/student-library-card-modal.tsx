"use client";

import { useEffect, useMemo } from "react";
import { X, CreditCard, BookOpen, Clock, CheckCircle2, QrCode } from "lucide-react";
import type { TransactionRecord } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";

interface StudentLibraryCardModalProps {
  open: boolean;
  onClose: () => void;
  student: {
    name: string;
    studentId: string;
    department?: string;
    course?: string;
    qrCode?: string;
    avatar?: string;
  } | null;
  transactions: TransactionRecord[];
}

function formatBorrowDateTime(dateStr?: string | Date) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const ymd = d.toISOString().split("T")[0];
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    return `${ymd} ${time}`;
  } catch {
    return String(dateStr);
  }
}

function formatDueDate(dateStr?: string | Date) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toISOString().split("T")[0];
  } catch {
    return String(dateStr);
  }
}

export function StudentLibraryCardModal({
  open,
  onClose,
  student,
  transactions,
}: StudentLibraryCardModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const studentBorrows = useMemo(() => {
    if (!student) return [];
    const seen = new Set<string>();
    return transactions.filter((t) => {
      if (!t) return false;
      const targetStudentId = (t.studentId || "").toLowerCase().trim();
      const currentStudentId = (student.studentId || "").toLowerCase().trim();
      const targetStudentName = (t.studentName || "").toLowerCase().trim();
      const currentStudentName = (student.name || "").toLowerCase().trim();
      const matchesStudent =
        (targetStudentId && targetStudentId === currentStudentId) ||
        (targetStudentName && (targetStudentName.includes(currentStudentName) || currentStudentName.includes(targetStudentName)));
      const isBorrow =
        t.type === "Borrow" || (t as any).action === "Borrow" || !t.type;
      const isApprovedOrActive = t.status === "Approved" || t.status === "Returned" || (t.status as string) === "Completed";
      if (!matchesStudent || !isBorrow || !isApprovedOrActive) return false;

      const uniqueKey = t.id || `${t.studentId}-${t.resourceTitle}-${t.requestedAt}`;
      if (seen.has(uniqueKey)) return false;
      seen.add(uniqueKey);
      return true;
    });
  }, [student, transactions]);

  const activeLoansCount = useMemo(() => {
    return studentBorrows.filter((t) => t.status === "Approved").length;
  }, [studentBorrows]);

  const returnedCount = useMemo(() => {
    return studentBorrows.filter((t) => t.status === "Returned" || (t.status as string) === "Completed").length;
  }, [studentBorrows]);

  if (!open || !student) return null;

  // Render 16 lined rows to match the official mobile pass ledger visual
  const TOTAL_ROWS = Math.max(16, studentBorrows.length);
  const rows = Array.from({ length: TOTAL_ROWS }, (_, i) => studentBorrows[i] || null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className={cn("fixed inset-0 backdrop-blur-sm transition-opacity", isLight ? "bg-slate-900/40" : "bg-black/80")}
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className={cn(
        "relative w-full max-w-2xl rounded-2xl p-6 shadow-2xl transition-all max-h-[90vh] flex flex-col",
        isLight ? "border-2 border-slate-200 bg-white text-slate-800 shadow-slate-300/60" : "border border-[#263650] bg-[#111A2E] shadow-black/60"
      )}>
        {/* Modal Top Header */}
        <div className={cn("flex items-center justify-between pb-4 border-b", isLight ? "border-slate-200" : "border-[#1E293B]")}>
          <div className="flex items-center gap-3">
            {student.avatar && (student.avatar.startsWith("http") || student.avatar.startsWith("data:")) && !student.avatar.includes("placeholder.com") ? (
              <img
                src={student.avatar}
                alt={student.name}
                className="h-10 w-10 rounded-xl object-cover border-2 border-[#FCD400]"
              />
            ) : (
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl font-black",
                isLight ? "bg-blue-50 text-[#0274BB] border border-blue-200" : "bg-[#FCD400]/15 text-[#FCD400]"
              )}>
                <CreditCard className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn("text-lg font-black tracking-tight uppercase", isLight ? "text-[#0274BB]" : "text-white")}>
                  Student Library Card
                </h3>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider",
                  isLight ? "bg-[#FFF300] text-[#0274BB] border border-[#ebd000]" : "bg-[#FCD400]/15 text-[#FCD400]"
                )}>
                  OFFICIAL PASS
                </span>
              </div>
              <p className={cn("text-xs", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>
                Book borrow history & physical card ledger for {student.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer",
              isLight ? "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800" : "border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-5 py-4 pr-1">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className={cn(
              "rounded-xl border p-3 text-center",
              isLight ? "border-2 border-slate-200 bg-slate-50" : "border border-white/5 bg-[#15233A]"
            )}>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isLight ? "text-slate-600" : "text-slate-400")}>Total Borrowed</span>
              <p className={cn("mt-1 text-xl font-black", isLight ? "text-[#0274BB]" : "text-white")}>{studentBorrows.length}</p>
            </div>
            <div className={cn(
              "rounded-xl border p-3 text-center",
              isLight ? "border-2 border-emerald-300 bg-emerald-50 text-emerald-800 shadow-xs" : "border border-emerald-500/20 bg-emerald-500/10"
            )}>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isLight ? "text-emerald-800" : "text-emerald-300")}>Active Loans</span>
              <p className={cn("mt-1 text-xl font-black", isLight ? "text-emerald-800" : "text-emerald-400")}>{activeLoansCount}</p>
            </div>
            <div className={cn(
              "rounded-xl border p-3 text-center",
              isLight ? "border-2 border-sky-300 bg-sky-50 text-sky-800 shadow-xs" : "border border-sky-500/20 bg-sky-500/10"
            )}>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isLight ? "text-sky-800" : "text-sky-300")}>Returned</span>
              <p className={cn("mt-1 text-xl font-black", isLight ? "text-sky-800" : "text-sky-400")}>{returnedCount}</p>
            </div>
          </div>

          {/* PHYSICAL LIBRARY CARD CONTAINER (Matches Mobile & Ledger Design) */}
          <div className={cn(
            "rounded-2xl border p-5 shadow-sm",
            isLight ? "border-2 border-slate-200 bg-white" : "border border-[#2E3F5C] bg-[#142033] shadow-lg"
          )}>
            {/* Header inside card */}
            <div className={cn("flex items-center justify-between pb-3 border-b mb-4", isLight ? "border-slate-200" : "border-[#24334C]")}>
              <span className={cn("text-xs font-black tracking-widest uppercase", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                LIBRARY CARD
              </span>
              <div className={cn("flex items-center gap-1.5 text-xs font-mono font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
                <QrCode className={cn("h-4 w-4", isLight ? "text-[#0274BB]" : "text-[#FCD400]")} />
                <span>{student.qrCode || `e1a1-${student.studentId || "pass"}`}</span>
              </div>
            </div>

            {/* Table */}
            <div className={cn("rounded-xl border overflow-hidden text-xs", isLight ? "border-slate-200" : "border-[#2E3F5C]")}>
              {/* Row 1: Fullname */}
              <div className={cn("flex border-b", isLight ? "border-slate-200 bg-slate-50" : "border-[#2E3F5C] bg-[#16233B]/70")}>
                <div className={cn("w-[30%] px-3.5 py-2.5 border-r font-bold", isLight ? "border-slate-200 text-slate-700" : "border-[#2E3F5C] text-slate-300")}>
                  Fullname:
                </div>
                <div className={cn("flex-1 px-3.5 py-2.5 font-bold", isLight ? "text-[#0274BB]" : "text-white")}>
                  {student.name}
                </div>
              </div>

              {/* Row 2: Course & Section */}
              <div className={cn("flex border-b", isLight ? "border-slate-200 bg-slate-50" : "border-[#2E3F5C] bg-[#16233B]/70")}>
                <div className={cn("w-[30%] px-3.5 py-2.5 border-r font-bold", isLight ? "border-slate-200 text-slate-700" : "border-[#2E3F5C] text-slate-300")}>
                  Course & Section:
                </div>
                <div className={cn("flex-1 px-3.5 py-2.5 font-bold", isLight ? "text-[#0274BB]" : "text-white")}>
                  {student.course || student.department || "BS in Information Technology"}
                </div>
              </div>

              {/* Row 3: Column Headers */}
              <div className={cn(
                "flex border-b-2 text-[11px] font-black",
                isLight ? "border-slate-300 bg-blue-50/80 text-[#0274BB]" : "border-[#3B4E70] bg-[#1C2C4A] text-slate-200"
              )}>
                <div className={cn("w-[36%] px-3.5 py-2.5 border-r", isLight ? "border-slate-200" : "border-[#2E3F5C]")}>
                  Borrow Date & Time:
                </div>
                <div className={cn("w-[26%] px-3.5 py-2.5 border-r", isLight ? "border-slate-200" : "border-[#2E3F5C]")}>
                  Due Return Date:
                </div>
                <div className="flex-1 px-3.5 py-2.5">
                  Book Title
                </div>
              </div>

              {/* Data / Grid Rows */}
              {rows.map((row, idx) => (
                <div
                  key={row?.id ? `borrow-row-${row.id}-${idx}` : `empty-row-${idx}`}
                  className={cn(
                    "flex border-b last:border-b-0 min-h-[30px] items-center transition-colors",
                    isLight
                      ? "border-slate-100 hover:bg-blue-50/40 text-slate-800"
                      : "border-[#24334C] hover:bg-white/[0.02] text-white"
                  )}
                >
                  <div className={cn("w-[36%] px-3.5 py-1.5 border-r font-mono text-[11px]", isLight ? "border-slate-100 text-slate-600 font-medium" : "border-[#24334C] text-slate-300")}>
                    {row?.requestedAt ? formatBorrowDateTime(row.requestedAt) : ""}
                  </div>
                  <div className={cn("w-[26%] px-3.5 py-1.5 border-r font-mono text-[11px]", isLight ? "border-slate-100 text-slate-600 font-medium" : "border-[#24334C] text-slate-300")}>
                    {row?.dueDate ? formatDueDate(row.dueDate) : ""}
                  </div>
                  <div className={cn("flex-1 px-3.5 py-1.5 font-semibold truncate flex items-center justify-between gap-2", isLight ? "text-slate-900" : "text-white")}>
                    <span className="truncate">{row?.resourceTitle || ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={cn("flex items-center justify-between pt-4 border-t", isLight ? "border-slate-200" : "border-[#1E293B]")}>
          <span className={cn("text-[11px] font-mono", isLight ? "text-slate-600 font-medium" : "text-slate-400")}>
            Student ID: <span className={cn("font-bold", isLight ? "text-[#0274BB]" : "text-white")}>{student.studentId}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-xl px-5 py-2 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm",
              isLight ? "bg-[#FFF300] text-[#0274BB] border border-[#ebd000] hover:bg-[#ebd000]" : "bg-[#FCD400] text-[#0b1c2c] hover:brightness-110"
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

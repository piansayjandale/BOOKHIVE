"use client";

import { useEffect, useMemo } from "react";
import { X, ShieldAlert, AlertTriangle, CheckCircle2, Clock, DollarSign } from "lucide-react";
import type { TransactionRecord } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";

interface StudentViolationModalProps {
  open: boolean;
  onClose: () => void;
  student: {
    name: string;
    studentId: string;
    department?: string;
    course?: string;
    currentTransaction?: TransactionRecord;
  } | null;
  transactions: TransactionRecord[];
}

function isOverdue(dateStr?: string) {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due.getTime() < now.getTime();
}

function getOverdueDays(dateStr?: string) {
  if (!dateStr) return 0;
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

export function StudentViolationModal({
  open,
  onClose,
  student,
  transactions,
}: StudentViolationModalProps) {
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

  const studentViolations = useMemo(() => {
    if (!student) return [];
    
    // Find all matching transactions for this student that are overdue
    const matched = transactions.filter(
      (t) =>
        (t.studentId === student.studentId ||
          t.studentName.toLowerCase() === student.name.toLowerCase()) &&
        t.status === "Approved" &&
        isOverdue(t.dueDate)
    );

    // If currentTransaction is passed and overdue, make sure it's included
    if (
      student.currentTransaction &&
      student.currentTransaction.status === "Approved" &&
      isOverdue(student.currentTransaction.dueDate) &&
      !matched.some((m) => m.id === student.currentTransaction?.id)
    ) {
      matched.push(student.currentTransaction);
    }

    return matched;
  }, [student, transactions]);

  const totalPenalty = useMemo(() => {
    return studentViolations.reduce((acc, curr) => {
      const days = getOverdueDays(curr.dueDate);
      return acc + Math.max(1, days) * 10; // ₱10 per day overdue
    }, 0);
  }, [studentViolations]);

  if (!open || !student) return null;

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
        isLight ? "border-2 border-rose-200 bg-white text-slate-800 shadow-slate-300/60" : "border border-rose-500/30 bg-[#140E14] text-white shadow-black/80"
      )}>
        {/* Header */}
        <div className={cn("flex items-center justify-between pb-4 border-b", isLight ? "border-rose-100" : "border-rose-500/20")}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              isLight ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            )}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn("text-lg font-black tracking-tight uppercase", isLight ? "text-rose-700" : "text-white")}>
                  Violation Record
                </h3>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider",
                  isLight ? "bg-rose-100 border border-rose-300 text-rose-800" : "bg-rose-500/20 border border-rose-500/30 text-rose-300"
                )}>
                  DISCIPLINARY VIEW
                </span>
              </div>
              <p className={cn("text-xs", isLight ? "text-slate-500" : "text-rose-200/70")}>
                Active overdue book returns and penalty history for {student.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border transition",
              isLight ? "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800" : "border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
          {/* Student Banner */}
          <div className={cn(
            "grid grid-cols-2 gap-4 rounded-xl border p-4 text-xs",
            isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#1F1420]"
          )}>
            <div>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>Student Name</span>
              <p className={cn("font-bold text-sm mt-0.5", isLight ? "text-slate-900" : "text-white")}>{student.name}</p>
            </div>
            <div>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>Student ID / Section</span>
              <p className={cn("font-bold text-sm mt-0.5", isLight ? "text-slate-900" : "text-white")}>
                {student.studentId} · {student.department || student.course || "Circulation"}
              </p>
            </div>
          </div>

          {/* Violations Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Active Overdue Violations ({studentViolations.length})
                </h4>
              </div>
              {totalPenalty > 0 && (
                <span className={cn(
                  "text-xs font-bold px-2.5 py-1 rounded-lg border",
                  isLight ? "bg-rose-100 text-rose-800 border-rose-300" : "text-rose-300 bg-rose-500/20 border-rose-500/30"
                )}>
                  Total Fine: ₱{totalPenalty.toFixed(2)}
                </span>
              )}
            </div>

            {studentViolations.length === 0 ? (
              <div className={cn(
                "rounded-xl border p-6 text-center space-y-2",
                isLight ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-500/30 bg-emerald-500/10"
              )}>
                <CheckCircle2 className={cn("mx-auto h-8 w-8", isLight ? "text-emerald-600" : "text-emerald-400")} />
                <p className={cn("text-sm font-bold", isLight ? "text-emerald-900" : "text-emerald-300")}>No Active Violations</p>
                <p className={cn("text-xs max-w-sm mx-auto", isLight ? "text-emerald-700" : "text-emerald-400/80")}>
                  This student account is currently in good standing with zero overdue loans or recorded library policy penalties.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {studentViolations.map((item, idx) => {
                  const days = getOverdueDays(item.dueDate);
                  const fine = Math.max(1, days) * 10;

                  return (
                    <div
                      key={item.id || idx}
                      className={cn(
                        "rounded-xl border p-4 space-y-3",
                        isLight ? "border-rose-200 bg-rose-50/70" : "border-rose-500/30 bg-rose-950/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className={cn("text-[10px] font-extrabold uppercase tracking-wider", isLight ? "text-rose-700" : "text-rose-400")}>
                            Violation #{idx + 1} · Overdue Loan
                          </span>
                          <h5 className={cn("font-bold text-sm mt-0.5", isLight ? "text-slate-900" : "text-white")}>
                            {item.resourceTitle}
                          </h5>
                          <p className={cn("text-xs font-mono mt-0.5", isLight ? "text-slate-500" : "text-slate-400")}>
                            ISBN: {item.isbn || "N/A"}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold",
                            isLight ? "bg-rose-100 border-rose-300 text-rose-800" : "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                          )}>
                            <AlertTriangle className="h-3 w-3" />
                            {days} Day{days !== 1 ? "s" : ""} Overdue
                          </span>
                          <p className={cn("text-xs font-bold mt-1", isLight ? "text-amber-800 font-extrabold" : "text-amber-300")}>
                            Fine: ₱{fine.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className={cn("grid grid-cols-2 gap-2 text-xs border-t pt-2.5", isLight ? "border-rose-200 text-slate-700" : "border-rose-500/20 text-slate-300")}>
                        <div>
                          <span className={cn("text-[10px] uppercase font-bold", isLight ? "text-slate-500" : "text-slate-500")}>Borrowed On:</span>
                          <p className={cn("font-medium", isLight ? "text-slate-900" : "text-white")}>{formatDate(item.requestedAt)}</p>
                        </div>
                        <div>
                          <span className={cn("text-[10px] uppercase font-bold", isLight ? "text-slate-500" : "text-slate-500")}>Due Return Deadline:</span>
                          <p className={cn("font-medium", isLight ? "text-rose-700 font-bold" : "text-rose-300")}>{item.dueDate ? formatDate(item.dueDate) : "Overdue"}</p>
                        </div>
                      </div>

                      <p className={cn("text-[11px] italic", isLight ? "text-slate-500" : "text-rose-300/80")}>
                        Standard fine rate of ₱10.00/day overdue applied according to university library circulation policy.
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className={cn("flex items-center justify-between pt-4 border-t", isLight ? "border-slate-200" : "border-rose-500/20")}>
          <span className={cn("text-xs", isLight ? "text-slate-600" : "text-slate-400")}>
            Student: <span className={cn("font-bold", isLight ? "text-slate-900" : "text-white")}>{student.name}</span> ({student.studentId})
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-rose-500 px-5 py-2 text-xs font-bold text-white transition hover:bg-rose-600 active:scale-95 shadow-lg shadow-rose-500/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

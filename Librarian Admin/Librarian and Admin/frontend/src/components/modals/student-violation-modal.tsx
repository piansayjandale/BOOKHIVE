"use client";

import { useEffect, useMemo } from "react";
import { X, ShieldAlert, AlertTriangle, CheckCircle2, Clock, DollarSign } from "lucide-react";
import type { TransactionRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

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
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-rose-500/30 bg-[#140E14] p-6 shadow-2xl shadow-black/80 transition-all max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-rose-500/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white uppercase">
                  Violation Record
                </h3>
                <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-rose-300">
                  DISCIPLINARY VIEW
                </span>
              </div>
              <p className="text-xs text-rose-200/70">
                Active overdue book returns and penalty history for {student.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
          {/* Student Banner */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-[#1F1420] p-4 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student Name</span>
              <p className="font-bold text-white text-sm mt-0.5">{student.name}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student ID / Section</span>
              <p className="font-bold text-white text-sm mt-0.5">
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
                <span className="text-xs font-bold text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/30">
                  Total Fine: ₱{totalPenalty.toFixed(2)}
                </span>
              )}
            </div>

            {studentViolations.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                <p className="text-sm font-bold text-emerald-300">No Active Violations</p>
                <p className="text-xs text-emerald-400/80 max-w-sm mx-auto">
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
                      className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                            Violation #{idx + 1} · Overdue Loan
                          </span>
                          <h5 className="font-bold text-white text-sm mt-0.5">
                            {item.resourceTitle}
                          </h5>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            ISBN: {item.isbn || "N/A"}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-xs font-bold text-rose-300">
                            <AlertTriangle className="h-3 w-3" />
                            {days} Day{days !== 1 ? "s" : ""} Overdue
                          </span>
                          <p className="text-xs font-bold text-amber-300 mt-1">
                            Fine: ₱{fine.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-rose-500/20 pt-2.5 text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Borrowed On:</span>
                          <p className="font-medium text-white">{formatDate(item.requestedAt)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Due Return Deadline:</span>
                          <p className="font-medium text-rose-300">{item.dueDate ? formatDate(item.dueDate) : "Overdue"}</p>
                        </div>
                      </div>

                      <p className="text-[11px] text-rose-300/80 italic">
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
        <div className="flex items-center justify-between pt-4 border-t border-rose-500/20">
          <span className="text-xs text-slate-400">
            Student: <span className="font-bold text-white">{student.name}</span> ({student.studentId})
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

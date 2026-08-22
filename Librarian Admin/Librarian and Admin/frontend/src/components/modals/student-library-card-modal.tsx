"use client";

import { useEffect, useMemo } from "react";
import { X, CreditCard, BookOpen, Clock, CheckCircle2, QrCode } from "lucide-react";
import type { TransactionRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface StudentLibraryCardModalProps {
  open: boolean;
  onClose: () => void;
  student: {
    name: string;
    studentId: string;
    department?: string;
    course?: string;
    qrCode?: string;
  } | null;
  transactions: TransactionRecord[];
}

export function StudentLibraryCardModal({
  open,
  onClose,
  student,
  transactions,
}: StudentLibraryCardModalProps) {
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
      const matchesStudent =
        (t.studentId && t.studentId === student.studentId) ||
        (t.studentName && t.studentName.toLowerCase() === student.name.toLowerCase());
      const isBorrow =
        t.type === "Borrow" || (t as any).action === "Borrow" || !t.type;
      if (!matchesStudent || !isBorrow) return false;

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
    return studentBorrows.filter((t) => t.status === "Returned").length;
  }, [studentBorrows]);

  if (!open || !student) return null;

  // Render minimum 8 lined rows for the library card visual
  const TOTAL_ROWS = Math.max(8, studentBorrows.length);
  const rows = Array.from({ length: TOTAL_ROWS }, (_, i) => studentBorrows[i] || null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#263650] bg-[#111A2E] p-6 shadow-2xl shadow-black/60 transition-all max-h-[90vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCD400]/15 text-[#FCD400]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white uppercase">
                  Student Library Card
                </h3>
                <span className="rounded-full bg-[#FCD400]/15 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-[#FCD400]">
                  OFFICIAL PASS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Book borrow history & physical card ledger for {student.name}
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
        <div className="flex-1 overflow-y-auto space-y-5 py-4 pr-1">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/5 bg-[#15233A] p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Borrowed</span>
              <p className="mt-1 text-xl font-black text-white">{studentBorrows.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Active Loans</span>
              <p className="mt-1 text-xl font-black text-emerald-400">{activeLoansCount}</p>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">Returned</span>
              <p className="mt-1 text-xl font-black text-sky-400">{returnedCount}</p>
            </div>
          </div>

          {/* PHYSICAL LIBRARY CARD CONTAINER (Matches Mobile & Ledger Design) */}
          <div className="rounded-2xl border border-[#2E3F5C] bg-[#142033] p-5 shadow-lg">
            {/* Header inside card */}
            <div className="flex items-center justify-between pb-3 border-b border-[#24334C] mb-4">
              <span className="text-xs font-black tracking-widest text-[#FCD400] uppercase">
                LIBRARY CARD
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <QrCode className="h-3.5 w-3.5 text-[#FCD400]" />
                <span>{student.qrCode || `e1a1-${student.studentId || "pass"}`}</span>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[#2E3F5C] overflow-hidden text-xs">
              {/* Row 1: Fullname */}
              <div className="flex border-b border-[#2E3F5C] bg-[#16233B]/70">
                <div className="w-[30%] px-3.5 py-2.5 border-r border-[#2E3F5C] font-semibold text-slate-300">
                  Fullname:
                </div>
                <div className="flex-1 px-3.5 py-2.5 font-bold text-white">
                  {student.name}
                </div>
              </div>

              {/* Row 2: Course & Section */}
              <div className="flex border-b border-[#2E3F5C] bg-[#16233B]/70">
                <div className="w-[30%] px-3.5 py-2.5 border-r border-[#2E3F5C] font-semibold text-slate-300">
                  Course & Section:
                </div>
                <div className="flex-1 px-3.5 py-2.5 font-bold text-white">
                  {student.course || student.department || "General Program"}
                </div>
              </div>

              {/* Row 3: Column Headers */}
              <div className="flex border-b-2 border-[#3B4E70] bg-[#1C2C4A] text-[11px] font-black text-slate-200">
                <div className="w-[28%] px-3.5 py-2.5 border-r border-[#2E3F5C]">
                  Borrow Date:
                </div>
                <div className="w-[28%] px-3.5 py-2.5 border-r border-[#2E3F5C]">
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
                  className="flex border-b border-[#24334C] last:border-b-0 min-h-[34px] items-center hover:bg-white/[0.02]"
                >
                  <div className="w-[28%] px-3.5 py-2 border-r border-[#24334C] text-slate-300">
                    {row?.requestedAt ? formatDate(row.requestedAt) : "—"}
                  </div>
                  <div className="w-[28%] px-3.5 py-2 border-r border-[#24334C] text-amber-300 font-medium">
                    {row?.dueDate ? formatDate(row.dueDate) : (row?.status === "Approved" ? "Active Loan" : "—")}
                  </div>
                  <div className="flex-1 px-3.5 py-2 font-semibold text-white truncate flex items-center justify-between gap-2">
                    <span className="truncate">{row?.resourceTitle || "—"}</span>
                    {row?.status && (
                      <span className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 bg-white/10 text-slate-300">
                        {row.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1E293B]">
          <span className="text-[11px] text-slate-400 font-mono">
            Student ID: <span className="font-bold text-white">{student.studentId}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#FCD400] px-5 py-2 text-xs font-bold text-[#0b1c2c] transition hover:brightness-110 active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

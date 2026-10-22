"use client";

import { useEffect, useMemo, useState } from "react";
import { X, CreditCard, BookOpen, Clock, CheckCircle2, QrCode, ChevronDown, ChevronUp } from "lucide-react";
import type { TransactionRecord } from "@/lib/types";
import { formatDate, cn, formatCourseShortcut } from "@/lib/utils";
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
    schoolIdFront?: string;
    schoolIdBack?: string;
    libraryIdFront?: string;
    libraryIdBack?: string;
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

function isDueToReturn(dateStr?: string | Date) {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dueDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    return dueDayStart.getTime() <= todayStart.getTime();
  } catch {
    return false;
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
  const [showIdCards, setShowIdCards] = useState(false);
  const [idCards, setIdCards] = useState<{
    schoolIdFront?: string;
    schoolIdBack?: string;
    libraryIdFront?: string;
    libraryIdBack?: string;
  } | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<{ label: string; src: string } | null>(null);

  useEffect(() => {
    if (!open || !student) {
      setShowIdCards(false);
      setEnlargedPhoto(null);
      return;
    }
    setIdCards({
      schoolIdFront: student.schoolIdFront,
      schoolIdBack: student.schoolIdBack,
      libraryIdFront: student.libraryIdFront,
      libraryIdBack: student.libraryIdBack,
    });
    const targetKey = student.studentId || student.qrCode || student.name;
    if (targetKey && !student.schoolIdFront && !student.libraryIdFront) {
      fetch(`/api/student/card-by-qr/${encodeURIComponent(targetKey)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.student) {
            setIdCards({
              schoolIdFront: data.student.schoolIdFront || "",
              schoolIdBack: data.student.schoolIdBack || "",
              libraryIdFront: data.student.libraryIdFront || "",
              libraryIdBack: data.student.libraryIdBack || "",
            });
          }
        })
        .catch(() => {});
    }
  }, [open, student]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        if (enlargedPhoto) {
          setEnlargedPhoto(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, enlargedPhoto]);

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
      const isReservation =
        t.type === "Reservation" || (t as any).action === "Reserve";
      const statusStr = String(t.status || "");
      const isApprovedOrActive =
        statusStr === "Approved" ||
        statusStr === "Returned" ||
        statusStr === "Completed" ||
        statusStr === "Picked Up" ||
        statusStr === "On Loan" ||
        (isReservation && (statusStr === "Approved" || statusStr === "Reserved"));
      if (!matchesStudent || (!isBorrow && !isReservation) || !isApprovedOrActive) return false;

      const uniqueKey = t.id || `${t.studentId}-${t.resourceTitle}-${t.requestedAt}`;
      if (seen.has(uniqueKey)) return false;
      seen.add(uniqueKey);
      return true;
    });
  }, [student, transactions]);

  const activeLoansCount = useMemo(() => {
    return studentBorrows.filter((t) => t.status === "Approved" && t.type !== "Reservation" && (t as any).action !== "Reserve").length;
  }, [studentBorrows]);

  const reservationsCount = useMemo(() => {
    return studentBorrows.filter((t) => {
      const isRes = t.type === "Reservation" || (t as any).action === "Reserve";
      const s = String(t.status || "");
      return isRes && (s === "Approved" || s === "Reserved");
    }).length;
  }, [studentBorrows]);

  const returnedCount = useMemo(() => {
    return studentBorrows.filter((t) => t.status === "Returned" || (t.status as string) === "Completed").length;
  }, [studentBorrows]);

  if (!open || !student) return null;

  // Lock to 13 visible rows with internal scrolling to match the mobile Library Card design
  const VISIBLE_ROWS = 13;
  const TOTAL_ROWS = Math.max(VISIBLE_ROWS, studentBorrows.length);
  const rows = Array.from({ length: TOTAL_ROWS }, (_, i) => studentBorrows[i] || null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className={cn("fixed inset-0 modal-backdrop backdrop-blur-md transition-opacity", isLight ? "bg-slate-900/40" : "bg-black/80")}
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowIdCards((prev) => !prev)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer",
                showIdCards
                  ? isLight
                    ? "border-[#0274BB] bg-blue-50 text-[#0274BB]"
                    : "border-[#FCD400] bg-[#FCD400]/15 text-[#FCD400]"
                  : isLight
                  ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>{showIdCards ? "Hide IDs" : "Show IDs"}</span>
              {showIdCards ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

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
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-5 py-4 pr-1">
          {/* Collapsible Student School & Library ID Cards */}
          {showIdCards && (
            <div className={cn(
              "rounded-2xl border p-4",
              isLight ? "border-2 border-slate-200 bg-slate-50" : "border border-[#263650] bg-[#15233A]"
            )}>
              <div className="flex items-center justify-between mb-3">
                <span className={cn("text-xs font-black tracking-wider uppercase", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}>
                  Verified Student Identification Cards
                </span>
                <span className={cn("text-[11px]", isLight ? "text-slate-500" : "text-slate-400")}>
                  Click any card to enlarge
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "School ID (Front)", src: idCards?.schoolIdFront || student.schoolIdFront },
                  { label: "School ID (Back)", src: idCards?.schoolIdBack || student.schoolIdBack },
                  { label: "Library ID (Front)", src: idCards?.libraryIdFront || student.libraryIdFront },
                  { label: "Library ID (Back)", src: idCards?.libraryIdBack || student.libraryIdBack },
                ].map((card) => (
                  <div
                    key={card.label}
                    className={cn(
                      "rounded-xl border p-2.5 flex flex-col",
                      isLight ? "border-slate-200 bg-white" : "border-[#2E3F5C] bg-[#111A2E]"
                    )}
                  >
                    <span className={cn("text-[11px] font-bold mb-2", isLight ? "text-slate-700" : "text-slate-200")}>
                      {card.label}
                    </span>
                    {card.src ? (
                      <button
                        type="button"
                        onClick={() => setEnlargedPhoto({ label: card.label, src: card.src! })}
                        className="relative group overflow-hidden rounded-lg border border-slate-200/30 h-28 w-full cursor-pointer"
                      >
                        <img
                          src={card.src}
                          alt={card.label}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </button>
                    ) : (
                      <div className={cn(
                        "h-28 w-full rounded-lg border border-dashed flex items-center justify-center text-[11px] font-medium",
                        isLight ? "border-slate-300 bg-slate-50 text-slate-400" : "border-slate-700 bg-slate-900/40 text-slate-500"
                      )}>
                        No image uploaded
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={cn(
              "rounded-xl border p-3 text-center",
              isLight ? "border-2 border-slate-200 bg-slate-50" : "border border-white/5 bg-[#15233A]"
            )}>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isLight ? "text-slate-600" : "text-slate-400")}>Total Records</span>
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
              isLight ? "border-2 border-purple-300 bg-purple-50 text-purple-800 shadow-xs" : "border border-purple-500/20 bg-purple-500/10"
            )}>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isLight ? "text-purple-800" : "text-purple-300")}>Reservations</span>
              <p className={cn("mt-1 text-xl font-black", isLight ? "text-purple-800" : "text-purple-400")}>{reservationsCount}</p>
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
            "rounded-2xl border p-5 shadow-sm overflow-hidden",
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
                  {formatCourseShortcut(student.course || student.department) || "BSIT"}
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

              {/* Data / Grid Rows (Scrollable at 13 rows) */}
              <div className="max-h-[390px] overflow-y-auto">
                {rows.map((row, idx) => {
                  const isReservation = (row?.type === "Reservation" || (row as any)?.action === "Reserve") && row?.type !== "Borrow" && (row as any)?.action !== "Borrow";
                  const isReturned = row?.status === "Returned" || (row?.status as string) === "Completed";
                  const isNowAvailable = !!(
                    row && (
                      row.available === "true" ||
                      (row.available as any) === true ||
                      (row as any).isAvailable === true ||
                      !!row.availableAt
                    )
                  );

                  const resolveRowDueDate = (r: any): string => {
                    if (!r) return "";
                    const candidate = r.dueDate || r.due_date || (r.returnDate && r.returnDate !== "Returned" && r.returnDate !== "Reservation" ? r.returnDate : undefined);
                    if (candidate && candidate !== "Returned" && candidate !== "Reservation" && candidate !== "7 days" && candidate !== "Pending") {
                      try {
                        const d = new Date(candidate);
                        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
                        if (typeof candidate === "string" && candidate.includes("-")) return candidate.split("T")[0];
                      } catch {}
                    }
                    const startCandidate = r.borrowDate || r.pickupDate || r.dateReserved || (r.date && r.date !== "Returned" && r.date !== "Pending" ? r.date : undefined) || r.requestedAt;
                    if (startCandidate) {
                      try {
                        const d = new Date(startCandidate);
                        if (!isNaN(d.getTime())) {
                          d.setDate(d.getDate() + 7);
                          return d.toISOString().split("T")[0];
                        }
                      } catch {}
                    }
                    const fallback = new Date();
                    fallback.setDate(fallback.getDate() + 7);
                    return fallback.toISOString().split("T")[0];
                  };

                  let dueReturnText = "";
                  let highlightClass = "";

                  if (row) {
                    // Due return date always shows the due date for every book regardless of status
                    dueReturnText = resolveRowDueDate(row);

                    if (isReturned) {
                      highlightClass = "";
                    } else if (isReservation) {
                      highlightClass = isLight
                        ? "bg-purple-100 text-purple-800 font-bold"
                        : "bg-purple-500/28 text-[#D8B4FE] font-bold";
                    } else {
                      if (isDueToReturn(row.dueDate || dueReturnText)) {
                        highlightClass = isLight
                          ? "bg-red-100 text-red-800 font-bold border border-red-300"
                          : "bg-red-500/28 text-[#F87171] font-bold";
                      } else {
                        highlightClass = isLight
                          ? "bg-[#86EFAC] text-[#064E3B] font-bold"
                          : "bg-emerald-400/22 text-[#86EFAC] font-bold";
                      }
                    }
                  }

                  return (
                    <div
                      key={row?.id ? `borrow-row-${row.id}-${idx}` : `empty-row-${idx}`}
                      className={cn(
                        "flex border-b last:border-b-0 min-h-[30px] items-center transition-colors",
                        isLight
                          ? "border-slate-100 hover:bg-blue-50/40 text-slate-800"
                          : "border-[#24334C] hover:bg-white/[0.02] text-white",
                        row && !isReturned && isReservation && (
                          isLight ? "bg-purple-50/35" : "bg-purple-500/[0.08]"
                        ),
                        row && !isReturned && !isReservation && isDueToReturn(row.dueDate) && (
                          isLight ? "bg-red-50/35" : "bg-red-500/[0.10]"
                        ),
                        row && !isReturned && !isReservation && !isDueToReturn(row.dueDate) && (
                          isLight ? "bg-emerald-50/35" : "bg-emerald-400/[0.08]"
                        )
                      )}
                    >
                      <div className={cn("w-[36%] px-3.5 py-1.5 border-r font-mono text-[11px]", isLight ? "border-slate-100 text-slate-600 font-medium" : "border-[#24334C] text-slate-300")}>
                        {row?.requestedAt ? formatBorrowDateTime(row.requestedAt) : ""}
                      </div>
                      <div className={cn("w-[26%] px-3.5 py-1.5 border-r font-mono text-[11px] flex items-center justify-center", isLight ? "border-slate-100 text-slate-600 font-medium" : "border-[#24334C] text-slate-300", highlightClass)}>
                        {dueReturnText}
                      </div>
                      <div className={cn("flex-1 px-3.5 py-1.5 font-semibold flex items-center justify-between gap-2", isLight ? "text-slate-900" : "text-white")}>
                        <span className="line-clamp-2 break-words">{row?.resourceTitle || ""}</span>
                        {isReservation && !isReturned && (
                          <span className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase shrink-0",
                            isLight ? "bg-purple-100 text-purple-700 border border-purple-300" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          )}>
                            {isNowAvailable ? "Available" : "Reserved"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visual Status Legend - Enclosed cleanly inside library card */}
            <div className={cn(
              "flex flex-wrap items-center justify-center gap-4 mt-3 py-2 px-3 rounded-xl border text-[11px] font-semibold",
              isLight
                ? "bg-slate-100/75 border-slate-200 text-slate-600"
                : "bg-slate-800/45 border-[#1E293B] text-slate-300"
            )}>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#86EFAC]" />
                <span>Green: Borrow (Active)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]" />
                <span>Red: Due to Return</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C084FC]" />
                <span>Violet: Reservation</span>
              </div>
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

      {/* Enlarged ID Card Lightbox */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          onClick={() => setEnlargedPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full px-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#FCD400]">
                {enlargedPhoto.label}
              </span>
              <button
                type="button"
                onClick={() => setEnlargedPhoto(null)}
                className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlargedPhoto.src}
              alt={enlargedPhoto.label}
              className="max-h-[75vh] w-auto rounded-2xl border border-white/20 object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}


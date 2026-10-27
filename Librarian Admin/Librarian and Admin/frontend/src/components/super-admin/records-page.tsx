"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";

import { AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { useTheme } from "@/components/providers/theme-provider";
import { BookCoverImage } from "@/components/ui/book-cover-image";
import { DepartmentBadge } from "@/components/ui/department-badge";
import { ModernDropdown, type ModernDropdownOption } from "./system-management-page";
import { requestJson } from "@/lib/admin/client";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const ROLE_OPTIONS: ModernDropdownOption[] = [
  { label: "All Roles", value: "All" },
  { label: "Super Admin", value: "Super Admin" },
  { label: "Admin", value: "Admin" },
  { label: "Librarian", value: "Librarian" },
  { label: "Student", value: "Student" },
];

const BOOK_STATUS_OPTIONS: ModernDropdownOption[] = [
  { label: "All Statuses", value: "All" },
  { label: "Active / Available", value: "Active" },
  { label: "Reserved", value: "Reserved" },
  { label: "Archived", value: "Archived" },
];

const TX_TYPE_OPTIONS: ModernDropdownOption[] = [
  { label: "All Types (Reserve, Borrow, Return)", value: "All" },
  { label: "Reserve", value: "Reserve" },
  { label: "Borrow", value: "Borrow" },
  { label: "Return", value: "Return" },
];

function getTxStatusBadge(status?: string, isLight?: boolean) {
  const norm = (status || "").toLowerCase().trim();
  if (norm.includes("return")) {
    return isLight
      ? "bg-blue-100 text-blue-900 border-blue-300 font-extrabold"
      : "bg-blue-500/20 text-blue-300 border-blue-500/40 font-extrabold";
  }
  if (norm.includes("cancel") || norm.includes("reject")) {
    return isLight
      ? "bg-rose-100 text-rose-900 border-rose-300 font-extrabold"
      : "bg-rose-500/20 text-rose-300 border-rose-500/40 font-extrabold";
  }
  if (norm.includes("approv")) {
    return isLight
      ? "bg-emerald-100 text-emerald-950 border-emerald-300 font-extrabold"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-extrabold";
  }
  if (norm.includes("borrow")) {
    // Green for Borrow as requested
    return isLight
      ? "bg-emerald-100 text-emerald-950 border-emerald-300 font-extrabold"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-extrabold";
  }
  if (norm.includes("pend") || norm.includes("request")) {
    return isLight
      ? "bg-amber-100 text-amber-950 border-amber-300 font-extrabold"
      : "bg-amber-500/20 text-amber-300 border-amber-500/40 font-extrabold";
  }
  if (norm.includes("overdue")) {
    return isLight
      ? "bg-rose-100 text-rose-900 border-rose-300 font-extrabold"
      : "bg-rose-500/20 text-rose-300 border-rose-500/40 font-extrabold";
  }
  return isLight
    ? "bg-slate-100 text-slate-800 border-slate-300 font-extrabold"
    : "bg-white/10 text-slate-300 border-white/20 font-extrabold";
}

function getRoleBadge(role?: string, isLight?: boolean) {
  const r = (role || "").toUpperCase();
  if (r.includes("SUPER")) {
    return {
      dot: "bg-rose-500",
      badge: isLight
        ? "bg-rose-100 text-rose-950 border border-rose-300 font-extrabold"
        : "bg-rose-500/15 text-rose-300 border border-rose-500/35 font-extrabold",
    };
  }
  if (r.includes("ADMIN")) {
    return {
      dot: "bg-indigo-500",
      badge: isLight
        ? "bg-indigo-100 text-indigo-950 border border-indigo-300 font-extrabold"
        : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/35 font-extrabold",
    };
  }
  if (r.includes("LIBRARIAN")) {
    return {
      dot: "bg-amber-500",
      badge: isLight
        ? "bg-amber-100 text-amber-950 border border-amber-300 font-extrabold"
        : "bg-amber-500/15 text-amber-300 border border-amber-500/35 font-extrabold",
    };
  }
  if (r.includes("STUDENT")) {
    return {
      dot: "bg-emerald-500",
      badge: isLight
        ? "bg-emerald-100 text-emerald-950 border border-emerald-300 font-extrabold"
        : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 font-extrabold",
    };
  }
  return {
    dot: "bg-slate-400",
    badge: isLight
      ? "bg-slate-200 text-slate-800 border border-slate-300 font-extrabold"
      : "bg-white/10 text-slate-300 border border-white/20 font-extrabold",
  };
}

export function RecordsPage() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [activeTab, setActiveTab] = useState<"accounts" | "books" | "transactions">("accounts");
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeReqRef = useRef(0);

  // Tab sub-filters
  const [roleFilter, setRoleFilter] = useState("All");
  const [bookStatus, setBookStatus] = useState("All");
  const [txType, setTxType] = useState("All");

  const handleTabChange = (tab: "accounts" | "books" | "transactions") => {
    if (activeTab === tab) return;
    setActiveTab(tab);
    setData([]);
    setTotal(0);
    setPage(1);
    setSearch("");
  };

  const loadRecords = useCallback(async () => {
    const currentReqId = ++activeReqRef.current;
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        tab: activeTab,
        role: roleFilter,
        bookStatus,
        txType,
        search,
        page: String(page),
        pageSize: "12",
      });

      const res = await requestJson<any>(`/api/super-admin/records?${params.toString()}`);
      if (currentReqId !== activeReqRef.current) {
        // Discard out-of-order response from previous tab
        return;
      }

      startTransition(() => {
        if (activeTab === "accounts") {
          setData(res.users || []);
        } else if (activeTab === "books") {
          setData(res.books || []);
        } else {
          setData(res.transactions || []);
        }
        setTotal(res.total || 0);
      });
    } catch (err) {
      if (currentReqId === activeReqRef.current) {
        console.warn("Failed to load master records:", err);
      }
    } finally {
      if (currentReqId === activeReqRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeTab, roleFilter, bookStatus, txType, search, page]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const totalPages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          eyebrow="Super Admin · Master Records"
          title="Master System Records"
          description="Consolidated, cross-department data records spanning accounts, full catalog inventory flags, and transaction journals."
        />
        <button
          type="button"
          onClick={() => void loadRecords()}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-4 py-2 text-xs font-bold text-[#0b1c2c] transition hover:brightness-110 shadow-lg shadow-[#FCD400]/20"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Records
        </button>
      </div>

      {/* Main Tabs */}
      <div className={cn("flex gap-6 sm:gap-8 border-b pb-0.5", isLight ? "border-slate-200" : "border-[var(--line)]")}>
        <button
          type="button"
          onClick={() => handleTabChange("accounts")}
          className={cn(
            "pb-3.5 text-base sm:text-lg font-bold transition relative whitespace-nowrap cursor-pointer",
            activeTab === "accounts"
              ? isLight ? "text-slate-900 font-extrabold" : "text-white font-extrabold"
              : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-[#FCD400]" />
            <span>Accounts</span>
          </div>
          {activeTab === "accounts" && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FCD400] rounded-full" />}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("books")}
          className={cn(
            "pb-3.5 text-base sm:text-lg font-bold transition relative whitespace-nowrap cursor-pointer",
            activeTab === "books"
              ? isLight ? "text-slate-900 font-extrabold" : "text-white font-extrabold"
              : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-sky-400" />
            <span>Books</span>
          </div>
          {activeTab === "books" && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FCD400] rounded-full" />}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("transactions")}
          className={cn(
            "pb-3.5 text-base sm:text-lg font-bold transition relative whitespace-nowrap cursor-pointer",
            activeTab === "transactions"
              ? isLight ? "text-slate-900 font-extrabold" : "text-white font-extrabold"
              : isLight ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <span>Transaction</span>
          </div>
          {activeTab === "transactions" && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FCD400] rounded-full" />}
        </button>
      </div>

      <AdminSection
        title={
          activeTab === "accounts"
            ? "Accounts Directory by Role"
            : activeTab === "books"
            ? "Catalog Holdings & Status Flags"
            : "Transaction Journals & Lifecycles"
        }
        description="Unified master records accessible to Super Administrators."
      >
        {/* Filter Controls Bar */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={
                activeTab === "accounts"
                  ? "Search name, ID number, email..."
                  : activeTab === "books"
                  ? "Search title, author, ISBN..."
                  : "Search student, title, ISBN..."
              }
              className={cn(
                "w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border transition-all outline-none",
                isLight
                  ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#FCD400]"
                  : "border-white/10 bg-[#101D2D] text-white placeholder:text-slate-500 focus:border-[#FCD400]"
              )}
            />
          </div>

          {activeTab === "accounts" && (
            <div>
              <ModernDropdown
                value={roleFilter}
                onChange={(val) => {
                  setRoleFilter(val);
                  setPage(1);
                }}
                options={ROLE_OPTIONS}
                icon={<Users className="h-4 w-4" />}
                isLight={isLight}
              />
            </div>
          )}

          {activeTab === "books" && (
            <div>
              <ModernDropdown
                value={bookStatus}
                onChange={(val) => {
                  setBookStatus(val);
                  setPage(1);
                }}
                options={BOOK_STATUS_OPTIONS}
                icon={<Tag className="h-4 w-4" />}
                isLight={isLight}
              />
            </div>
          )}

          {activeTab === "transactions" && (
            <div>
              <ModernDropdown
                value={txType}
                onChange={(val) => {
                  setTxType(val);
                  setPage(1);
                }}
                options={TX_TYPE_OPTIONS}
                icon={<ClipboardList className="h-4 w-4" />}
                isLight={isLight}
              />
            </div>
          )}
        </div>

        {/* Dynamic Table Render */}
        <AdminTable>
          {activeTab === "accounts" && (
            <table className="min-w-full text-left">
              <thead className={cn(
                "uppercase tracking-wider font-extrabold text-xs sm:text-sm border-b",
                isLight ? "bg-slate-100 text-slate-800 border-slate-200" : "bg-[#132338] text-slate-200 border-white/5"
              )}>
                <tr>
                  <th className="px-4 py-3.5">Account Name</th>
                  <th className="px-4 py-3.5">ID Number</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Registered</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", isLight ? "divide-slate-200 text-slate-800" : "divide-white/5 text-slate-200")}>
                {data.map((user, idx) => (
                  <tr key={user.id ? `acc-${user.id}-${idx}` : `a-idx-${idx}`} className={isLight ? "hover:bg-slate-50 transition" : "hover:bg-white/[0.02] transition"}>
                    <td className="px-4 py-3.5">
                      <div className={cn("font-bold text-sm sm:text-base", isLight ? "text-slate-900" : "text-white")}>{user.name}</div>
                      <div className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400 mt-0.5">{user.email}</div>
                    </td>
                    <td className={cn("px-4 py-3.5 font-mono text-sm sm:text-base font-semibold", isLight ? "text-slate-800" : "text-slate-200")}>{user.idNumber}</td>
                    <td className="px-4 py-3.5">
                      {(() => {
                        const { dot, badge } = getRoleBadge(user.role, isLight);
                        return (
                          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs sm:text-sm font-bold uppercase shadow-sm border", badge)}>
                            <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
                            {user.role}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5">
                      <DepartmentBadge department={user.department} isLight={isLight} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "rounded-md px-3 py-1 text-xs sm:text-sm font-bold uppercase border shadow-xs inline-block",
                        user.status === "Active"
                          ? isLight ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : isLight ? "bg-rose-100 text-rose-900 border-rose-300" : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      )}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500 dark:text-slate-400">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "books" && (
            <table className="min-w-full text-left">
              <thead className={cn(
                "uppercase tracking-wider font-extrabold text-xs sm:text-sm border-b",
                isLight ? "bg-slate-100 text-slate-800 border-slate-200" : "bg-[#132338] text-slate-200 border-white/5"
              )}>
                <tr>
                  <th className="px-4 py-3.5">Book Details</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Shelf</th>
                  <th className="px-4 py-3.5">Status Flag</th>
                  <th className="px-4 py-3.5">Copies</th>
                  <th className="px-4 py-3.5">Borrow Count</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", isLight ? "divide-slate-200 text-slate-800" : "divide-white/5 text-slate-200")}>
                {data.map((book, idx) => (
                  <tr key={book.id ? `bk-${book.id}-${idx}` : `b-idx-${idx}`} className={isLight ? "hover:bg-slate-50 transition" : "hover:bg-white/[0.02] transition"}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3.5">
                        <BookCoverImage book={book} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className={cn("font-bold text-sm sm:text-base", isLight ? "text-slate-900" : "text-white")}>{book.title}</div>
                          <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{book.author} · ISBN: <span className="font-mono">{book.isbn}</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <DepartmentBadge department={book.department} isLight={isLight} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm text-slate-500 dark:text-slate-400">{book.shelfLocation || "General"}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "rounded-md px-3 py-1 text-xs sm:text-sm font-extrabold uppercase border shadow-xs inline-block",
                          book.archivedAt
                            ? isLight ? "bg-rose-100 text-rose-950 border-rose-300" : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                            : book.availability === "Available"
                            ? isLight ? "bg-emerald-100 text-emerald-950 border-emerald-300" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : isLight ? "bg-amber-100 text-amber-950 border-amber-300" : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        )}
                      >
                        {book.archivedAt ? "Archived" : book.availability}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3.5 font-extrabold text-sm sm:text-base", isLight ? "text-slate-900" : "text-white")}>{book.copies ?? 1}</td>
                    <td className="px-4 py-3.5 font-mono text-[#FCD400] font-extrabold text-sm sm:text-base">{book.borrowCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "transactions" && (
            <table className="min-w-full text-left">
              <thead className={cn(
                "uppercase tracking-wider font-extrabold text-xs sm:text-sm border-b",
                isLight ? "bg-slate-100 text-slate-800 border-slate-200" : "bg-[#132338] text-slate-200 border-white/5"
              )}>
                <tr>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Book Resource</th>
                  <th className="px-4 py-3.5">Type Segment</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Requested Date</th>
                  <th className="px-4 py-3.5">Due Date</th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", isLight ? "divide-slate-200 text-slate-800" : "divide-white/5 text-slate-200")}>
                {data.map((tx, idx) => (
                  <tr key={tx.id ? `tx-${tx.id}-${idx}` : `t-idx-${idx}`} className={isLight ? "hover:bg-slate-50 transition" : "hover:bg-white/[0.02] transition"}>
                    <td className="px-4 py-3.5">
                      <div className={cn("font-bold text-sm sm:text-base", isLight ? "text-slate-900" : "text-white")}>{tx.studentName || tx.name || "—"}</div>
                      <div className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400 mt-0.5">{tx.studentId || tx.idNumber || "—"}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3.5">
                        <BookCoverImage
                          book={{
                            title: tx.resourceTitle || tx.title,
                            isbn: tx.isbn,
                            department: tx.department,
                          }}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={cn("font-bold text-sm sm:text-base", isLight ? "text-slate-900" : "text-white")}>{tx.resourceTitle || tx.title || "—"}</div>
                          <div className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400 mt-0.5">{tx.isbn || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {tx.type ? (
                        <span
                          className={cn(
                            "rounded-md px-3 py-1 text-xs sm:text-sm font-extrabold uppercase border shadow-xs inline-block",
                            tx.type.toLowerCase().includes("borrow")
                              ? isLight ? "bg-emerald-100 text-emerald-950 border-emerald-300" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : tx.type.toLowerCase().includes("return")
                              ? isLight ? "bg-sky-100 text-sky-950 border-sky-300" : "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                              : isLight ? "bg-emerald-100 text-emerald-950 border-emerald-300" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          )}
                        >
                          {tx.type}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "rounded-md px-3 py-1 text-xs sm:text-sm uppercase shadow-xs inline-block",
                          getTxStatusBadge(tx.status, isLight)
                        )}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500 dark:text-slate-400">{tx.requestedAt ? formatDate(tx.requestedAt) : "—"}</td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500 dark:text-slate-400">{tx.dueDate ? formatDate(tx.dueDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {isLoading && data.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-400">
              <RefreshCw className="mx-auto mb-2.5 h-6 w-6 animate-spin text-[#FCD400]" />
              Loading {activeTab === "accounts" ? "account" : activeTab === "books" ? "book" : "transaction"} records...
            </div>
          )}

          {!isLoading && data.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              <Inbox className="mx-auto mb-2 h-7 w-7 opacity-30 text-slate-400" />
              No records found in this view.
            </div>
          )}
        </AdminTable>

        {/* Pagination */}
        <div className={cn("mt-4 flex items-center justify-between border-t pt-4 text-sm font-medium", isLight ? "border-slate-200 text-slate-600" : "border-white/8 text-slate-400")}>
          <span>
            Showing <strong className={isLight ? "text-slate-900 font-bold" : "text-white font-bold"}>{data.length}</strong> of{" "}
            <strong className={isLight ? "text-slate-900 font-bold" : "text-white font-bold"}>{total}</strong> records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-semibold transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer",
                isLight ? "border-slate-300 text-slate-700 hover:bg-slate-100" : "border-white/10 text-slate-300 hover:bg-white/5"
              )}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className={cn("px-2 font-bold", isLight ? "text-slate-900" : "text-white")}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-semibold transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer",
                isLight ? "border-slate-300 text-slate-700 hover:bg-slate-100" : "border-white/10 text-slate-300 hover:bg-white/5"
              )}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}

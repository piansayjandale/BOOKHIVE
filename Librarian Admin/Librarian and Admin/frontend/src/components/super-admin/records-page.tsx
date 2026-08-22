"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
import { requestJson } from "@/lib/admin/client";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export function RecordsPage() {
  const [activeTab, setActiveTab] = useState<"accounts" | "books" | "transactions">("accounts");
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Tab sub-filters
  const [roleFilter, setRoleFilter] = useState("All");
  const [bookStatus, setBookStatus] = useState("All");
  const [txType, setTxType] = useState("All");

  const loadRecords = useCallback(async () => {
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
      console.warn("Failed to load master records:", err);
    } finally {
      setIsLoading(false);
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
      <div className="flex gap-6 border-b border-[var(--line)] pb-0.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab("accounts");
            setPage(1);
          }}
          className={cn(
            "pb-3 text-sm font-semibold transition relative whitespace-nowrap",
            activeTab === "accounts" ? "text-white font-bold" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#FCD400]" />
            Tab 1: Accounts by Role
          </div>
          {activeTab === "accounts" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FCD400]" />}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("books");
            setPage(1);
          }}
          className={cn(
            "pb-3 text-sm font-semibold transition relative whitespace-nowrap",
            activeTab === "books" ? "text-white font-bold" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-sky-400" />
            Tab 2: Books with Status Flags
          </div>
          {activeTab === "books" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FCD400]" />}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("transactions");
            setPage(1);
          }}
          className={cn(
            "pb-3 text-sm font-semibold transition relative whitespace-nowrap",
            activeTab === "transactions" ? "text-white font-bold" : "text-slate-400 hover:text-white"
          )}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Tab 3: Transactions Journal
          </div>
          {activeTab === "transactions" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FCD400]" />}
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
              className="glass-input w-full pl-9 pr-3 py-2 text-xs"
            />
          </div>

          {activeTab === "accounts" && (
            <div>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="glass-input w-full px-3 py-2 text-xs"
              >
                <option value="All" className="bg-[#101D2D] text-white">All Roles</option>
                <option value="Admin" className="bg-[#101D2D] text-white">Admin</option>
                <option value="Circulation Librarian" className="bg-[#101D2D] text-white">Circulation Librarian</option>
                <option value="Technical Librarian" className="bg-[#101D2D] text-white">Technical Librarian</option>
                <option value="Student" className="bg-[#101D2D] text-white">Student</option>
              </select>
            </div>
          )}

          {activeTab === "books" && (
            <div>
              <select
                value={bookStatus}
                onChange={(e) => {
                  setBookStatus(e.target.value);
                  setPage(1);
                }}
                className="glass-input w-full px-3 py-2 text-xs"
              >
                <option value="All" className="bg-[#101D2D] text-white">All Statuses</option>
                <option value="Active" className="bg-[#101D2D] text-white">Active / Available</option>
                <option value="Reserved" className="bg-[#101D2D] text-white">Reserved</option>
                <option value="Archived" className="bg-[#101D2D] text-white">Archived</option>
              </select>
            </div>
          )}

          {activeTab === "transactions" && (
            <div>
              <select
                value={txType}
                onChange={(e) => {
                  setTxType(e.target.value);
                  setPage(1);
                }}
                className="glass-input w-full px-3 py-2 text-xs"
              >
                <option value="All" className="bg-[#101D2D] text-white">All Types (Reserve, Borrow, Return)</option>
                <option value="Reserve" className="bg-[#101D2D] text-white">Reserve</option>
                <option value="Borrow" className="bg-[#101D2D] text-white">Borrow</option>
                <option value="Return" className="bg-[#101D2D] text-white">Return</option>
              </select>
            </div>
          )}
        </div>

        {/* Dynamic Table Render */}
        <AdminTable>
          {activeTab === "accounts" && (
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Account Name</th>
                  <th className="px-4 py-3">ID Number</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {data.map((user, idx) => (
                  <tr key={user.id ? `acc-${user.id}-${idx}` : `a-idx-${idx}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-semibold text-white">
                      {user.name}
                      <div className="text-[11px] font-mono text-slate-400">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{user.idNumber}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-[#FCD400]">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{user.department}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${user.status === "Active" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "books" && (
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Book Details</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Shelf</th>
                  <th className="px-4 py-3">Status Flag</th>
                  <th className="px-4 py-3">Copies</th>
                  <th className="px-4 py-3">Borrow Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {data.map((book, idx) => (
                  <tr key={book.id ? `bk-${book.id}-${idx}` : `b-idx-${idx}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{book.title}</div>
                      <div className="text-[11px] text-slate-400">{book.author} · ISBN: <span className="font-mono">{book.isbn}</span></div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{book.department}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{book.shelfLocation || "General"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                          book.archivedAt
                            ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            : book.availability === "Available"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        )}
                      >
                        {book.archivedAt ? "Archived" : book.availability}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-white">{book.copies ?? 1}</td>
                    <td className="px-4 py-3 font-mono text-[#FCD400] font-bold">{book.borrowCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "transactions" && (
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Book Resource</th>
                  <th className="px-4 py-3">Type Segment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requested Date</th>
                  <th className="px-4 py-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {data.map((tx, idx) => (
                  <tr key={tx.id ? `tx-${tx.id}-${idx}` : `t-idx-${idx}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-semibold text-white">
                      {tx.studentName}
                      <div className="text-[11px] font-mono text-slate-400">{tx.studentId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{tx.resourceTitle}</div>
                      <div className="text-[11px] font-mono text-slate-400">{tx.isbn}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                          tx.type === "Borrow"
                            ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                            : tx.type === "Return"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        )}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold text-slate-300">{tx.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(tx.requestedAt)}</td>
                    <td className="px-4 py-3 text-slate-400">{tx.dueDate ? formatDate(tx.dueDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Inbox className="mx-auto mb-2 h-7 w-7 opacity-30 text-slate-400" />
              No records found in this view.
            </div>
          )}
        </AdminTable>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4 text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{data.length}</strong> of{" "}
            <strong className="text-white">{total}</strong> records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="px-2 font-bold text-white">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}

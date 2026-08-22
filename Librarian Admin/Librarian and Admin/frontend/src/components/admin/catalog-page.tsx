"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useState } from "react";
import { BookOpen, Eye, Search, ChevronLeft, ChevronRight, Inbox, Layers, Tag, Bookmark } from "lucide-react";

import { AdminModal, AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminBookRecord, AdminBooksPayload } from "@/lib/admin/types";
import { cn, formatDate } from "@/lib/utils";

const DEPARTMENTS = [
  "All",
  "Circulation",
  "General Reference",
  "Filipiniana",
  "Reserve",
  "Periodical",
  "Special Collections",
];

export function CatalogPage() {
  const [payload, setPayload] = useState<AdminBooksPayload | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState<AdminBookRecord | null>(null);
  const deferredSearch = useDeferredValue(search);

  const loadBooks = useCallback(async () => {
    const statusParam = status === "All" ? "Active" : status;
    const nextPayload = await requestJson<AdminBooksPayload>(
      `/api/admin/books?search=${encodeURIComponent(deferredSearch)}&department=${encodeURIComponent(department)}&status=${encodeURIComponent(statusParam)}&page=${page}&pageSize=10`,
    );
    startTransition(() => setPayload(nextPayload));
  }, [deferredSearch, department, page, status]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  const booksList = payload?.books ?? [];
  const totalPages = payload ? Math.max(1, Math.ceil(payload.total / payload.pageSize)) : 1;

  // Extract unique categories for filter
  const categories = Array.from(new Set(booksList.map((b) => b.category).filter(Boolean)));

  const filteredBooks = category === "All"
    ? booksList
    : booksList.filter((b) => b.category === category);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Admin · Catalog"
        title="Resource Catalog"
        description="Comprehensive search, inventory availability, and category browsing across all academic holdings."
      />

      <AdminSection
        title="Library Holdings"
        description="Browse books by department, circulation status, or classification categories."
      >
        {/* Filters and Search Bar */}
        <div className="mb-6 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, author, ISBN..."
              className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
            />
          </div>

          <div>
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
              className="glass-input w-full px-3 py-2.5 text-sm"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} className="bg-[#101D2D] text-white">
                  {d === "All" ? "All Departments" : d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="glass-input w-full px-3 py-2.5 text-sm"
            >
              <option value="All" className="bg-[#101D2D] text-white">All Availability</option>
              <option value="Active" className="bg-[#101D2D] text-white">Available / Active</option>
              <option value="Archived" className="bg-[#101D2D] text-white">Archived</option>
            </select>
          </div>

          <div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="glass-input w-full px-3 py-2.5 text-sm"
            >
              <option value="All" className="bg-[#101D2D] text-white">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#101D2D] text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Books Catalog Table */}
        <AdminTable>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#132338] text-[11px] font-bold uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-5 py-3.5">Book Details</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Shelf Location</th>
                <th className="px-5 py-3.5">Availability</th>
                <th className="px-5 py-3.5">Copies</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredBooks.map((book, idx) => (
                <tr key={book.id ? `book-${book.id}-${idx}` : `b-idx-${idx}`} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 max-w-[300px]">
                    <div className="font-semibold text-white truncate">{book.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{book.author} · ISBN: <span className="font-mono">{book.isbn}</span></div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-300">{book.department}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-slate-300">
                      <Tag className="h-3 w-3 text-[#FCD400]" />
                      {book.category || "General"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-400">{book.shelfLocation || "Stack Section"}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        book.availability === "Available"
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : book.availability === "Reserved"
                          ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                          : "bg-amber-500/15 text-amber-300 border border-amber-500/30",
                      )}
                    >
                      {book.availability || "Available"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-bold text-white">{book.copies ?? 1}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedBook(book)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#FCD400]" />
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {filteredBooks.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Inbox className="mx-auto mb-3 h-8 w-8 opacity-30 text-slate-400" />
                    <p className="text-sm font-medium">No catalog books match your search filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTable>

        {/* Pagination Controls */}
        <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4 text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{filteredBooks.length}</strong> of{" "}
            <strong className="text-white">{payload?.total ?? 0}</strong> total resources
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

      {/* Book Details Modal */}
      {selectedBook && (
        <AdminModal
          open={!!selectedBook}
          onClose={() => setSelectedBook(null)}
          title="Catalog Resource Details"
          description={`Metadata & inventory information for ${selectedBook.title}`}
        >
          <div className="space-y-4 text-sm text-slate-300">
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/8 bg-white/5 p-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Title</span>
                <p className="font-bold text-white mt-0.5">{selectedBook.title}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Author</span>
                <p className="font-bold text-white mt-0.5">{selectedBook.author}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">ISBN</span>
                <p className="font-mono text-amber-300 mt-0.5">{selectedBook.isbn}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Department</span>
                <p className="text-white mt-0.5">{selectedBook.department}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Shelf Location</span>
                <p className="font-mono text-white mt-0.5">{selectedBook.shelfLocation || "General Stacks"}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Copies in Inventory</span>
                <p className="font-bold text-white mt-0.5">{selectedBook.copies ?? 1}</p>
              </div>
            </div>

            {selectedBook.summary && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Summary / Abstract</span>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed rounded-xl bg-white/5 p-3.5 border border-white/5">
                  {selectedBook.summary}
                </p>
              </div>
            )}

            {selectedBook.apaCitation && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">APA Citation</span>
                <p className="mt-1 text-xs font-mono text-slate-300 bg-[#0c1624] p-3 rounded-lg border border-white/5 select-all">
                  {selectedBook.apaCitation}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                className="rounded-xl bg-[#FCD400] px-5 py-2 text-xs font-bold text-[#0b1c2c] transition hover:brightness-110"
              >
                Close
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { RecordsCatalogPayload } from "@/lib/admin/types";

export function RecordsCatalogPage() {
  const [payload, setPayload] = useState<RecordsCatalogPayload | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    void requestJson<RecordsCatalogPayload>(
      `/api/admin/records-catalog?search=${encodeURIComponent(deferredSearch)}&department=${encodeURIComponent(department)}`,
    ).then((response) => {
      startTransition(() => setPayload(response));
    });
  }, [deferredSearch, department]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Records & Catalog"
        description="Inspect the full system-wide book record set in a structured, read-only view organized by department and title."
      />

      <AdminSection
        title="Catalog View"
        description="Apply title and department filters to review the centralized records collection."
      >
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or author" className="glass-input px-4 py-3" />
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="glass-input px-4 py-3">
            <option value="All">All Departments</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Engineering">Engineering</option>
            <option value="Education">Education</option>
            <option value="Business & Accountancy">Business &amp; Accountancy</option>
            <option value="Arts & Sciences">Arts &amp; Sciences</option>
          </select>
        </div>

        <AdminTable>
          <table className="min-w-full text-left">
            <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Shelf</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.records ?? []).map((record) => (
                <tr key={record.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 text-sm font-semibold">{record.title}</td>
                  <td className="px-4 py-3 text-sm">{record.author}</td>
                  <td className="px-4 py-3 text-sm">{record.department}</td>
                  <td className="px-4 py-3 text-sm">{record.category}</td>
                  <td className="px-4 py-3 text-sm">{record.shelfLocation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </div>
  );
}

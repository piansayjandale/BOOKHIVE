"use client";

import { motion } from "framer-motion";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { useNotice } from "@/components/providers/notice-provider";
import { AdminPageHeader, AdminSection, AdminTable } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { PromptSearchPayload, PromptSearchLog } from "@/lib/admin/types";
import { formatDateTime } from "@/lib/utils";

export function AiSearchPage() {
  const { notify } = useNotice();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [department, setDepartment] = useState(
    () => searchParams.get("department") ?? "Computer Science",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [payload, setPayload] = useState<PromptSearchPayload | null>(null);
  const [logs, setLogs] = useState<PromptSearchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const autoSearchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void requestJson<{ logs: PromptSearchLog[] }>("/api/admin/prompt-search").then((response) => {
      setLogs(response.logs);
    });
  }, []);

  async function executeSearch(searchQuery: string, searchDepartment: string, updateUrl = true) {
    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("query", searchQuery);
      formData.set("department", searchDepartment);
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await requestJson<PromptSearchPayload>("/api/admin/prompt-search", {
        method: "POST",
        body: formData,
      });

      startTransition(() => {
        setPayload(response);
        setLogs(response.logs);
      });

      if (updateUrl) {
        router.replace(
          `/admin/ai-prompt-search?query=${encodeURIComponent(searchQuery)}&department=${encodeURIComponent(
            searchDepartment,
          )}`,
          { scroll: false },
        );
      }

      notify("AI prompt search completed.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Search failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  const triggerInitialSearch = useEffectEvent((searchQuery: string, searchDepartment: string) => {
    void executeSearch(searchQuery, searchDepartment, false);
  });

  useEffect(() => {
    const queryParam = searchParams.get("query") ?? "";
    const departmentParam = searchParams.get("department") ?? "";
    const searchDepartment = departmentParam || department;
    const searchKey = queryParam ? `${queryParam}::${searchDepartment}` : "";

    if (!searchKey || payload || loading || autoSearchKeyRef.current === searchKey) {
      return;
    }

    autoSearchKeyRef.current = searchKey;

    const timeoutId = window.setTimeout(() => {
      triggerInitialSearch(queryParam, searchDepartment);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [searchParams, payload, loading, department]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeSearch(query, department);
  }

  const results = payload?.results ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="AI Prompt Search"
        description="Search the live library catalog with natural language prompts and supporting PDF, DOCX, PPT, and image uploads."
      />

      <AdminSection
        title="Prompt Search"
        description="Upload supporting files and inspect relevance percentages for matched books."
      >
        <form className="space-y-6" onSubmit={handleSearch}>
          <div className="space-y-5 rounded-[32px] border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl shadow-sky-500/10 ai-search-hero">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const fileInput = document.getElementById("prompt-upload-input") as HTMLInputElement | null;
                  fileInput?.click();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400 shadow-sm shadow-sky-500/20 transition hover:bg-sky-500/30 z-20"
                aria-label="Upload files"
              >
                <Plus className="h-5 w-5" />
              </button>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, author, ISBN, or a natural language prompt"
                className="glass-input relative z-0 w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-16 py-5 text-base text-[var(--module-title-color)]"
              />
              <button
                type="button"
                onClick={() => {
                  const selectedQuery = query.trim();
                  if (selectedQuery) {
                    void executeSearch(selectedQuery, department);
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[#10233a] shadow-lg shadow-sky-500/20 transition hover:scale-105 z-20"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <select value={department} onChange={(event) => setDepartment(event.target.value)} className="glass-input px-4 py-4">
                <option value="Computer Science">Computer Science</option>
                <option value="Engineering">Engineering</option>
                <option value="Education">Education</option>
                <option value="Business & Accountancy">Business &amp; Accountancy</option>
                <option value="Arts & Sciences">Arts &amp; Sciences</option>
              </select>

              <input
                id="prompt-upload-input"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
            </div>

            <p className="text-sm text-[var(--module-muted-color)]">
              The plus icon uploads supporting files for the AI prompt search.
            </p>
          </div>

          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {files.map((file) => (
                <span key={`${file.name}-${file.size}`} className="rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1 text-xs">
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}
        </form>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {results.length > 0 ? (
            results.map((result) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="rounded-3xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--module-muted-color)]">{result.department}</p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--module-title-color)]">{result.title}</h3>
                  </div>
                  <span className="admin-success-chip rounded-full px-3 py-1 text-xs font-semibold">
                    {result.relevance}%
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--module-muted-color)]">{result.author}</p>
                <p className="mt-4 text-sm leading-7 text-[var(--module-muted-color)]">{result.summary}</p>
              </motion.div>
            ))
          ) : (
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--module-muted-color)]">
              Enter a prompt above to see AI prompt search results here.
            </div>
          )}
        </div>
      </AdminSection>

      <AdminSection
        title="Search History"
        description="Prompt history with actor, scope, uploaded context, and result counts."
      >
        <AdminTable>
          <table className="min-w-full text-left">
            <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
              <tr>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Query</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Matches</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => (
                <tr key={entry.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 text-sm">{entry.actor}</td>
                  <td className="px-4 py-3 text-sm">{entry.query}</td>
                  <td className="px-4 py-3 text-sm">{entry.department}</td>
                  <td className="px-4 py-3 text-sm">{entry.matchesFound}</td>
                  <td className="px-4 py-3 text-sm">{formatDateTime(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </div>
  );
}

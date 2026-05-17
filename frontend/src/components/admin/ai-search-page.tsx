"use client";

import { motion } from "framer-motion";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import { Plus, Search, Sparkles, Mic, Image as ImageIcon } from "lucide-react";
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
        <form className="mb-8 rounded-[32px] border border-white/10 bg-[#152E47] p-8 md:p-12 shadow-xl shadow-black/20" onSubmit={handleSearch}>
          {/* Section Label */}
          <div className="mb-6 flex items-center gap-2 text-[#FCD400]">
            <Sparkles className="h-4 w-4 fill-current" />
            <span className="text-xs font-bold tracking-widest">
              ASK BOOKHIVE
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="mb-10 text-[28px] font-bold leading-tight text-white md:text-[36px]">
            Find resources across the entire STI WNU digital ecosystem.
          </h1>

          {/* AI Prompt Search Box */}
          <div className="mb-8 flex w-full items-center gap-2 rounded-full bg-white py-1.5 pl-6 pr-2 shadow-sm">
            <Search className="h-5 w-5 flex-shrink-0 text-[#94A3B8]" />
            
            <input
              type="text"
              suppressHydrationWarning
              placeholder="Search by Title, Author, ISBN, or ask a question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-[#1E293B] outline-none placeholder:text-[#94A3B8]"
            />

            <div className="flex items-center gap-3 border-l border-slate-200 pl-4 pr-1">
              <button
                type="button"
                suppressHydrationWarning
                className="text-[#94A3B8] transition-colors hover:text-slate-700"
                title="Voice Search"
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  const fileInput = document.getElementById("prompt-upload-input") as HTMLInputElement | null;
                  fileInput?.click();
                }}
                className="text-[#94A3B8] transition-colors hover:text-slate-700"
                title="Upload Image/Context"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
              
              <button
                type="submit"
                suppressHydrationWarning
                className="ml-2 rounded-full bg-[#152E47] px-8 py-3.5 text-xs font-bold tracking-widest text-white transition-transform hover:scale-105"
              >
                ANALYZE
              </button>
            </div>
            
            <input
              id="prompt-upload-input"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-3">
            {["Computer Science", "Engineering", "Education", "Business & Accountancy", "Arts & Sciences"].map((cat) => (
              <button
                key={cat}
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setDepartment(cat);
                  if (query.trim()) {
                    void executeSearch(query, cat);
                  }
                }}
                className={`rounded-[24px] px-6 py-2.5 text-[13px] font-medium transition-colors ${
                  department === cat
                    ? "bg-[#1E3445] text-white"
                    : "bg-[#1E3445] text-[#94A3B8] hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* File list */}
          {files.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {files.map((file) => (
                <span key={`${file.name}-${file.size}`} className="rounded-full bg-white/20 px-3 py-1 text-xs text-white backdrop-blur-md">
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

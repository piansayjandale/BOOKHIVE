"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Megaphone, PencilLine, Plus, RefreshCcw, Search, SlidersHorizontal, Trash2 } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import type { AnnouncementRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const audienceOptions = ["All", "All Users", "Students", "Staff"] as const;
const statusOptions = ["All", "Published", "Draft"] as const;
const priorityOptions = ["Normal", "Important", "Urgent"] as const;

const emptyAnnouncementForm = {
  title: "",
  content: "",
  audience: "All Users" as AnnouncementRecord["audience"],
  priority: "Normal" as AnnouncementRecord["priority"],
  published: true,
};

function PriorityBadge({ priority }: { priority: AnnouncementRecord["priority"] }) {
  const styles = {
    Urgent:    "bg-red-500/15 text-red-300 border-red-500/30",
    Important: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    Normal:    "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${styles[priority]}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-emerald-300">
      Published
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-500/30 bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-slate-300">
      Draft
    </span>
  );
}

export function AnnouncementsModule({
  variant = "admin",
}: {
  variant?: "admin" | "librarian";
}) {
  const { user } = useSession();
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<(typeof audienceOptions)[number]>("All");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("All");
  const [form, setForm] = useState(emptyAnnouncementForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const deferredSearch = useDeferredValue(search);

  const loadAnnouncements = useCallback(async () => {
    const params = new URLSearchParams({
      search: deferredSearch,
      audience,
      status,
    });
    const response = await fetch(`/api/announcements?${params.toString()}`);
    const payload = (await response.json()) as { announcements: AnnouncementRecord[] };
    startTransition(() => setAnnouncements(payload.announcements));
  }, [audience, deferredSearch, status]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  function resetForm() {
    setForm(emptyAnnouncementForm);
    setEditingId(null);
  }

  async function saveAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const endpoint = editingId ? `/api/announcements/${editingId}` : "/api/announcements";
    const method = editingId ? "PUT" : "POST";
    await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    resetForm();
    await loadAnnouncements();
    setSaving(false);
  }

  function editAnnouncement(announcement: AnnouncementRecord) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      audience: announcement.audience,
      priority: announcement.priority,
      published: announcement.published,
    });
  }

  async function deleteAnnouncement(id: string) {
    await fetch(`/api/announcements/${id}`, {
      method: "DELETE",
    });
    await loadAnnouncements();
    if (editingId === id) {
      resetForm();
    }
  }

  const stats = useMemo(
    () => ({
      published: announcements.filter((announcement) => announcement.published).length,
      drafts: announcements.filter((announcement) => !announcement.published).length,
      urgent: announcements.filter((announcement) => announcement.priority === "Urgent").length,
    }),
    [announcements],
  );

  const headerTitle =
    variant === "admin"
      ? "System Announcements"
      : "Operational Announcements";

  const headerDescription =
    variant === "admin"
      ? "Publish system notices, coordinate audience targeting, and keep the shared BookHive communications feed aligned across admin and librarian operations."
      : "Draft, publish, and maintain notices that sync directly with the shared BookHive admin backend and the live library communication feed.";

  return (
    <div className="flex h-full flex-col gap-6 px-1">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#FCD400] uppercase">
            {variant === "admin" ? "Admin · Announcements" : "Librarian · Announcements"}
          </p>
          <h1 className="mt-1 text-2xl font-black text-white tracking-tight">
            {headerTitle}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {headerDescription}
          </p>
        </div>
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => void loadAnnouncements()}
          className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-5 py-2.5 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Main Layout Grid ────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        
        {/* ── Left Column: Compose Announcement ──────────────── */}
        <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#6EE7B7] uppercase">
                {editingId ? "Edit Notice" : "Publish Notice"}
              </p>
              <h2 className="mt-1 text-xl font-bold text-white tracking-tight">
                {editingId ? "Update announcement details" : "Compose a new announcement"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Changes are stored in the shared backend and logged under {user?.name ?? "your"} session.
              </p>
            </div>
            <Megaphone className="h-4 w-4 text-slate-500 mt-1" />
          </div>

          <form className="grid gap-4" onSubmit={saveAnnouncement}>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Announcement Title</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0 transition-colors"
                placeholder="Enter title..."
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Announcement Body</span>
              <textarea
                className="w-full min-h-[140px] rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0 transition-colors resize-none"
                placeholder="Enter message details..."
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({ ...current, content: event.target.value }))
                }
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Audience</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={form.audience}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      audience: event.target.value as AnnouncementRecord["audience"],
                    }))
                  }
                >
                  {audienceOptions
                    .filter((option) => option !== "All")
                    .map((option) => (
                      <option key={option} value={option} className="bg-[#0F1D29]">
                        {option}
                      </option>
                    ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Priority</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as AnnouncementRecord["priority"],
                    }))
                  }
                >
                  {priorityOptions.map((option) => (
                    <option key={option} value={option} className="bg-[#0F1D29]">
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Visibility</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none transition-colors"
                  value={form.published ? "Published" : "Draft"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      published: event.target.value === "Published",
                    }))
                  }
                >
                  {statusOptions
                    .filter((option) => option !== "All")
                    .map((option) => (
                      <option key={option} value={option} className="bg-[#0F1D29]">
                        {option}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3 mt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#FCD400] px-5 py-3 text-sm font-bold text-[#0b1c2c] shadow-lg shadow-[#FCD400]/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {editingId ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saving ? "Saving..." : editingId ? "Update Notice" : "Create Notice"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 transition"
                onClick={resetForm}
              >
                Reset
              </button>
            </div>
          </form>

          {/* Form stats pills */}
          <div className="mt-4 grid gap-3 grid-cols-3">
            {[
              { label: "Published", value: stats.published.toString(), color: "#6EE7B7" },
              { label: "Drafts", value: stats.drafts.toString(), color: "#94A3B8" },
              { label: "Urgent", value: stats.urgent.toString(), color: "#FCA5A5" },
            ].map((item) => (
              <div key={item.label}
                className="rounded-xl border border-white/8 bg-[#152E47]/60 px-4 py-3 backdrop-blur"
                style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
              >
                <p className="text-[9px] font-bold tracking-[0.18em] text-slate-400 uppercase">{item.label}</p>
                <p className="mt-0.5 text-lg font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Column: Announcement Queue ───────────────── */}
        <div className="rounded-2xl border border-white/8 bg-[#0F1D29]/80 backdrop-blur p-6 flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-sky-400 uppercase">Shared Notice Board</p>
              <h2 className="mt-1 text-xl font-bold text-white tracking-tight">Announcement queue</h2>
              <p className="mt-1 text-xs text-slate-400">
                Filter published and draft notices while keeping communication updates clean and synchronized.
              </p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-[#FCD400]/50 focus:outline-none focus:ring-0"
                placeholder="Search title, content, or author..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="relative">
              <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-8 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none"
                value={audience}
                onChange={(event) =>
                  setAudience(event.target.value as (typeof audienceOptions)[number])
                }
              >
                {audienceOptions.map((option) => (
                  <option key={option} value={option} className="bg-[#0F1D29]">
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-8 text-sm text-white focus:border-[#FCD400]/50 focus:outline-none"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as (typeof statusOptions)[number])
                }
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option} className="bg-[#0F1D29]">
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List Table */}
          <div className="flex-1 overflow-hidden rounded-xl border border-white/8 bg-[#0F1D29]/50">
            <div className="overflow-x-auto h-full">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 bg-[#152E47]/60">
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap">Title</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap">Audience</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap">Priority</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap">Status</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap">Updated</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((announcement) => (
                    <tr key={announcement.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3.5 max-w-[240px]">
                        <div className="font-semibold text-white leading-snug line-clamp-1">{announcement.title}</div>
                        <div className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">{announcement.content}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-300">{announcement.audience}</span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <PriorityBadge priority={announcement.priority} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge published={announcement.published} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateTime(announcement.updatedAt)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50 transition"
                            onClick={() => editAnnouncement(announcement)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 hover:border-red-500/50 transition"
                            onClick={() => void deleteAnnouncement(announcement.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {announcements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No announcements found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

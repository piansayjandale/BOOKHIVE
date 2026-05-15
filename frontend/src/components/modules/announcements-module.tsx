"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Megaphone, PencilLine, Plus, Trash2 } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { ModuleHeader } from "@/components/ui/module-header";
import { Panel } from "@/components/ui/panel";
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

function announcementTone(priority: AnnouncementRecord["priority"]) {
  if (priority === "Urgent") {
    return "danger";
  }

  if (priority === "Important") {
    return "warning";
  }

  return "default";
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
      ? "System-wide announcement publishing and notice control"
      : "Operational announcements for library users and staff";

  const headerDescription =
    variant === "admin"
      ? "Publish system notices, coordinate audience targeting, and keep the shared BookHive communications feed aligned across admin and librarian operations."
      : "Draft, publish, and maintain notices that sync directly with the shared BookHive admin backend and the live library communication feed.";

  return (
    <div className="space-y-8">
      <ModuleHeader
        eyebrow="Announcements"
        title={headerTitle}
        description={headerDescription}
      />

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Panel className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone="success">{editingId ? "Edit Notice" : "Publish Notice"}</Badge>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                {editingId ? "Update announcement details" : "Compose a new announcement"}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Changes are stored in the shared backend and logged under {user?.name ?? "your"}
                {" "}session.
              </p>
            </div>
            <Megaphone className="h-5 w-5 text-white/40" />
          </div>

          <form className="mt-6 grid gap-4" onSubmit={saveAnnouncement}>
            <label className="grid gap-2">
              <span className="text-sm text-white/65">Announcement Title</span>
              <input
                className="glass-input rounded-2xl px-4 py-3"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-white/65">Announcement Body</span>
              <textarea
                className="glass-input min-h-40 rounded-2xl px-4 py-3"
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({ ...current, content: event.target.value }))
                }
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm text-white/65">Audience</span>
                <select
                  className="glass-input rounded-2xl px-4 py-3"
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
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/65">Priority</span>
                <select
                  className="glass-input rounded-2xl px-4 py-3"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as AnnouncementRecord["priority"],
                    }))
                  }
                >
                  {priorityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/65">Visibility</span>
                <select
                  className="glass-input rounded-2xl px-4 py-3"
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
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#57c3ff,#2563eb)] px-5 py-3 text-sm font-semibold text-white"
              >
                {editingId ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saving ? "Saving..." : editingId ? "Update Announcement" : "Create Announcement"}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/6 px-5 py-3 text-sm font-semibold text-white/75"
                onClick={resetForm}
              >
                Reset
              </button>
            </div>
          </form>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              { label: "Published", value: stats.published.toString() },
              { label: "Drafts", value: stats.drafts.toString() },
              { label: "Urgent", value: stats.urgent.toString() },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge>Shared Notice Board</Badge>
              <h2 className="mt-4 text-2xl font-semibold text-white">Announcement queue</h2>
              <p className="mt-2 text-sm text-white/60">
                Filter published and draft notices while keeping communication updates clean and synchronized.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 xl:grid-cols-[1fr_180px_180px]">
            <input
              className="glass-input rounded-2xl px-4 py-3"
              placeholder="Search title, content, or author"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="glass-input rounded-2xl px-4 py-3"
              value={audience}
              onChange={(event) =>
                setAudience(event.target.value as (typeof audienceOptions)[number])
              }
            >
              {audienceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="glass-input rounded-2xl px-4 py-3"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as (typeof statusOptions)[number])
              }
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-[var(--table-header-bg)] text-xs uppercase tracking-[0.2em] text-[var(--table-header-foreground)]">
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Audience</th>
                  <th className="px-4 py-3 text-left">Priority</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((announcement) => (
                  <tr key={announcement.id} className="border-b last:border-b-0 hover:bg-[var(--content-bg)]">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[var(--module-title-color)]">{announcement.title}</div>
                      <div className="mt-1 text-sm text-[var(--module-muted-2)] line-clamp-2">{announcement.content}</div>
                    </td>
                    <td className="px-4 py-4 text-[var(--module-muted-color)]">{announcement.audience}</td>
                    <td className="px-4 py-4">
                      <Badge tone={announcementTone(announcement.priority)}>{announcement.priority}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={announcement.published ? 'success' : 'default'}>{announcement.published ? 'Published' : 'Draft'}</Badge>
                    </td>
                    <td className="px-4 py-4 text-[var(--module-muted-2)]">{formatDateTime(announcement.updatedAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/15 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200"
                          onClick={() => editAnnouncement(announcement)}
                        >
                          <PencilLine className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200"
                          onClick={() => void deleteAnnouncement(announcement.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

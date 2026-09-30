"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Megaphone,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Radio,
  Send,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
  Clock,
  Users,
  GraduationCap,
  Briefcase,
  LayoutGrid,
  ListFilter,
  Check,
  X,
  ShieldAlert,
  FileText,
  Flame,
  Globe,
  Bell,
  CheckCircle2,
  Calendar,
  Hourglass,
  ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import type { AnnouncementRecord } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const audienceOptions = ["All", "All Users", "Students", "Staff"] as const;
const statusOptions = ["All", "Published", "Draft"] as const;
const priorityOptions = ["Normal", "Important", "Urgent"] as const;

export const DURATION_CHOICES = [
  { value: 1, label: "1 Day", hint: "Expires in 24 hrs" },
  { value: 2, label: "2 Days", hint: "Expires in 48 hrs" },
  { value: 3, label: "3 Days", hint: "Expires in 72 hrs" },
  { value: 7, label: "7 Days", hint: "Expires in 1 week" },
  { value: 0, label: "No Limit", hint: "Permanent Notice" },
] as const;

const emptyAnnouncementForm = {
  title: "",
  content: "",
  audience: "All Users" as AnnouncementRecord["audience"],
  priority: "Normal" as AnnouncementRecord["priority"],
  published: true,
  durationDays: 0, // 0 = No expiration / Permanent
};

const PRESET_TEMPLATES = [
  {
    id: "hours",
    name: "Library Hours",
    icon: Clock,
    title: "Extended Library Hours for Midterm & Final Exam Week",
    content: "The Main Circulation floor and Quiet Study Zone will remain open until 10:00 PM on weekdays throughout the examination period. Group study rooms are available for online booking through the BookHive portal.",
    audience: "All Users" as const,
    priority: "Important" as const,
    published: true,
    durationDays: 7,
  },
  {
    id: "catalog",
    name: "New AI Search",
    icon: Sparkles,
    title: "New AI-Powered Semantic Catalog Search Now Live",
    content: "We have deployed the new BookHive semantic AI search engine. Students and faculty can now query books using conceptual prompts, course syllabi topics, and natural keywords across the 48,000+ title catalog.",
    audience: "All Users" as const,
    priority: "Normal" as const,
    published: true,
    durationDays: 3,
  },
  {
    id: "maintenance",
    name: "System Maintenance",
    icon: ShieldAlert,
    title: "Scheduled Database Maintenance & Catalog Sync",
    content: "Central BookHive server maintenance and catalog indexing is scheduled for Sunday from 2:00 AM to 5:00 AM. Circulation transactions and loan lookups will experience brief intermittent downtime during this window.",
    audience: "All Users" as const,
    priority: "Urgent" as const,
    published: true,
    durationDays: 1,
  },
  {
    id: "reserves",
    name: "Faculty Reserves",
    icon: Briefcase,
    title: "Faculty Course Reserve & Digital Reading List Submissions",
    content: "Department faculty members are invited to submit their required reading lists and reserve shelf allocations for the upcoming academic semester before the 25th of the month.",
    audience: "Staff" as const,
    priority: "Normal" as const,
    published: false,
    durationDays: 0,
  },
];

function getDurationLabel(announcement: AnnouncementRecord): { label: string; isExpired: boolean } | null {
  if (announcement.expiresAt) {
    const expTime = new Date(announcement.expiresAt).getTime();
    const now = Date.now();
    const diffMs = expTime - now;
    if (diffMs <= 0) {
      return { label: "Expired", isExpired: true };
    }
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) {
      return { label: `${Math.max(1, diffHours)}h left`, isExpired: false };
    }
    const diffDays = Math.ceil(diffHours / 24);
    return { label: `${diffDays}d left`, isExpired: false };
  }
  if (announcement.durationDays && announcement.durationDays > 0) {
    return { label: `${announcement.durationDays}d limit`, isExpired: false };
  }
  return null;
}

function PriorityBadge({ priority, isLight = false }: { priority: AnnouncementRecord["priority"]; isLight?: boolean }) {
  const styles = isLight
    ? {
        Urgent: "bg-red-50 text-red-700 border-red-200 shadow-xs",
        Important: "bg-amber-50 text-amber-800 border-amber-200 shadow-xs",
        Normal: "bg-sky-50 text-sky-700 border-sky-200 shadow-xs",
      }
    : {
        Urgent: "bg-red-500/15 text-red-300 border-red-500/40 shadow-sm shadow-red-500/10",
        Important: "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10",
        Normal: "bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/10",
      };

  const dotColors = {
    Urgent: "bg-red-500 shadow-sm shadow-red-400 animate-pulse",
    Important: "bg-amber-500 shadow-sm shadow-amber-400",
    Normal: "bg-sky-500 shadow-sm shadow-sky-400",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${styles[priority]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColors[priority]}`} />
      {priority}
    </span>
  );
}

function StatusBadge({ published, isLight = false }: { published: boolean; isLight?: boolean }) {
  return published ? (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase",
      isLight
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-xs"
        : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-500/10"
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Published
    </span>
  ) : (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase",
      isLight ? "border-slate-200 bg-slate-100 text-slate-700" : "border-slate-500/40 bg-slate-500/15 text-slate-300"
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Draft
    </span>
  );
}

function AudienceBadge({ audience, isLight = false }: { audience: AnnouncementRecord["audience"]; isLight?: boolean }) {
  const icon =
    audience === "Students" ? (
      <GraduationCap className={cn("h-3 w-3", isLight ? "text-emerald-600" : "text-emerald-400")} />
    ) : audience === "Staff" ? (
      <Briefcase className={cn("h-3 w-3", isLight ? "text-purple-600" : "text-purple-400")} />
    ) : (
      <Globe className={cn("h-3 w-3", isLight ? "text-sky-600" : "text-sky-400")} />
    );

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
      isLight ? "border-slate-200 bg-slate-100 text-slate-700" : "border-white/10 bg-white/5 text-slate-200"
    )}>
      {icon}
      {audience}
    </span>
  );
}

function DurationBadge({ announcement, isLight = false }: { announcement: AnnouncementRecord; isLight?: boolean }) {
  const durationInfo = getDurationLabel(announcement);
  if (!durationInfo) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium",
        isLight ? "border-slate-200 bg-slate-100 text-slate-600" : "border-white/10 bg-white/5 text-slate-400"
      )} title="Permanent announcement">
        <Clock className="h-2.5 w-2.5 text-slate-400" />
        Permanent
      </span>
    );
  }

  if (durationInfo.isExpired) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold animate-pulse shadow-xs",
        isLight ? "border-red-200 bg-red-50 text-red-700" : "border-red-500/40 bg-red-500/20 text-red-300 shadow-sm shadow-red-500/15"
      )} title="This announcement has reached its expiration time">
        <AlertTriangle className="h-2.5 w-2.5 text-red-500" />
        Expired
      </span>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold shadow-xs",
      isLight ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/10"
    )} title={`Duration active: ${durationInfo.label}`}>
      <Hourglass className="h-2.5 w-2.5 text-amber-500" />
      {durationInfo.label}
    </span>
  );
}

export function AnnouncementsModule({
  variant = "admin",
}: {
  variant?: "admin" | "librarian";
}) {
  const { user } = useSession();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<(typeof audienceOptions)[number]>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("All");
  const [viewMode, setViewMode] = useState<"feed" | "table">("feed");
  const [composerTab, setComposerTab] = useState<"edit" | "preview">("edit");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyAnnouncementForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const deferredSearch = useDeferredValue(search);

  const loadAnnouncements = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        search: deferredSearch,
        audience,
        status,
      });
      const response = await fetch(`/api/announcements?${params.toString()}`);
      const payload = (await response.json()) as { announcements: AnnouncementRecord[] };
      startTransition(() => setAnnouncements(payload.announcements || []));
    } catch (error) {
      console.error("Failed to load announcements:", error);
    } finally {
      setRefreshing(false);
    }
  }, [audience, deferredSearch, status]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  function resetForm() {
    setForm(emptyAnnouncementForm);
    setEditingId(null);
    setComposerTab("edit");
  }

  function applyTemplate(tpl: (typeof PRESET_TEMPLATES)[number]) {
    setForm({
      title: tpl.title,
      content: tpl.content,
      audience: tpl.audience,
      priority: tpl.priority,
      published: tpl.published,
      durationDays: tpl.durationDays ?? 0,
    });
    setEditingId(null);
    setComposerTab("edit");
  }

  async function saveAnnouncement(event?: React.FormEvent, forcePublish?: boolean) {
    if (event) event.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    const publishValue = forcePublish !== undefined ? forcePublish : form.published;

    try {
      const endpoint = editingId ? `/api/announcements/${editingId}` : "/api/announcements";
      const method = editingId ? "PUT" : "POST";
      await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          published: publishValue,
          durationDays: form.durationDays || null,
        }),
      });

      resetForm();
      await loadAnnouncements();
    } catch (err) {
      console.error("Failed to save announcement:", err);
    } finally {
      setSaving(false);
    }
  }

  function editAnnouncement(announcement: AnnouncementRecord) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      audience: announcement.audience,
      priority: announcement.priority,
      published: announcement.published,
      durationDays: announcement.durationDays ?? 0,
    });
    setComposerTab("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleStatus(announcement: AnnouncementRecord) {
    const updatedPublished = !announcement.published;
    setAnnouncements((prev) =>
      prev.map((item) =>
        item.id === announcement.id ? { ...item, published: updatedPublished } : item
      )
    );

    try {
      await fetch(`/api/announcements/${announcement.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: updatedPublished }),
      });
      await loadAnnouncements();
    } catch (err) {
      console.error("Failed to toggle status:", err);
      await loadAnnouncements();
    }
  }

  async function deleteAnnouncement(id: string) {
    try {
      await fetch(`/api/announcements/${id}`, {
        method: "DELETE",
      });
      setConfirmDeleteId(null);
      await loadAnnouncements();
      if (editingId === id) {
        resetForm();
      }
    } catch (err) {
      console.error("Failed to delete announcement:", err);
    }
  }

  async function clearAllDisplayed() {
    setConfirmDeleteId(null);
    try {
      for (const item of displayAnnouncements) {
        await fetch(`/api/announcements/${item.id}`, { method: "DELETE" });
      }
      await loadAnnouncements();
      resetForm();
    } catch (err) {
      console.error("Failed to clear announcements:", err);
    }
  }

  const displayAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      if (priorityFilter !== "All" && a.priority !== priorityFilter) return false;
      return true;
    });
  }, [announcements, priorityFilter]);

  const stats = useMemo(() => {
    const total = announcements.length;
    const published = announcements.filter((a) => a.published).length;
    const drafts = announcements.filter((a) => !a.published).length;
    const urgent = announcements.filter((a) => a.priority === "Urgent").length;
    const expired = announcements.filter((a) => a.isExpired).length;

    return { total, published, drafts, urgent, expired };
  }, [announcements]);

  return (
    <div className={cn("flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1700px] mx-auto", isLight ? "text-slate-800" : "text-slate-100")}>
      {/* ── Top Hero Banner ─────────────────────────────────────────── */}
      <div className={cn(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-8 transition-colors",
        isLight
          ? "border-slate-200 bg-white shadow-xs"
          : "border-white/10 bg-gradient-to-br from-[#0B1A2C] via-[#0F2236] to-[#08131E] shadow-2xl"
      )}>
        <div className={cn("absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl pointer-events-none", isLight ? "bg-[#FCD400]/15" : "bg-[#FCD400]/10")} />
        <div className={cn("absolute -left-16 -bottom-16 h-64 w-64 rounded-full blur-3xl pointer-events-none", isLight ? "bg-sky-400/10" : "bg-sky-500/10")} />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
              isLight
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-[#FCD400]/30 bg-[#FCD400]/10 text-[#FCD400]"
            )}>
              <Radio className={cn("h-3.5 w-3.5 animate-pulse", isLight ? "text-amber-600" : "text-[#FCD400]")} />
              Live Campus Broadcast Center
            </div>
            <h1 className={cn("text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight", isLight ? "text-slate-800" : "text-white")}>
              Announcements & Notices
            </h1>
            <p className={cn("max-w-2xl text-xs sm:text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
              Compose, schedule, and broadcast institutional updates, library schedules, and system maintenance alerts across student mobile apps and campus portals in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            <button
              type="button"
              onClick={() => {
                resetForm();
                window.scrollTo({ top: 300, behavior: "smooth" });
              }}
              className="flex items-center gap-2 rounded-2xl bg-[#FCD400] px-4 py-2.5 text-xs sm:text-sm font-black text-[#0B1A2C] shadow-lg shadow-[#FCD400]/20 hover:brightness-110 active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Announcement</span>
            </button>

            <button
              type="button"
              onClick={() => loadAnnouncements()}
              disabled={refreshing}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl border transition active:scale-95 cursor-pointer disabled:opacity-50",
                isLight
                  ? "border-slate-200 bg-slate-50 text-slate-700 hover:text-[#0274BB] hover:bg-slate-100"
                  : "border-white/10 bg-[#122335]/80 text-slate-300 hover:text-white hover:bg-[#18324e]"
              )}
              title="Refresh announcements list"
            >
              <RefreshCcw className={cn("h-4 w-4", refreshing ? (isLight ? "animate-spin text-[#0274BB]" : "animate-spin text-[#FCD400]") : "")} />
            </button>
          </div>
        </div>

        {/* ── Key Metrics Overview ──────────────────────────────────── */}
        <div className={cn("mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-6", isLight ? "border-slate-100" : "border-white/10")}>
          <div className={cn("rounded-2xl border p-4 transition-colors", isLight ? "border-slate-200/80 bg-slate-50/80 hover:bg-slate-100/60" : "border-white/5 bg-white/[0.02]")}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>Total Notices</span>
              <Megaphone className={cn("h-4 w-4", isLight ? "text-sky-600" : "text-sky-400")} />
            </div>
            <p className={cn("mt-2 text-2xl font-black", isLight ? "text-slate-900" : "text-white")}>{stats.total}</p>
            <p className={cn("mt-0.5 text-[11px]", isLight ? "text-slate-500" : "text-slate-400")}>Stored in system</p>
          </div>

          <div className={cn("rounded-2xl border p-4 transition-colors", isLight ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50" : "border-emerald-500/20 bg-emerald-500/[0.03]")}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold", isLight ? "text-emerald-700" : "text-emerald-300")}>Live & Published</span>
              <Send className={cn("h-4 w-4", isLight ? "text-emerald-600" : "text-emerald-400")} />
            </div>
            <p className={cn("mt-2 text-2xl font-black", isLight ? "text-emerald-700" : "text-emerald-300")}>{stats.published}</p>
            <p className={cn("mt-0.5 text-[11px]", isLight ? "text-emerald-600" : "text-emerald-400/80")}>Visible to audience</p>
          </div>

          <div className={cn("rounded-2xl border p-4 transition-colors", isLight ? "border-slate-200/80 bg-slate-50/80 hover:bg-slate-100/60" : "border-white/5 bg-white/[0.02]")}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>Draft Notices</span>
              <FileText className={cn("h-4 w-4", isLight ? "text-slate-500" : "text-slate-400")} />
            </div>
            <p className={cn("mt-2 text-2xl font-black", isLight ? "text-slate-900" : "text-slate-200")}>{stats.drafts}</p>
            <p className={cn("mt-0.5 text-[11px]", isLight ? "text-slate-500" : "text-slate-400")}>Pending review</p>
          </div>

          <div className={cn("rounded-2xl border p-4 transition-colors", isLight ? "border-red-200 bg-red-50/60 hover:bg-red-50" : "border-red-500/20 bg-red-500/[0.03]")}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold", isLight ? "text-red-700" : "text-red-300")}>Urgent Alerts</span>
              <Flame className={cn("h-4 w-4", isLight ? "text-red-600" : "text-red-400")} />
            </div>
            <p className={cn("mt-2 text-2xl font-black", isLight ? "text-red-700" : "text-red-400")}>{stats.urgent}</p>
            <p className={cn("mt-0.5 text-[11px]", isLight ? "text-red-600" : "text-red-400/80")}>High priority dispatch</p>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Composer & Live Preview ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "lg:col-span-5 rounded-2xl border p-6 flex flex-col gap-5",
            isLight
              ? "border-slate-200/80 bg-white shadow-xs"
              : "border-white/10 bg-[#0F1D29]/95 shadow-2xl backdrop-blur"
          )}
        >
          {/* Composer Header */}
          <div className={cn("flex items-center justify-between border-b pb-4", isLight ? "border-slate-100" : "border-white/5")}>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-[#FCD400]" />
                <p className={cn("text-[10px] font-extrabold tracking-[0.2em] uppercase", isLight ? "text-amber-700" : "text-[#FCD400]")}>
                  {editingId ? "Edit Mode" : "Notice Composer"}
                </p>
              </div>
              <h2 className={cn("mt-1 text-xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                {editingId ? "Update Announcement" : "Publish Announcement"}
              </h2>
            </div>

            {/* Composer Tab Toggle: Edit vs Preview */}
            <div className={cn("flex items-center rounded-xl border p-0.5 text-xs font-semibold", isLight ? "border-slate-200 bg-slate-100" : "border-white/10 bg-[#0B1726]")}>
              <button
                type="button"
                onClick={() => setComposerTab("edit")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition cursor-pointer",
                  composerTab === "edit"
                    ? isLight
                      ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-xs"
                      : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                    : isLight
                      ? "text-slate-600 hover:text-[#0274BB]"
                      : "text-slate-400 hover:text-white"
                )}
              >
                <PencilLine className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setComposerTab("preview")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition cursor-pointer",
                  composerTab === "preview"
                    ? isLight
                      ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-xs"
                      : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                    : isLight
                      ? "text-slate-600 hover:text-[#0274BB]"
                      : "text-slate-400 hover:text-white"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>
          </div>

          {/* Quick Preset Templates Bar */}
          {!editingId && composerTab === "edit" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                <span className={cn("flex items-center gap-1", isLight ? "text-slate-700" : "text-slate-400")}>
                  <Sparkles className="h-3 w-3 text-[#FCD400]" />
                  Instant Templates
                </span>
                <span className={cn("text-[10px] font-normal", isLight ? "text-slate-400" : "text-slate-500")}>Click to auto-fill</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_TEMPLATES.map((tpl) => {
                  const Icon = tpl.icon;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition cursor-pointer group",
                        isLight
                          ? "border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-800"
                          : "border-white/5 bg-[#122335]/60 text-slate-200 hover:border-[#FCD400]/40 hover:bg-[#162D44] hover:text-[#FCD400]"
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5 transition", isLight ? "text-slate-400 group-hover:text-amber-600" : "text-slate-400 group-hover:text-[#FCD400]")} />
                      <span className="truncate">{tpl.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {composerTab === "edit" ? (
            /* ── Editor Form ───────────────────────────────────────── */
            <form onSubmit={(e) => saveAnnouncement(e, true)} className="flex flex-col gap-4">
              {/* Title Field */}
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-bold flex items-center justify-between", isLight ? "text-slate-700" : "text-slate-300")}>
                  <span>Announcement Title *</span>
                  <span className={cn("text-[10px]", isLight ? "text-slate-400" : "text-slate-500")}>{form.title.length}/120</span>
                </label>
                <input
                  required
                  maxLength={120}
                  className={cn(
                    "w-full rounded-xl border p-3 text-sm focus:border-[#FCD400] focus:ring-1 focus:ring-[#FCD400]/50 focus:outline-none transition",
                    isLight
                      ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
                      : "border-white/10 bg-[#0B1726] text-white placeholder:text-slate-500 shadow-inner"
                  )}
                  placeholder="e.g., Extended Library Hours for Midterms"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>

              {/* Content / Body Field */}
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-bold flex items-center justify-between", isLight ? "text-slate-700" : "text-slate-300")}>
                  <span>Announcement Message *</span>
                  <span className={cn("text-[10px]", isLight ? "text-slate-400" : "text-slate-500")}>{form.content.length} characters</span>
                </label>
                <textarea
                  required
                  rows={4}
                  className={cn(
                    "w-full rounded-xl border p-3 text-xs leading-relaxed focus:border-[#FCD400] focus:ring-1 focus:ring-[#FCD400]/50 focus:outline-none transition resize-none",
                    isLight
                      ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
                      : "border-white/10 bg-[#0B1726] text-white placeholder:text-slate-500 shadow-inner"
                  )}
                  placeholder="Provide clear details, timings, affected groups, instructions, or hyperlinks..."
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, content: event.target.value }))
                  }
                />
              </div>

              {/* Target Audience Selector */}
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-bold", isLight ? "text-slate-700" : "text-slate-300")}>Target Audience</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "All Users", label: "All Users", icon: Globe, desc: "Entire Campus" },
                    { id: "Students", label: "Students", icon: GraduationCap, desc: "Learners Only" },
                    { id: "Staff", label: "Staff", icon: Briefcase, desc: "Faculty & Library" },
                  ].map((item) => {
                    const isSelected = form.audience === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            audience: item.id as AnnouncementRecord["audience"],
                          }))
                        }
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-xl border transition text-center cursor-pointer",
                          isSelected
                            ? isLight
                              ? "border-[#FFF300] bg-amber-50 text-slate-900 shadow-xs ring-1 ring-amber-300"
                              : "border-[#FCD400] bg-[#FCD400]/10 text-white shadow-sm shadow-[#FCD400]/10 ring-1 ring-[#FCD400]/30"
                            : isLight
                              ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              : "border-white/10 bg-[#0B1726]/60 text-slate-400 hover:bg-[#0B1726] hover:text-slate-200"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 mb-1", isSelected ? (isLight ? "text-amber-600" : "text-[#FCD400]") : "text-slate-400")} />
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className={cn("text-[10px] mt-0.5", isLight ? "text-slate-500" : "text-slate-500")}>{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority & Visibility Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Priority Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className={cn("text-xs font-bold", isLight ? "text-slate-700" : "text-slate-300")}>Priority Level</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {priorityOptions.map((opt) => {
                      const isSelected = form.priority === opt;
                      const isUrgent = opt === "Urgent";
                      const isImportant = opt === "Important";
                      
                      const selectedStyle = isLight
                        ? isUrgent
                          ? "border-red-300 bg-red-50 text-red-800 ring-1 ring-red-300 font-bold"
                          : isImportant
                          ? "border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-300 font-bold"
                          : "border-sky-300 bg-sky-50 text-sky-800 ring-1 ring-sky-300 font-bold"
                        : isUrgent
                        ? "border-red-500/60 bg-red-500/20 text-red-300 ring-1 ring-red-500/40 font-bold"
                        : isImportant
                        ? "border-amber-500/60 bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 font-bold"
                        : "border-sky-500/60 bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40 font-bold";

                      const dotColor = isUrgent
                        ? "bg-red-500"
                        : isImportant
                        ? "bg-amber-500"
                        : "bg-sky-500";

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setForm((c) => ({ ...c, priority: opt }))}
                          className={cn(
                            "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs transition cursor-pointer",
                            isSelected
                              ? selectedStyle
                              : isLight
                              ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              : "border-white/10 bg-[#0B1726]/60 text-slate-400 hover:bg-[#0B1726] hover:text-slate-200"
                          )}
                        >
                          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Visibility Switch */}
                <div className="flex flex-col gap-1.5">
                  <label className={cn("text-xs font-bold", isLight ? "text-slate-700" : "text-slate-300")}>Publish Target Status</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setForm((c) => ({ ...c, published: true }))}
                      className={cn(
                        "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer",
                        form.published
                          ? isLight
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 shadow-xs"
                            : "border-emerald-500/60 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm shadow-emerald-500/10"
                          : isLight
                          ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          : "border-white/10 bg-[#0B1726]/60 text-slate-400 hover:bg-[#0B1726] hover:text-slate-200"
                      )}
                    >
                      <Send className={cn("h-3.5 w-3.5", isLight ? "text-emerald-600" : "text-emerald-400")} />
                      Broadcast Live
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((c) => ({ ...c, published: false }))}
                      className={cn(
                        "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer",
                        !form.published
                          ? isLight
                            ? "border-amber-300 bg-amber-50 text-amber-800 ring-1 ring-amber-300"
                            : "border-amber-500/60 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40"
                          : isLight
                          ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          : "border-white/10 bg-[#0B1726]/60 text-slate-400 hover:bg-[#0B1726] hover:text-slate-200"
                      )}
                    >
                      <FileText className={cn("h-3.5 w-3.5", isLight ? "text-amber-600" : "text-amber-400")} />
                      Save as Draft
                    </button>
                  </div>
                </div>
              </div>

              {/* ── NEW: Announcement Duration Selection (1, 2, 3 Days) ── */}
              <div className={cn("flex flex-col gap-2 rounded-2xl border p-3.5", isLight ? "border-slate-200 bg-slate-50 shadow-xs" : "border-white/10 bg-[#0B1726]/70 shadow-inner")}>
                <div className="flex items-center justify-between">
                  <label className={cn("text-xs font-bold flex items-center gap-1.5", isLight ? "text-slate-700" : "text-slate-200")}>
                    <Clock className={cn("h-3.5 w-3.5", isLight ? "text-amber-600" : "text-[#FCD400]")} />
                    Notice Duration & Auto-Expiry
                  </label>
                  <span className={cn("text-[11px] font-semibold", isLight ? "text-amber-700" : "text-[#FCD400]")}>
                    {form.durationDays === 0 || !form.durationDays
                      ? "Permanent (Never Expires)"
                      : `Expires in ${form.durationDays} day${form.durationDays > 1 ? "s" : ""}`}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {DURATION_CHOICES.map((choice) => {
                    const isSelected = (form.durationDays ?? 0) === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({ ...current, durationDays: choice.value }))
                        }
                        className={cn(
                          "flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition cursor-pointer",
                          isSelected
                            ? isLight
                              ? "border-amber-400 bg-amber-100/70 text-amber-900 ring-1 ring-amber-400/50 font-bold shadow-xs"
                              : "border-[#FCD400] bg-[#FCD400]/15 text-white ring-1 ring-[#FCD400]/40 font-bold shadow-sm shadow-[#FCD400]/10"
                            : isLight
                            ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            : "border-white/10 bg-[#122335]/40 text-slate-400 hover:bg-[#122335] hover:text-slate-200"
                        )}
                      >
                        <span className={cn("text-xs font-bold", isSelected ? (isLight ? "text-amber-900" : "text-[#FCD400]") : (isLight ? "text-slate-700" : "text-slate-200"))}>
                          {choice.label}
                        </span>
                        <span className={cn("text-[9px] mt-0.5 whitespace-nowrap", isLight ? "text-slate-500" : "text-slate-400")}>
                          {choice.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className={cn("flex flex-wrap items-center gap-2.5 pt-3 border-t", isLight ? "border-slate-100" : "border-white/5")}>
                <button
                  type="button"
                  disabled={saving || !form.title.trim()}
                  onClick={(e) => saveAnnouncement(e, true)}
                  className="flex-1 min-w-[200px] flex items-center justify-center gap-2 rounded-xl bg-[#FCD400] hover:bg-yellow-400 py-3 px-5 text-sm font-black text-[#0B1A2C] shadow-lg shadow-[#FCD400]/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCcw className="h-4 w-4 animate-spin text-[#0B1A2C]" />
                      <span>Broadcasting Notice...</span>
                    </>
                  ) : editingId ? (
                    <>
                      <Check className="h-4 w-4 text-[#0B1A2C]" />
                      <span>Update & Publish Live</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 text-[#0B1A2C]" />
                      <span>🚀 Broadcast Live (Students & Staff)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={saving || !form.title.trim()}
                  onClick={(e) => saveAnnouncement(e, false)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border py-3 px-4 text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer",
                    isLight
                      ? "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                      : "border-white/15 bg-[#122335] hover:bg-[#18324e] text-slate-300"
                  )}
                  title="Save announcement as draft (hidden from students and librarians)"
                >
                  <FileText className={cn("h-3.5 w-3.5", isLight ? "text-slate-500" : "text-slate-400")} />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-xs font-semibold transition cursor-pointer",
                    isLight
                      ? "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                      : "border-white/10 bg-[#0B1726] text-slate-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  Reset
                </button>
              </div>
            </form>
          ) : (
            /* ── Live Preview Mode ────────────────────────────────── */
            <div className="flex flex-col gap-4 py-2">
              <div className={cn("flex items-center justify-between text-xs px-3 py-2 rounded-xl border", isLight ? "border-amber-200 bg-amber-50 text-slate-700" : "border-white/5 bg-white/5 text-slate-400")}>
                <span className={cn("flex items-center gap-1.5 font-semibold", isLight ? "text-amber-800" : "text-[#FCD400]")}>
                  <Eye className="h-3.5 w-3.5" />
                  Live Student & Campus Feed Simulation
                </span>
                <span>Rendered in BookHive App</span>
              </div>

              {/* Simulated Card Preview */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-5 transition-colors",
                  isLight
                    ? "border-slate-200 bg-slate-50 shadow-md text-slate-800"
                    : "border-white/15 bg-gradient-to-b from-[#132438] to-[#0A1622] shadow-2xl text-white"
                )}
                style={{
                  borderLeftColor:
                    form.priority === "Urgent"
                      ? "#EF4444"
                      : form.priority === "Important"
                      ? "#FCD400"
                      : "#38BDF8",
                  borderLeftWidth: 4,
                }}
              >
                {/* Notice Header */}
                <div className={cn("flex items-center justify-between gap-3 border-b pb-3", isLight ? "border-slate-200" : "border-white/5")}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCD400] font-mono text-xs font-black text-[#0B1A2C] shadow-md">
                      BH
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-bold", isLight ? "text-slate-900" : "text-white")}>BookHive Administration</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#FCD400]" />
                      </div>
                      <p className={cn("text-[10px]", isLight ? "text-slate-500" : "text-slate-400")}>Official Campus Dispatch • Just now</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {form.durationDays > 0 && (
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold", isLight ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-500/40 bg-amber-500/15 text-amber-300")}>
                        <Clock className="h-2.5 w-2.5" />
                        {form.durationDays}d limit
                      </span>
                    )}
                    <PriorityBadge priority={form.priority} isLight={isLight} />
                    <StatusBadge published={form.published} isLight={isLight} />
                  </div>
                </div>

                {/* Notice Title & Content */}
                <div className="mt-4">
                  <h3 className={cn("text-lg font-bold tracking-tight leading-snug", isLight ? "text-slate-900" : "text-white")}>
                    {form.title || "Announcement Title Preview"}
                  </h3>
                  <p className={cn("mt-2 text-xs leading-relaxed whitespace-pre-wrap", isLight ? "text-slate-600" : "text-slate-300")}>
                    {form.content ||
                      "Your announcement body text will appear here with rich formatting and clear typography for student and staff readability."}
                  </p>
                </div>

                {/* Notice Footer Tags */}
                <div className={cn("mt-4 flex items-center justify-between pt-3 border-t text-[11px]", isLight ? "border-slate-200" : "border-white/5")}>
                  <AudienceBadge audience={form.audience} isLight={isLight} />
                  <span className={cn("text-[10px] font-mono", isLight ? "text-slate-500" : "text-slate-400")}>
                    {form.durationDays > 0 ? `Duration: ${form.durationDays} Days` : "Duration: Permanent"}
                  </span>
                </div>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setComposerTab("edit")}
                  className={cn("text-xs font-semibold cursor-pointer hover:underline", isLight ? "text-[#0274BB]" : "text-[#FCD400]")}
                >
                  ← Return to Editor to refine text
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Right Column: Shared Notice Board & Queue ──────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className={cn(
            "lg:col-span-7 rounded-2xl border p-6 flex flex-col gap-5 min-h-[580px]",
            isLight
              ? "border-slate-200/80 bg-white shadow-xs"
              : "border-white/10 bg-[#0F1D29]/95 shadow-2xl backdrop-blur"
          )}
        >
          {/* Header & View Switcher */}
          <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b pb-4", isLight ? "border-slate-100" : "border-white/5")}>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-sky-400" />
                <p className={cn("text-[10px] font-extrabold tracking-[0.2em] uppercase", isLight ? "text-[#0274BB]" : "text-sky-400")}>
                  Shared Notice Board
                </p>
              </div>
              <h2 className={cn("mt-1 text-xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                Announcement Queue
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className={cn("rounded-full border px-3 py-1 text-xs font-bold shadow-xs", isLight ? "border-slate-200 bg-slate-50 text-[#0274BB]" : "border-white/10 bg-[#122335] text-[#FCD400]")}>
                {displayAnnouncements.length} {displayAnnouncements.length === 1 ? "Notice" : "Notices"}
              </span>

              {/* Bulk Clear All Button */}
              {displayAnnouncements.length > 0 && (
                confirmDeleteId === "CLEAR_ALL" ? (
                  <div className="flex items-center gap-1 rounded-xl border border-red-500/40 bg-red-950/80 p-1">
                    <button
                      type="button"
                      onClick={clearAllDisplayed}
                      className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-500 cursor-pointer shadow-sm"
                    >
                      Confirm Clear ({displayAnnouncements.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId("CLEAR_ALL")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition cursor-pointer",
                      isLight
                        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                    )}
                    title="Remove all displayed notices from system"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    <span>Clear All</span>
                  </button>
                )
              )}

              {/* View Switcher: Card Feed vs Table */}
              <div className={cn("flex items-center rounded-xl border p-0.5 text-xs font-semibold", isLight ? "border-slate-200 bg-slate-100" : "border-white/10 bg-[#0B1726]")}>
                <button
                  type="button"
                  onClick={() => setViewMode("feed")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition cursor-pointer",
                    viewMode === "feed"
                      ? isLight
                        ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-xs"
                        : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                      : isLight
                        ? "text-slate-600 hover:text-[#0274BB]"
                        : "text-slate-400 hover:text-white"
                  )}
                  title="Interactive Cards View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Feed
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition cursor-pointer",
                    viewMode === "table"
                      ? isLight
                        ? "bg-[#FFF300] text-[#0274BB] font-bold shadow-xs"
                        : "bg-[#FCD400] text-[#0B1A2C] font-bold shadow-sm"
                      : isLight
                        ? "text-slate-600 hover:text-[#0274BB]"
                        : "text-slate-400 hover:text-white"
                  )}
                  title="Dense Table View"
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col gap-3">
            <div className="grid gap-2.5 sm:grid-cols-12">
              {/* Search Bar */}
              <div className="relative sm:col-span-6">
                <Search className={cn("absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2", isLight ? "text-slate-400" : "text-slate-400")} />
                <input
                  className={cn(
                    "w-full rounded-xl border py-2.5 pl-10 pr-9 text-xs focus:border-[#FCD400] focus:ring-1 focus:ring-[#FCD400]/40 focus:outline-none transition",
                    isLight
                      ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs"
                      : "border-white/10 bg-[#0B1726] text-white placeholder:text-slate-500 shadow-inner"
                  )}
                  placeholder="Search title, keywords, or author..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className={cn("absolute right-3 top-1/2 -translate-y-1/2", isLight ? "text-slate-400 hover:text-slate-700" : "text-slate-500 hover:text-white")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Audience Dropdown */}
              <div className="sm:col-span-3">
                <select
                  className={cn(
                    "w-full rounded-xl border py-2.5 px-3 text-xs focus:border-[#FCD400] focus:outline-none transition cursor-pointer",
                    isLight
                      ? "border-slate-200 bg-white text-slate-800"
                      : "border-white/10 bg-[#0B1726] text-white"
                  )}
                  value={audience}
                  onChange={(event) =>
                    setAudience(event.target.value as (typeof audienceOptions)[number])
                  }
                >
                  {audienceOptions.map((option) => (
                    <option key={option} value={option} className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>
                      {option === "All" ? "All Audiences" : option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Dropdown */}
              <div className="sm:col-span-3">
                <select
                  className={cn(
                    "w-full rounded-xl border py-2.5 px-3 text-xs focus:border-[#FCD400] focus:outline-none transition cursor-pointer",
                    isLight
                      ? "border-slate-200 bg-white text-slate-800"
                      : "border-white/10 bg-[#0B1726] text-white"
                  )}
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                >
                  <option value="All" className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>All Priorities</option>
                  <option value="Urgent" className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>🔴 Urgent</option>
                  <option value="Important" className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>🟡 Important</option>
                  <option value="Normal" className={isLight ? "bg-white text-slate-800" : "bg-[#0F1D29]"}>🔵 Normal</option>
                </select>
              </div>
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", isLight ? "text-slate-500" : "text-slate-400")}>Status:</span>
              <div className="flex items-center gap-1.5">
                {[
                  { id: "All", label: `All (${stats.total})` },
                  { id: "Published", label: `Live (${stats.published})` },
                  { id: "Draft", label: `Drafts (${stats.drafts})` },
                ].map((st) => {
                  const isActive = status === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatus(st.id as (typeof statusOptions)[number])}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer",
                        isActive
                          ? isLight
                            ? "bg-slate-200 text-[#0274BB] border border-slate-300 shadow-xs"
                            : "bg-white/15 text-white border border-white/20"
                          : isLight
                            ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      )}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Content View ────────────────────────────────────────── */}
          {displayAnnouncements.length === 0 ? (
            /* Empty State */
            <div className={cn("flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center", isLight ? "border-slate-200 bg-slate-50/50" : "border-white/10 bg-white/[0.01]")}>
              <div className={cn("relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner", isLight ? "bg-slate-100 text-slate-500" : "bg-[#122335] text-slate-400")}>
                <Megaphone className={cn("h-6 w-6", isLight ? "text-slate-500" : "text-slate-400")} />
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FCD400] animate-ping" />
              </div>
              <h3 className={cn("text-base font-bold", isLight ? "text-slate-800" : "text-white")}>No announcements found</h3>
              <p className={cn("mt-1 max-w-sm text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                {search || audience !== "All" || status !== "All" || priorityFilter !== "All"
                  ? "No notices match your current filters. Try resetting search criteria."
                  : "Start by composing a new notice or applying one of the quick templates above."}
              </p>
              {(search || audience !== "All" || status !== "All" || priorityFilter !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setAudience("All");
                    setStatus("All");
                    setPriorityFilter("All");
                  }}
                  className={cn(
                    "mt-4 rounded-xl border px-4 py-2 text-xs font-bold transition cursor-pointer",
                    isLight
                      ? "border-slate-200 bg-white text-[#0274BB] hover:bg-slate-50 shadow-xs"
                      : "border-white/10 bg-[#122335] text-[#FCD400] hover:bg-[#18324e]"
                  )}
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : viewMode === "feed" ? (
            /* ── Interactive Card Feed View (Cleanly Scrollable) ───── */
            <div className="flex flex-col flex-1">
              <div
                className="flex flex-col gap-3.5 overflow-y-auto max-h-[640px] pr-2 focus:outline-none"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: isLight ? "#cbd5e1 #f8fafc" : "#24425e #0B1726",
                }}
              >
                <AnimatePresence>
                  {displayAnnouncements.map((announcement) => {
                    const isEditing = editingId === announcement.id;
                    const isUrgent = announcement.priority === "Urgent";
                    const isImportant = announcement.priority === "Important";
                    const borderColor = isUrgent ? "#EF4444" : isImportant ? "#FCD400" : "#38BDF8";

                    return (
                      <motion.div
                        key={announcement.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border transition-all duration-200",
                          isEditing
                            ? isLight
                              ? "border-[#FCD400] bg-amber-50/50 ring-2 ring-[#FCD400]/40 shadow-md"
                              : "border-[#FCD400] bg-[#122335] ring-2 ring-[#FCD400]/40 shadow-xl"
                            : isLight
                            ? "border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300 shadow-xs"
                            : "border-white/10 bg-[#0B1726]/80 hover:bg-[#122335]/90 hover:border-white/20 shadow-md"
                        )}
                        style={{ borderLeftColor: borderColor, borderLeftWidth: 4 }}
                      >
                        <div className="p-4 sm:p-5">
                          {/* Card Top Metadata Bar: Badges + Timestamp + CLEAR/DELETE BUTTON */}
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <PriorityBadge priority={announcement.priority} isLight={isLight} />
                              <AudienceBadge audience={announcement.audience} isLight={isLight} />
                              <StatusBadge published={announcement.published} isLight={isLight} />
                              <DurationBadge announcement={announcement} isLight={isLight} />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={cn("text-[11px] font-mono", isLight ? "text-slate-400" : "text-slate-400")}>
                                {formatDateTime(announcement.updatedAt)}
                              </span>

                              {/* Prominent Quick Delete / Clear Button in Card Header */}
                              {confirmDeleteId === announcement.id ? (
                                <div className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/80 p-0.5 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => deleteAnnouncement(announcement.id)}
                                    className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-500 transition cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded-md px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(announcement.id)}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer",
                                    isLight
                                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300"
                                      : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/25 hover:border-red-500/60"
                                  )}
                                  title="Delete announcement from system"
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                  <span className="hidden sm:inline">Delete</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Title & Body */}
                          <div className="mt-3">
                            <h3 className={cn("text-base font-bold tracking-tight leading-snug", isLight ? "text-slate-900" : "text-white")}>
                              {announcement.title}
                            </h3>
                            <p className={cn("mt-1.5 text-xs leading-relaxed line-clamp-3", isLight ? "text-slate-600" : "text-slate-300")}>
                              {announcement.content}
                            </p>
                          </div>

                          {/* Card Bottom Actions Bar */}
                          <div className={cn("mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t", isLight ? "border-slate-100" : "border-white/5")}>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className={cn("font-semibold", isLight ? "text-slate-700" : "text-slate-300")}>By {announcement.author}</span>
                              {announcement.durationDays ? (
                                <span className={cn(isLight ? "text-slate-400" : "text-slate-500")}>• {announcement.durationDays}d duration</span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Quick Status Toggle Button */}
                              <button
                                type="button"
                                onClick={() => toggleStatus(announcement)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[11px] font-bold transition cursor-pointer",
                                  announcement.published
                                    ? isLight
                                      ? "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
                                      : "border-slate-500/40 bg-slate-500/10 text-slate-300 hover:bg-slate-500/25 hover:text-white"
                                    : isLight
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                    : "border-emerald-500/60 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 ring-1 ring-emerald-500/30 shadow-sm"
                                )}
                                title={announcement.published ? "Click to move to Draft (hide from students)" : "Click to Broadcast Live Now"}
                              >
                                {announcement.published ? (
                                  <>
                                    <EyeOff className="h-3 w-3 text-slate-400" />
                                    <span>Move to Draft</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3 w-3 text-emerald-500" />
                                    <span>🚀 Publish Live Now</span>
                                  </>
                                )}
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => editAnnouncement(announcement)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                                  isLight
                                    ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                    : "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50"
                                )}
                              >
                                <PencilLine className="h-3 w-3" />
                                <span>Edit</span>
                              </button>

                              {/* Secondary Delete Button */}
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(announcement.id)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                                  isLight
                                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                    : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                                )}
                                title="Delete announcement"
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Scrollable Indicator / Footer */}
              {displayAnnouncements.length > 2 && (
                <div className={cn("mt-3 flex items-center justify-between px-2 pt-2 border-t text-[11px]", isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-slate-400")}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#FCD400] animate-pulse" />
                    Scroll queue to view all {displayAnnouncements.length} announcements
                  </span>
                  <span className={cn("font-mono text-[10px]", isLight ? "text-slate-400" : "text-slate-500")}>Live synced with Mobile App</span>
                </div>
              )}
            </div>
          ) : (
            /* ── Compact Table View (Cleanly Scrollable) ───────────── */
            <div className={cn("flex-1 overflow-hidden rounded-xl border shadow-xs", isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#0B1726]/70 shadow-md")}>
              <div
                className="overflow-x-auto overflow-y-auto max-h-[640px]"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: isLight ? "#cbd5e1 #f8fafc" : "#24425e #0B1726",
                }}
              >
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className={cn("border-b", isLight ? "border-slate-200 bg-slate-100/90 text-slate-700" : "border-white/10 bg-[#122335] text-slate-300")}>
                      <th className="px-4 py-3.5 text-left font-bold tracking-wider uppercase whitespace-nowrap">
                        Title & Body
                      </th>
                      <th className="px-4 py-3.5 text-left font-bold tracking-wider uppercase whitespace-nowrap">
                        Audience
                      </th>
                      <th className="px-4 py-3.5 text-left font-bold tracking-wider uppercase whitespace-nowrap">
                        Priority
                      </th>
                      <th className="px-4 py-3.5 text-left font-bold tracking-wider uppercase whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-4 py-3.5 text-left font-bold tracking-wider uppercase whitespace-nowrap">
                        Duration
                      </th>
                      <th className="px-4 py-3.5 text-left font-bold tracking-wider uppercase whitespace-nowrap">
                        Updated
                      </th>
                      <th className="px-4 py-3.5 text-right font-bold tracking-wider uppercase whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", isLight ? "divide-slate-100" : "divide-white/5")}>
                    {displayAnnouncements.map((announcement) => (
                      <tr
                        key={announcement.id}
                        className={cn("transition group", isLight ? "hover:bg-slate-50" : "hover:bg-white/[0.04]")}
                      >
                        <td className="px-4 py-3.5 max-w-[240px]">
                          <div className={cn("font-bold truncate transition-colors", isLight ? "text-slate-900 group-hover:text-[#0274BB]" : "text-white group-hover:text-[#FCD400]")}>
                            {announcement.title}
                          </div>
                          <div className={cn("text-[11px] line-clamp-1 mt-0.5", isLight ? "text-slate-500" : "text-slate-400")}>
                            {announcement.content}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <AudienceBadge audience={announcement.audience} isLight={isLight} />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <PriorityBadge priority={announcement.priority} isLight={isLight} />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleStatus(announcement)}
                            className="cursor-pointer"
                            title="Click to toggle status"
                          >
                            <StatusBadge published={announcement.published} isLight={isLight} />
                          </button>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <DurationBadge announcement={announcement} isLight={isLight} />
                        </td>
                        <td className={cn("px-4 py-3.5 text-[11px] whitespace-nowrap font-mono", isLight ? "text-slate-500" : "text-slate-400")}>
                          {formatDateTime(announcement.updatedAt)}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {confirmDeleteId === announcement.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => deleteAnnouncement(announcement.id)}
                                className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-500 cursor-pointer shadow-sm"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded border border-white/10 px-1.5 py-1 text-[10px] text-slate-300 hover:text-white cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => editAnnouncement(announcement)}
                                className={cn(
                                  "rounded-lg border p-1.5 transition cursor-pointer",
                                  isLight
                                    ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                    : "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
                                )}
                                title="Edit"
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(announcement.id)}
                                className={cn(
                                  "rounded-lg border p-1.5 transition cursor-pointer",
                                  isLight
                                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                    : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                )}
                                title="Delete announcement from system"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

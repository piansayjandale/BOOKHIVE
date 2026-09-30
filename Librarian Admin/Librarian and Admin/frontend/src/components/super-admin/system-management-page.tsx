"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Edit2,
  Eye,
  EyeOff,
  Inbox,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Zap,
} from "lucide-react";

import { AdminModal, AdminPageHeader, AdminSection, AdminTable, FieldLabel } from "@/components/admin/shared";
import { useNotice } from "@/components/providers/notice-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { requestJson } from "@/lib/admin/client";
import type { SuperAdminUserRecord, SuperAdminVitals, SuperAdminDashboardPayload } from "@/lib/types";
import type { AdminBookRecord } from "@/lib/admin/types";
import { cn, formatDate } from "@/lib/utils";

const ALL_ROLES = [
  "Super Admin",
  "Admin",
  "Librarian",
  "Student",
];

export interface CollegeDepartment {
  code: string;
  name: string;
  category: "Academic Colleges" | "Other";
  programs: string[];
}

export const ACADEMIC_DEPARTMENTS: CollegeDepartment[] = [
  {
    code: "CICT",
    name: "College of Information & Communications Technology (CICT)",
    category: "Academic Colleges",
    programs: [
      "BS Information Technology",
      "BS Computer Science",
      "Bachelor of Library & Information Science",
      "Associate in Computer Technology",
    ],
  },
  {
    code: "COE",
    name: "College of Engineering (COE)",
    category: "Academic Colleges",
    programs: [
      "BS Computer Engineering",
      "BS Electrical Engineering",
      "BS Electronics Engineering",
      "BS Civil Engineering",
      "BS Mechanical Engineering",
    ],
  },
  {
    code: "CBMA",
    name: "College of Business Management & Accountancy (CBMA)",
    category: "Academic Colleges",
    programs: [
      "BS Accountancy",
      "BS Business Administration",
      "BS Management Accounting",
      "BS Entrepreneurship",
    ],
  },
  {
    code: "CAS",
    name: "College of Arts & Sciences (CAS)",
    category: "Academic Colleges",
    programs: [
      "BA Communication",
      "BS Psychology",
      "BA Political Science",
      "BS Biology",
    ],
  },
  {
    code: "CED",
    name: "College of Education (CED)",
    category: "Academic Colleges",
    programs: [
      "Bachelor of Secondary Education",
      "Bachelor of Elementary Education",
      "Bachelor of Early Childhood Education",
      "Bachelor of Special Needs Education",
    ],
  },
  {
    code: "CHTM",
    name: "College of Hospitality & Tourism Management (CHTM)",
    category: "Academic Colleges",
    programs: [
      "BS Hospitality Management",
      "BS Tourism Management",
    ],
  },
  {
    code: "CCJE",
    name: "College of Criminal Justice Education (CCJE)",
    category: "Academic Colleges",
    programs: [
      "BS Criminology",
    ],
  },
  {
    code: "NONE",
    name: "None",
    category: "Other",
    programs: [
      "None",
    ],
  },
];

export function getDepartmentPrograms(deptName: string): string[] {
  if (!deptName || deptName.toLowerCase() === "none") return ["None"];
  const found = ACADEMIC_DEPARTMENTS.find(
    (d) =>
      d.name.toLowerCase() === deptName.toLowerCase() ||
      d.code.toLowerCase() === deptName.toLowerCase() ||
      deptName.toLowerCase().includes(d.code.toLowerCase()) ||
      d.name.toLowerCase().includes(deptName.toLowerCase())
  );
  return found ? found.programs : ["None"];
}

export interface ModernDropdownOption {
  label: string;
  value: string;
  group?: string;
}

export function ModernDropdown({
  value,
  onChange,
  options,
  placeholder = "-- Select --",
  icon,
}: {
  value: string;
  onChange: (val: string) => void;
  options: (string | ModernDropdownOption)[];
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const normalizedOptions: ModernDropdownOption[] = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value || placeholder;

  const grouped: { [group: string]: ModernDropdownOption[] } = {};
  const ungrouped: ModernDropdownOption[] = [];

  normalizedOptions.forEach((opt) => {
    if (opt.group) {
      if (!grouped[opt.group]) grouped[opt.group] = [];
      grouped[opt.group].push(opt);
    } else {
      ungrouped.push(opt);
    }
  });

  return (
    <div ref={containerRef} className={cn("relative w-full", open ? "z-50" : "z-10")}>
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 z-10">
          {icon}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "glass-input w-full flex items-center justify-between pr-3.5 py-2.5 text-xs text-white bg-[#101D2D] rounded-xl transition-all cursor-pointer text-left select-none",
          icon ? "pl-10" : "pl-3.5",
          open
            ? "border-[#FCD400] ring-1 ring-[#FCD400]/30 shadow-lg shadow-[#FCD400]/10"
            : "hover:border-white/20"
        )}
      >
        <span className={cn("truncate pr-2", !value && "text-slate-400")}>
          {displayLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200",
            open && "rotate-180 text-[#FCD400]"
          )}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl border border-[#2E3F5C] bg-[#0E1A26] p-1.5 shadow-2xl shadow-black/90 backdrop-blur-md"
          style={{ transformOrigin: "top" }}
        >
          {Object.keys(grouped).length > 0 ? (
            <>
              {Object.entries(grouped).map(([grp, items]) => (
                <div key={grp} className="mb-2 last:mb-0">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FCD400]/90 border-b border-white/5 mb-1">
                    {grp}
                  </div>
                  {items.map((opt) => {
                    const isSelected = value === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition cursor-pointer text-left",
                          isSelected
                            ? "bg-[#FCD400] text-[#0F1D29] font-bold shadow-sm"
                            : "text-slate-200 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-[#0F1D29] shrink-0 ml-1.5" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  {ungrouped.map((opt) => {
                    const isSelected = value === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition cursor-pointer text-left",
                          isSelected
                            ? "bg-[#FCD400] text-[#0F1D29] font-bold shadow-sm"
                            : "text-slate-200 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-[#0F1D29] shrink-0 ml-1.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition cursor-pointer text-left",
                    isSelected
                      ? "bg-[#FCD400] text-[#0F1D29] font-bold shadow-sm"
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#0F1D29] shrink-0 ml-1.5" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const emptyUserForm = {
  name: "",
  email: "",
  idNumber: "",
  role: "Student",
  department: "College of Information & Communications Technology (CICT)",
  course: "BS Information Technology",
  yearLevel: "4TH",
  section: "A",
  status: "Active" as "Active" | "Suspended" | "Archived",
  password: "",
};

export function SystemManagementPage() {
  const { notify } = useNotice();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [isPending, startTransition] = useTransition();

  // 4 Organized Main Tabs
  const [activeTab, setActiveTab] = useState<"accounts" | "books" | "archived" | "infrastructure">("accounts");

  // Sub-tab inside Archived Records
  const [archiveSubTab, setArchiveSubTab] = useState<"books" | "accounts">("books");

  // ── Tab 1: Accounts State ──────────────────────────────────────────
  const [users, setUsers] = useState<SuperAdminUserRecord[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [vitals, setVitals] = useState<SuperAdminVitals | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState("All");
  const [userStatusFilter, setUserStatusFilter] = useState("All");
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SuperAdminUserRecord | null>(null);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [archiveConfirmUser, setArchiveConfirmUser] = useState<SuperAdminUserRecord | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [archivedUsers, setArchivedUsers] = useState<SuperAdminUserRecord[]>([]);
  const [isLoadingArchivedUsers, setIsLoadingArchivedUsers] = useState(false);

  // ── Tab 2: Books Catalog (Active) State ────────────────────────────
  const [books, setBooks] = useState<AdminBookRecord[]>([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [bookSearch, setBookSearch] = useState("");
  const [bookDeptFilter, setBookDeptFilter] = useState("All");
  const [bookPage, setBookPage] = useState(1);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);
  const [archiveConfirmBook, setArchiveConfirmBook] = useState<AdminBookRecord | null>(null);

  // ── Tab 3: Archived Records State ──────────────────────────────────
  const [archivedBooks, setArchivedBooks] = useState<any[]>([]);
  const [totalArchivedBooks, setTotalArchivedBooks] = useState(0);
  const [archivedSearch, setArchivedSearch] = useState("");
  const [archivedPage, setArchivedPage] = useState(1);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [restoreConfirmBook, setRestoreConfirmBook] = useState<any | null>(null);
  const [purgeConfirmBook, setPurgeConfirmBook] = useState<any | null>(null);
  const [purgeAllArchivedModal, setPurgeAllArchivedModal] = useState(false);

  // ── Tab 4: Infrastructure & Pruning State ──────────────────────────
  const [infraData, setInfraData] = useState<any>(null);
  const [isRebuildingIndex, setIsRebuildingIndex] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [pruneConfirmType, setPruneConfirmType] = useState<"books" | "accounts" | null>(null);

  // ── Handlers for User Form ─────────────────────────────────────────
  function handleRoleChange(newRole: string) {
    let newDept = userForm.department;
    let newCourse = userForm.course;

    if (
      newRole === "Librarian" ||
      newRole === "Circulation Librarian" ||
      newRole === "Technical Librarian" ||
      newRole === "Admin" ||
      newRole === "Super Admin"
    ) {
      newDept = "None";
      newCourse = "None";
    } else if (newRole === "Student") {
      if (
        newDept === "None" ||
        newDept === "Librarian" ||
        newDept === "Admin" ||
        newDept.includes("Administration") ||
        newDept.includes("Library")
      ) {
        newDept = "College of Information & Communications Technology (CICT)";
        newCourse = "BS Information Technology";
      }
    }

    setUserForm((prev) => ({
      ...prev,
      role: newRole,
      department: newDept,
      course: newCourse,
    }));
  }

  function handleDepartmentChange(newDept: string) {
    const programs = getDepartmentPrograms(newDept);
    setUserForm((prev) => ({
      ...prev,
      department: newDept,
      course: programs[0] || "None",
    }));
  }

  // ── 1. Fetch Users ─────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role: userRoleFilter,
        status: userStatusFilter,
        search: userSearch,
        page: String(userPage),
        pageSize: "10",
      });
      const res = await requestJson<{ users: SuperAdminUserRecord[]; total: number }>(
        `/api/super-admin/users?${params.toString()}`
      );
      startTransition(() => {
        setUsers(res.users || []);
        setTotalUsers(res.total || 0);
      });
    } catch (err) {
      console.warn("Error fetching users:", err);
    }
  }, [userRoleFilter, userStatusFilter, userSearch, userPage]);

  // ── 2. Fetch Active Books ──────────────────────────────────────────
  const fetchActiveBooks = useCallback(async () => {
    try {
      setIsLoadingBooks(true);
      const params = new URLSearchParams({
        search: bookSearch,
        department: bookDeptFilter,
        page: String(bookPage),
        pageSize: "10",
        archivedOnly: "false",
      });
      const res = await requestJson<{ books: AdminBookRecord[]; total: number }>(
        `/api/admin/books?${params.toString()}`
      );
      startTransition(() => {
        setBooks(res.books || []);
        setTotalBooks(res.total || 0);
      });
    } catch (err) {
      console.warn("Error fetching books:", err);
    } finally {
      setIsLoadingBooks(false);
    }
  }, [bookSearch, bookDeptFilter, bookPage]);

  // ── 3. Fetch Archived Books ────────────────────────────────────────
  const fetchArchivedBooks = useCallback(async () => {
    try {
      setIsLoadingArchived(true);
      const params = new URLSearchParams({
        search: archivedSearch,
        page: String(archivedPage),
        pageSize: "10",
        archivedOnly: "true",
      });
      const res = await requestJson<{ books: any[]; total: number }>(
        `/api/admin/books?${params.toString()}`
      );
      startTransition(() => {
        setArchivedBooks(res.books || []);
        setTotalArchivedBooks(res.total || 0);
      });
    } catch (err) {
      console.warn("Error fetching archived books:", err);
    } finally {
      setIsLoadingArchived(false);
    }
  }, [archivedSearch, archivedPage]);

  // ── 4. Fetch Archived / Suspended Users ────────────────────────────
  const fetchArchivedUsers = useCallback(async () => {
    try {
      setIsLoadingArchivedUsers(true);
      const res = await requestJson<{ users: SuperAdminUserRecord[]; total: number }>(
        "/api/super-admin/users?status=Suspended&pageSize=100"
      );
      startTransition(() => {
        setArchivedUsers(res.users || []);
      });
    } catch (err) {
      console.warn("Error fetching archived users:", err);
    } finally {
      setIsLoadingArchivedUsers(false);
    }
  }, []);

  // ── 5. Fetch Infrastructure Health ─────────────────────────────────
  const fetchInfra = useCallback(async () => {
    try {
      const res = await requestJson<any>("/api/super-admin/infrastructure");
      setInfraData(res);
    } catch (err) {
      console.warn("Error fetching infrastructure:", err);
    }
  }, []);

  // ── 6. Fetch Dashboard Vitals (Accurate Total Counts) ──────────────
  const fetchVitals = useCallback(async () => {
    try {
      const res = await requestJson<SuperAdminDashboardPayload>("/api/super-admin/dashboard");
      if (res?.vitals) {
        setVitals(res.vitals);
      }
    } catch (err) {
      console.warn("Error fetching vitals:", err);
    }
  }, []);

  // Initial load across all vitals and counts
  useEffect(() => {
    void fetchUsers();
    void fetchVitals();
    void fetchActiveBooks();
    void fetchArchivedBooks();
    void fetchArchivedUsers();
  }, [fetchUsers, fetchVitals, fetchActiveBooks, fetchArchivedBooks, fetchArchivedUsers]);

  // Trigger loads based on active tab
  useEffect(() => {
    if (activeTab === "accounts") {
      void fetchUsers();
      void fetchVitals();
      void fetchArchivedUsers();
    } else if (activeTab === "books") {
      void fetchActiveBooks();
      void fetchArchivedBooks();
    } else if (activeTab === "archived") {
      void fetchArchivedBooks();
      void fetchArchivedUsers();
    } else if (activeTab === "infrastructure") {
      void fetchInfra();
    }
  }, [activeTab, fetchUsers, fetchVitals, fetchActiveBooks, fetchArchivedBooks, fetchArchivedUsers, fetchInfra]);

  // ── User CRUD Actions ──────────────────────────────────────────────
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser && (!userForm.password || userForm.password.trim().length < 6)) {
      notify("Password must be at least 6 characters long.", "error");
      return;
    }
    try {
      setIsSavingUser(true);
      if (editingUser) {
        await requestJson(`/api/super-admin/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userForm),
        });
        notify("User updated successfully.", "success");
      } else {
        await requestJson("/api/super-admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userForm),
        });
        notify("User created successfully.", "success");
      }
      setUserModalOpen(false);
      setEditingUser(null);
      setUserForm(emptyUserForm);
      void fetchUsers();
      void fetchVitals();
    } catch (err: any) {
      notify(err.message || "Failed to save user.", "error");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleArchiveUser = async () => {
    if (!archiveConfirmUser) return;
    const archivedName = archiveConfirmUser.name;
    try {
      await requestJson(`/api/super-admin/users/${archiveConfirmUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Archived" }),
      });
      notify(`Account for "${archivedName}" has been moved to Archived Records.`, "success");
      setArchiveConfirmUser(null);
      void fetchUsers();
      void fetchVitals();
      void fetchArchivedUsers();
      setActiveTab("archived");
      setArchiveSubTab("accounts");
    } catch (err: any) {
      notify(err.message || "Failed to archive user.", "error");
    }
  };

  const handleRestoreUser = async (userToRestore: SuperAdminUserRecord) => {
    try {
      await requestJson(`/api/super-admin/users/${userToRestore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active" }),
      });
      notify(`Account for "${userToRestore.name}" has been reactivated.`, "success");
      void fetchUsers();
      void fetchVitals();
      void fetchArchivedUsers();
    } catch (err: any) {
      notify(err.message || "Failed to reactivate account.", "error");
    }
  };

  // ── Book Actions: Archive, Restore, Delete ─────────────────────────
  const handleArchiveBook = async () => {
    if (!archiveConfirmBook) return;
    const archivedTitle = archiveConfirmBook.title;
    try {
      await requestJson(`/api/admin/books/${archiveConfirmBook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      notify(`"${archivedTitle}" has been moved to the Archived Records vault.`, "success");
      setArchiveConfirmBook(null);
      void fetchActiveBooks();
      void fetchArchivedBooks();
      setActiveTab("archived");
      setArchiveSubTab("books");
    } catch (err: any) {
      notify(err.message || "Failed to archive book.", "error");
    }
  };

  const handleRestoreBook = async (bookToRestore: any) => {
    try {
      await requestJson(`/api/admin/books/${bookToRestore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      notify(`"${bookToRestore.title}" has been restored to active catalog circulation.`, "success");
      setRestoreConfirmBook(null);
      void fetchArchivedBooks();
      void fetchActiveBooks();
    } catch (err: any) {
      notify(err.message || "Failed to restore book.", "error");
    }
  };

  const handlePurgeSingleBook = async () => {
    if (!purgeConfirmBook) return;
    try {
      await requestJson(`/api/admin/books/${purgeConfirmBook.id}`, {
        method: "DELETE",
      });
      notify(`"${purgeConfirmBook.title}" permanently removed from database.`, "success");
      setPurgeConfirmBook(null);
      void fetchArchivedBooks();
    } catch (err: any) {
      notify(err.message || "Failed to delete record.", "error");
    }
  };

  const handlePurgeAllArchivedBooks = async () => {
    try {
      setIsPruning(true);
      const res = await requestJson<{ purgedCount: number }>("/api/super-admin/pruning/books", {
        method: "POST",
      });
      notify(`Successfully purged ${res.purgedCount} archived book records permanently.`, "success");
      setPurgeAllArchivedModal(false);
      void fetchArchivedBooks();
    } catch (err: any) {
      notify(err.message || "Failed to purge archived books.", "error");
    } finally {
      setIsPruning(false);
    }
  };

  // ── Pruning & Infrastructure Actions ───────────────────────────────
  const handleExecutePrune = async () => {
    if (!pruneConfirmType) return;
    try {
      setIsPruning(true);
      if (pruneConfirmType === "books") {
        const res = await requestJson<{ purgedCount: number }>("/api/super-admin/pruning/books", {
          method: "POST",
        });
        notify(`Purged ${res.purgedCount} archived books permanently.`, "success");
        void fetchArchivedBooks();
      } else {
        const res = await requestJson<{ purgedCount: number }>("/api/super-admin/pruning/accounts", {
          method: "POST",
        });
        notify(`Purged ${res.purgedCount} deactivated accounts permanently.`, "success");
        void fetchUsers();
      }
      setPruneConfirmType(null);
    } catch (err: any) {
      notify(err.message || "Failed to execute pruning.", "error");
    } finally {
      setIsPruning(false);
    }
  };

  const handleRebuildIndex = async () => {
    try {
      setIsRebuildingIndex(true);
      await requestJson("/api/super-admin/infrastructure/rebuild-index", {
        method: "POST",
      });
      notify("Neural search vector index rebuild triggered successfully.", "success");
      void fetchInfra();
    } catch (err: any) {
      notify(err.message || "Failed to trigger index rebuild.", "error");
    } finally {
      setIsRebuildingIndex(false);
    }
  };

  // Calculate suspended / archived accounts
  const suspendedAccounts = users.filter((u) => u.status === "Suspended" || u.status === "Archived");

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          eyebrow="Super Admin · Platform Management"
          title="System & Catalog Management"
          description="Administrative oversight across user accounts, active catalog inventory, archived records vault, and retention infrastructure."
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (activeTab === "accounts") void fetchUsers();
              else if (activeTab === "books") void fetchActiveBooks();
              else if (activeTab === "archived") void fetchArchivedBooks();
              else void fetchInfra();
            }}
            className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh View</span>
          </button>

          {activeTab === "accounts" && (
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setUserForm(emptyUserForm);
                setShowPassword(false);
                setUserModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-[#FCD400] px-4 py-2 text-xs font-bold text-[#0A1624] transition hover:brightness-110 shadow-lg shadow-[#FCD400]/20"
            >
              <UserPlus className="h-4 w-4" />
              <span>Create Account</span>
            </button>
          )}

          {activeTab === "archived" && archiveSubTab === "books" && totalArchivedBooks > 0 && (
            <button
              type="button"
              onClick={() => setPurgeAllArchivedModal(true)}
              className="btn-purge flex items-center gap-2 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] px-4 py-2 text-xs font-bold text-white transition shadow-md shadow-red-950/20 border border-red-700/30"
              style={{ color: "#ffffff" }}
            >
              <Trash2 className="h-4 w-4" style={{ color: "#ffffff" }} />
              <span style={{ color: "#ffffff" }}>Purge All Archived</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Tab Navigation Bar ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-0.5">
        {/* Tab 1: Accounts */}
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-3 text-xs font-bold transition-all relative rounded-t-xl border-b-2",
            activeTab === "accounts"
              ? "border-[#FCD400] bg-white/5 text-[#FCD400]"
              : "border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]"
          )}
        >
          <Users className="h-4 w-4" />
          <span>Accounts Management</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-300">
            {vitals?.totalUsers ?? totalUsers}
          </span>
        </button>

        {/* Tab 2: Books Catalog */}
        <button
          type="button"
          onClick={() => setActiveTab("books")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-3 text-xs font-bold transition-all relative rounded-t-xl border-b-2",
            activeTab === "books"
              ? "border-[#FCD400] bg-white/5 text-[#FCD400]"
              : "border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]"
          )}
        >
          <BookOpen className="h-4 w-4" />
          <span>Books Catalog</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-300">
            {totalBooks}
          </span>
        </button>

        {/* Tab 3: Archived Records (Highlighted) */}
        <button
          type="button"
          onClick={() => setActiveTab("archived")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-3 text-xs font-bold transition-all relative rounded-t-xl border-b-2",
            activeTab === "archived"
              ? "border-[#FCD400] bg-white/5 text-[#FCD400]"
              : "border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]"
          )}
        >
          <Archive className="h-4 w-4 text-orange-400" />
          <span>Archived Records</span>
          {(totalArchivedBooks + archivedUsers.length) > 0 && (
            <span className="rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
              {totalArchivedBooks + archivedUsers.length}
            </span>
          )}
        </button>

        {/* Tab 4: Infrastructure & Pruning */}
        <button
          type="button"
          onClick={() => setActiveTab("infrastructure")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-3 text-xs font-bold transition-all relative rounded-t-xl border-b-2",
            activeTab === "infrastructure"
              ? "border-[#FCD400] bg-white/5 text-[#FCD400]"
              : "border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]"
          )}
        >
          <Server className="h-4 w-4 text-sky-400" />
          <span>Infrastructure & Retention</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: ACCOUNTS MANAGEMENT ───────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className={cn(
              "rounded-2xl p-4 shadow-sm border transition-all",
              isLight ? "border-slate-200 bg-white" : "border-white/10 bg-[#122033]"
            )}>
              <div className={cn(
                "text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                isLight ? "text-slate-600" : "text-slate-400"
              )}>
                <Users className={cn("h-3.5 w-3.5", isLight ? "text-slate-500" : "text-slate-400")} />
                <span>Total Users</span>
              </div>
              <div className={cn(
                "mt-1 text-2xl font-black",
                isLight ? "text-slate-900" : "text-white"
              )}>
                {vitals?.totalUsers ?? totalUsers}
              </div>
            </div>

            <div className={cn(
              "rounded-2xl p-4 shadow-sm border transition-all",
              isLight
                ? "border-purple-300 bg-purple-50/80 ring-1 ring-purple-400/25 shadow-purple-500/5"
                : "border-purple-500/20 bg-[#1A1E38]"
            )}>
              <div className={cn(
                "text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5",
                isLight ? "text-purple-800" : "text-purple-300"
              )}>
                <ShieldCheck className={cn("h-3.5 w-3.5", isLight ? "text-purple-700" : "text-purple-400")} />
                <span>Super Admins & Admins</span>
              </div>
              <div className={cn(
                "mt-1 text-2xl font-black tracking-tight",
                isLight ? "text-purple-950 font-black" : "text-purple-200"
              )}>
                {vitals ? vitals.superAdminsCount + vitals.adminsCount : users.filter((u) => u.role.includes("Admin")).length}
              </div>
            </div>

            <div className={cn(
              "rounded-2xl p-4 shadow-sm border transition-all",
              isLight
                ? "border-sky-300 bg-sky-50/80 ring-1 ring-sky-400/20"
                : "border-sky-500/20 bg-[#12273D]"
            )}>
              <div className={cn(
                "text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                isLight ? "text-sky-800" : "text-sky-300"
              )}>
                <BookOpen className={cn("h-3.5 w-3.5", isLight ? "text-sky-700" : "text-sky-400")} />
                <span>Librarian Staff</span>
              </div>
              <div className={cn(
                "mt-1 text-2xl font-black tracking-tight",
                isLight ? "text-sky-950 font-black" : "text-sky-200"
              )}>
                {vitals?.librariansCount ?? users.filter((u) => u.role.includes("Librarian")).length}
              </div>
            </div>

            <div className={cn(
              "rounded-2xl p-4 shadow-sm border transition-all",
              isLight
                ? "border-emerald-300 bg-emerald-50/80 ring-1 ring-emerald-400/20"
                : "border-emerald-500/20 bg-[#10292B]"
            )}>
              <div className={cn(
                "text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                isLight ? "text-emerald-800" : "text-emerald-300"
              )}>
                <UserCheck className={cn("h-3.5 w-3.5", isLight ? "text-emerald-700" : "text-emerald-400")} />
                <span>Students Enrolled</span>
              </div>
              <div className={cn(
                "mt-1 text-2xl font-black tracking-tight",
                isLight ? "text-emerald-950 font-black" : "text-emerald-200"
              )}>
                {vitals?.studentsCount ?? users.filter((u) => u.role === "Student").length}
              </div>
            </div>
          </div>

          <AdminSection
            title="User Accounts Management"
            description="Manage identity provisioning, academic colleges, authority roles, and account statuses."
          >
            {/* Filter Toolbar */}
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                  placeholder="Search name, email, ID number..."
                  className="glass-input w-full pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="glass-input w-full px-3 py-2 text-xs text-white bg-[#101D2D]"
                >
                  <option value="All" className="bg-[#101D2D] text-white">All Roles</option>
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r} className="bg-[#101D2D] text-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={userStatusFilter}
                  onChange={(e) => {
                    setUserStatusFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="glass-input w-full px-3 py-2 text-xs text-white bg-[#101D2D]"
                >
                  <option value="All" className="bg-[#101D2D] text-white">All Statuses</option>
                  <option value="Active" className="bg-[#101D2D] text-white">Active</option>
                  <option value="Suspended" className="bg-[#101D2D] text-white">Archived / Suspended</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <AdminTable>
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">ID Number</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department / Course</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {users.map((user, idx) => (
                    <tr key={user.id ? `u-${user.id}-${idx}` : `u-idx-${idx}`} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{user.name}</div>
                        <div className="text-slate-400 font-mono text-[11px]">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">{user.idNumber}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider",
                            user.role.includes("Super Admin")
                              ? isLight
                                ? "bg-purple-100 text-purple-900 border border-purple-300 font-black shadow-xs"
                                : "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold"
                              : user.role.includes("Admin")
                              ? isLight
                                ? "bg-amber-100 text-amber-950 border border-amber-400 font-black shadow-xs"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                              : user.role.includes("Librarian")
                              ? isLight
                                ? "bg-sky-100 text-sky-900 border border-sky-300 font-bold"
                                : "bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold"
                              : isLight
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                          )}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <div className="truncate max-w-[220px]">{user.department}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[220px]">{user.course}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            user.status === "Active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                          )}
                        >
                          {user.status === "Suspended" ? "ARCHIVED" : user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(user);
                              setUserForm({
                                name: user.name,
                                email: user.email,
                                idNumber: user.idNumber,
                                role: user.role,
                                department: user.department || "College of Information & Communications Technology (CICT)",
                                course: user.course || "BS Information Technology",
                                yearLevel: user.yearLevel || "4TH",
                                section: user.section || "A",
                                status: user.status,
                                password: "",
                              });
                              setShowPassword(false);
                              setUserModalOpen(true);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
                            title="Edit Account"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-[#FCD400]" />
                          </button>
                          {user.status === "Suspended" || user.status === "Archived" ? (
                            <button
                              type="button"
                              onClick={() => void handleRestoreUser(user)}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-300 hover:bg-emerald-500/20 transition"
                              title="Reactivate Account"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setArchiveConfirmUser(user)}
                              className="rounded-lg border border-orange-500/40 bg-orange-500/15 p-1.5 text-orange-400 hover:bg-orange-500/25 hover:border-orange-500/60 transition"
                              title="Archive Account"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No user accounts found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </AdminTable>

            {/* Pagination */}
            {totalUsers > 10 && (
              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-slate-400">
                <span>
                  Showing page {userPage} of {Math.max(1, Math.ceil(totalUsers / 10))} ({totalUsers} users)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={userPage >= Math.ceil(totalUsers / 10)}
                    onClick={() => setUserPage((p) => p + 1)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </AdminSection>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: BOOKS CATALOG (ACTIVE) ────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "books" && (
        <div className="space-y-6">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-[#122033] p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Catalog Resources</div>
              <div className="mt-1 text-2xl font-black text-white">{totalBooks}</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-[#10292B] p-4 shadow-sm">
              <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Available for Loan</div>
              <div className="mt-1 text-2xl font-black text-emerald-300">
                {books.filter((b) => (b.availability || "").toLowerCase() === "available").length}
              </div>
            </div>
            <div className="rounded-2xl border border-orange-500/20 bg-[#291B10] p-4 shadow-sm">
              <div className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">Archived Vault Total</div>
              <div className="mt-1 text-2xl font-black text-orange-400">{totalArchivedBooks}</div>
            </div>
            <div className="rounded-2xl border border-sky-500/20 bg-[#12273D] p-4 shadow-sm">
              <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">Departments Covered</div>
              <div className="mt-1 text-2xl font-black text-sky-300">7 Colleges</div>
            </div>
          </div>

          <AdminSection
            title="Active Library Catalog"
            description="Inspect active library resources. Select any book to review metadata or archive from active circulation."
          >
            {/* Filter Toolbar */}
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={bookSearch}
                  onChange={(e) => {
                    setBookSearch(e.target.value);
                    setBookPage(1);
                  }}
                  placeholder="Search book title, author, ISBN, shelf location..."
                  className="glass-input w-full pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <select
                  value={bookDeptFilter}
                  onChange={(e) => {
                    setBookDeptFilter(e.target.value);
                    setBookPage(1);
                  }}
                  className="glass-input w-full px-3 py-2 text-xs text-white bg-[#101D2D]"
                >
                  <option value="All" className="bg-[#101D2D] text-white">All Departments</option>
                  <option value="Circulation" className="bg-[#101D2D] text-white">Circulation</option>
                  <option value="Filipiniana" className="bg-[#101D2D] text-white">Filipiniana</option>
                  <option value="General Reference" className="bg-[#101D2D] text-white">General Reference</option>
                  <option value="Reserve" className="bg-[#101D2D] text-white">Reserve</option>
                  <option value="Periodicals" className="bg-[#101D2D] text-white">Periodicals</option>
                  <option value="Special Collections" className="bg-[#101D2D] text-white">Special Collections</option>
                </select>
              </div>
            </div>

            {/* Books Table */}
            <AdminTable>
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Book Resource</th>
                    <th className="px-4 py-3">ISBN & Shelf</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Copies / Borrows</th>
                    <th className="px-4 py-3">Availability</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {books.map((book, idx) => (
                    <tr key={book.id ? `b-${book.id}-${idx}` : `b-idx-${idx}`} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{book.title}</div>
                        <div className="text-slate-400 text-[11px]">{book.author || "STI Library"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-slate-300 text-[11px]">{book.isbn || "—"}</div>
                        <div className="font-mono text-slate-400 text-[10px]">{book.shelfLocation || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-lg bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 font-medium">
                          {book.department || "Circulation"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <span className="font-bold text-white">{book.copies ?? 1}</span> copies
                        <span className="text-slate-500 mx-1">·</span>
                        <span className="text-amber-300 font-semibold">{book.borrowCount ?? 0}</span> borrows
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                            (book.availability || "").toLowerCase() === "available"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          )}
                        >
                          {book.availability || "Available"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setArchiveConfirmBook(book)}
                            className="flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold text-orange-400 hover:bg-orange-500/25 hover:border-orange-500/60 transition"
                            title="Archive this book"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            <span>Archive</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {books.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        {isLoadingBooks ? "Loading catalog resources..." : "No active books found matching your filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </AdminTable>

            {/* Pagination */}
            {totalBooks > 10 && (
              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-slate-400">
                <span>
                  Showing page {bookPage} of {Math.max(1, Math.ceil(totalBooks / 10))} ({totalBooks} books)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={bookPage <= 1}
                    onClick={() => setBookPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={bookPage >= Math.ceil(totalBooks / 10)}
                    onClick={() => setBookPage((p) => p + 1)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </AdminSection>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: ARCHIVED RECORDS VAULT (ESPECIALLY ARCHIVED TAB) ─── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "archived" && (
        <div className="space-y-6">
          {/* Archive Vault Directive Banner */}
          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Decommissioned Catalog & Inactive Archive Vault</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Archived books are removed from student search and active borrowing, but remain preserved. You can restore them to active status or permanently purge them.
                </p>
              </div>
            </div>

            {/* Archive Sub-Tab Segmented Selector */}
            <div className="flex items-center rounded-xl bg-[#0E1A26] border border-white/10 p-1">
              <button
                type="button"
                onClick={() => setArchiveSubTab("books")}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
                  archiveSubTab === "books"
                    ? "bg-[#FCD400] text-[#0B1A2C] shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Archived Books ({totalArchivedBooks})
              </button>
              <button
                type="button"
                onClick={() => setArchiveSubTab("accounts")}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
                  archiveSubTab === "accounts"
                    ? "bg-[#FCD400] text-[#0B1A2C] shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Archived Accounts ({archivedUsers.length > 0 ? archivedUsers.length : suspendedAccounts.length})
              </button>
            </div>
          </div>

          {/* Sub-view 1: Archived Books */}
          {archiveSubTab === "books" && (
            <AdminSection
              title="Archived Catalog Books"
              description="Manage archived titles. Click 'Restore' to unarchive a book back to the live catalog, or permanently purge obsolete records."
              action={
                totalArchivedBooks > 0 && (
                  <button
                    type="button"
                    onClick={() => setPurgeAllArchivedModal(true)}
                    className="btn-purge flex items-center gap-2 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] px-4 py-2 text-xs font-bold text-white transition shadow-md shadow-red-950/20 border border-red-700/30"
                    style={{ color: "#ffffff" }}
                  >
                    <Trash2 className="h-4 w-4" style={{ color: "#ffffff" }} />
                    <span style={{ color: "#ffffff" }}>Purge All Archived Books</span>
                  </button>
                )
              }
            >
              {/* Search */}
              <div className="mb-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={archivedSearch}
                    onChange={(e) => {
                      setArchivedSearch(e.target.value);
                      setArchivedPage(1);
                    }}
                    placeholder="Search archived books by title, author, ISBN..."
                    className="glass-input w-full pl-9 pr-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Archived Books Table */}
              <AdminTable>
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Archived Book</th>
                      <th className="px-4 py-3">ISBN & Call No.</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Archived Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {archivedBooks.map((book, idx) => (
                      <tr key={book.id ? `ab-${book.id}-${idx}` : `ab-idx-${idx}`} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{book.title}</div>
                          <div className="text-slate-400 text-[11px]">{book.author || "STI Library"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-slate-300 text-[11px]">{book.isbn || "—"}</div>
                          <div className="font-mono text-slate-400 text-[10px]">{book.shelfLocation || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-lg bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                            {book.department || "Circulation"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {book.archivedAt ? formatDate(book.archivedAt) : "Archived"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-300 border border-amber-500/20">
                            ARCHIVED
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Restore to Active Catalog */}
                            <button
                              type="button"
                              onClick={() => handleRestoreBook(book)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-sm",
                                isLight
                                  ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                  : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                              )}
                              title="Restore back to active catalog"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Restore Book</span>
                            </button>

                            {/* Permanently Delete */}
                            <button
                              type="button"
                              onClick={() => setPurgeConfirmBook(book)}
                              className={cn(
                                "rounded-lg p-1.5 transition",
                                isLight
                                  ? "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                  : "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                              )}
                              title="Permanently Delete Record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {archivedBooks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          {isLoadingArchived ? "Checking archive vault..." : "No archived books found in vault."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </AdminTable>

              {/* Pagination */}
              {totalArchivedBooks > 10 && (
                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-slate-400">
                  <span>
                    Showing page {archivedPage} of {Math.max(1, Math.ceil(totalArchivedBooks / 10))} ({totalArchivedBooks} archived books)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={archivedPage <= 1}
                      onClick={() => setArchivedPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={archivedPage >= Math.ceil(totalArchivedBooks / 10)}
                      onClick={() => setArchivedPage((p) => p + 1)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </AdminSection>
          )}

          {/* Sub-view 2: Suspended Accounts */}
          {archiveSubTab === "accounts" && (
            <AdminSection
              title="Archived User Accounts"
              description="User accounts that have been archived. These users cannot authenticate into the platform. You can restore them to active status anytime."
            >
              <AdminTable>
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-[#132338] uppercase tracking-wider text-slate-300 font-bold text-[10px]">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">ID Number</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {(archivedUsers.length > 0 ? archivedUsers : suspendedAccounts).map((user, idx) => (
                      <tr key={user.id ? `su-${user.id}-${idx}` : `su-idx-${idx}`} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{user.name}</div>
                          <div className="text-slate-400 font-mono text-[11px]">{user.email}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300">{user.idNumber}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider",
                              user.role.includes("Super Admin")
                                ? isLight
                                  ? "bg-purple-100 text-purple-900 border border-purple-300 font-black"
                                  : "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold"
                                : user.role.includes("Admin")
                                ? isLight
                                  ? "bg-amber-100 text-amber-950 border border-amber-400 font-black"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                                : user.role.includes("Librarian")
                                ? isLight
                                  ? "bg-sky-100 text-sky-900 border border-sky-300 font-bold"
                                  : "bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold"
                                : isLight
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                            )}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{user.department}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400 border border-orange-500/20">
                            ARCHIVED
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleRestoreUser(user)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ml-auto",
                              isLight
                                ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                            )}
                            title="Restore Account"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Restore Account</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {(archivedUsers.length > 0 ? archivedUsers : suspendedAccounts).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          {isLoadingArchivedUsers ? "Checking archived accounts..." : "No archived accounts found in vault. All users are currently active."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </AdminTable>
            </AdminSection>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: INFRASTRUCTURE & PRUNING ──────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "infrastructure" && (
        <div className="space-y-6">
          {/* Data Pruning Controls */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/10 p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Permanent Data Retention & Pruning Controls</h3>
                <p className="text-xs text-rose-200/80">Irreversible maintenance procedures to purge dormant or obsolete records.</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Purge Archived Books */}
              <div className="rounded-xl border border-white/10 bg-[#101D2D] p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Purge Archived Books</span>
                    <Trash2 className="h-4 w-4 text-rose-400" />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Permanently delete all book records marked as <strong className="text-white">Archived</strong> from the PostgreSQL database. This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPruneConfirmType("books")}
                  className={cn(
                    "rounded-xl py-2.5 text-xs font-bold transition cursor-pointer",
                    isLight
                      ? "border border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                      : "border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white"
                  )}
                >
                  Purge Archived Books Now
                </button>
              </div>

              {/* Purge Deactivated Accounts */}
              <div className="rounded-xl border border-white/10 bg-[#101D2D] p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Purge Deactivated Accounts</span>
                    <UserX className="h-4 w-4 text-rose-400" />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Permanently remove all user accounts in <strong className="text-white">Suspended</strong> status along with their associated session tokens.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPruneConfirmType("accounts")}
                  className={cn(
                    "rounded-xl py-2.5 text-xs font-bold transition cursor-pointer",
                    isLight
                      ? "border border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                      : "border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white"
                  )}
                >
                  Purge Suspended Accounts Now
                </button>
              </div>
            </div>
          </div>

          {/* Infrastructure Health & Search Index Rebuild */}
          <div className="rounded-2xl border border-sky-500/30 bg-[#101D2D] p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Infrastructure Health & Telemetry</h3>
                  <p className="text-xs text-slate-400">Node runtime telemetry and AI vector indexing status.</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {infraData?.telemetry?.platformStatus || "Operational"}
              </span>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Neural Search Index */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Neural Search Vector Index</span>
                    <Zap className="h-4 w-4 text-[#FCD400]" />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Trigger a full scan and synchronization of the BookHive catalog to rebuild semantic search vectors.
                  </p>
                  <div className="mt-3 text-xs text-slate-300">
                    <span>Index Status: </span>
                    <strong className="text-emerald-400 font-bold">
                      {infraData?.telemetry?.searchIndexStatus || "Healthy"}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRebuildIndex}
                  disabled={isRebuildingIndex}
                  className="rounded-xl bg-[#FCD400] py-2.5 text-xs font-bold text-[#0b1c2c] transition hover:brightness-110 shadow-lg shadow-[#FCD400]/20 disabled:opacity-50 cursor-pointer"
                >
                  {isRebuildingIndex ? "Rebuilding Neural Index..." : "Rebuild Search Index"}
                </button>
              </div>

              {/* Database & Runtime Specs */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3 text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Database Engine</span>
                  <span className="font-semibold text-emerald-400">PostgreSQL 16</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Node.js Version</span>
                  <span className="font-mono text-white">{infraData?.telemetry?.nodeVersion || "v24.19.0"}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">System Memory Usage</span>
                  <span className="font-bold text-[#FCD400]">{infraData?.telemetry?.memoryUsagePercent ?? 36}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Storage Capacity</span>
                  <span className="font-bold text-sky-400">{infraData?.telemetry?.storageUsedPercent ?? 24}% used</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── MODALS ───────────────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* 1. Create/Edit User Modal */}
      <AdminModal
        open={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setEditingUser(null);
        }}
        title={editingUser ? "Edit User Account" : "Create New User Account"}
        description={
          editingUser
            ? "Update identity, role permissions, or institutional status."
            : "Provision a new user account with role-based access control."
        }
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>Full Name</FieldLabel>
              <input
                required
                value={userForm.name}
                onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Maria Santos"
                className="glass-input w-full px-3 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <FieldLabel required>Email Address</FieldLabel>
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="user@stiwnu.edu.ph"
                className="glass-input w-full px-3 py-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>ID Number</FieldLabel>
              <input
                required
                value={userForm.idNumber}
                onChange={(e) => setUserForm((prev) => ({ ...prev, idNumber: e.target.value }))}
                placeholder="e.g. 2026-00123"
                className="glass-input w-full px-3 py-2.5 text-xs text-white font-mono"
              />
            </div>

            <div>
              <FieldLabel required>Authority Role</FieldLabel>
              <ModernDropdown
                value={userForm.role}
                onChange={handleRoleChange}
                options={ALL_ROLES}
              />
            </div>
          </div>

          {/* Academic Department */}
          <div>
            <FieldLabel required={userForm.role === "Student"}>Academic College / Department</FieldLabel>
            <ModernDropdown
              value={userForm.department}
              onChange={handleDepartmentChange}
              options={ACADEMIC_DEPARTMENTS.map((d) => ({
                label: d.name,
                value: d.name,
                group: d.category,
              }))}
            />
          </div>

          {/* Course / Program */}
          <div>
            <FieldLabel required={userForm.role === "Student"}>Academic Program / Course</FieldLabel>
            <ModernDropdown
              value={userForm.course}
              onChange={(val) => setUserForm((prev) => ({ ...prev, course: val }))}
              options={getDepartmentPrograms(userForm.department)}
            />
          </div>

          {/* Student Specific Fields: Year Level & Section */}
          {userForm.role === "Student" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Year Level</FieldLabel>
                <select
                  value={userForm.yearLevel}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, yearLevel: e.target.value }))}
                  className="glass-input w-full px-3 py-2.5 text-xs text-white bg-[#101D2D]"
                >
                  <option value="1ST" className="bg-[#101D2D] text-white">1st Year</option>
                  <option value="2ND" className="bg-[#101D2D] text-white">2nd Year</option>
                  <option value="3RD" className="bg-[#101D2D] text-white">3rd Year</option>
                  <option value="4TH" className="bg-[#101D2D] text-white">4th Year</option>
                </select>
              </div>
              <div>
                <FieldLabel required>Section</FieldLabel>
                <input
                  required
                  value={userForm.section}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, section: e.target.value.toUpperCase() }))}
                  placeholder="e.g. A, B, H..."
                  maxLength={5}
                  className="glass-input w-full px-3 py-2.5 text-xs text-white font-mono uppercase"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                value={userForm.status}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, status: e.target.value as "Active" | "Suspended" | "Archived" }))
                }
                className="glass-input w-full px-3 py-2.5 text-xs text-white bg-[#101D2D]"
              >
                <option value="Active" className="bg-[#101D2D] text-white">Active</option>
                <option value="Suspended" className="bg-[#101D2D] text-white">Suspended</option>
                <option value="Archived" className="bg-[#101D2D] text-white">Archived</option>
              </select>
            </div>

            <div>
              <FieldLabel required={!editingUser}>
                {editingUser ? "Change Password (optional)" : "Password"}
              </FieldLabel>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={userForm.password}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={editingUser ? "Leave blank to keep current" : "Enter account password"}
                  className="glass-input w-full pr-9 pl-3 py-2.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingUser}
              className="rounded-xl bg-[#FCD400] px-5 py-2 text-xs font-bold text-[#0A1624] hover:brightness-110 shadow-lg shadow-[#FCD400]/20 disabled:opacity-50"
            >
              {isSavingUser ? "Saving..." : editingUser ? "Update Account" : "Create Account"}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* 2. Archive User Confirmation Modal */}
      <AdminModal
        open={Boolean(archiveConfirmUser)}
        onClose={() => setArchiveConfirmUser(null)}
        title="Archive User Account"
        description="Safely move this user account to the archived records."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
            Archiving <strong>{archiveConfirmUser?.name}</strong> ({archiveConfirmUser?.email}) will suspend their platform access while preserving all circulation records and borrow history. You can restore this account anytime from the Archived Records tab.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setArchiveConfirmUser(null)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveUser}
              className="rounded-xl bg-orange-500 text-white px-4 py-2 text-xs font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/25 transition"
            >
              Confirm Archive
            </button>
          </div>
        </div>
      </AdminModal>

      {/* 3. Archive Book Confirmation Modal */}
      <AdminModal
        open={Boolean(archiveConfirmBook)}
        onClose={() => setArchiveConfirmBook(null)}
        title="Archive Book Record"
        description="Move this book into the Archived Records vault."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-xs text-orange-200">
            Archiving <strong>"{archiveConfirmBook?.title}"</strong> will remove it from active student catalog search and borrow requests. You can restore it anytime from the Archived Records tab.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setArchiveConfirmBook(null)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveBook}
              className="rounded-xl bg-orange-500 text-white px-4 py-2 text-xs font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/25 transition"
            >
              Confirm Archive
            </button>
          </div>
        </div>
      </AdminModal>

      {/* 4. Single Book Permanent Delete Modal */}
      <AdminModal
        open={Boolean(purgeConfirmBook)}
        onClose={() => setPurgeConfirmBook(null)}
        title="Permanently Delete Book Record"
        description="This will permanently delete this catalog record from PostgreSQL database."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-200">
            Are you sure you want to permanently delete <strong>"{purgeConfirmBook?.title}"</strong>? This action cannot be reversed.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPurgeConfirmBook(null)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePurgeSingleBook}
              className="btn-purge rounded-xl bg-[#b91c1c] text-white px-4 py-2 text-xs font-bold hover:bg-[#991b1b] shadow-md border border-red-700/30"
              style={{ color: "#ffffff" }}
            >
              <span style={{ color: "#ffffff" }}>Permanently Delete</span>
            </button>
          </div>
        </div>
      </AdminModal>

      {/* 5. Purge All Archived Books Modal */}
      <AdminModal
        open={purgeAllArchivedModal}
        onClose={() => setPurgeAllArchivedModal(false)}
        title="Permanent Purge All Archived Books"
        description="Irreversible bulk deletion of all decommissioned books."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-4 text-xs text-rose-200 leading-relaxed">
            <strong className="block text-sm font-bold text-white mb-1">CRITICAL WARNING</strong>
            This will permanently delete all <strong className="text-white">{totalArchivedBooks} archived books</strong> from PostgreSQL. This will permanently clear storage space and cannot be undone.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPurgeAllArchivedModal(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPruning}
              onClick={handlePurgeAllArchivedBooks}
              className="btn-purge rounded-xl bg-[#b91c1c] text-white px-5 py-2 text-xs font-bold hover:bg-[#991b1b] shadow-md border border-red-700/30 disabled:opacity-50"
              style={{ color: "#ffffff" }}
            >
              <span style={{ color: "#ffffff" }}>{isPruning ? "Purging..." : "Confirm Purge All"}</span>
            </button>
          </div>
        </div>
      </AdminModal>

      {/* 6. General Pruning Confirmation Modal */}
      <AdminModal
        open={Boolean(pruneConfirmType)}
        onClose={() => setPruneConfirmType(null)}
        title="Confirm Permanent Data Pruning"
        description="This will permanently delete records from PostgreSQL."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-4 text-xs text-rose-200">
            {pruneConfirmType === "books"
              ? "All archived books will be permanently removed from the database."
              : "All user accounts currently marked as Suspended will be permanently deleted."}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPruneConfirmType(null)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPruning}
              onClick={handleExecutePrune}
              className="btn-purge rounded-xl bg-[#b91c1c] text-white px-4 py-2 text-xs font-bold hover:bg-[#991b1b] shadow-md border border-red-700/30 disabled:opacity-50"
              style={{ color: "#ffffff" }}
            >
              <span style={{ color: "#ffffff" }}>{isPruning ? "Executing Purge..." : "Confirm Purge"}</span>
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

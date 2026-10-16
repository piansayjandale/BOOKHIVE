"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Check,
  CheckCircle2,
  ClipboardList,
  History,
  Home,
  Info,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  ChartColumnBig,
  Download,
  Upload,
  Globe,
  Smartphone,
  ScanText,
  QrCode,
  PackageCheck,
} from "lucide-react";

import { AdminModal, AdminPageHeader, AdminSection, AdminStatCard, AdminTable } from "@/components/admin/shared";
import type { LibrarianAccount, LibrarianPermissionKey, LibrarianPermissions } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNotice } from "@/components/providers/notice-provider";
import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";

export type PlatformType = "web" | "mobile";

export interface PermissionModuleDef {
  key: LibrarianPermissionKey;
  label: string;
  shortLabel: string;
  icon: any;
  path: string;
  description: string;
  platform: PlatformType;
}

export const LIBRARIAN_WEB_MODULES: PermissionModuleDef[] = [
  {
    key: "records",
    label: "Cataloging",
    shortLabel: "Cataloging",
    icon: ClipboardList,
    path: "/librarian/records",
    description: "Cataloging, viewing records, adding books, and CSV batch import.",
    platform: "web",
  },
  {
    key: "export",
    label: "Export Catalog",
    shortLabel: "Export",
    icon: Download,
    path: "Catalog Export (CSV)",
    description: "Export book records catalog to CSV and spreadsheet format.",
    platform: "web",
  },
  {
    key: "import",
    label: "Import Books",
    shortLabel: "Import",
    icon: Upload,
    path: "CSV Batch Import",
    description: "Upload and batch import book records catalog via CSV.",
    platform: "web",
  },
  {
    key: "transactions",
    label: "Transactions",
    shortLabel: "Transactions",
    icon: Sparkles,
    path: "/librarian/transactions",
    description: "Borrow requests, circulation approvals, return processing, and reservations.",
    platform: "web",
  },
  {
    key: "reminders",
    label: "Violations & Reminders",
    shortLabel: "Violations & Reminders",
    icon: BellRing,
    path: "/librarian/reminders",
    description: "Overdue fines, student violations, warning notices, and return reminders.",
    platform: "web",
  },
  {
    key: "reports",
    label: "Reports",
    shortLabel: "Reports",
    icon: ChartColumnBig,
    path: "/librarian/reports",
    description: "Monthly circulation metrics, borrowing trends, and department analytics.",
    platform: "web",
  },
  {
    key: "history",
    label: "History",
    shortLabel: "History",
    icon: History,
    path: "/librarian/history",
    description: "System history logs, activity trails, and audit records.",
    platform: "web",
  },
  {
    key: "settings",
    label: "Settings",
    shortLabel: "Settings",
    icon: Settings,
    path: "/librarian/settings",
    description: "System configuration preferences and librarian account settings.",
    platform: "web",
  },
];

export const LIBRARIAN_MOBILE_MODULES: PermissionModuleDef[] = [
  {
    key: "mobileCatalog",
    label: "Paper Catalog Scanner",
    shortLabel: "Paper Scanner",
    icon: ScanText,
    path: "Mobile App / Paper OCR",
    description: "Camera document OCR scanner to read printed or handwritten book details and register items into catalog.",
    platform: "mobile",
  },
  {
    key: "mobileStudentPass",
    label: "Student Information & Return Desk",
    shortLabel: "Student Information & Return",
    icon: QrCode,
    path: "Mobile App / Student Info & Return",
    description: "Scanning student digital library cards, student information, book return check-ins, reservations queue, and student violations.",
    platform: "mobile",
  },
  {
    key: "mobilePickup",
    label: "Pick-Up Verification",
    shortLabel: "Pick-Up",
    icon: PackageCheck,
    path: "Mobile App / Pick-Up Desk",
    description: "Verifying student circulation pickup receipt slips and executing handed-over book collection.",
    platform: "mobile",
  },
];

export const LIBRARIAN_MODULES = LIBRARIAN_WEB_MODULES;

export const DEFAULT_PERMISSIONS: LibrarianPermissions = {
  home: true,
  records: true,
  transactions: true,
  reminders: true,
  reports: true,
  history: true,
  settings: true,
  export: true,
  import: true,
  mobileCatalog: true,
  mobileStudentPass: true,
  mobileReturns: true,
  mobilePickup: true,
  mobileReservations: true,
  mobileViolations: true,
  mobileManualEntry: true,
  mobileGallery: true,
};

export function RestrictionsPage() {
  const { notify } = useNotice();
  const { refreshUser } = useSession();
  const { theme } = useTheme();
  const isLight = theme === "light";

  // Active Platform View Toggle: "web" | "mobile"
  const [activePlatform, setActivePlatform] = useState<PlatformType>("web");

  const [librarians, setLibrarians] = useState<LibrarianAccount[]>([]);
  const [localPermissions, setLocalPermissions] = useState<Record<string, LibrarianPermissions>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLibrarian, setSelectedLibrarian] = useState<LibrarianAccount | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlatform, setModalPlatform] = useState<PlatformType>("web");

  // Current active modules based on platform toggle
  const activeModules = useMemo(() => {
    return activePlatform === "web" ? LIBRARIAN_WEB_MODULES : LIBRARIAN_MOBILE_MODULES;
  }, [activePlatform]);

  // Load librarians from API
  const loadLibrarians = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/librarians", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load librarian accounts");
      const data = await res.json();
      const accounts: LibrarianAccount[] = data.librarians || [];
      const initialMap: Record<string, LibrarianPermissions> = {};

      accounts.forEach((acc) => {
        const studentDeskAllowed =
          acc.permissions?.mobileStudentPass !== false &&
          acc.permissions?.mobileReturns !== false &&
          acc.permissions?.mobileReservations !== false &&
          acc.permissions?.mobileViolations !== false;

        initialMap[acc.id] = {
          home: acc.permissions?.home !== false,
          records: acc.permissions?.records !== false,
          transactions: acc.permissions?.transactions !== false,
          reminders: acc.permissions?.reminders !== false,
          reports: acc.permissions?.reports !== false,
          history: acc.permissions?.history !== false,
          settings: acc.permissions?.settings !== false,
          export: acc.permissions?.export !== false,
          import: acc.permissions?.import !== false,
          mobileCatalog: acc.permissions?.mobileCatalog !== false,
          mobileStudentPass: studentDeskAllowed,
          mobileReturns: studentDeskAllowed,
          mobileReservations: studentDeskAllowed,
          mobileViolations: studentDeskAllowed,
          mobilePickup: acc.permissions?.mobilePickup !== false,
          mobileManualEntry: true,
          mobileGallery: true,
        };
      });

      startTransition(() => {
        setLibrarians(accounts);
        setLocalPermissions(initialMap);
        setLoading(false);
      });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to load librarian accounts.";
      notify(msg, "error");
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [notify]);

  useEffect(() => {
    void loadLibrarians();
  }, [loadLibrarians]);

  // Toggle single permission for a librarian
  const handleTogglePermission = (librarianId: string, key: LibrarianPermissionKey) => {
    setLocalPermissions((prev) => {
      const current = prev[librarianId] || { ...DEFAULT_PERMISSIONS };
      const nextVal = !current[key];
      const updated: LibrarianPermissions = {
        ...current,
        [key]: nextVal,
      };
      if (key === "mobileStudentPass") {
        updated.mobileReturns = nextVal;
        updated.mobileReservations = nextVal;
        updated.mobileViolations = nextVal;
      }
      return {
        ...prev,
        [librarianId]: updated,
      };
    });
  };

  // Bulk set permissions for a librarian (platform specific or all)
  const handleSetAllPermissions = (
    librarianId: string,
    value: boolean,
    targetPlatform: PlatformType | "all" = "all"
  ) => {
    setLocalPermissions((prev) => {
      const current = prev[librarianId] || { ...DEFAULT_PERMISSIONS };
      const updated = { ...current };

      if (targetPlatform === "web" || targetPlatform === "all") {
        LIBRARIAN_WEB_MODULES.forEach((m) => {
          updated[m.key] = value;
        });
      }

      if (targetPlatform === "mobile" || targetPlatform === "all") {
        LIBRARIAN_MOBILE_MODULES.forEach((m) => {
          updated[m.key] = value;
        });
        updated.mobileReturns = value;
        updated.mobileReservations = value;
        updated.mobileViolations = value;
        updated.mobileManualEntry = true;
        updated.mobileGallery = true;
      }

      return {
        ...prev,
        [librarianId]: updated,
      };
    });
  };

  // Reset librarian permissions to saved state
  const handleResetPermissions = (librarian: LibrarianAccount) => {
    const studentDeskAllowed =
      librarian.permissions?.mobileStudentPass !== false &&
      librarian.permissions?.mobileReturns !== false &&
      librarian.permissions?.mobileReservations !== false &&
      librarian.permissions?.mobileViolations !== false;

    setLocalPermissions((prev) => ({
      ...prev,
      [librarian.id]: {
        home: librarian.permissions?.home !== false,
        records: librarian.permissions?.records !== false,
        transactions: librarian.permissions?.transactions !== false,
        reminders: librarian.permissions?.reminders !== false,
        reports: librarian.permissions?.reports !== false,
        history: librarian.permissions?.history !== false,
        settings: librarian.permissions?.settings !== false,
        export: librarian.permissions?.export !== false,
        import: librarian.permissions?.import !== false,
        mobileCatalog: librarian.permissions?.mobileCatalog !== false,
        mobileStudentPass: studentDeskAllowed,
        mobileReturns: studentDeskAllowed,
        mobileReservations: studentDeskAllowed,
        mobileViolations: studentDeskAllowed,
        mobilePickup: librarian.permissions?.mobilePickup !== false,
        mobileManualEntry: true,
        mobileGallery: true,
      },
    }));
  };

  // Save permissions for a specific librarian
  const handleSavePermissions = async (librarian: LibrarianAccount) => {
    const perms = localPermissions[librarian.id];
    if (!perms) return;

    setSavingId(librarian.id);
    try {
      const res = await fetch(`/api/admin/librarians/${librarian.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update restrictions.");
      }

      const result = await res.json();
      const updatedUser = result.user;

      // Update librarians list with saved permissions
      setLibrarians((prev) =>
        prev.map((item) =>
          item.id === librarian.id ? { ...item, permissions: updatedUser.permissions } : item
        )
      );

      const allModules = [...LIBRARIAN_WEB_MODULES, ...LIBRARIAN_MOBILE_MODULES];
      const restrictedCount = allModules.filter((m) => perms[m.key] === false).length;
      notify(
        restrictedCount > 0
          ? `${librarian.name}: ${restrictedCount} function(s) restricted.`
          : `Full access enabled for ${librarian.name}.`,
        "success"
      );
      void refreshUser();
    } catch (err: unknown) {
      console.error("Save error:", err);
      const msg = err instanceof Error ? err.message : "Could not save librarian restrictions.";
      notify(msg, "error");
    } finally {
      setSavingId(null);
    }
  };

  // Filter librarians
  const filteredLibrarians = useMemo(() => {
    return librarians.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.idNumber.toLowerCase().includes(q) ||
        (item.department && item.department.toLowerCase().includes(q))
      );
    });
  }, [librarians, searchQuery]);

  // Statistics tailored to the selected platform
  const stats = useMemo(() => {
    const total = librarians.length;
    let fullyActive = 0;
    let restrictedAccounts = 0;
    let totalRestrictedFunctions = 0;

    librarians.forEach((acc) => {
      const perms = localPermissions[acc.id] || acc.permissions || DEFAULT_PERMISSIONS;
      const restricted = activeModules.filter((m) => perms[m.key] === false).length;
      totalRestrictedFunctions += restricted;
      if (restricted === 0) {
        fullyActive += 1;
      } else {
        restrictedAccounts += 1;
      }
    });

    return { total, fullyActive, restrictedAccounts, totalRestrictedFunctions };
  }, [librarians, localPermissions, activeModules]);

  // Check if a librarian has unsaved changes across any platform
  const isDirty = (librarianId: string) => {
    const current = localPermissions[librarianId];
    const original = librarians.find((l) => l.id === librarianId)?.permissions;
    if (!current || !original) return false;

    const allModules = [...LIBRARIAN_WEB_MODULES, ...LIBRARIAN_MOBILE_MODULES];
    return allModules.some(
      (m) => (current[m.key] ?? true) !== (original[m.key] ?? true)
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        eyebrow="SYSTEM GOVERNANCE / ACCESS CONTROL"
        title="Librarian Function Restrictions"
        description="Configure feature and module access per librarian account across Web and Mobile platforms. If a function is unchecked, that function is completely hidden and locked for the librarian."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setLoading(true);
                void loadLibrarians();
              }}
              disabled={loading}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50",
                isLight
                  ? "border border-slate-200 bg-white text-slate-700 hover:border-[#0274BB]/40 hover:bg-slate-50 hover:text-[#0274BB]"
                  : "border border-white/10 bg-[#152E47]/70 text-slate-200 backdrop-blur-sm hover:border-[#FCD400]/40 hover:bg-[#152E47] hover:text-[#FCD400]"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Overview Stats (Reflects Active Platform) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total Librarian Accounts" value={stats.total} tone="default" />
        <AdminStatCard
          label={activePlatform === "web" ? "Full Access (Web)" : "Full Access (Mobile)"}
          value={stats.fullyActive}
          tone="success"
        />
        <AdminStatCard
          label={activePlatform === "web" ? "Restricted Accounts (Web)" : "Restricted Accounts (Mobile)"}
          value={stats.restrictedAccounts}
          tone={stats.restrictedAccounts > 0 ? "warning" : "default"}
        />
        <AdminStatCard
          label={activePlatform === "web" ? "Active Web Restrictions" : "Active Mobile Restrictions"}
          value={stats.totalRestrictedFunctions}
          tone={stats.totalRestrictedFunctions > 0 ? "danger" : "default"}
        />
      </div>

      {/* Guidance Banner (Dynamic Context for Web vs Mobile) */}
      <div
        className={cn(
          "flex items-start gap-4 rounded-2xl p-5 shadow-sm transition-all",
          isLight
            ? "border border-amber-200/80 bg-amber-50/60"
            : "border border-[#FCD400]/20 bg-gradient-to-r from-[#FCD400]/10 via-[#152E47]/40 to-[#0F1D29]/60 shadow-lg backdrop-blur-md"
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
            isLight
              ? "bg-amber-100 text-amber-700"
              : "bg-[#FCD400]/20 text-[#FCD400]"
          )}
        >
          {activePlatform === "web" ? (
            <Globe className="h-5 w-5" />
          ) : (
            <Smartphone className="h-5 w-5" />
          )}
        </div>
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <p className={cn("font-bold", isLight ? "text-amber-900" : "text-[#FCD400]")}>
              How {activePlatform === "web" ? "Web System" : "Librarian Mobile"} Restrictions Work
            </p>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                activePlatform === "web"
                  ? isLight
                    ? "bg-[#0274BB]/15 text-[#0274BB]"
                    : "bg-[#0274BB]/30 text-sky-300"
                  : isLight
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-emerald-500/20 text-emerald-300"
              )}
            >
              {activePlatform === "web" ? "Web System Mode" : "Librarian Mobile Mode"}
            </span>
          </div>

          <p className={cn("mt-1", isLight ? "text-slate-600" : "text-slate-300")}>
            {activePlatform === "web" ? (
              <>
                Checking a box <span className={cn("font-semibold", isLight ? "text-emerald-700" : "text-emerald-400")}>grants access</span> to that function.
                Unchecking a box <span className={cn("font-semibold", isLight ? "text-amber-700" : "text-amber-400")}>hides and restricts</span> the function: the navigation link disappears from the librarian&apos;s sidebar, its dashboard quick action cards disappear, and direct URL navigation is blocked.
              </>
            ) : (
              <>
                Checking a box <span className={cn("font-semibold", isLight ? "text-emerald-700" : "text-emerald-400")}>enables mobile tool access</span>.
                Unchecking a box <span className={cn("font-semibold", isLight ? "text-amber-700" : "text-amber-400")}>locks and restricts</span> that feature in the Librarian Mobile App: camera OCR book cataloging, student information & returns desk (including reservation queues and student violations), or physical pick-up verification will be disabled for that librarian.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Main Restrictions Management Section */}
      <AdminSection
        title="Librarian Accounts & Permissions"
        description={`Toggle checkboxes to grant or restrict ${activePlatform === "web" ? "web portal" : "mobile app"} functions for each librarian.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* PLATFORM SWITCHER TOGGLE: Web vs Mobile */}
            <div
              className={cn(
                "flex items-center rounded-xl p-1 shadow-xs transition-colors",
                isLight ? "bg-slate-100 border border-slate-200" : "bg-[#0F1D29]/90 border border-white/10"
              )}
            >
              <button
                type="button"
                onClick={() => setActivePlatform("web")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95",
                  activePlatform === "web"
                    ? isLight
                      ? "bg-[#0274BB] !text-white shadow-xs"
                      : "bg-[#FCD400] text-slate-950 shadow-xs"
                    : isLight
                      ? "text-slate-600 hover:text-slate-900"
                      : "text-slate-400 hover:text-white"
                )}
                style={activePlatform === "web" && isLight ? { color: "#ffffff" } : undefined}
              >
                <Globe className={cn("h-3.5 w-3.5", activePlatform === "web" && isLight && "!text-white stroke-white")} />
                <span className={cn(activePlatform === "web" && isLight && "!text-white")} style={activePlatform === "web" && isLight ? { color: "#ffffff" } : undefined}>
                  Web Portal
                </span>
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                    activePlatform === "web"
                      ? isLight
                        ? "bg-white/25 !text-white"
                        : "bg-black/15 text-slate-950"
                      : isLight
                        ? "bg-slate-200 text-slate-600"
                        : "bg-white/10 text-slate-400"
                  )}
                  style={activePlatform === "web" && isLight ? { color: "#ffffff" } : undefined}
                >
                  {LIBRARIAN_WEB_MODULES.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActivePlatform("mobile")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95",
                  activePlatform === "mobile"
                    ? isLight
                      ? "bg-[#0274BB] !text-white shadow-xs"
                      : "bg-[#FCD400] text-slate-950 shadow-xs"
                    : isLight
                      ? "text-slate-600 hover:text-slate-900"
                      : "text-slate-400 hover:text-white"
                )}
                style={activePlatform === "mobile" && isLight ? { color: "#ffffff" } : undefined}
              >
                <Smartphone className={cn("h-3.5 w-3.5", activePlatform === "mobile" && isLight && "!text-white stroke-white")} />
                <span className={cn(activePlatform === "mobile" && isLight && "!text-white")} style={activePlatform === "mobile" && isLight ? { color: "#ffffff" } : undefined}>
                  Librarian Mobile
                </span>
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                    activePlatform === "mobile"
                      ? isLight
                        ? "bg-white/25 !text-white"
                        : "bg-black/15 text-slate-950"
                      : isLight
                        ? "bg-slate-200 text-slate-600"
                        : "bg-white/10 text-slate-400"
                  )}
                  style={activePlatform === "mobile" && isLight ? { color: "#ffffff" } : undefined}
                >
                  {LIBRARIAN_MOBILE_MODULES.length}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search librarian by name, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full rounded-xl !py-2 !pl-11 !pr-9 text-sm outline-none transition-all",
                  isLight
                    ? "border border-slate-200 bg-white text-slate-800 placeholder-slate-400 shadow-xs focus:border-[#0274BB] focus:ring-1 focus:ring-[#0274BB]/30"
                    : "border border-white/10 bg-[#0F1D29]/80 text-slate-100 placeholder-slate-400 focus:border-[#FCD400]/60 focus:ring-1 focus:ring-[#FCD400]/40"
                )}
                style={{ paddingLeft: "2.75rem", paddingRight: "2.25rem" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={cn(
                    "absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors",
                    isLight ? "text-slate-400 hover:text-slate-700" : "text-slate-400 hover:text-white"
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        }
      >
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className={cn("h-8 w-8 animate-spin", isLight ? "text-[#0274BB]" : "text-[#FCD400]")} />
            <p className={cn("text-sm font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
              Loading librarian accounts...
            </p>
          </div>
        ) : filteredLibrarians.length === 0 ? (
          <div
            className={cn(
              "flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center",
              isLight
                ? "border-slate-200 bg-slate-50 text-slate-500"
                : "border-white/10 bg-slate-900/30 text-slate-400"
            )}
          >
            <Users className="h-10 w-10 text-slate-400" />
            <p className={cn("text-base font-semibold", isLight ? "text-slate-800" : "text-slate-200")}>
              No Librarian Accounts Found
            </p>
            <p className={cn("max-w-md text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
              {searchQuery
                ? "Try adjusting your search criteria."
                : "No accounts with librarian privileges currently exist in the database."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <AdminTable>
              <table className={cn("min-w-full divide-y text-left text-sm", isLight ? "divide-slate-200" : "divide-white/10")}>
                <thead>
                  <tr
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      isLight
                        ? "border-b border-slate-200 bg-slate-50 text-slate-700"
                        : "bg-[#152E47]/50 text-slate-300"
                    )}
                  >
                    <th className="px-5 py-4 min-w-[220px]">Librarian Account</th>
                    {activeModules.map((mod) => {
                      const Icon = mod.icon;
                      return (
                        <th key={mod.key} className="px-2 py-4 text-center min-w-[115px]" title={mod.description}>
                          <div className="flex flex-col items-center gap-1.5">
                            <Icon className={cn("h-4 w-4", isLight ? "text-[#0274BB]" : "text-[#FCD400]")} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">
                              {mod.shortLabel}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-4 py-4 text-center min-w-[130px]">Status</th>
                    <th className="px-5 py-4 text-right min-w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y", isLight ? "divide-slate-200 bg-white" : "divide-white/5 bg-[#0F1D29]/40")}>
                  {filteredLibrarians.map((librarian) => {
                    const perms = localPermissions[librarian.id] || DEFAULT_PERMISSIONS;
                    const dirty = isDirty(librarian.id);
                    const isSaving = savingId === librarian.id;
                    const activeCount = activeModules.filter((m) => perms[m.key] !== false).length;
                    const totalCount = activeModules.length;
                    const isFullAccess = activeCount === totalCount;
                    const isSelectedRow = dirty || selectedLibrarian?.id === librarian.id;

                    return (
                      <tr
                        key={librarian.id}
                        className={cn(
                          "transition-all duration-150",
                          isSelectedRow && (isLight ? "row-selected-dirty" : "row-selected-dirty-dark"),
                          isLight
                            ? isSelectedRow
                              ? "bg-white"
                              : "bg-white hover:bg-slate-50/80"
                            : isSelectedRow
                              ? "bg-slate-800/40"
                              : "hover:bg-slate-800/30"
                        )}
                        style={isSelectedRow && isLight ? { outline: "2px solid #000000", outlineOffset: "-2px", backgroundColor: "#ffffff" } : undefined}
                      >
                        {/* Account Info */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm",
                                isLight
                                  ? "border border-slate-200 bg-slate-100 text-[#0274BB]"
                                  : "border border-white/10 bg-gradient-to-br from-[#152E47] to-[#0F1D29] text-[#FCD400]"
                              )}
                            >
                              {librarian.name?.charAt(0).toUpperCase() || "L"}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className={cn("truncate font-semibold", isLight ? "text-slate-900" : "text-white")}>
                                {librarian.name}
                              </span>
                              <span className={cn("truncate text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                                {librarian.email}
                              </span>
                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                    isLight ? "bg-slate-100 text-slate-700" : "bg-white/5 text-slate-300"
                                  )}
                                >
                                  {librarian.idNumber}
                                </span>
                                {librarian.department && (
                                  <span
                                    className={cn(
                                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                      isLight ? "bg-slate-100 text-slate-500" : "bg-white/5 text-slate-400"
                                    )}
                                  >
                                    {librarian.department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Checkbox columns for the active platform */}
                        {activeModules.map((mod) => {
                          const checked = perms[mod.key] ?? true;
                          return (
                            <td key={mod.key} className="px-3 py-4 text-center">
                              <label
                                className="group inline-flex cursor-pointer flex-col items-center justify-center p-1"
                                title={`${checked ? "Disable" : "Enable"} ${mod.label} for ${librarian.name}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleTogglePermission(librarian.id, mod.key)}
                                  className="sr-only"
                                />
                                <div
                                  className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200 group-active:scale-95",
                                    checked
                                      ? isLight
                                        ? "border-emerald-500 bg-emerald-500 text-white shadow-xs"
                                        : "border-[#FCD400]/80 bg-[#FCD400]/20 text-[#FCD400] shadow-[0_0_12px_rgba(252,212,0,0.25)]"
                                      : isLight
                                        ? "border-slate-300 bg-slate-100 text-slate-400 hover:border-red-400 hover:bg-red-50 hover:text-red-500"
                                        : "border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-500/50"
                                  )}
                                >
                                  {checked ? (
                                    <Check className="h-4 w-4 stroke-[3]" />
                                  ) : (
                                    <X className="h-4 w-4 stroke-[2.5]" />
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    "mt-1 text-[9px] font-semibold uppercase tracking-wider",
                                    checked
                                      ? isLight
                                        ? "text-emerald-700"
                                        : "text-slate-400"
                                      : isLight
                                        ? "text-slate-500"
                                        : "text-red-400/90"
                                  )}
                                >
                                  {checked ? "Visible" : "Hidden"}
                                </span>
                              </label>
                            </td>
                          );
                        })}

                        {/* Status Summary */}
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                                isFullAccess
                                  ? isLight
                                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                  : isLight
                                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                                    : "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                              )}
                            >
                              {isFullAccess ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Full Access
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3.5 w-3.5" />
                                  {totalCount - activeCount} Hidden
                                </>
                              )}
                            </span>
                            <span className={cn("text-[11px]", isLight ? "text-slate-500" : "text-slate-400")}>
                              {activeCount}/{totalCount} active
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Detailed Inspection */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLibrarian(librarian);
                                setModalPlatform(activePlatform);
                                setModalOpen(true);
                              }}
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                                isLight
                                  ? "border-slate-200 bg-white text-slate-600 hover:border-[#0274BB]/40 hover:bg-slate-50 hover:text-[#0274BB] shadow-xs"
                                  : "border-white/10 bg-white/5 text-slate-300 hover:border-[#FCD400]/40 hover:bg-[#FCD400]/10 hover:text-[#FCD400]"
                              )}
                              title="Inspect & Configure Detailed Permissions"
                            >
                              <Info className="h-4 w-4" />
                            </button>

                            {/* Reset if dirty */}
                            {dirty && (
                              <button
                                type="button"
                                onClick={() => handleResetPermissions(librarian)}
                                disabled={isSaving}
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                                  isLight
                                    ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                                    : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                )}
                                title="Reset Unsaved Changes"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Save Button */}
                            <button
                              type="button"
                              onClick={() => void handleSavePermissions(librarian)}
                              disabled={isSaving || !dirty}
                              className={cn(
                                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-sm",
                                dirty
                                  ? isLight
                                    ? "btn-save-active border border-[#0274BB] bg-[#0274BB] !text-white hover:bg-[#02609c] active:scale-95 shadow-sm"
                                    : "border border-[#FCD400] bg-[#FCD400] text-slate-950 hover:bg-[#ffe14d] active:scale-95 shadow-[0_0_15px_rgba(252,212,0,0.3)]"
                                  : isLight
                                    ? "border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                                    : "border border-white/10 bg-white/5 text-slate-500 cursor-not-allowed opacity-50"
                              )}
                              style={dirty && isLight ? { color: "#ffffff" } : undefined}
                              title={dirty ? "Save Permissions" : "All changes saved"}
                            >
                              {isSaving ? (
                                <RefreshCw className={cn("h-3.5 w-3.5 animate-spin", dirty && isLight && "!text-white stroke-white")} />
                              ) : (
                                <Save className={cn("h-3.5 w-3.5", dirty && isLight && "!text-white stroke-white")} />
                              )}
                              <span className={cn(dirty && isLight && "!text-white")} style={dirty && isLight ? { color: "#ffffff" } : undefined}>
                                {isSaving ? "Saving..." : dirty ? "Save" : "Saved"}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminTable>
          </div>
        )}
      </AdminSection>

      {/* Detailed Configuration Modal (Supports Web & Mobile Inspection) */}
      {selectedLibrarian && (
        <AdminModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Configure Permissions: ${selectedLibrarian.name}`}
          description={`Fine-tune individual permissions and function visibility across Web Portal and Mobile App for ${selectedLibrarian.name}.`}
        >
          <div className="space-y-6">
            {/* Account Card */}
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4",
                isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-[#0F1D29]"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold",
                    isLight ? "bg-slate-200 text-[#0274BB]" : "bg-[#152E47] text-[#FCD400]"
                  )}
                >
                  {selectedLibrarian.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className={cn("font-bold", isLight ? "text-slate-900" : "text-white")}>
                    {selectedLibrarian.name}
                  </h4>
                  <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                    {selectedLibrarian.email} • {selectedLibrarian.department}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllPermissions(selectedLibrarian.id, true, modalPlatform)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                    isLight
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  )}
                >
                  Allow All ({modalPlatform === "web" ? "Web" : "Mobile"})
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllPermissions(selectedLibrarian.id, false, modalPlatform)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                    isLight
                      ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  )}
                >
                  Restrict All ({modalPlatform === "web" ? "Web" : "Mobile"})
                </button>
              </div>
            </div>

            {/* Modal Platform Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-white/10">
              <button
                type="button"
                onClick={() => setModalPlatform("web")}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
                  modalPlatform === "web"
                    ? isLight
                      ? "bg-[#0274BB] !text-white shadow-xs"
                      : "bg-[#FCD400] text-slate-950 shadow-xs"
                    : isLight
                      ? "text-slate-600 hover:bg-slate-100"
                      : "text-slate-400 hover:bg-white/5"
                )}
                style={modalPlatform === "web" && isLight ? { color: "#ffffff" } : undefined}
              >
                <Globe className={cn("h-4 w-4", modalPlatform === "web" && isLight && "!text-white stroke-white")} />
                <span style={modalPlatform === "web" && isLight ? { color: "#ffffff" } : undefined}>
                  Web System Functions ({LIBRARIAN_WEB_MODULES.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalPlatform("mobile")}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
                  modalPlatform === "mobile"
                    ? isLight
                      ? "bg-[#0274BB] !text-white shadow-xs"
                      : "bg-[#FCD400] text-slate-950 shadow-xs"
                    : isLight
                      ? "text-slate-600 hover:bg-slate-100"
                      : "text-slate-400 hover:bg-white/5"
                )}
                style={modalPlatform === "mobile" && isLight ? { color: "#ffffff" } : undefined}
              >
                <Smartphone className={cn("h-4 w-4", modalPlatform === "mobile" && isLight && "!text-white stroke-white")} />
                <span style={modalPlatform === "mobile" && isLight ? { color: "#ffffff" } : undefined}>
                  Librarian Mobile Functions ({LIBRARIAN_MOBILE_MODULES.length})
                </span>
              </button>
            </div>

            {/* Modules List with Checkboxes for Modal Platform */}
            <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {(modalPlatform === "web" ? LIBRARIAN_WEB_MODULES : LIBRARIAN_MOBILE_MODULES).map((mod) => {
                const Icon = mod.icon;
                const perms = localPermissions[selectedLibrarian.id] || DEFAULT_PERMISSIONS;
                const checked = perms[mod.key] ?? true;

                return (
                  <div
                    key={mod.key}
                    onClick={() => handleTogglePermission(selectedLibrarian.id, mod.key)}
                    className={cn(
                      "flex cursor-pointer items-start justify-between rounded-xl border p-4 transition-all",
                      checked
                        ? isLight
                          ? "border-[#0274BB]/30 bg-sky-50/50 hover:border-[#0274BB]/50"
                          : "border-[#FCD400]/30 bg-[#152E47]/40 hover:border-[#FCD400]/60"
                        : isLight
                          ? "border-slate-200 bg-slate-50/60 hover:border-slate-300 opacity-75"
                          : "border-white/5 bg-slate-950/40 hover:border-white/10 opacity-75"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg",
                          checked
                            ? isLight
                              ? "bg-[#0274BB]/10 text-[#0274BB]"
                              : "bg-[#FCD400]/20 text-[#FCD400]"
                            : isLight
                              ? "bg-slate-200 text-slate-500"
                              : "bg-white/5 text-slate-500"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-semibold", isLight ? "text-slate-900" : "text-white")}>
                            {mod.label}
                          </span>
                          <span className={cn("font-mono text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                            {mod.path}
                          </span>
                        </div>
                        <p className={cn("mt-1 text-xs", isLight ? "text-slate-600" : "text-slate-300")}>
                          {mod.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span
                        className={cn(
                          "text-xs font-bold",
                          checked
                            ? isLight
                              ? "text-[#0274BB]"
                              : "text-[#FCD400]"
                            : "text-slate-500"
                        )}
                      >
                        {checked ? "Visible" : "Hidden"}
                      </span>
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md border",
                          checked
                            ? isLight
                              ? "border-[#0274BB] bg-[#0274BB] text-white"
                              : "border-[#FCD400] bg-[#FCD400] text-slate-950"
                            : isLight
                              ? "border-slate-300 bg-white"
                              : "border-white/20 bg-white/5"
                        )}
                      >
                        {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className={cn("flex items-center justify-end gap-3 border-t pt-4", isLight ? "border-slate-200" : "border-white/10")}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                  isLight
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    : "border-white/10 text-slate-300 hover:bg-white/5"
                )}
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSavePermissions(selectedLibrarian);
                  setModalOpen(false);
                }}
                disabled={savingId === selectedLibrarian.id}
                className={cn(
                  "btn-save-active flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold shadow-lg transition-all active:scale-95",
                  isLight
                    ? "bg-[#0274BB] !text-white hover:bg-[#02609c]"
                    : "bg-[#FCD400] text-slate-950 hover:bg-[#ffe14d]"
                )}
                style={isLight ? { color: "#ffffff" } : undefined}
              >
                <Save className={cn("h-4 w-4", isLight && "!text-white stroke-white")} />
                <span className={cn(isLight && "!text-white")} style={isLight ? { color: "#ffffff" } : undefined}>
                  Save Permissions
                </span>
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

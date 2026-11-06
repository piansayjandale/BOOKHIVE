"use client";

import dynamic from "next/dynamic";
import { PageCircleLoader } from "@/components/ui/page-circle-loader";

export const LazyDashboardFigma = dynamic(
  () => import("@/components/dashboard/dashboard-figma").then((mod) => mod.DashboardFigma),
  { loading: () => <PageCircleLoader label="Loading Dashboard..." /> }
);

export const LazyAnnouncementsModule = dynamic(
  () => import("@/components/modules/announcements-module").then((mod) => mod.AnnouncementsModule),
  { loading: () => <PageCircleLoader label="Loading Announcements..." /> }
);

export const LazyHistoryModule = dynamic(
  () => import("@/components/modules/history-module").then((mod) => mod.HistoryModule),
  { loading: () => <PageCircleLoader label="Loading History..." /> }
);

export const LazyRecordsModule = dynamic(
  () => import("@/components/modules/records-module").then((mod) => mod.RecordsModule),
  { loading: () => <PageCircleLoader label="Loading Records..." /> }
);

export const LazyReportsModule = dynamic(
  () => import("@/components/modules/reports-module").then((mod) => mod.ReportsModule),
  { loading: () => <PageCircleLoader label="Loading Reports..." /> }
);

export const LazySettingsModule = dynamic(
  () => import("@/components/modules/settings-module").then((mod) => mod.SettingsModule),
  { loading: () => <PageCircleLoader label="Loading Settings..." /> }
);

export const LazyTransactionsModule = dynamic(
  () => import("@/components/modules/transactions-module").then((mod) => mod.TransactionsModule),
  { loading: () => <PageCircleLoader label="Loading Transactions..." /> }
);

export const LazyAiSearchPage = dynamic(
  () => import("@/components/admin/ai-search-page").then((mod) => mod.AiSearchPage),
  { loading: () => <PageCircleLoader label="Loading AI Search..." /> }
);

export const LazyAnalyticsPage = dynamic(
  () => import("@/components/admin/analytics-page").then((mod) => mod.AnalyticsPage),
  { loading: () => <PageCircleLoader label="Loading Analytics..." /> }
);

export const LazyCatalogPage = dynamic(
  () => import("@/components/admin/catalog-page").then((mod) => mod.CatalogPage),
  { loading: () => <PageCircleLoader label="Loading Catalog..." /> }
);

export const LazyProfilePage = dynamic(
  () => import("@/components/admin/profile-page").then((mod) => mod.ProfilePage),
  { loading: () => <PageCircleLoader label="Loading Profile..." /> }
);

export const LazyRestrictionsPage = dynamic(
  () => import("@/components/admin/restrictions-page").then((mod) => mod.RestrictionsPage),
  { loading: () => <PageCircleLoader label="Loading Restrictions..." /> }
);

export const LazyRemindersModule = dynamic(
  () => import("@/components/modules/reminders-module").then((mod) => mod.RemindersModule),
  { loading: () => <PageCircleLoader label="Loading Reminders..." /> }
);

export const LazyLibrarianSettingsModule = dynamic(
  () =>
    import("@/components/modules/librarian-settings-module").then(
      (mod) => mod.LibrarianSettingsModule
    ),
  { loading: () => <PageCircleLoader label="Loading Settings..." /> }
);

export const LazyStudentView = dynamic(
  () => import("@/app/student/student-view").then((mod) => mod.StudentView),
  { loading: () => <PageCircleLoader label="Loading Student View..." /> }
);

export const LazyAuditLogsPage = dynamic(
  () => import("@/components/super-admin/audit-logs-page").then((mod) => mod.AuditLogsPage),
  { loading: () => <PageCircleLoader label="Loading Audit Logs..." /> }
);

export const LazySuperAdminHomePage = dynamic(
  () => import("@/components/super-admin/super-admin-home-page").then((mod) => mod.SuperAdminHomePage),
  { loading: () => <PageCircleLoader label="Loading Super Admin..." /> }
);

export const LazySuperAdminRecordsPage = dynamic(
  () => import("@/components/super-admin/records-page").then((mod) => mod.RecordsPage),
  { loading: () => <PageCircleLoader label="Loading Records..." /> }
);

export const LazySuperAdminSettingsPage = dynamic(
  () => import("@/components/super-admin/settings-page").then((mod) => mod.SuperAdminSettingsPage),
  { loading: () => <PageCircleLoader label="Loading Settings..." /> }
);

export const LazySystemManagementPage = dynamic(
  () =>
    import("@/components/super-admin/system-management-page").then(
      (mod) => mod.SystemManagementPage
    ),
  { loading: () => <PageCircleLoader label="Loading System Management..." /> }
);

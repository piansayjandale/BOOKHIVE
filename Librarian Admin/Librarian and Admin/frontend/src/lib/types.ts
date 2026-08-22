export type ThemeMode = "dark" | "light";

export type Role =
  | "Super Admin"
  | "SUPER_ADMIN"
  | "Admin"
  | "ADMIN"
  | "Circulation Librarian"
  | "CIRCULATION_LIBRARIAN"
  | "Technical Librarian"
  | "TECHNICAL_LIBRARIAN"
  | "Librarian"
  | "Student"
  | "STUDENT";

export type Department =
  | "Circulation"
  | "General Reference"
  | "Filipiniana"
  | "Reserve"
  | "Periodical"
  | "Special Collections";

export type BookAvailability = "Available" | "Limited" | "Reserved";

export type TransactionType = "Borrow" | "Return" | "Reservation";

export type TransactionStatus = "Pending" | "Approved" | "Declined" | "Returned" | "Cancelled";


export type ActivityLevel = "info" | "success" | "warning";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  audience: "All Users" | "Students" | "Staff";
  priority: "Normal" | "Important" | "Urgent";
  published: boolean;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publicationDate: string;
  department: Department;
  shelfLocation: string;
  summary: string;
  borrowCount: number;
  availability: BookAvailability;
  aiScore: number;
  genres?: string;
  language?: string;
  publisher?: string;
  rating?: number;
  coverImg?: string;
  source?: string;
  archived?: boolean;
  copies?: number;
}

export interface TransactionRecord {
  id: string;
  studentName: string;
  studentId: string;
  resourceTitle: string;
  isbn: string;
  type: TransactionType;
  status: TransactionStatus;
  requestedAt: string;
  dueDate?: string;
  department: Department;
  durationDays: number;
}

export interface ActivityLog {
  id: string;
  message: string;
  timestamp: string;
  level: ActivityLevel;
}

export interface HistoryEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  module: "Records" | "Transactions" | "Settings" | "Accounts" | "Announcements";
  timestamp: string;
  detail: string;
}

export interface SystemPreference {
  theme: ThemeMode;
  borrowLimit: number;
  borrowDurationDays: number;
  storageUsedPercent: number;
  indexingStatus: "Healthy" | "Rebuilding" | "Delayed";
  aiEngine: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department;
  status: "Active" | "Suspended";
  lastActive: string;
}

export interface SearchResult {
  id: string;
  title: string;
  author: string;
  isbn: string;
  department: Department;
  availability: BookAvailability;
  relevance: number;
  summary: string;
  matchedBy: string[];
  genres?: string;
  language?: string;
  rating?: number;
  coverImg?: string;
}

export interface DashboardPayload {
  metrics: {
    totalBooks: number;
    activeUsers: number;
    pendingRequests: number;
    approvedRequests: number;
    returnedRequests: number;
    totalBorrows: number;
    reservationRequests: number;
    activeBorrowedBooks: number;
    overdueItems: number;
    systemHealth: string;
    storageUsedPercent: number;
    indexingStatus: string;
  };
  queue: TransactionRecord[];
  trending: BookRecord[];
  recentActivity: ActivityLog[];
}

export interface ReportsPayload {
  monthlyBorrowing: Array<{ month: string; borrows: number; reservations: number }>;
  departmentUsage: Array<{ department: Department; usage: number }>;
  topBorrowed: Array<{ title: string; borrows: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
}

export interface SuperAdminVitals {
  totalUsers: number;
  superAdminsCount: number;
  adminsCount: number;
  librariansCount: number;
  studentsCount: number;
  activeBooksCount: number;
  archivedBooksCount: number;
  totalTransactions: number;
  pendingTransactions: number;
  activeBorrows: number;
  totalAiSearches: number;
  totalAuditLogs: number;
}

export interface SuperAdminTelemetry {
  platformStatus: string;
  databaseStatus: string;
  memoryUsagePercent: number;
  storageUsedPercent: number;
  uptimeSeconds: number;
  nodeVersion: string;
  searchIndexStatus: string;
  institutionalSyncStatus: string;
}

export interface SuperAdminDashboardPayload {
  vitals: SuperAdminVitals;
  telemetry: SuperAdminTelemetry;
}

export interface SuperAdminUserRecord {
  id: string;
  name: string;
  idNumber: string;
  email: string;
  role: string;
  department: string;
  course: string;
  status: "Active" | "Suspended";
  avatar?: string;
  qrCode?: string;
  lastActive?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SystemBackupRecord {
  id: string;
  fileName: string;
  fileSizeMb: number;
  backupType: "MANUAL" | "SCHEDULED" | "PRE_PRUNE";
  status: "COMPLETED" | "IN_PROGRESS" | "FAILED";
  createdBy: string;
  createdAt: string;
}

export interface InstitutionalSyncLog {
  id: string;
  provider: string;
  syncedRecords: number;
  status: string;
  details?: string;
  syncedAt: string;
}

export interface SuperAdminSettingsPayload {
  settings: {
    theme: string;
    borrowLimit: number;
    borrowDurationDays: number;
    storageUsedPercent: number;
    indexingStatus: string;
    aiEngine: string;
    notificationsEnabled: boolean;
    emailNotifications: boolean;
    allowAdminTransactionControl: boolean;
    aiStrictMode: boolean;
  };
  institutionalSync: {
    provider: string;
    autoSyncSchedule: string;
    lastSyncLogs: InstitutionalSyncLog[];
  };
}


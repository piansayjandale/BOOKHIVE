import type {
  BookAvailability,
  BookRecord,
  Department,
  Role,
  SearchResult,
  SystemPreference,
  TransactionRecord,
} from "@/lib/types";

export interface AdminSummaryMetric {
  label: string;
  value: number;
  change: string;
}

export interface AdminActivityItem {
  id: string;
  actor: string;
  message: string;
  timestamp: string;
  category: "User" | "Book" | "Transaction" | "AI" | "System" | "Auth";
}

export interface AdminUserRecord {
  id: string;
  name: string;
  idNumber: string;
  email: string;
  role: Role;
  department: Department;
  course: string;
  status: "Active" | "Suspended";
  lastActive: string;
}

export interface AdminBookRecord {
  id: string;
  title: string;
  author: string;
  isbn: string;
  department: Department;
  category: string;
  shelfLocation: string;
  publishedDate: string;
  apaCitation: string;
  archived: boolean;
  availability: BookAvailability;
  borrowCount: number;
  summary: string;
}

export interface AdminDashboardPayload {
  summary: {
    totalUsers: number;
    totalBooks: number;
    activeBorrowedBooks: number;
    pendingRequests: number;
  };
  topBooks: BookRecord[];
  monthlyBorrowTrends: Array<{
    month: string;
    borrows: number;
    returns: number;
    reservations: number;
  }>;
  departmentUsage: Array<{
    department: Department;
    usage: number;
  }>;
  recentActivities: AdminActivityItem[];
  newUsers: AdminUserRecord[];
  latestTransactions: TransactionRecord[];
}

export interface AdminUsersPayload {
  users: AdminUserRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminBooksPayload {
  books: AdminBookRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminTransactionsPayload {
  summary: {
    pending: number;
    approved: number;
    declined: number;
    returned: number;
  };
  borrowRequests: TransactionRecord[];
  returnRecords: TransactionRecord[];
  reservations: TransactionRecord[];
  transactionHistory: TransactionRecord[];
  allowAdminControl: boolean;
}

export interface PromptSearchLog {
  id: string;
  actor: string;
  query: string;
  department: string;
  fileNames: string[];
  matchesFound: number;
  createdAt: string;
}

export interface PromptSearchPayload {
  results: SearchResult[];
  logs: PromptSearchLog[];
}

export interface AnalyticsPayload {
  mostBorrowedBooks: Array<{ title: string; borrows: number }>;
  mostActiveDepartments: Array<{ department: Department; total: number }>;
  monthlyTrends: Array<{ month: string; borrows: number; returns: number; reservations: number }>;
  yearlyTrends: Array<{ year: string; transactions: number }>;
  transactionStatus: Array<{ status: string; total: number }>;
}

export interface RecordsCatalogPayload {
  records: AdminBookRecord[];
  total: number;
}

export interface MonitoringLog {
  id: string;
  actor: string;
  activityType: "User" | "Book" | "Transaction" | "AI" | "System" | "Auth";
  message: string;
  severity: "info" | "success" | "warning";
  timestamp: string;
}

export interface MonitoringPayload {
  logs: MonitoringLog[];
  totals: {
    authEvents: number;
    aiEvents: number;
    transactionEvents: number;
    userEvents: number;
  };
}

export interface AdminSettingsPayload extends SystemPreference {
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  allowAdminTransactionControl: boolean;
  aiStrictMode: boolean;
}

export interface AdminProfilePayload {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department;
  phone: string;
  bio: string;
  avatar: string;
  lastActive: string;
}

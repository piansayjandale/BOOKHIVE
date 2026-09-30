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
  qrCode?: string;
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
  genres?: string;
  copies?: number;
  pages?: number;
  rating?: string;
  coverImg?: string;
  edition?: string;
  volume?: string;
}

export interface AdminDashboardPayload {
  summary: {
    totalUsers: number;
    totalBooks: number;
    activeBorrowedBooks: number;
    pendingRequests: number;
  };
  systemHealth?: {
    status: "NOMINAL" | "DEGRADED" | "CRITICAL";
    lastIndexing: string;
    storageUsed: number;
    storageTotal: number;
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
  monthlyBookAdditions?: Array<{ month: string; count: number; cumulative: number; isFuture?: boolean }>;
  catalogQuota?: {
    limit: number;
    totalAdded: number;
    remaining: number;
    percentage: number;
    safeMonthlyRate: number;
  };
  mostCourseBorrowed?: MostCourseBorrowed;
  mostSearchedBooks?: MostSearchedBooks;
  circulationHealth?: CirculationHealth;
  collectionDepth?: CollectionDepth;
}

export interface MostCourseBorrowed {
  totalBorrows: number;
  activeCoursesCount: number;
  topCourse: {
    name: string;
    fullTitle?: string;
    borrowCount: number;
    percentage: number;
  };
  courses: Array<{
    course: string;
    fullTitle: string;
    borrowCount: number;
    studentCount: number;
    percentage: number;
    fill?: string;
  }>;
}

export interface MostSearchedBooks {
  totalSearches: number;
  topTitle: string;
  books: Array<{
    title: string;
    author: string;
    category: string;
    searchCount: number;
    percentage: number;
    trend: string;
  }>;
  searchTerms: Array<{
    term: string;
    count: number;
    category: string;
  }>;
}

export interface CirculationHealth {
  totalTx: number;
  activeLoans: number;
  returnedCount: number;
  overdueCount: number;
  pendingCount: number;
  cancelledCount: number;
  returnComplianceRate: number;
  statusBreakdown: Array<{
    key: string;
    label: string;
    count: number;
    fill: string;
    desc: string;
  }>;
  durationBreakdown: Array<{
    label: string;
    days: number;
    count: number;
  }>;
}

export interface CollectionDepth {
  totalTitles: number;
  departments: Array<{
    department: string;
    count: number;
    percentage: number;
  }>;
  topGenres: Array<{
    genre: string;
    count: number;
    percentage: number;
  }>;
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

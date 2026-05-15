export type ThemeMode = "dark" | "light";

export type Role = "Admin" | "Librarian" | "Student";

export type Department =
  | "Computer Science"
  | "Engineering"
  | "Education"
  | "Business & Accountancy"
  | "Arts & Sciences";

export type BookAvailability = "Available" | "Limited" | "Reserved";

export type TransactionType = "Borrow" | "Return" | "Reservation";

export type TransactionStatus = "Pending" | "Approved" | "Declined" | "Returned";

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

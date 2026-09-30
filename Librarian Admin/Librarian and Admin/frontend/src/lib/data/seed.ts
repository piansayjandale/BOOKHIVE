import type {
  ActivityLog,
  AnnouncementRecord,
  BookRecord,
  HistoryEntry,
  SystemPreference,
  SystemUser,
  TransactionRecord,
} from "@/lib/types";

const now = Date.now();

export const seedBooks: BookRecord[] = [];

export const seedTransactions: TransactionRecord[] = [];

export const seedActivities: ActivityLog[] = [];

export const seedHistory: HistoryEntry[] = [];

export const seedAnnouncements: AnnouncementRecord[] = [];

export const seedSettings: SystemPreference = {
  theme: "dark",
  borrowLimit: 5,
  borrowDurationDays: 7,
  storageUsedPercent: 0,
  indexingStatus: "Healthy",
  aiEngine: "Gemini + RAG Cache",
};

export const seedUsers: SystemUser[] = [
  {
    id: "user-001",
    name: "Yana Palmares",
    email: "yana.palmares@stiwnu.edu.ph",
    role: "Admin",
    department: "Circulation",
    status: "Active",
    lastActive: new Date().toISOString(),
  },
  {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    department: "Circulation",
    status: "Active",
    lastActive: new Date().toISOString(),
  },
];

import { catalogRepository } from "@/lib/catalog/repository";
import { pool } from "@/lib/db";
import {
  seedActivities,
  seedAnnouncements,
  seedHistory,
  seedSettings,
  seedTransactions,
  seedUsers,
} from "@/lib/data/seed";
import { publishActivity } from "@/lib/live";
import type {
  ActivityLog,
  AnnouncementRecord,
  BookRecord,
  DashboardPayload,
  Department,
  HistoryEntry,
  ReportsPayload,
  SessionUser,
  SystemPreference,
  SystemUser,
  TransactionRecord,
  TransactionStatus,
} from "@/lib/types";

interface StoreState {
  transactions: TransactionRecord[];
  activities: ActivityLog[];
  history: HistoryEntry[];
  announcements: AnnouncementRecord[];
  settings: SystemPreference;
  users: SystemUser[];
  counters: Record<string, number>;
}

interface AnnouncementInput {
  title: string;
  content: string;
  audience: AnnouncementRecord["audience"];
  priority: AnnouncementRecord["priority"];
  published: boolean;
}

declare global {
  var __bookhiveStore: StoreState | undefined;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInitialState(): StoreState {
  return {
    transactions: clone(seedTransactions),
    activities: clone(seedActivities),
    history: clone(seedHistory),
    announcements: clone(seedAnnouncements),
    settings: clone(seedSettings),
    users: clone(seedUsers),
    counters: {
      transactions: seedTransactions.length + 1,
      activities: seedActivities.length + 1,
      history: seedHistory.length + 1,
      announcements: seedAnnouncements.length + 1,
      users: seedUsers.length + 1,
    },
  };
}

function getState() {
  if (!globalThis.__bookhiveStore) {
    globalThis.__bookhiveStore = createInitialState();
  }

  return globalThis.__bookhiveStore;
}

function nextId(key: keyof StoreState["counters"], prefix: string) {
  const state = getState();
  const value = state.counters[key];
  state.counters[key] += 1;
  return `${prefix}-${String(value).padStart(3, "0")}`;
}

function actorLabel(actor?: SessionUser | null) {
  return actor ? `${actor.role} ${actor.name}` : "BookHive Admin";
}

function actorName(actor?: SessionUser | null) {
  return actor?.name ?? "BookHive Admin";
}

function recordActivity(message: string, level: ActivityLog["level"]) {
  const state = getState();
  const activity: ActivityLog = {
    id: nextId("activities", "act"),
    message,
    level,
    timestamp: new Date().toISOString(),
  };

  state.activities.unshift(activity);
  state.activities = state.activities.slice(0, 80);
  publishActivity(activity);
  return activity;
}

function recordHistory(entry: Omit<HistoryEntry, "id" | "timestamp">) {
  const state = getState();
  state.history.unshift({
    ...entry,
    id: nextId("history", "hist"),
    timestamp: new Date().toISOString(),
  });
  state.history = state.history.slice(0, 180);
}

function computeOverdueCount() {
  return getState().transactions.filter(
    (transaction) =>
      transaction.status === "Approved" &&
      transaction.dueDate &&
      new Date(transaction.dueDate).getTime() < Date.now(),
  ).length;
}

function activeBorrowsForStudent(studentId: string) {
  return getState().transactions.filter(
    (transaction) =>
      transaction.studentId === studentId &&
      transaction.type === "Borrow" &&
      transaction.status === "Approved" &&
      (!transaction.dueDate || new Date(transaction.dueDate).getTime() >= Date.now()),
  ).length;
}

export const store = {
  async getDashboard(): Promise<DashboardPayload> {
    const state = getState();

    const totalBorrows = state.transactions.filter((transaction) => transaction.type === "Borrow").length;
    const reservationRequests = state.transactions.filter((transaction) => transaction.type === "Reservation").length;
    const approvedRequests = state.transactions.filter((transaction) => transaction.status === "Approved").length;
    const returnedRequests = state.transactions.filter((transaction) => transaction.status === "Returned").length;
    const activeBorrowedBooks = state.transactions.filter(
      (transaction) => transaction.type === "Borrow" && transaction.status === "Approved",
    ).length;

    return {
      metrics: {
        totalBooks: await catalogRepository.countBooks(),
        activeUsers: state.users.filter((user) => user.status === "Active").length,
        pendingRequests: state.transactions.filter((transaction) => transaction.status === "Pending").length,
        approvedRequests,
        returnedRequests,
        totalBorrows,
        reservationRequests,
        activeBorrowedBooks,
        overdueItems: computeOverdueCount(),
        systemHealth: `${100 - state.settings.storageUsedPercent}% headroom`,
        storageUsedPercent: state.settings.storageUsedPercent,
        indexingStatus: state.settings.indexingStatus,
      },
      queue: state.transactions
        .filter(
          (transaction) =>
            transaction.status === "Pending" &&
            (transaction.type === "Borrow" || transaction.type === "Reservation"),
        )
        .sort(
          (left, right) =>
            new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime(),
        ),
      trending: await catalogRepository.getTrendingBooks(5),
      recentActivity: state.activities.slice(0, 8),
    };
  },

  async searchBooks(
    query: string,
    options: {
      department?: string;
      uploadedContext?: string;
      uploadedFileNames?: string[];
      limit?: number;
      includeArchived?: boolean;
    } = {},
  ) {
    return catalogRepository.searchBooks({
      query,
      department: options.department,
      uploadedContext: options.uploadedContext,
      uploadedFileNames: options.uploadedFileNames,
      limit: options.limit,
      includeArchived: options.includeArchived,
    });
  },

  async listBooks(search = "", department = "All", limit = 120, offset = 0, includeArchived = false) {
    return catalogRepository.listBooks({ search, department, limit, offset, includeArchived });
  },

  async addBook(
    input: Omit<BookRecord, "id" | "borrowCount" | "aiScore">,
    actor?: SessionUser | null,
  ) {
    const book = await catalogRepository.addBook(input);
    recordActivity(`Book added: ${book.title}`, "success");
    recordHistory({
      actor: actorLabel(actor),
      action: "Added new book",
      target: book.title,
      module: "Records",
      detail: `Catalog record created at shelf ${book.shelfLocation}.`,
    });
    return book;
  },

  async updateBook(id: string, updates: Partial<BookRecord>, actor?: SessionUser | null) {
    const book = await catalogRepository.updateBook(id, updates);
    if (!book) {
      return null;
    }

    recordActivity(`Book updated: ${book.title}`, "info");
    recordHistory({
      actor: actorLabel(actor),
      action: "Updated book metadata",
      target: book.title,
      module: "Records",
      detail: "Catalog metadata adjusted for discovery and circulation.",
    });
    return book;
  },

  async deleteBook(id: string, actor?: SessionUser | null) {
    const book = await catalogRepository.getBookById(id);
    if (!book) {
      return false;
    }

    if (!(await catalogRepository.deleteBook(id))) {
      return false;
    }

    recordActivity(`Book removed: ${book.title}`, "warning");
    recordHistory({
      actor: actorLabel(actor),
      action: "Deleted book record",
      target: book.title,
      module: "Records",
      detail: "Catalog record archived from active circulation.",
    });
    return true;
  },

  async archiveBook(id: string, actor?: SessionUser | null) {
    const book = await catalogRepository.getBookById(id);
    if (!book) {
      return false;
    }

    if (!(await catalogRepository.archiveBook(id))) {
      return false;
    }

    recordActivity(`Book archived: ${book.title}`, "warning");
    recordHistory({
      actor: actorLabel(actor),
      action: "Archived book record",
      target: book.title,
      module: "Records",
      detail: "Catalog record archived from active circulation.",
    });
    return true;
  },

  listTransactions(search = "", status = "All", type = "All") {
    return getState().transactions.filter((transaction) => {
      const matchesSearch =
        !search ||
        `${transaction.studentName} ${transaction.studentId} ${transaction.resourceTitle} ${transaction.isbn}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus = status === "All" || transaction.status === status;
      const matchesType = type === "All" || transaction.type === type;
      return matchesSearch && matchesStatus && matchesType;
    });
  },

  addTransaction(
    input: Omit<TransactionRecord, "id" | "requestedAt" | "dueDate">,
    actor?: SessionUser | null,
  ) {
    const state = getState();
    const transaction: TransactionRecord = {
      ...input,
      id: nextId("transactions", "txn"),
      requestedAt: new Date().toISOString(),
      dueDate:
        input.status === "Approved"
          ? new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
    };
    state.transactions.unshift(transaction);
    recordActivity(`${transaction.type} request created for ${transaction.studentName}`, "info");
    recordHistory({
      actor: actorLabel(actor),
      action: "Created transaction",
      target: transaction.studentName,
      module: "Transactions",
      detail: `${transaction.type} request opened for ${transaction.resourceTitle}.`,
    });
    return transaction;
  },

  updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    actor?: SessionUser | null,
  ) {
    const state = getState();
    const index = state.transactions.findIndex((transaction) => transaction.id === id);
    if (index === -1) {
      return { error: "Transaction not found." };
    }

    const transaction = state.transactions[index];

    if (status === "Approved" && transaction.type !== "Return") {
      const currentBorrows = activeBorrowsForStudent(transaction.studentId);
      if (currentBorrows >= state.settings.borrowLimit && transaction.status !== "Approved") {
        return { error: `Student already reached the ${state.settings.borrowLimit}-book limit.` };
      }
    }

    const dueDate =
      status === "Approved"
        ? new Date(
            Date.now() + state.settings.borrowDurationDays * 24 * 60 * 60 * 1000,
          ).toISOString()
        : status === "Returned"
          ? undefined
          : transaction.dueDate;

    state.transactions[index] = {
      ...transaction,
      status,
      dueDate,
      durationDays:
        status === "Approved" ? state.settings.borrowDurationDays : transaction.durationDays,
    };

    recordActivity(
      `${transaction.type} ${status.toLowerCase()} for ${transaction.studentId}`,
      status === "Declined" ? "warning" : "success",
    );
    recordHistory({
      actor: actorLabel(actor),
      action: `${status} transaction`,
      target: transaction.studentName,
      module: "Transactions",
      detail: `${transaction.resourceTitle} is now marked ${status}.`,
    });

    return { transaction: state.transactions[index] };
  },

  listHistory(search = "", module = "All") {
    return getState().history.filter((entry) => {
      const matchesSearch =
        !search ||
        `${entry.actor} ${entry.action} ${entry.target} ${entry.detail}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesModule = module === "All" || entry.module === module;
      return matchesSearch && matchesModule;
    });
  },

  listAnnouncements(search = "", audience = "All", status = "All") {
    return getState()
      .announcements.filter((announcement) => {
        const matchesSearch =
          !search ||
          `${announcement.title} ${announcement.content} ${announcement.author}`
            .toLowerCase()
            .includes(search.toLowerCase());
        const matchesAudience = audience === "All" || announcement.audience === audience;
        const matchesStatus =
          status === "All" ||
          (status === "Published" && announcement.published) ||
          (status === "Draft" && !announcement.published);
        return matchesSearch && matchesAudience && matchesStatus;
      })
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
  },

  addAnnouncement(input: AnnouncementInput, actor?: SessionUser | null) {
    const state = getState();
    const nowIso = new Date().toISOString();
    const announcement: AnnouncementRecord = {
      id: nextId("announcements", "ann"),
      author: actorName(actor),
      createdAt: nowIso,
      updatedAt: nowIso,
      ...input,
    };

    state.announcements.unshift(announcement);
    recordActivity(
      `${announcement.published ? "Announcement published" : "Announcement drafted"}: ${announcement.title}`,
      announcement.priority === "Urgent" ? "warning" : "success",
    );
    recordHistory({
      actor: actorLabel(actor),
      action: announcement.published ? "Published announcement" : "Created announcement",
      target: announcement.title,
      module: "Announcements",
      detail: `${announcement.audience} audience with ${announcement.priority.toLowerCase()} priority.`,
    });
    return announcement;
  },

  updateAnnouncement(
    id: string,
    updates: Partial<AnnouncementInput>,
    actor?: SessionUser | null,
  ) {
    const state = getState();
    const index = state.announcements.findIndex((announcement) => announcement.id === id);
    if (index === -1) {
      return null;
    }

    const current = state.announcements[index];
    const nextAnnouncement: AnnouncementRecord = {
      ...current,
      ...updates,
      author: actorName(actor),
      updatedAt: new Date().toISOString(),
    };
    state.announcements[index] = nextAnnouncement;

    const action =
      current.published !== nextAnnouncement.published && nextAnnouncement.published
        ? "Published announcement"
        : "Updated announcement";

    recordActivity(
      `${action}: ${nextAnnouncement.title}`,
      nextAnnouncement.priority === "Urgent" ? "warning" : "info",
    );
    recordHistory({
      actor: actorLabel(actor),
      action,
      target: nextAnnouncement.title,
      module: "Announcements",
      detail: `${nextAnnouncement.audience} audience with ${nextAnnouncement.priority.toLowerCase()} priority.`,
    });

    return nextAnnouncement;
  },

  deleteAnnouncement(id: string, actor?: SessionUser | null) {
    const state = getState();
    const announcement = state.announcements.find((item) => item.id === id);
    if (!announcement) {
      return false;
    }

    state.announcements = state.announcements.filter((item) => item.id !== id);
    recordActivity(`Announcement removed: ${announcement.title}`, "warning");
    recordHistory({
      actor: actorLabel(actor),
      action: "Deleted announcement",
      target: announcement.title,
      module: "Announcements",
      detail: "Notice removed from the active publishing queue.",
    });
    return true;
  },

  async getReports(): Promise<ReportsPayload> {
    try {
      const [
        trendRes,
        deptRes,
        topRes,
        statusRes,
        catRes,
        totalBooksRes,
        deptBorrowRes,
        collegeBorrowRes,
      ] = await Promise.all([
        pool.query(`
          SELECT
            to_char(date_trunc('month', requested_at), 'Mon') AS month,
            COUNT(*) FILTER (WHERE type = 'Borrow')::int AS borrows,
            COUNT(*) FILTER (WHERE type = 'Reservation')::int AS reservations,
            COUNT(*) FILTER (WHERE type = 'Return' OR status = 'Returned')::int AS returns
          FROM transactions
          GROUP BY date_trunc('month', requested_at)
          ORDER BY date_trunc('month', requested_at)
        `),
        catalogRepository.getDepartmentDistribution(),
        pool.query(`
          SELECT
            b_info.title,
            b_info.author,
            b_info.department,
            b_info.borrows
          FROM (
            SELECT
              COALESCE(b.title, t.resource_title) as title,
              COALESCE(b.author, 'STI Library Collection') as author,
              COALESCE(b.department, 'Circulation') as department,
              COUNT(t.id)::int as borrows,
              ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(COALESCE(b.title, t.resource_title))) ORDER BY COUNT(t.id) DESC) as rn
            FROM transactions t
            LEFT JOIN books b ON LOWER(TRIM(t.resource_title)) = LOWER(TRIM(b.title)) OR (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn = b.isbn)
            WHERE t.type::text IN ('Borrow', 'borrow')
            GROUP BY 1, 2, 3
          ) b_info
          WHERE b_info.rn = 1
          ORDER BY b_info.borrows DESC
          LIMIT 8
        `),
        pool.query(`
          SELECT 
            CASE 
              WHEN LOWER(type::text) = 'reservation' AND LOWER(status::text) IN ('pending', 'approved', 'active', 'waitlisted') THEN 'Reservations'
              WHEN LOWER(type::text) = 'borrow' AND LOWER(status::text) = 'pending' THEN 'Pending'
              WHEN LOWER(type::text) = 'borrow' AND LOWER(status::text) = 'approved' THEN 'Approved'
              WHEN LOWER(type::text) = 'borrow' AND LOWER(status::text) = 'returned' THEN 'Returned'
              WHEN LOWER(status::text) = 'declined' THEN 'Declined'
              WHEN LOWER(status::text) = 'cancelled' THEN 'Cancelled'
              ELSE status::text
            END as category,
            COUNT(*)::int as count
          FROM transactions
          GROUP BY 1
        `),
        pool.query(`
          SELECT category, COUNT(*)::int as count
          FROM books
          WHERE archived_at IS NULL AND category IS NOT NULL AND category != ''
          GROUP BY category
          ORDER BY count DESC
          LIMIT 6
        `),
        pool.query("SELECT COUNT(*)::int as total FROM books WHERE archived_at IS NULL"),
        pool.query(`
          SELECT 
            COALESCE(b.department, 'Circulation') as department,
            COUNT(t.id)::int as borrows
          FROM transactions t
          LEFT JOIN books b ON (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn = b.isbn) OR LOWER(TRIM(t.resource_title)) = LOWER(TRIM(b.title))
          WHERE t.type::text IN ('Borrow', 'borrow')
          GROUP BY 1
          ORDER BY borrows DESC
        `),
        pool.query(`
          SELECT 
            COALESCE(u.department, t.department) as college_dept,
            u.course,
            COUNT(t.id)::int as borrows
          FROM transactions t
          LEFT JOIN users u ON t.user_id = u.id
          WHERE t.type::text IN ('Borrow', 'borrow')
          GROUP BY 1, 2
        `),
      ]);

      const totalCatalogBooks = Number(totalBooksRes.rows[0]?.total || 0);

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const d = new Date();
      const paddedMonthly = [];
      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
        const mName = monthNames[targetDate.getMonth()];
        const found = trendRes.rows.find((r: any) => r.month?.toLowerCase() === mName.toLowerCase());
        paddedMonthly.push({
          month: mName,
          borrows: found ? Number(found.borrows) : 0,
          reservations: found ? Number(found.reservations) : 0,
          returns: found ? Number(found.returns) : 0,
        });
      }

      const statuses = ["Pending", "Approved", "Declined", "Returned", "Reservations"];
      const queueTxnCount = statuses.reduce((sum, s) => {
        const found = statusRes.rows.find((r: any) => r.category === s);
        return sum + (found ? Number(found.count) : 0);
      }, 0);

      const statusBreakdown = statuses.map((status) => {
        const found = statusRes.rows.find((r: any) => r.category === status);
        const count = found ? Number(found.count) : 0;
        const percentage = queueTxnCount > 0 ? Math.round((count / queueTxnCount) * 100) : 0;
        return { status, count, percentage };
      });

      const totalBorrows = paddedMonthly.reduce((acc, curr) => acc + curr.borrows, 0);
      const totalReturns = paddedMonthly.reduce((acc, curr) => acc + curr.returns, 0);

      const ALL_LIBRARY_DEPTS: Department[] = [
        "Circulation",
        "Filipiniana",
        "Special Collections",
        "General Reference",
        "Reserve",
        "Periodical",
      ];
      const deptLoansTotal = deptBorrowRes.rows.reduce((sum: number, r: any) => sum + Number(r.borrows || 0), 0);
      const departmentLoans = ALL_LIBRARY_DEPTS.map((dept) => {
        const found = deptBorrowRes.rows.find((r: any) => r.department?.toLowerCase() === dept.toLowerCase());
        const borrows = found ? Number(found.borrows) : 0;
        return {
          department: dept,
          borrows,
          percentage: deptLoansTotal > 0 ? Math.round((borrows / deptLoansTotal) * 100) : 0,
        };
      });

      const STANDARDIZED_COLLEGES = [
        { code: "CICT", name: "CICT", mascot: "Red Sentinels", color: "#EF4444" },
        { code: "COE", name: "COE", mascot: "Orange Erudites", color: "#FF6B00" },
        { code: "CBMA", name: "CBMA", mascot: "Yellow Tycoons", color: "#EAB308" },
        { code: "CAS", name: "CAS", mascot: "Green Titans", color: "#10B981" },
        { code: "CED", name: "CED", mascot: "Blue Guardians", color: "#3B82F6" },
        { code: "CHTM", name: "CHTM", mascot: "Pink Vikings", color: "#EC4899" },
        { code: "CCJE", name: "CCJE", mascot: "Purple Wizards", color: "#8B5CF6" },
      ];

      function resolveCollege(str?: string | null): string {
        if (!str) return "CICT";
        const s = String(str).toUpperCase().trim();
        if (s.includes("CICT") || s.includes("INFORMATION") || s.includes("BSIT") || s.includes("CS") || s.includes("TECH") || s.includes("TIME TRAVEL") || s.includes("COMPUTER")) return "CICT";
        if (s.includes("COE") || s.includes("ENGINEERING") || s.includes("BSCE") || s.includes("CPE") || s.includes("CIVIL") || s.includes("ELECTRICAL") || s.includes("MECHANICAL")) return "COE";
        if (s.includes("CBMA") || s.includes("BUSINESS") || s.includes("ACCOUNTANCY") || s.includes("BSA") || s.includes("BSBA") || s.includes("MANAGEMENT") || s.includes("MARKETING")) return "CBMA";
        if (s.includes("CAS") || s.includes("ARTS") || s.includes("SCIENCES") || s.includes("COMM") || s.includes("BACOMM") || s.includes("PSYCH") || s.includes("POLITICAL")) return "CAS";
        if (s.includes("CED") || s.includes("EDUCATION") || s.includes("BSED") || s.includes("BEED") || s.includes("TEACHER")) return "CED";
        if (s.includes("CHTM") || s.includes("HOSPITALITY") || s.includes("TOURISM") || s.includes("BSTM") || s.includes("BSHM") || s.includes("HOTEL") || s.includes("RESTAURANT")) return "CHTM";
        if (s.includes("CCJE") || s.includes("CRIMINAL") || s.includes("JUSTICE") || s.includes("CRIM") || s.includes("BSCRIM") || s.includes("LAW ENFORCEMENT")) return "CCJE";
        return "CICT";
      }

      const collegeCounts: Record<string, number> = {
        CICT: 0, COE: 0, CBMA: 0, CAS: 0, CED: 0, CHTM: 0, CCJE: 0,
      };

      collegeBorrowRes.rows.forEach((r: any) => {
        const code = resolveCollege(r.college_dept) || resolveCollege(r.course) || "CICT";
        const count = Number(r.borrows || 0);
        if (collegeCounts[code] !== undefined) {
          collegeCounts[code] += count;
        }
      });

      const totalCollegeBorrows = Object.values(collegeCounts).reduce((a, b) => a + b, 0);
      const collegeLoans = STANDARDIZED_COLLEGES.map((c) => ({
        ...c,
        borrows: collegeCounts[c.code] || 0,
        percentage: totalCollegeBorrows > 0 ? Math.round(((collegeCounts[c.code] || 0) / totalCollegeBorrows) * 100) : 0,
      }));

      return {
        monthlyBorrowing: paddedMonthly,
        departmentUsage: deptRes,
        departmentLoans,
        collegeLoans,
        topBorrowed: topRes.rows.map((book: any) => ({
          title: book.title,
          author: book.author || "STI Faculty / Author",
          department: book.department || "Circulation",
          borrows: Number(book.borrows || 0),
        })),
        statusBreakdown,
        categoryDistribution: catRes.rows.map((r: any) => ({
          category: r.category,
          count: Number(r.count || 0),
        })),
        velocityMetrics: {
          totalCirculationActions: queueTxnCount,
          totalBorrows,
          totalReturns,
          returnRatePercent: totalBorrows > 0 ? Math.min(100, Math.round((totalReturns / totalBorrows) * 100)) : 100,
          totalCatalogBooks,
        },
      };
    } catch (e) {
      console.warn("store.getReports DB query notice, using memory state:", e);
    }

    const state = getState();
    const departmentUsage = await catalogRepository.getDepartmentDistribution();
    const topTrending = await catalogRepository.getTrendingBooks(5);

    const STANDARDIZED_COLLEGES = [
      { code: "CICT", name: "CICT", mascot: "Red Sentinels", color: "#EF4444" },
      { code: "COE", name: "COE", mascot: "Orange Erudites", color: "#FF6B00" },
      { code: "CBMA", name: "CBMA", mascot: "Yellow Tycoons", color: "#EAB308" },
      { code: "CAS", name: "CAS", mascot: "Green Titans", color: "#10B981" },
      { code: "CED", name: "CED", mascot: "Blue Guardians", color: "#3B82F6" },
      { code: "CHTM", name: "CHTM", mascot: "Pink Vikings", color: "#EC4899" },
      { code: "CCJE", name: "CCJE", mascot: "Purple Wizards", color: "#8B5CF6" },
    ];

    function resolveCollegeFallback(str?: string | null): string {
      if (!str) return "CICT";
      const s = String(str).toUpperCase().trim();
      if (s.includes("CICT") || s.includes("INFORMATION") || s.includes("BSIT") || s.includes("CS") || s.includes("TECH") || s.includes("TIME TRAVEL") || s.includes("COMPUTER")) return "CICT";
      if (s.includes("COE") || s.includes("ENGINEERING") || s.includes("BSCE") || s.includes("CPE") || s.includes("CIVIL") || s.includes("ELECTRICAL") || s.includes("MECHANICAL")) return "COE";
      if (s.includes("CBMA") || s.includes("BUSINESS") || s.includes("ACCOUNTANCY") || s.includes("BSA") || s.includes("BSBA") || s.includes("MANAGEMENT") || s.includes("MARKETING")) return "CBMA";
      if (s.includes("CAS") || s.includes("ARTS") || s.includes("SCIENCES") || s.includes("COMM") || s.includes("BACOMM") || s.includes("PSYCH") || s.includes("POLITICAL")) return "CAS";
      if (s.includes("CED") || s.includes("EDUCATION") || s.includes("BSED") || s.includes("BEED") || s.includes("TEACHER")) return "CED";
      if (s.includes("CHTM") || s.includes("HOSPITALITY") || s.includes("TOURISM") || s.includes("BSTM") || s.includes("BSHM") || s.includes("HOTEL") || s.includes("RESTAURANT")) return "CHTM";
      if (s.includes("CCJE") || s.includes("CRIMINAL") || s.includes("JUSTICE") || s.includes("CRIM") || s.includes("BSCRIM") || s.includes("LAW ENFORCEMENT")) return "CCJE";
      return "CICT";
    }

    const fallbackCollegeCounts: Record<string, number> = {
      CICT: 0, COE: 0, CBMA: 0, CAS: 0, CED: 0, CHTM: 0, CCJE: 0,
    };
    state.transactions.filter((item) => (item.type || "").toLowerCase() === "borrow").forEach((tx) => {
      const code = resolveCollegeFallback(tx.department);
      if (fallbackCollegeCounts[code] !== undefined) {
        fallbackCollegeCounts[code]++;
      }
    });
    const fallbackTotalCollegeBorrows = Object.values(fallbackCollegeCounts).reduce((a, b) => a + b, 0);
    const fallbackCollegeLoans = STANDARDIZED_COLLEGES.map((c) => ({
      ...c,
      borrows: fallbackCollegeCounts[c.code] || 0,
      percentage: fallbackTotalCollegeBorrows > 0 ? Math.round(((fallbackCollegeCounts[c.code] || 0) / fallbackTotalCollegeBorrows) * 100) : 0,
    }));

    const ALL_LIBRARY_DEPTS: Department[] = [
      "Circulation",
      "Filipiniana",
      "Special Collections",
      "General Reference",
      "Reserve",
      "Periodical",
    ];
    const deptBorrowMap: Record<string, number> = {
      Circulation: 0,
      Filipiniana: 0,
      "Special Collections": 0,
      "General Reference": 0,
      Reserve: 0,
      Periodical: 0,
    };
    state.transactions.filter((item) => (item.type || "").toLowerCase() === "borrow").forEach((tx) => {
      const dept = tx.department || "Circulation";
      if (deptBorrowMap[dept] !== undefined) {
        deptBorrowMap[dept]++;
      }
    });
    const fallbackBorrowsTotal = Object.values(deptBorrowMap).reduce((a, b) => a + b, 0);
    const fallbackDeptLoans = ALL_LIBRARY_DEPTS.map((dept) => ({
      department: dept,
      borrows: deptBorrowMap[dept] || 0,
      percentage: fallbackBorrowsTotal > 0 ? Math.round(((deptBorrowMap[dept] || 0) / fallbackBorrowsTotal) * 100) : 0,
    }));

    return {
      monthlyBorrowing: [
        { month: "Jan", borrows: 340, reservations: 112 },
        { month: "Feb", borrows: 396, reservations: 128 },
        { month: "Mar", borrows: 441, reservations: 165 },
        { month: "Apr", borrows: 489, reservations: 180 },
        { month: "May", borrows: 521, reservations: 191 },
        { month: "Jun", borrows: 548, reservations: 205 },
      ],
      departmentUsage,
      departmentLoans: fallbackDeptLoans,
      collegeLoans: fallbackCollegeLoans,
      topBorrowed: topTrending.map((book) => ({ title: book.title, borrows: book.borrowCount })),
      statusBreakdown: [
        {
          status: "Pending",
          count: state.transactions.filter((item) => (item.type || "").toLowerCase() === "borrow" && item.status === "Pending").length,
        },
        {
          status: "Approved",
          count: state.transactions.filter((item) => (item.type || "").toLowerCase() === "borrow" && item.status === "Approved").length,
        },
        {
          status: "Declined",
          count: state.transactions.filter((item) => item.status === "Declined").length,
        },
        {
          status: "Returned",
          count: state.transactions.filter((item) => (item.type || "").toLowerCase() === "borrow" && item.status === "Returned").length,
        },
        {
          status: "Reservations",
          count: state.transactions.filter((item) => (item.type || "").toLowerCase() === "reservation" && ["Pending", "Approved", "Active", "Waitlisted"].includes(item.status)).length,
        },
      ],
    };
  },

  getSettings() {
    return getState().settings;
  },

  updateSettings(updates: Partial<SystemPreference>, actor?: SessionUser | null) {
    const state = getState();
    state.settings = { ...state.settings, ...updates };
    recordActivity("System preferences updated", "success");
    recordHistory({
      actor: actorLabel(actor),
      action: "Updated settings",
      target: "System Preferences",
      module: "Settings",
      detail: "Borrow limits and platform defaults were synchronized.",
    });
    return state.settings;
  },

  listUsers(search = "", role = "All") {
    return getState().users.filter((user) => {
      const matchesSearch =
        !search ||
        `${user.name} ${user.email} ${user.department} ${user.role}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesRole = role === "All" || user.role === role;
      return matchesSearch && matchesRole;
    });
  },

  addUser(input: Omit<SystemUser, "id" | "lastActive">, actor?: SessionUser | null) {
    const state = getState();
    const user: SystemUser = {
      ...input,
      id: nextId("users", "user"),
      lastActive: new Date().toISOString(),
    };
    state.users.unshift(user);
    recordActivity(`Account created for ${user.name}`, "success");
    recordHistory({
      actor: actorLabel(actor),
      action: "Created account",
      target: user.name,
      module: "Accounts",
      detail: `${user.role} access provisioned for ${user.department}.`,
    });
    return user;
  },

  updateUser(id: string, updates: Partial<SystemUser>, actor?: SessionUser | null) {
    const state = getState();
    const index = state.users.findIndex((user) => user.id === id);
    if (index === -1) {
      return null;
    }

    state.users[index] = { ...state.users[index], ...updates };
    recordActivity(`Account updated for ${state.users[index].name}`, "info");
    recordHistory({
      actor: actorLabel(actor),
      action: "Updated account",
      target: state.users[index].name,
      module: "Accounts",
      detail: "Role or access status modified.",
    });
    return state.users[index];
  },

  deleteUser(id: string, actor?: SessionUser | null) {
    const state = getState();
    const user = state.users.find((item) => item.id === id);
    if (!user) {
      return false;
    }

    state.users = state.users.filter((item) => item.id !== id);
    recordActivity(`Account removed for ${user.name}`, "warning");
    recordHistory({
      actor: actorLabel(actor),
      action: "Deleted account",
      target: user.name,
      module: "Accounts",
      detail: "User access revoked from the dashboard.",
    });
    return true;
  },
};

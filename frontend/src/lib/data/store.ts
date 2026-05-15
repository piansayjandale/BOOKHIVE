import { catalogRepository } from "@/lib/catalog/repository";
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
    } = {},
  ) {
    return catalogRepository.searchBooks({
      query,
      department: options.department,
      uploadedContext: options.uploadedContext,
      uploadedFileNames: options.uploadedFileNames,
      limit: options.limit,
    });
  },

  async listBooks(search = "", department = "All", limit = 120, offset = 0) {
    return catalogRepository.listBooks({ search, department, limit, offset });
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
    const state = getState();

    const departmentUsage = await catalogRepository.getDepartmentDistribution();
    const topTrending = await catalogRepository.getTrendingBooks(5);

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
      topBorrowed: topTrending.map((book) => ({ title: book.title, borrows: book.borrowCount })),
      statusBreakdown: [
        {
          status: "Pending",
          count: state.transactions.filter((item) => item.status === "Pending").length,
        },
        {
          status: "Approved",
          count: state.transactions.filter((item) => item.status === "Approved").length,
        },
        {
          status: "Returned",
          count: state.transactions.filter((item) => item.status === "Returned").length,
        },
        {
          status: "Declined",
          count: state.transactions.filter((item) => item.status === "Declined").length,
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

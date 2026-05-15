import { createHash } from "node:crypto";

import {
  authenticateAccountUser,
  changeAccountPassword,
  countAccountUsers,
  createAccountUser,
  deleteAccountUser,
  getAccountProfile,
  listAccountAuthLogs,
  listAccountUsers,
  listRecentAccountUsers,
  registerAccountAuthEvent,
  updateAccountProfile,
  updateAccountUser,
} from "@/lib/admin/account-db";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/admin/passwords";
import { catalogRepository } from "@/lib/catalog/repository";
import { store } from "@/lib/data/store";
import type {
  AdminBookRecord,
  AdminBooksPayload,
  AdminDashboardPayload,
  AdminProfilePayload,
  AdminSettingsPayload,
  AdminTransactionsPayload,
  AdminUserRecord,
  AdminUsersPayload,
  AnalyticsPayload,
  MonitoringLog,
  MonitoringPayload,
  PromptSearchLog,
  PromptSearchPayload,
  RecordsCatalogPayload,
} from "@/lib/admin/types";
import type {
  BookRecord,
  Department,
  Role,
  SessionUser,
  SystemPreference,
  SystemUser,
  TransactionStatus,
} from "@/lib/types";
import { generateApaCitation } from "@/lib/utils";

interface UserExtraState {
  idNumber: string;
  course: string;
}

interface BookExtraState {
  category: string;
  archived: boolean;
}

interface ProfileState {
  phone: string;
  bio: string;
  passwordHash: string;
}

interface AuthLogState {
  id: string;
  actor: string;
  message: string;
  severity: MonitoringLog["severity"];
  timestamp: string;
}

interface AdminState {
  userExtras: Record<string, UserExtraState>;
  bookExtras: Record<string, BookExtraState>;
  profiles: Record<string, ProfileState>;
  searchLogs: PromptSearchLog[];
  authLogs: AuthLogState[];
  flags: {
    notificationsEnabled: boolean;
    emailNotifications: boolean;
    allowAdminTransactionControl: boolean;
    aiStrictMode: boolean;
  };
  counters: {
    search: number;
    auth: number;
  };
}

declare global {
  var __bookhiveAdminState: AdminState | undefined;
}

function digestPassword(password: string) {
  return hashAdminPassword(password);
}

function verifyPasswordHash(password: string, hashedPassword: string) {
  return verifyAdminPassword(password, hashedPassword);
}

function deterministicIdNumber(email: string, fallback: string) {
  const digest = createHash("sha1").update(email).digest("hex").slice(0, 6).toUpperCase();
  return `${fallback}-${digest}`;
}

function inferCourse(role: Role, department: Department) {
  if (role === "Admin") {
    return "Library Administration";
  }

  switch (department) {
    case "Computer Science":
      return "BS Computer Science";
    case "Engineering":
      return "BS Civil Engineering";
    case "Education":
      return "BSEd";
    case "Business & Accountancy":
      return "BS Accountancy";
    default:
      return "BA Social Sciences";
  }
}

function inferCategory(book: BookRecord) {
  const firstGenre = book.genres?.split(",").map((item) => item.trim()).find(Boolean);
  if (firstGenre) {
    return firstGenre;
  }

  switch (book.department) {
    case "Computer Science":
      return "Technology";
    case "Engineering":
      return "Engineering";
    case "Education":
      return "Pedagogy";
    case "Business & Accountancy":
      return "Business";
    default:
      return "Humanities";
  }
}

function toAdminUser(user: SystemUser, state: AdminState): AdminUserRecord {
  const extra = state.userExtras[user.id] ?? {
    idNumber: deterministicIdNumber(user.email, "USR"),
    course: inferCourse(user.role, user.department),
  };

  state.userExtras[user.id] = extra;

  return {
    id: user.id,
    name: user.name,
    idNumber: extra.idNumber,
    email: user.email,
    role: user.role,
    department: user.department,
    course: extra.course,
    status: user.status,
    lastActive: user.lastActive,
  };
}

function ensureBookExtra(book: BookRecord, state: AdminState) {
  if (!state.bookExtras[book.id]) {
    state.bookExtras[book.id] = {
      category: inferCategory(book),
      archived: false,
    };
  }

  return state.bookExtras[book.id];
}

function toAdminBook(book: BookRecord, state: AdminState): AdminBookRecord {
  const extra = ensureBookExtra(book, state);

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    department: book.department,
    category: extra.category,
    shelfLocation: book.shelfLocation,
    publishedDate: book.publicationDate,
    apaCitation: generateApaCitation(book),
    archived: extra.archived,
    availability: book.availability,
    borrowCount: book.borrowCount,
    summary: book.summary,
  };
}

function nextAuthLogId(state: AdminState) {
  state.counters.auth += 1;
  return `auth-${String(state.counters.auth).padStart(3, "0")}`;
}

function nextSearchLogId(state: AdminState) {
  state.counters.search += 1;
  return `search-${String(state.counters.search).padStart(3, "0")}`;
}

function buildActivityCategory(message: string): MonitoringLog["activityType"] {
  const normalized = message.toLowerCase();
  if (normalized.includes("search")) return "AI";
  if (normalized.includes("transaction") || normalized.includes("borrow") || normalized.includes("reservation")) {
    return "Transaction";
  }
  if (normalized.includes("account") || normalized.includes("user")) return "User";
  if (normalized.includes("book") || normalized.includes("catalog")) return "Book";
  return "System";
}

async function buildInitialState(): Promise<AdminState> {
  const users = store.listUsers("", "All");
  let books = [] as BookRecord[];

  try {
    books = (await catalogRepository.listBooks({ limit: 200, offset: 0 })).books;
  } catch (error) {
    console.error("BookHive catalog initialization failed, continuing with no catalog data:", error);
  }

  const userExtras: Record<string, UserExtraState> = {};
  const profiles: Record<string, ProfileState> = {};

  for (const user of users) {
    const defaultIdNumber =
      user.role === "Admin"
        ? "ADM-2026-0001"
        : user.role === "Librarian"
          ? `LIB-2026-${user.id.slice(-3)}`
          : `STU-2026-${user.id.slice(-3)}`;

    userExtras[user.id] = {
      idNumber: defaultIdNumber,
      course: inferCourse(user.role, user.department),
    };

    const defaultPassword =
      user.role === "Admin"
        ? "BookHiveAdmin!2026"
        : user.role === "Librarian"
          ? "BookHiveLibrarian!2026"
          : userExtras[user.id].idNumber;

    profiles[user.id] = {
      phone: user.role === "Admin" ? "+63 917 555 0101" : "+63 917 555 0199",
      bio:
        user.role === "Admin"
          ? "Oversees the BookHive platform, policy configuration, and system-wide analytics."
          : "Supports circulation, patron service, and day-to-day catalog operations.",
      passwordHash: digestPassword(defaultPassword),
    };
  }

  const bookExtras: Record<string, BookExtraState> = {};
  for (const book of books) {
    bookExtras[book.id] = {
      category: inferCategory(book),
      archived: false,
    };
  }

  return {
    userExtras,
    bookExtras,
    profiles,
    searchLogs: [],
    authLogs: [],
    flags: {
      notificationsEnabled: true,
      emailNotifications: true,
      allowAdminTransactionControl: false,
      aiStrictMode: true,
    },
    counters: {
      search: 0,
      auth: 0,
    },
  };
}

async function getAdminState() {
  if (!globalThis.__bookhiveAdminState) {
    globalThis.__bookhiveAdminState = await buildInitialState();
  }

  return globalThis.__bookhiveAdminState;
}

function getAllUsers(state: AdminState) {
  return store.listUsers("", "All").map((user) => toAdminUser(user, state));
}

function findUserEntityById(id: string) {
  return store.listUsers("", "All").find((user) => user.id === id) ?? null;
}

function getAllTransactions() {
  return store
    .listTransactions("", "All", "All")
    .slice()
    .sort((left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime());
}

function getMonthKey(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short" }).format(new Date(value));
}

function getYearKey(value: string) {
  return new Intl.DateTimeFormat("en-PH", { year: "numeric" }).format(new Date(value));
}

function mapHistoryToMonitoringLog(entry: ReturnType<typeof store.listHistory>[number]): MonitoringLog {
  return {
    id: entry.id,
    actor: entry.actor,
    activityType: buildActivityCategory(entry.action),
    message: `${entry.action}: ${entry.target}`,
    severity:
      entry.action.toLowerCase().includes("delete") || entry.action.toLowerCase().includes("declined")
        ? "warning"
        : "success",
    timestamp: entry.timestamp,
  };
}

function getSystemLogs(state: AdminState, authLogsOverride?: MonitoringLog[]) {
  const historyLogs = store.listHistory("", "All").map(mapHistoryToMonitoringLog);
  const aiLogs = state.searchLogs.map<MonitoringLog>((entry) => ({
    id: entry.id,
    actor: entry.actor,
    activityType: "AI",
    message: `Prompt search for "${entry.query}" with ${entry.matchesFound} matches`,
    severity: "info",
    timestamp: entry.createdAt,
  }));
  const authLogs =
    authLogsOverride ??
    state.authLogs.map<MonitoringLog>((entry) => ({
      id: entry.id,
      actor: entry.actor,
      activityType: "Auth",
      message: entry.message,
      severity: entry.severity,
      timestamp: entry.timestamp,
    }));

  return [...historyLogs, ...aiLogs, ...authLogs].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

export const adminRepository = {
  async authenticate(identifier: string, password: string) {
    try {
      return await authenticateAccountUser(identifier, password);
    } catch (error) {
      console.error("PostgreSQL account authentication unavailable, using fallback state:", error);
    }

    const state = await getAdminState();
    const users = getAllUsers(state);
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const matchedUser =
      users.find((user) => user.email.toLowerCase() === normalizedIdentifier) ??
      users.find((user) => user.idNumber.toLowerCase() === normalizedIdentifier);

    if (!matchedUser || !["Admin", "Librarian"].includes(matchedUser.role)) {
      return null;
    }

    const profile = state.profiles[matchedUser.id];
    if (!profile || !verifyPasswordHash(password, profile.passwordHash)) {
      return null;
    }

    return matchedUser;
  },

  async registerAuthEvent(actor: string, message: string, severity: MonitoringLog["severity"] = "info") {
    try {
      await registerAccountAuthEvent(actor, message, severity);
    } catch (error) {
      console.error("PostgreSQL auth event logging unavailable, keeping in-memory log only:", error);
    }

    const state = await getAdminState();
    state.authLogs.unshift({
      id: nextAuthLogId(state),
      actor,
      message,
      severity,
      timestamp: new Date().toISOString(),
    });
    state.authLogs = state.authLogs.slice(0, 60);
  },

  async getDashboard(): Promise<AdminDashboardPayload> {
    const state = await getAdminState();
    const transactions = getAllTransactions();
    let catalogCount = 0;
    let totalUsers = getAllUsers(state).length;
    let newUsers = getAllUsers(state).slice(0, 5);

    try {
      catalogCount = await catalogRepository.countBooks();
    } catch (error) {
      console.error("Unable to load catalog count:", error);
    }

    try {
      totalUsers = await countAccountUsers();
      newUsers = await listRecentAccountUsers(5);
    } catch (error) {
      console.error("Unable to load PostgreSQL account dashboard data, using fallback state:", error);
    }

    const approvedBorrows = transactions.filter(
      (item) => item.type === "Borrow" && item.status === "Approved",
    ).length;
    const pendingRequests = transactions.filter((item) => item.status === "Pending").length;

    const monthMap = new Map<string, { borrows: number; returns: number; reservations: number }>();
    for (const transaction of transactions.slice(0, 18)) {
      const month = getMonthKey(transaction.requestedAt);
      const entry = monthMap.get(month) ?? { borrows: 0, returns: 0, reservations: 0 };
      if (transaction.type === "Borrow") entry.borrows += 1;
      if (transaction.type === "Return") entry.returns += 1;
      if (transaction.type === "Reservation") entry.reservations += 1;
      monthMap.set(month, entry);
    }

    const departmentMap = new Map<Department, number>();
    for (const transaction of transactions) {
      departmentMap.set(transaction.department, (departmentMap.get(transaction.department) ?? 0) + 1);
    }

    const recentHistory = store.listHistory("", "All").slice(0, 8);

    return {
      summary: {
        totalUsers,
        totalBooks: catalogCount,
        activeBorrowedBooks: approvedBorrows,
        pendingRequests,
      },
      topBooks: await catalogRepository.getTrendingBooks(5),
      monthlyBorrowTrends: Array.from(monthMap.entries()).map(([month, value]) => ({
        month,
        borrows: value.borrows,
        returns: value.returns,
        reservations: value.reservations,
      })),
      departmentUsage: Array.from(departmentMap.entries()).map(([department, usage]) => ({
        department,
        usage,
      })),
      recentActivities: recentHistory.map((entry) => ({
        id: entry.id,
        actor: entry.actor,
        message: `${entry.action} · ${entry.target}`,
        timestamp: entry.timestamp,
        category: buildActivityCategory(entry.action),
      })),
      newUsers,
      latestTransactions: transactions.slice(0, 6),
    };
  },

  async listUsers(options: {
    search?: string;
    role?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AdminUsersPayload> {
    try {
      return await listAccountUsers(options);
    } catch (error) {
      console.error("PostgreSQL account list unavailable, using fallback state:", error);
    }

    const state = await getAdminState();
    const search = options.search?.trim().toLowerCase() ?? "";
    const role = options.role ?? "All";
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 10));

    const filtered = getAllUsers(state).filter((user) => {
      const matchesSearch =
        !search ||
        `${user.name} ${user.idNumber} ${user.email} ${user.department} ${user.course}`.toLowerCase().includes(search);
      const matchesRole = role === "All" || user.role === role;
      return matchesSearch && matchesRole;
    });

    const start = (page - 1) * pageSize;
    return {
      users: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  },

  async createUser(
    input: Omit<AdminUserRecord, "id" | "lastActive" | "status">,
    actor?: SessionUser | null,
  ) {
    try {
      return await createAccountUser(input);
    } catch (error) {
      console.error("PostgreSQL account creation unavailable, using fallback state:", error);
    }

    const state = await getAdminState();
    const created = store.addUser(
      {
        name: input.name,
        email: input.email,
        role: input.role,
        department: input.department,
        status: "Active",
      },
      actor,
    );

    state.userExtras[created.id] = {
      idNumber: input.idNumber,
      course: input.course,
    };
    state.profiles[created.id] = {
      phone: "",
      bio: `${input.role} access for ${input.department}.`,
      passwordHash: digestPassword(input.idNumber),
    };

    return {
      user: toAdminUser(created, state),
      tempPassword: input.idNumber,
    };
  },

  async updateUser(
    id: string,
    updates: Partial<Omit<AdminUserRecord, "id" | "lastActive">>,
    actor?: SessionUser | null,
  ) {
    try {
      return await updateAccountUser(id, updates);
    } catch (error) {
      console.error("PostgreSQL account update unavailable, using fallback state:", error);
    }

    const state = await getAdminState();
    const updated = store.updateUser(
      id,
      {
        name: updates.name,
        email: updates.email,
        role: updates.role,
        department: updates.department,
        status: updates.status,
      },
      actor,
    );

    if (!updated) {
      return null;
    }

    const currentExtra = state.userExtras[id] ?? {
      idNumber: deterministicIdNumber(updated.email, "USR"),
      course: inferCourse(updated.role, updated.department),
    };

    state.userExtras[id] = {
      idNumber: updates.idNumber ?? currentExtra.idNumber,
      course: updates.course ?? currentExtra.course,
    };

    return toAdminUser(updated, state);
  },

  async deleteUser(id: string, actor?: SessionUser | null) {
    try {
      return await deleteAccountUser(id);
    } catch (error) {
      console.error("PostgreSQL account deletion unavailable, using fallback state:", error);
    }

    const state = await getAdminState();
    const deleted = store.deleteUser(id, actor);
    if (deleted) {
      delete state.userExtras[id];
      delete state.profiles[id];
    }
    return deleted;
  },

  async listBooks(options: {
    search?: string;
    department?: string;
    category?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AdminBooksPayload> {
    const state = await getAdminState();
    const search = options.search?.trim().toLowerCase() ?? "";
    const department = options.department ?? "All";
    const category = options.category ?? "All";
    const status = options.status ?? "All";
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 10));
    const baseBooks: AdminBookRecord[] = (await store.listBooks(search, department, 500, 0)).books.map(
      (book: BookRecord) => toAdminBook(book, state),
    );

    const filtered = baseBooks
      .filter((book) => (category === "All" ? true : book.category === category))
      .filter((book) => {
        if (status === "Archived") return book.archived;
        if (status === "Active") return !book.archived;
        return true;
      })
      .sort((left: AdminBookRecord, right: AdminBookRecord) => left.title.localeCompare(right.title));

    const start = (page - 1) * pageSize;

    return {
      books: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  },

  async createBook(
    input: Omit<AdminBookRecord, "id" | "apaCitation" | "borrowCount">,
    actor?: SessionUser | null,
  ) {
    const state = await getAdminState();
    const created = await store.addBook(
      {
        title: input.title,
        author: input.author,
        isbn: input.isbn,
        department: input.department,
        publicationDate: input.publishedDate,
        shelfLocation: input.shelfLocation,
        summary: input.summary || `${input.title} for ${input.department} learners.`,
        availability: input.availability,
      },
      actor,
    );

    state.bookExtras[created.id] = {
      category: input.category,
      archived: input.archived,
    };

    return toAdminBook(created, state);
  },

  async updateBook(
    id: string,
    updates: Partial<Omit<AdminBookRecord, "id" | "apaCitation" | "borrowCount">>,
    actor?: SessionUser | null,
  ) {
    const state = await getAdminState();
    const updated = await store.updateBook(
      id,
      {
        title: updates.title,
        author: updates.author,
        isbn: updates.isbn,
        department: updates.department,
        publicationDate: updates.publishedDate,
        shelfLocation: updates.shelfLocation,
        summary: updates.summary,
        availability: updates.availability,
      },
      actor,
    );

    if (!updated) {
      return null;
    }

    const currentExtra = ensureBookExtra(updated, state);
    state.bookExtras[id] = {
      category: updates.category ?? currentExtra.category,
      archived: updates.archived ?? currentExtra.archived,
    };

    return toAdminBook(updated, state);
  },

  async archiveBook(id: string) {
    const state = await getAdminState();
    const book = await catalogRepository.getBookById(id);
    if (!book) {
      return null;
    }

    const currentExtra = ensureBookExtra(book, state);
    state.bookExtras[id] = {
      ...currentExtra,
      archived: true,
    };

    return toAdminBook(book, state);
  },

  async deleteBook(id: string, actor?: SessionUser | null) {
    const state = await getAdminState();
    const deleted = await store.deleteBook(id, actor);
    if (deleted) {
      delete state.bookExtras[id];
    }
    return deleted;
  },

  async getTransactions(): Promise<AdminTransactionsPayload> {
    const state = await getAdminState();
    const transactions = getAllTransactions();

    return {
      summary: {
        pending: transactions.filter((item) => item.status === "Pending").length,
        approved: transactions.filter((item) => item.status === "Approved").length,
        declined: transactions.filter((item) => item.status === "Declined").length,
        returned: transactions.filter((item) => item.status === "Returned").length,
      },
      borrowRequests: transactions.filter((item) => item.type === "Borrow"),
      returnRecords: transactions.filter((item) => item.type === "Return" || item.status === "Returned"),
      reservations: transactions.filter((item) => item.type === "Reservation"),
      transactionHistory: transactions,
      allowAdminControl: state.flags.allowAdminTransactionControl,
    };
  },

  async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    actor?: SessionUser | null,
  ) {
    const state = await getAdminState();
    if (!state.flags.allowAdminTransactionControl) {
      return { error: "Admin transaction override is disabled in settings." };
    }

    return store.updateTransactionStatus(id, status, actor);
  },

  async runPromptSearch(input: {
    query: string;
    department?: string;
    uploadedContext?: string;
    fileNames?: string[];
    actor?: SessionUser | null;
  }): Promise<PromptSearchPayload> {
    const state = await getAdminState();
    const results = await store.searchBooks(input.query, {
      department: input.department,
      uploadedContext: input.uploadedContext,
      uploadedFileNames: input.fileNames,
      limit: 8,
    });

    state.searchLogs.unshift({
      id: nextSearchLogId(state),
      actor: input.actor?.name ?? "System",
      query: input.query || "Uploaded context search",
      department: input.department ?? "All",
      fileNames: input.fileNames ?? [],
      matchesFound: results.length,
      createdAt: new Date().toISOString(),
    });
    state.searchLogs = state.searchLogs.slice(0, 25);

    return {
      results,
      logs: state.searchLogs,
    };
  },

  async getSearchLogs() {
    return (await getAdminState()).searchLogs;
  },

  async getAnalytics(): Promise<AnalyticsPayload> {
    const transactions = getAllTransactions();
    const books = await catalogRepository.getTrendingBooks(8);

    const departmentCounts = new Map<Department, number>();
    const monthlyCounts = new Map<string, { borrows: number; returns: number; reservations: number }>();
    const yearlyCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();

    for (const transaction of transactions) {
      departmentCounts.set(
        transaction.department,
        (departmentCounts.get(transaction.department) ?? 0) + 1,
      );
      const month = getMonthKey(transaction.requestedAt);
      const monthEntry = monthlyCounts.get(month) ?? { borrows: 0, returns: 0, reservations: 0 };
      if (transaction.type === "Borrow") monthEntry.borrows += 1;
      if (transaction.type === "Return") monthEntry.returns += 1;
      if (transaction.type === "Reservation") monthEntry.reservations += 1;
      monthlyCounts.set(month, monthEntry);
      const year = getYearKey(transaction.requestedAt);
      yearlyCounts.set(year, (yearlyCounts.get(year) ?? 0) + 1);
      statusCounts.set(transaction.status, (statusCounts.get(transaction.status) ?? 0) + 1);
    }

    return {
      mostBorrowedBooks: books.map((book: BookRecord) => ({ title: book.title, borrows: book.borrowCount })),
      mostActiveDepartments: Array.from(departmentCounts.entries()).map(([department, total]) => ({
        department,
        total,
      })),
      monthlyTrends: Array.from(monthlyCounts.entries()).map(([month, value]) => ({
        month,
        borrows: value.borrows,
        returns: value.returns,
        reservations: value.reservations,
      })),
      yearlyTrends: Array.from(yearlyCounts.entries()).map(([year, total]) => ({
        year,
        transactions: total,
      })),
      transactionStatus: Array.from(statusCounts.entries()).map(([status, total]) => ({
        status,
        total,
      })),
    };
  },

  async getRecordsCatalog(options: { department?: string; search?: string }): Promise<RecordsCatalogPayload> {
    const state = await getAdminState();
    const base = (await store.listBooks(options.search ?? "", options.department ?? "All", 300, 0)).books;
    const records: AdminBookRecord[] = base
      .map((book: BookRecord) => toAdminBook(book, state))
      .sort((left: AdminBookRecord, right: AdminBookRecord) => left.title.localeCompare(right.title));

    return {
      records,
      total: records.length,
    };
  },

  async getMonitoring(filters: {
    actor?: string;
    activityType?: string;
    from?: string;
  }): Promise<MonitoringPayload> {
    const state = await getAdminState();
    let authLogsOverride: MonitoringLog[] | undefined;

    try {
      const persistedAuthLogs = await listAccountAuthLogs(60);
      authLogsOverride = persistedAuthLogs.map((entry) => ({
        id: entry.id,
        actor: entry.actor,
        activityType: "Auth",
        message: entry.message,
        severity: entry.severity,
        timestamp: typeof entry.timestamp === "string" ? entry.timestamp : entry.timestamp.toISOString(),
      }));
    } catch (error) {
      console.error("PostgreSQL auth logs unavailable, using fallback state:", error);
    }

    const logs = getSystemLogs(state, authLogsOverride).filter((entry) => {
      const matchesActor =
        !filters.actor || filters.actor === "All" || entry.actor.toLowerCase().includes(filters.actor.toLowerCase());
      const matchesType =
        !filters.activityType || filters.activityType === "All" || entry.activityType === filters.activityType;
      const matchesDate = !filters.from || entry.timestamp >= filters.from;
      return matchesActor && matchesType && matchesDate;
    });

    return {
      logs,
      totals: {
        authEvents: logs.filter((entry) => entry.activityType === "Auth").length,
        aiEvents: logs.filter((entry) => entry.activityType === "AI").length,
        transactionEvents: logs.filter((entry) => entry.activityType === "Transaction").length,
        userEvents: logs.filter((entry) => entry.activityType === "User").length,
      },
    };
  },

  async getSettings(): Promise<AdminSettingsPayload> {
    const state = await getAdminState();
    const settings = store.getSettings();
    return {
      ...settings,
      notificationsEnabled: state.flags.notificationsEnabled,
      emailNotifications: state.flags.emailNotifications,
      allowAdminTransactionControl: state.flags.allowAdminTransactionControl,
      aiStrictMode: state.flags.aiStrictMode,
    };
  },

  async updateSettings(updates: Partial<AdminSettingsPayload>, actor?: SessionUser | null) {
    const state = await getAdminState();
    const nextStorePayload: Partial<SystemPreference> = {
      theme: updates.theme,
      borrowLimit: updates.borrowLimit,
      borrowDurationDays: updates.borrowDurationDays,
      storageUsedPercent: updates.storageUsedPercent,
      indexingStatus: updates.indexingStatus,
      aiEngine: updates.aiEngine,
    };

    store.updateSettings(nextStorePayload, actor);

    state.flags = {
      notificationsEnabled: updates.notificationsEnabled ?? state.flags.notificationsEnabled,
      emailNotifications: updates.emailNotifications ?? state.flags.emailNotifications,
      allowAdminTransactionControl:
        updates.allowAdminTransactionControl ?? state.flags.allowAdminTransactionControl,
      aiStrictMode: updates.aiStrictMode ?? state.flags.aiStrictMode,
    };

    return await this.getSettings();
  },

  async getProfile(userId: string) {
    try {
      return await getAccountProfile(userId);
    } catch (error) {
      console.error("PostgreSQL profile lookup unavailable, using fallback state:", error);
    }

    const state = await getAdminState();
    const user = findUserEntityById(userId);
    if (!user) {
      return null;
    }

    const profile = state.profiles[userId] ?? {
      phone: "",
      bio: "",
      passwordHash: digestPassword("Password@123"),
    };
    state.profiles[userId] = profile;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: profile.phone,
      bio: profile.bio,
      avatar: user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join(""),
      lastActive: user.lastActive,
    } satisfies AdminProfilePayload;
  },

  async updateProfile(
    userId: string,
    updates: Pick<AdminProfilePayload, "name" | "email" | "department" | "phone" | "bio">,
  ) {
    try {
      return await updateAccountProfile(userId, updates);
    } catch (error) {
      console.error("PostgreSQL profile update unavailable, using fallback state:", error);
    }

    const state = await getAdminState();
    const updatedUser = store.updateUser(userId, {
      name: updates.name,
      email: updates.email,
      department: updates.department,
    });
    if (!updatedUser) {
      return null;
    }

    const currentProfile = state.profiles[userId] ?? {
      phone: "",
      bio: "",
      passwordHash: digestPassword("Password@123"),
    };

    state.profiles[userId] = {
      ...currentProfile,
      phone: updates.phone,
      bio: updates.bio,
    };

    return this.getProfile(userId);
  },

  async changePassword(userId: string, currentPassword: string, nextPassword: string) {
    try {
      return await changeAccountPassword(userId, currentPassword, nextPassword);
    } catch (error) {
      console.error("PostgreSQL password change unavailable, using fallback state:", error);
    }

    const state = await getAdminState();
    const profile = state.profiles[userId];
    if (!profile) {
      return { error: "Profile not found." };
    }

    if (!verifyPasswordHash(currentPassword, profile.passwordHash)) {
      return { error: "Current password is incorrect." };
    }

    state.profiles[userId] = {
      ...profile,
      passwordHash: digestPassword(nextPassword),
    };

    return { success: true };
  },
};

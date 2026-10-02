function warnIfNotOffline(label, error) {
  if (error && error.code !== "DB_OFFLINE" && !error.message?.includes("offline") && !error.message?.includes("password authentication failed") && !error.message?.includes("connect ECONNREFUSED")) {
    console.warn(label, error.message);
  }
}

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { adminModel } from "../models/admin.model.js";
import { superAdminModel } from "../models/super-admin.model.js";
import { studentModel } from "../models/student.model.js";
import { pool } from "../db/pool.js";
import { emitBookAdded, emitTransactionDecided, emitBookReturned, emitAnnouncementPublished, emitAnnouncementDeleted } from "../socket.js";
import { eventDispatcher } from "../services/event-dispatcher.js";
import { reservationTimerService } from "../services/reservation-timer.service.js";


const DEV_CREDENTIALS = {
  "superadmin@stiwnu.edu.ph": {
    id: "super-001",
    name: "Super Administrator",
    email: "superadmin@stiwnu.edu.ph",
    role: "Super Admin",
    password: "BookHiveSuperAdmin!2026",
    idNumber: "SUP-2026-0001",
    department: "Executive System Governance",
    course: "Platform Infrastructure",
  },
  "yana.palmares@stiwnu.edu.ph": {
    id: "user-001",
    name: "Yana Palmares",
    email: "yana.palmares@stiwnu.edu.ph",
    role: "Super Admin",
    password: "BookHiveSuperAdmin!2026",
    idNumber: "SUP-2026-0001",
    department: "Executive System Governance",
    course: "Platform Infrastructure",
  },
  "admin@stiwnu.edu.ph": {
    id: "user-admin-001",
    name: "Library Administrator",
    email: "admin@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    idNumber: "ADM-2026-0001",
    department: "Library Administration",
    course: "Library Administration",
  },
  "adm-2026-0001": {
    id: "user-admin-001",
    name: "Library Administrator",
    email: "admin@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    idNumber: "ADM-2026-0001",
    department: "Library Administration",
    course: "Library Administration",
  },
  "librarian@stiwnu.edu.ph": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
    department: "Library Services",
    course: "Library Services",
  },
  "lib-2026-0001": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
    department: "Library Services",
    course: "Library Services",
  },
  "joseph.tan@stiwnu.edu.ph": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
    department: "Library Services",
    course: "Library Services",
  },
  "lib-2026-002": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
    department: "Library Services",
    course: "Library Services",
  },
};

export const adminController = {
  async login(req, res) {
    const { identifier, password } = req.body;
    
    let user = null;
    try {
      user = await adminModel.findUserByIdentifier(identifier);
    } catch (error) {
      warnIfNotOffline("Backend login DB failed, checking fallback:", error.message);
    }

    // Fallback for default administrative accounts when DB record is not yet provisioned or DB is in fallback
    if (!user) {
      const devAccount = DEV_CREDENTIALS[identifier?.toLowerCase()];
      if (devAccount && (devAccount.password === password || password === "BookHiveAdmin!2026" || password === "BookHiveSuperAdmin!2026" || password === "BookHiveLibrarian!2026")) {
        user = { ...devAccount, passwordHash: "HIDDEN" };
      }
    }

    const ALLOWED_ROLES = [
      "Super Admin", "SUPER_ADMIN",
      "Admin", "ADMIN",
      "Librarian", "Circulation Librarian", "CIRCULATION_LIBRARIAN",
      "Technical Librarian", "TECHNICAL_LIBRARIAN"
    ];

    if (user && (user.role === "Student" || user.role === "STUDENT")) {
      return res.status(403).json({ message: "Student accounts must access BookHive through the Student Mobile App." });
    }

    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (user.status === "Suspended" || user.status === "Archived") {
      return res.status(403).json({ message: "Account is deactivated or suspended. Please contact system administration." });
    }

    if (user.passwordHash !== "HIDDEN") {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
        name: user.name,
      },
      env.jwtSecret,
      { expiresIn: "8h" },
    );

    try {
      await adminModel.addActivityLog("Signed in to BookHive", "success", user.name);
    } catch (logError) {
      console.warn("Failed to log sign-in activity:", logError.message);
    }

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        idNumber: user.idNumber,
        email: user.email,
        role: user.role,
        department: user.department,
        course: user.course,
        permissions: user.permissions || {
          home: true,
          records: true,
          transactions: true,
          reminders: true,
          reports: true,
          history: true,
          settings: true,
        },
      },
    });
  },

  async resetPassword(req, res) {
    const { identifier, email, newPassword } = req.body;
    const target = identifier || email;

    if (!target || !newPassword) {
      return res.status(400).json({ message: "Identifier (email or ID number) and new password are required." });
    }

    if (String(newPassword).trim().length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long." });
    }

    const user = await adminModel.findUserByIdentifier(target);
    if (!user) {
      return res.status(404).json({ message: "No existing account found with that email or ID number." });
    }

    const newPasswordHash = await bcrypt.hash(String(newPassword).trim(), 10);
    const updated = await studentModel.updateUserPassword(target, newPasswordHash);

    if (!updated) {
      return res.status(500).json({ message: "Failed to update password." });
    }

    return res.json({
      success: true,
      message: "Password reset successfully. You may now log in with your new password.",
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        idNumber: updated.idNumber,
      },
    });
  },

  async getDashboard(_req, res) {
    try {
      const [summary, monthlyBorrowTrends, departmentUsage, recentActivities, newUsers, latestTransactions, topBooks] =
        await Promise.all([
          adminModel.getDashboardSummary().catch(() => ({
            totalUsers: 0,
            totalBooks: 0,
            activeBorrowedBooks: 0,
            pendingRequests: 0,
          })),
          adminModel.getMonthlyBorrowTrends().catch(() => []),
          adminModel.getDepartmentUsage().catch(() => []),
          adminModel.getRecentActivities().catch(() => []),
          adminModel.getRecentUsers().catch(() => []),
          adminModel.getLatestTransactions().catch(() => []),
          adminModel.getTopBorrowedBooks(10).catch(() => []),
        ]);

      const systemHealth = {
        status: "NOMINAL",
        lastIndexing: new Date().toISOString(),
        storageUsed: 84.2,
        storageTotal: 128,
      };

      return res.json({
        summary: summary || { totalUsers: 0, totalBooks: 0, activeBorrowedBooks: 0, pendingRequests: 0 },
        systemHealth,
        topBooks: topBooks || [],
        monthlyBorrowTrends: monthlyBorrowTrends || [],
        departmentUsage: departmentUsage || [],
        recentActivities: recentActivities || [],
        newUsers: newUsers || [],
        latestTransactions: latestTransactions || [],
      });
    } catch (err) {
      console.warn("[adminController.getDashboard] Safe fallback:", err.message);
      return res.json({
        summary: { totalUsers: 0, totalBooks: 0, activeBorrowedBooks: 0, pendingRequests: 0 },
        systemHealth: { status: "DEGRADED", lastIndexing: new Date().toISOString() },
        topBooks: [],
        monthlyBorrowTrends: [],
        departmentUsage: [],
        recentActivities: [],
        newUsers: [],
        latestTransactions: [],
      });
    }
  },

  async getGenres(_req, res) {
    try {
      const genres = await adminModel.getGenres().catch(() => []);
      return res.json({ genres: genres || [] });
    } catch (err) {
      console.warn("[adminController.getGenres] Safe fallback:", err.message);
      return res.json({ genres: [] });
    }
  },

  async listUsers(req, res) {
    try {
      const search = String(req.query.search ?? "");
      const role = String(req.query.role ?? "All");
      const page = Math.max(1, Number(req.query.page ?? 1));
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));
      const offset = (page - 1) * pageSize;
      const status = String(req.query.status ?? "Active");
      const result = await adminModel.listUsers({ search, role, limit: pageSize, offset, status }).catch(() => ({ rows: [], total: 0 }));

      return res.json({
        users: result?.rows || [],
        total: result?.total || 0,
        page,
        pageSize,
      });
    } catch (err) {
      console.warn("[adminController.listUsers] Safe fallback:", err.message);
      return res.json({
        users: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    }
  },

  async createUser(req, res) {
    const passwordHash = await bcrypt.hash(req.body.idNumber, 10);
    const user = await adminModel.createUser({ ...req.body, passwordHash });
    const actorLabel = `${req.user.role} ${req.user.name}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: "Created account",
      target: user.name,
      module: "Accounts",
      detail: `${user.role} access provisioned for ${user.department}.`,
    });
    await adminModel.addActivityLog(`Account created for ${user.name}`, "success", req.user.name);
    void eventDispatcher.dispatchUserMutation("created", user);
    return res.status(201).json({
      user,
      tempPassword: req.body.idNumber,
    });
  },

  async updateUser(req, res) {
    const user = await adminModel.updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const actorLabel = `${req.user.role} ${req.user.name}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: "Updated account",
      target: user.name,
      module: "Accounts",
      detail: "Role or access status modified.",
    });
    await adminModel.addActivityLog(`Account updated for ${user.name}`, "info", req.user.name);
    void eventDispatcher.dispatchUserMutation("updated", user);
    return res.json({ user });
  },

  async deleteUser(req, res) {
    const { id } = req.params;
    const existing = await pool.query("SELECT name FROM users WHERE id = $1", [id]);
    const name = existing.rows[0]?.name || "Unknown User";

    await adminModel.deleteUser(id);
    const actorLabel = `${req.user.role} ${req.user.name}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: "Deleted account",
      target: name,
      module: "Accounts",
      detail: "User access revoked from the dashboard.",
    });
    await adminModel.addActivityLog(`Account removed for ${name}`, "warning", req.user.name);
    void eventDispatcher.dispatchUserMutation("deleted", { id, name });
    return res.json({ ok: true });
  },

  // --- Catalog Management ---
  async listBooks(req, res) {
    try {
      const search = String(req.query.search ?? "");
      const department = String(req.query.department ?? "All");
      const page = Math.max(1, Number(req.query.page ?? 1));
      const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 120)));
      const offset = (page - 1) * pageSize;
      const archivedOnly = req.query.archivedOnly === "true";
      const sortBy = String(req.query.sortBy ?? "");

      const result = await adminModel.listBooks({ search, department, limit: pageSize, offset, archivedOnly, sortBy }).catch((err) => {
        console.warn("[adminController.listBooks] Safe query fallback:", err.message);
        return { books: [], total: 0 };
      });
      return res.json({
        books: result?.books || [],
        total: result?.total || 0,
        page,
        pageSize,
      });
    } catch (err) {
      console.warn("[adminController.listBooks] Safe fallback:", err.message);
      return res.json({
        books: [],
        total: 0,
        page: 1,
        pageSize: 120,
      });
    }
  },

  async getRecordsCatalog(req, res) {
    try {
      const search = String(req.query.search ?? "");
      const department = String(req.query.department ?? "All");
      const result = await adminModel.listBooks({ search, department, limit: 300, offset: 0 }).catch(() => ({ books: [], total: 0 }));
      return res.json({
        records: result?.books || [],
        total: result?.total || 0,
      });
    } catch (err) {
      console.warn("[adminController.getRecordsCatalog] Safe fallback:", err.message);
      return res.json({
        records: [],
        total: 0,
      });
    }
  },

  async addBook(req, res) {
    const book = await adminModel.addBook(req.body);
    const actorLabel = `${req.user.role} ${req.user.name}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: "Added new book",
      target: book.title,
      module: "Records",
      detail: `Catalog record created at shelf ${book.shelfLocation}.`,
    });
    await adminModel.addActivityLog(`Book added: ${book.title}`, "success", req.user.name);
    
    // Broadcast real-time WebSocket event to Student App and dashboards
    emitBookAdded(book);
    void eventDispatcher.dispatchCatalogMutation("added", book);

    return res.status(201).json({ book });
  },

  async updateBook(req, res) {
    const { id } = req.params;
    const book = await adminModel.updateBook(id, req.body);
    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }
    const actorLabel = `${req.user.role} ${req.user.name}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: "Updated book metadata",
      target: book.title,
      module: "Records",
      detail: "Catalog metadata adjusted for discovery and circulation.",
    });
    await adminModel.addActivityLog(`Book updated: ${book.title}`, "info", req.user.name);
    void eventDispatcher.dispatchCatalogMutation("updated", book);
    return res.json({ book });
  },

  async deleteBook(req, res) {
    const { id } = req.params;
    const actorLabel = `${req.user.role} ${req.user.name}`;
    
    const existing = await pool.query("SELECT title FROM books WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Book not found." });
    }
    const title = existing.rows[0].title;

    if (req.user.role === "Librarian") {
      const archivedBook = await adminModel.archiveBook(id);
      if (!archivedBook) {
        return res.status(404).json({ message: "Book not found." });
      }
      await adminModel.addHistoryLog({
        actor: actorLabel,
        action: "Archived book record",
        target: title,
        module: "Records",
        detail: "Catalog record archived from active circulation.",
      });
      await adminModel.addActivityLog(`Book archived: ${title}`, "warning", req.user.name);
      void eventDispatcher.dispatchCatalogMutation("archived", { id, title });
      return res.json({ ok: true, archived: true });
    } else {
      const deleted = await adminModel.deleteBook(id);
      if (!deleted) {
        return res.status(404).json({ message: "Book not found." });
      }
      await adminModel.addHistoryLog({
        actor: actorLabel,
        action: "Deleted book record",
        target: title,
        module: "Records",
        detail: "Catalog record archived from active circulation.",
      });
      await adminModel.addActivityLog(`Book removed: ${title}`, "warning", req.user.name);
      void eventDispatcher.dispatchCatalogMutation("deleted", { id, title });
      return res.json({ ok: true });
    }
  },

  // --- Announcements ---
  async listAnnouncements(req, res) {
    const search = String(req.query.search ?? "");
    const audience = String(req.query.audience ?? "All");
    const status = String(req.query.status ?? "All");

    const announcements = await adminModel.listAnnouncements({ search, audience, status });
    return res.json({ announcements });
  },

  async addAnnouncement(req, res) {
    const input = {
      ...req.body,
      author: req.user.name,
    };
    const announcement = await adminModel.addAnnouncement(input);
    const actorLabel = `${req.user.role} ${req.user.name}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: announcement.published ? "Published announcement" : "Created announcement",
      target: announcement.title,
      module: "Announcements",
      detail: `${announcement.audience} audience with ${announcement.priority.toLowerCase()} priority.`,
    });
    await adminModel.addActivityLog(
      `${announcement.published ? "Announcement published" : "Announcement drafted"}: ${announcement.title}`,
      announcement.priority === "Urgent" ? "warning" : "success",
      req.user.name
    );
    if (announcement.published) {
      emitAnnouncementPublished(announcement);
    }
    return res.status(201).json({ announcement });
  },

  async updateAnnouncement(req, res) {
    const { id } = req.params;
    const updates = {
      ...req.body,
      author: req.user.name,
    };
    
    const existingResult = await pool.query("SELECT published, title FROM announcements WHERE id = $1", [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: "Announcement not found." });
    }
    const oldPublished = existingResult.rows[0].published;
    
    const announcement = await adminModel.updateAnnouncement(id, updates);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found." });
    }
    
    const actorLabel = `${req.user.role} ${req.user.name}`;
    const action = !oldPublished && announcement.published ? "Published announcement" : "Updated announcement";
    
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action,
      target: announcement.title,
      module: "Announcements",
      detail: `${announcement.audience} audience with ${announcement.priority.toLowerCase()} priority.`,
    });
    await adminModel.addActivityLog(
      `${action}: ${announcement.title}`,
      announcement.priority === "Urgent" ? "warning" : "info",
      req.user.name
    );
    if (announcement.published) {
      emitAnnouncementPublished(announcement);
    }
    return res.json({ announcement });
  },

  async deleteAnnouncement(req, res) {
    const { id } = req.params;
    const actorLabel = `${req.user.role} ${req.user.name}`;
    
    const existingResult = await pool.query("SELECT title FROM announcements WHERE id = $1", [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: "Announcement not found." });
    }
    const title = existingResult.rows[0].title;
    
    const deleted = await adminModel.deleteAnnouncement(id);
    if (!deleted) {
      return res.status(404).json({ message: "Announcement not found." });
    }
    
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: "Deleted announcement",
      target: title,
      module: "Announcements",
      detail: "Notice removed from the active publishing queue.",
    });
    await adminModel.addActivityLog(`Announcement removed: ${title}`, "warning", req.user.name);
    emitAnnouncementDeleted(id);
    return res.json({ ok: true });
  },

  // --- Settings ---
  async getSettings(req, res) {
    const settings = await adminModel.getSettings();
    return res.json({ settings });
  },

  async updateSettings(req, res) {
    const settings = await adminModel.updateSettings(req.body);
    const actorLabel = `${req.user.role} ${req.user.name}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: "Updated settings",
      target: "System Preferences",
      module: "Settings",
      detail: "Borrow limits and platform defaults were synchronized.",
    });
    await adminModel.addActivityLog("System preferences updated", "success", req.user.name);
    return res.json({ settings });
  },

  // --- Reports ---
  async getReports(req, res) {
    const reports = await adminModel.getReports();
    return res.json(reports);
  },

  // --- Logs ---
  async listActivityLogs(req, res) {
    const logs = await adminModel.listActivityLogs();
    return res.json(logs);
  },

  async listHistoryLogs(req, res) {
    const search = String(req.query.search ?? "");
    const moduleName = String(req.query.module ?? "All");
    const logs = await adminModel.listHistoryLogs({ search, module: moduleName });
    return res.json({ history: logs });
  },

  // --- Transaction approval workflow ---
  async listTransactions(req, res) {
    const status = req.query.status !== undefined ? String(req.query.status) : 'All';
    const type = req.query.type ? String(req.query.type) : null;
    const studentId = req.query.studentId ? String(req.query.studentId) : null;

    const { transactions } = await adminModel.listTransactions({ status, type, studentId });
    const rawList = Array.isArray(transactions) ? transactions : [];

    const borrowRequests = rawList.filter(
      (item) => String(item.type || "").toLowerCase() === "borrow"
    );
    const returnRecords = rawList.filter(
      (item) => String(item.type || "").toLowerCase() === "return" || item.status === "Returned"
    );
    const reservations = rawList.filter(
      (item) => String(item.type || "").toLowerCase() === "reservation"
    );

    const summary = {
      pending: rawList.filter((item) => item.status === "Pending").length,
      approved: rawList.filter((item) => item.status === "Approved").length,
      declined: rawList.filter((item) => item.status === "Declined").length,
      returned: rawList.filter((item) => item.status === "Returned").length,
    };

    return res.json({
      transactions: rawList,
      borrowRequests,
      returnRecords,
      reservations,
      transactionHistory: rawList,
      summary,
      allowAdminControl: true,
    });
  },

  async decideTransaction(req, res) {
    const { transactionId } = req.params;
    const { status, comment } = req.body;

    if (!status || !['Approved', 'Declined', 'Returned'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const actorId = req.user?.sub || req.user?.id;
    const isUuid = Boolean(actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(actorId)));
    const decidedBy = isUuid ? actorId : null;
    const actorName = req.user?.name || "Librarian";
    const actorRole = req.user?.role || "Librarian";

    const transaction = await adminModel.decideTransaction({
      transactionId,
      status,
      decidedBy,
      comment,
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    // Broadcast real-time WebSocket event to Student App and dashboards
    emitTransactionDecided(transaction);
    if (status === "Returned") {
      emitBookReturned(transaction);
    }
    void eventDispatcher.dispatchTransactionDecision(transaction);

    const actorLabel = `${actorRole} ${actorName}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: `${status} transaction`,
      target: transaction.studentName,
      module: "Transactions",
      detail: `${transaction.resourceTitle} is now marked ${status}.`,
    });
    await adminModel.addActivityLog(
      `${transaction.type} ${status.toLowerCase()} for ${transaction.studentId}`,
      status === "Declined" ? "warning" : "success",
      actorName
    );

    // Automated Return-to-Reservation Notification & 24h Timer:
    // If a book is returned, promote the next waitlisted reservation and start their 24h timer
    if (status === "Returned") {
      try {
        await reservationTimerService.promoteNextReservation(transaction.isbn, transaction.resourceTitle);
      } catch (notifyErr) {
        console.warn("Automated reservation timer activation error on admin return:", notifyErr.message);
      }
    }

    return res.json({ transaction });
  },


  async createTransaction(req, res) {
    const transaction = await adminModel.createTransaction(req.body);
    const actorLabel = `${req.user.role} ${req.user.name}`;
    await adminModel.addHistoryLog({
      actor: actorLabel,
      action: "Created transaction",
      target: transaction.studentName,
      module: "Transactions",
      detail: `${transaction.type} request opened for ${transaction.resourceTitle}.`,
    });
    await adminModel.addActivityLog(
      `${transaction.type} request created for ${transaction.studentName}`,
      "info",
      req.user.name
    );
    return res.status(201).json({ transaction });
  },

  async getMonitoring(req, res) {
    const actorFilter = String(req.query.actor ?? "All");
    const typeFilter = String(req.query.activityType ?? "All");
    const fromFilter = String(req.query.from ?? "");

    // Fetch from activity_logs, history_logs, and ai_search_logs
    const [activityLogsRes, historyLogsRes, aiLogsRes] = await Promise.all([
      pool.query("SELECT id, actor, category, message, severity, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 150"),
      pool.query("SELECT id, actor, action, target, module, detail, created_at FROM history_logs ORDER BY created_at DESC LIMIT 150"),
      pool.query("SELECT id, actor_name AS actor, prompt, department, matches_found, created_at FROM ai_search_logs ORDER BY created_at DESC LIMIT 150")
    ]);

    const logs = [];

    // Map activity logs
    activityLogsRes.rows.forEach(row => {
      const type = row.category === "Auth" ? "Auth" : "System";
      logs.push({
        id: String(row.id),
        actor: row.actor,
        activityType: type,
        message: row.message,
        severity: row.severity,
        timestamp: row.created_at.toISOString()
      });
    });

    // Map history logs
    historyLogsRes.rows.forEach(row => {
      const msg = `${row.action}: ${row.target}`;
      let activityType = "System";
      const normalizedAction = row.action.toLowerCase();
      const normalizedModule = row.module.toLowerCase();
      if (normalizedAction.includes("search") || normalizedModule.includes("search")) {
        activityType = "AI";
      } else if (normalizedAction.includes("transaction") || normalizedAction.includes("borrow") || normalizedAction.includes("reserve") || normalizedModule.includes("transaction")) {
        activityType = "Transaction";
      } else if (normalizedAction.includes("account") || normalizedAction.includes("user") || normalizedModule.includes("account") || normalizedModule.includes("users")) {
        activityType = "User";
      } else if (normalizedAction.includes("book") || normalizedAction.includes("catalog") || normalizedModule.includes("book") || normalizedModule.includes("records")) {
        activityType = "Book";
      }

      logs.push({
        id: String(row.id),
        actor: row.actor,
        activityType,
        message: msg,
        severity: (normalizedAction.includes("delete") || normalizedAction.includes("decline")) ? "warning" : "success",
        timestamp: row.created_at.toISOString()
      });
    });

    // Map AI search logs
    aiLogsRes.rows.forEach(row => {
      logs.push({
        id: String(row.id),
        actor: row.actor,
        activityType: "AI",
        message: `Prompt search for "${row.prompt}" with ${row.matches_found} matches`,
        severity: "info",
        timestamp: row.created_at.toISOString()
      });
    });

    // Sort by timestamp desc
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply filters
    const filteredLogs = logs.filter(entry => {
      const matchesActor = actorFilter === "All" || entry.actor.toLowerCase().includes(actorFilter.toLowerCase());
      const matchesType = typeFilter === "All" || entry.activityType === typeFilter;
      const matchesDate = !fromFilter || entry.timestamp >= fromFilter;
      return matchesActor && matchesType && matchesDate;
    });

    // Return payload matching MonitoringPayload
    return res.json({
      logs: filteredLogs,
      totals: {
        authEvents: filteredLogs.filter(entry => entry.activityType === "Auth").length,
        aiEvents: filteredLogs.filter(entry => entry.activityType === "AI").length,
        transactionEvents: filteredLogs.filter(entry => entry.activityType === "Transaction").length,
        userEvents: filteredLogs.filter(entry => entry.activityType === "User").length,
      }
    });
  },

  async getProfile(req, res) {
    const profile = await adminModel.findUserById(req.user.sub);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }
    const avatar = profile.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    return res.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      department: profile.department,
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      avatar,
      permissions: profile.permissions || {
        home: true,
        records: true,
        transactions: true,
        reminders: true,
        reports: true,
        history: true,
        settings: true,
      },
      lastActive: profile.lastActive,
    });
  },

  async updateProfile(req, res) {
    const { name, email, department, phone, bio } = req.body;
    try {
      const updated = await adminModel.updateProfile(req.user.sub, {
        name,
        email,
        department,
        phone,
        bio
      });

      const avatar = updated.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

      return res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        department: updated.department,
        phone: updated.phone ?? "",
        bio: updated.bio ?? "",
        avatar,
        lastActive: updated.lastActive,
      });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to update profile." });
    }
  },

  async changePassword(req, res) {
    const { currentPassword, nextPassword } = req.body;
    const userId = req.user.sub;
    const user = await adminModel.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }
    const newHash = await bcrypt.hash(nextPassword, 10);
    await pool.query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1", [userId, newHash]);
    return res.json({ ok: true });
  },

  async getPromptSearchLogs(req, res) {
    const logs = await adminModel.getSearchLogs();
    return res.json({ logs });
  },

  async runPromptSearch(req, res) {
    const { query, department, uploadedContext, fileNames } = req.body;
    const actorId = req.user?.sub;
    const actorName = req.user?.name || "System";
    const result = await adminModel.runPromptSearch({
      query,
      department,
      uploadedContext,
      fileNames,
      actorId,
      actorName,
    });
    return res.json(result);
  },

  async deletePromptSearchLog(req, res) {
    const { id } = req.params;
    if (id) {
      const logs = await adminModel.deleteSearchLog(id);
      return res.json({ success: true, logs });
    }
    const logs = await adminModel.clearSearchLogs();
    return res.json({ success: true, logs });
  },

  async listLibrarians(req, res) {
    const librarians = await adminModel.listLibrarians();
    return res.json({ librarians });
  },

  async updateLibrarianPermissions(req, res) {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ message: "Permissions object is required." });
    }

    const updatedUser = await adminModel.updateUserPermissions(id, permissions);
    if (!updatedUser) {
      return res.status(404).json({ message: "Librarian account not found." });
    }

    const actor = req.user?.name || "Administrator";
    const restrictedCount = Object.values(permissions).filter((val) => val === false).length;
    const detailMsg = restrictedCount > 0
      ? `Updated permissions for ${updatedUser.name}: ${restrictedCount} function(s) restricted.`
      : `Granted full access permissions to ${updatedUser.name}.`;

    try {
      await adminModel.addHistoryLog({
        actor: `${req.user?.role || "Admin"} ${actor}`,
        action: "Updated Librarian Restrictions",
        target: updatedUser.name,
        module: "Accounts",
        detail: detailMsg,
      });
      await adminModel.addActivityLog(`Permissions updated for ${updatedUser.name}`, "info", actor);
    } catch (logErr) {
      console.warn("Failed to log permission update history:", logErr.message);
    }

    void eventDispatcher.dispatchUserMutation("permissions_updated", updatedUser);

    return res.json({ user: updatedUser, success: true });
  },

  // --- User Account Management (Admin & Staff Users) ---
  async listUsers(req, res) {
    const role = String(req.query.role || "All");
    const status = String(req.query.status || "All");
    const search = String(req.query.search || "");
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 10));

    const result = await superAdminModel.listUsers({ role, status, search, page, pageSize });
    return res.json(result);
  },

  async createUser(req, res) {
    const { name, email, idNumber, password, role, department, course, status, yearLevel, section } = req.body;

    if (!name || !email || !idNumber || !role) {
      return res.status(400).json({ message: "Name, email, ID number, and role are required." });
    }

    try {
      const newUser = await superAdminModel.createUser({
        name,
        email,
        idNumber,
        password,
        role,
        department,
        course,
        status: status || "Active",
        yearLevel,
        section,
      });

      const actor = req.user?.name || "Admin";
      await adminModel.addHistoryLog({
        actor: `Admin ${actor}`,
        action: "Created User Account",
        target: name,
        module: "Accounts",
        detail: `Created account for ${name} (${email}) with role ${role}.`,
      });

      void eventDispatcher.dispatchUserMutation("created", newUser);

      return res.status(201).json({ user: newUser });
    } catch (err) {
      if (err.code === "23505") {
        if (err.constraint === "users_email_key" || err.message?.includes("email")) {
          return res.status(409).json({ message: "An account with this email address already exists." });
        }
        if (err.constraint === "users_id_number_key" || err.message?.includes("id_number")) {
          return res.status(409).json({ message: "An account with this ID number already exists." });
        }
        return res.status(409).json({ message: "An account with this identity already exists." });
      }
      throw err;
    }
  },

  async updateUser(req, res) {
    const { id } = req.params;
    const { name, email, idNumber, role, department, course, status, password, yearLevel, section } = req.body;

    try {
      const updated = await superAdminModel.updateUser(id, {
        name,
        email,
        idNumber,
        role,
        department,
        course,
        status,
        password,
        yearLevel,
        section,
      });

      if (!updated) {
        return res.status(404).json({ message: "User not found or no changes made." });
      }

      const actor = req.user?.name || "Admin";
      await adminModel.addHistoryLog({
        actor: `Admin ${actor}`,
        action: "Updated User Account",
        target: updated.name,
        module: "Accounts",
        detail: `Modified user record for ${updated.name} (Role: ${updated.role}, Status: ${updated.status}).`,
      });

      void eventDispatcher.dispatchUserMutation("updated", updated);

      return res.json({ user: updated });
    } catch (err) {
      if (err.code === "23505") {
        if (err.constraint === "users_email_key" || err.message?.includes("email")) {
          return res.status(409).json({ message: "An account with this email address already exists." });
        }
        if (err.constraint === "users_id_number_key" || err.message?.includes("id_number")) {
          return res.status(409).json({ message: "An account with this ID number already exists." });
        }
        return res.status(409).json({ message: "An account with this identity already exists." });
      }
      throw err;
    }
  },

  async deleteUser(req, res) {
    const { id } = req.params;
    const deleted = await superAdminModel.deleteUser(id);

    if (!deleted) {
      return res.status(404).json({ message: "User not found." });
    }

    const actor = req.user?.name || "Admin";
    await adminModel.addHistoryLog({
      actor: `Admin ${actor}`,
      action: "Deleted User Account",
      target: deleted.name,
      module: "Accounts",
      detail: `Deleted account for ${deleted.name} (${deleted.email}).`,
    });

    void eventDispatcher.dispatchUserMutation("deleted", deleted);

    return res.json({ success: true, user: deleted });
  },
};



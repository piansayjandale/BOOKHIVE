import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { studentModel } from "../models/student.model.js";
import { adminModel } from "../models/admin.model.js";
import {
  emitBorrowRequest,
  emitReservationRequest,
  emitReservationCancelled,
  emitTransactionDecided,
  emitTransactionUpdated,
  emitBookReturned,
  emitTransactionPickedUp,
} from "../socket.js";
import { eventDispatcher } from "../services/event-dispatcher.js";
import { pool } from "../db/pool.js";
import { reservationTimerService } from "../services/reservation-timer.service.js";
import { processPaperScan, verifyStudentIdCardsOcr } from "../services/ocr.service.js";
import { executeAiSearch } from "../services/ai-search.service.js";
import { invalidateDashboardCache, onCacheInvalidation } from "./admin.controller.js";

let studentBooksCache = null;
let studentBooksCacheExpiry = 0;

export function invalidateStudentBooksCache() {
  studentBooksCache = null;
  studentBooksCacheExpiry = 0;
}
onCacheInvalidation(invalidateStudentBooksCache);

export const studentController = {
  async login(req, res) {
    const { email, identifier, password } = req.body;
    const inputIdentifier = email || identifier;
    
    if (!inputIdentifier || !password) {
      return res.status(400).json({ message: "Email or ID number and password are required." });
    }

    const normalizedIdentifier = String(inputIdentifier).trim().toLowerCase();
    const cleanPassword = String(password).trim();
    let user = await studentModel.findUserByEmail(normalizedIdentifier);
    let isNewUser = false;

    if (!user) {
      // Check if it matches allowed school domains
      const isSchool = normalizedIdentifier.endsWith("@sti.edu.ph") || 
                       normalizedIdentifier.endsWith("@stiwnu.edu.ph") || 
                       normalizedIdentifier.endsWith("@wnu.sti.edu.ph");
      
      if (isSchool) {
        // Unfamiliar or nonexistent account in the database - new user!
        isNewUser = true;

        // Automatically register the student with a guaranteed unique temporary ID
        const emailLocalPart = normalizedIdentifier.split("@")[0];
        const parts = emailLocalPart.split(".");
        
        let parsedName = "STI Student";
        const uniqueTempId = `TEMP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        if (parts.length >= 2) {
          const idCandidate = parts[parts.length - 1];
          if (/^\d+$/.test(idCandidate)) {
            const nameParts = parts.slice(0, parts.length - 1);
            parsedName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
          } else {
            parsedName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
          }
        } else if (parts.length === 1) {
          parsedName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }

        const passwordHash = await bcrypt.hash(cleanPassword, 10);
        user = await studentModel.createUser({
          name: parsedName,
          email: normalizedIdentifier,
          idNumber: uniqueTempId,
          department: "CICT",
          course: "BSIT",
          yearLevel: "4TH",
          section: "H",
          passwordHash,
          role: "Student",
        });

        if (!user) {
          return res.status(500).json({ message: "Failed to create user session." });
        }

        // Broadcast real-time user registration event
        void eventDispatcher.dispatchUserMutation("registered", user);
      } else {
        return res.status(401).json({ message: "Invalid credentials." });
      }
    } else {
      let isValid = false;
      if (user.passwordHash) {
        isValid = await bcrypt.compare(cleanPassword, user.passwordHash);
      }
      if (!isValid && user.password && user.password === cleanPassword) {
        isValid = true;
      }
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      const status = user.status || "Active";
      if (status === "Suspended" || status === "Archived") {
        return res.status(403).json({ message: "Account is deactivated or suspended. Please contact the library administrator." });
      }

      // Only flag as isNewUser if the account has a temporary auto-generated ID or no ID
      const rawId = user.idNumber || user.id_number || "";
      if (!rawId || rawId.startsWith("TEMP-")) {
        isNewUser = true;
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
      { expiresIn: "7d" },
    );

    return res.json({
      token,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        idNumber: user.idNumber,
        department: user.department,
        course: user.course,
        yearLevel: user.yearLevel || user.year_level || "",
        section: user.section || "",
        status: user.status,
        avatar: user.avatar,
        schoolIdFront: user.schoolIdFront || user.school_id_front || "",
        schoolIdBack: user.schoolIdBack || user.school_id_back || "",
        libraryIdFront: user.libraryIdFront || user.library_id_front || "",
        libraryIdBack: user.libraryIdBack || user.library_id_back || "",
        qrCode: user.qrCode,
        isNewUser,
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

    const user = await studentModel.findUserByEmail(target);
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

  async register(req, res) {
    const { email, password, name, idNumber, department, course } = req.body;

    if (!email || !password || !name || !idNumber) {
      return res.status(400).json({ message: "Email, password, name, and idNumber are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    const existing = await studentModel.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    const user = await studentModel.createUser({
      name: String(name).trim(),
      email: normalizedEmail,
      idNumber: String(idNumber).trim(),
      department: department ? String(department).trim() : "STI Student",
      course: course ? String(course).trim() : "General Program",
      passwordHash,
      role: "Student",
    });

    if (!user) {
      return res.status(500).json({ message: "Failed to create user." });
    }

    // Broadcast real-time user registration event
    void eventDispatcher.dispatchUserMutation("registered", user);

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
        name: user.name,
      },
      env.jwtSecret,
      { expiresIn: "7d" },
    );

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        idNumber: user.idNumber,
        department: user.department,
        course: user.course,
        status: user.status,
        avatar: user.avatar,
        schoolIdFront: user.schoolIdFront || user.school_id_front || "",
        schoolIdBack: user.schoolIdBack || user.school_id_back || "",
        libraryIdFront: user.libraryIdFront || user.library_id_front || "",
        libraryIdBack: user.libraryIdBack || user.library_id_back || "",
        qrCode: user.qrCode,
      },
    });
  },


  async getProfile(req, res) {
    const userId = req.user.sub;
    const user = await studentModel.getUserProfile(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user });
  },

  async updateProfile(req, res) {
    try {
      const userId = req.user.sub;
      const {
        name,
        email,
        idNumber,
        course,
        department,
        yearLevel,
        section,
        avatar,
        schoolIdFront,
        schoolIdBack,
        libraryIdFront,
        libraryIdBack,
      } = req.body;
      
      const user = await studentModel.updateUserProfile(userId, {
        name,
        email,
        idNumber,
        course,
        department,
        yearLevel,
        section,
        avatar,
        schoolIdFront,
        schoolIdBack,
        libraryIdFront,
        libraryIdBack,
      });
      
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      return res.json({ user });
    } catch (error) {
      console.error("updateProfile controller error:", error);
      if (error.message.includes("already in use")) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An error occurred while updating profile." });
    }
  },

  async getBooks(req, res) {
    try {
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

      // Fast-path: return cached initial catalog for instant response (< 2ms)
      const now = Date.now();
      if (page === 1 && limit <= 100 && studentBooksCache && now < studentBooksCacheExpiry) {
        return res.json(studentBooksCache);
      }

      const result = await studentModel.getAvailableBooks(page, limit).catch((err) => {
        console.warn("[studentController.getBooks] Safe query fallback:", err.message);
        return { books: [], total: 0 };
      });

      const responsePayload = {
        books: result?.books || [],
        total: result?.total || 0,
        page,
        limit,
      };

      if (page === 1 && limit <= 100 && responsePayload.books.length > 0) {
        studentBooksCache = responsePayload;
        studentBooksCacheExpiry = now + 60 * 1000;
      }

      return res.json(responsePayload);
    } catch (err) {
      console.warn("[studentController.getBooks] Unexpected error, returning empty list:", err.message);
      return res.json({
        books: [],
        total: 0,
        page: 1,
        limit: 50,
      });
    }
  },

  async getBook(req, res) {
    try {
      const { id } = req.params;
      const title = req.query.title || req.query.resourceTitle;
      const isbn = req.query.isbn;
      const book = await studentModel.getBookById(id, { title, isbn }).catch(() => null);

      if (!book) {
        return res.status(404).json({ message: "Book not found." });
      }

      return res.json({ book });
    } catch (err) {
      console.warn("[studentController.getBook] Safe fallback:", err.message);
      return res.status(404).json({ message: "Book not found." });
    }
  },

  async searchBooks(req, res) {
    try {
      const { q, mode } = req.query;

      if (!q) {
        return res.status(400).json({ message: "Search query is required." });
      }

      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
      const searchMode = String(mode || "prefix").toLowerCase();

      const result = await studentModel.searchBooks(q, page, limit, searchMode).catch((err) => {
        console.warn("[studentController.searchBooks] Safe query fallback:", err.message);
        return { books: [], total: 0 };
      });

      // Persist search query telemetry in ai_search_logs with actor details and matches
      const actorId = req.user?.sub || req.user?.id || null;
      const actorName = req.user?.name || "Student";
      const department = req.user?.department || "General";
      const matchesCount = result?.total || result?.books?.length || 0;

      try {
        const cleanPrompt = String(q).trim();
        await pool.query(
          `DELETE FROM ai_search_logs 
           WHERE (mode = 'filter' OR mode = 'prefix')
             AND (
               LOWER(TRIM(prompt)) = LOWER(TRIM($1))
               OR ($1 ILIKE TRIM(prompt) || '%' AND LENGTH(TRIM(prompt)) < LENGTH($1))
             )
             AND (actor_id = $2 OR actor_name = $3)`,
          [cleanPrompt, actorId, actorName]
        );
        await pool.query(
          "INSERT INTO ai_search_logs (actor_id, actor_name, prompt, department, mode, matches_found) VALUES ($1, $2, $3, $4, 'filter', $5)",
          [actorId, actorName, cleanPrompt, department, matchesCount]
        );
      } catch (logErr) {
        console.warn("[studentController.searchBooks] Telemetry insert warning:", logErr.message);
      }

      // Broadcast real-time search telemetry event to Super Admin (includes refreshed vitals)
      try {
        void eventDispatcher.dispatchSearchEvent({
          query: String(q).trim(),
          mode: searchMode,
          actor: actorName,
          department,
          matches: matchesCount,
        });
      } catch {}

      return res.json({
        books: result?.books || [],
        total: result?.total || 0,
        page,
        limit,
        query: q,
      });
    } catch (err) {
      console.warn("[studentController.searchBooks] Safe fallback:", err.message);
      return res.json({
        books: [],
        total: 0,
        page: 1,
        limit: 200,
        query: req.query?.q || "",
      });
    }
  },

  async getSettings(req, res) {
    try {
      const { rows } = await pool.query("SELECT * FROM system_settings WHERE id = 1 LIMIT 1");
      const row = rows[0] || {};
      const latestEasApk = "https://expo.dev/artifacts/eas/xc8SUbZZdm5ObSv2fEFJIqtMbYHYyDuaEBsqcpwf2c8.apk";
      const isStaleApk =
        !row.latest_apk_url ||
        row.latest_apk_url.includes("XFgckz2TnI1Z76BNl4QKdN6GqdBxBMw0p7wHXKXVla8") ||
        row.latest_apk_url.includes("mH97U3T7g48Yn3KFtIHH0Uyal0bzBl5MWx5iu39M_uI") ||
        row.latest_apk_url.includes("m90mnPT1hrznA0zP1xdm95K-P6ZMwCNdlYIbZ6kO-uQ") ||
        row.latest_apk_url.includes("wq4OYzJNpymhY6ysiXCuUri2xPkuZwsavxKd1eAqaoQ") ||
        row.latest_apk_url.includes("u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU") ||
        row.latest_apk_url.includes("9vqmAP6x6yMOIC_o6J9CLqo8sKcXd0rOtUXxAa7M5UU");
      const isStaleVersion =
        !row.min_app_version ||
        ["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5"].includes(String(row.min_app_version).trim());

      const settings = {
        theme: row.theme || "dark",
        borrowLimit: Number(row.borrow_limit || 5),
        borrowDurationDays: Number(row.borrow_duration_days || 7),
        storageUsedPercent: Number(row.storage_used_percent || 24),
        indexingStatus: row.indexing_status || "Healthy",
        aiEngine: row.ai_engine || "BookHive AI",
        notificationsEnabled: row.notifications_enabled ?? true,
        emailNotifications: row.email_notifications ?? true,
        allowAdminTransactionControl: row.allow_admin_transaction_control ?? false,
        aiStrictMode: row.ai_strict_mode ?? true,
        isMaintenanceMode: Boolean(row.is_maintenance_mode ?? false),
        maintenanceTitle: row.maintenance_title || "System Maintenance & Update",
        maintenanceMessage: row.maintenance_message || "BookHive is currently undergoing scheduled maintenance and updates. Services are temporarily paused.",
        maintenanceUntil: row.maintenance_until || null,
        minAppVersion: isStaleVersion ? "1.0.6" : row.min_app_version,
        latestApkUrl: isStaleApk ? latestEasApk : row.latest_apk_url,
      };
      return res.json({ settings });
    } catch (err) {
      console.warn("[studentController.getSettings] Fallback:", err.message);
      return res.json({
        settings: {
          borrowLimit: 5,
          borrowDurationDays: 7,
          theme: "dark",
          isMaintenanceMode: false,
          maintenanceTitle: "System Maintenance & Update",
          maintenanceMessage: "BookHive is currently undergoing scheduled maintenance and updates.",
          maintenanceUntil: null,
          minAppVersion: "1.0.6",
          latestApkUrl: "https://expo.dev/artifacts/eas/xc8SUbZZdm5ObSv2fEFJIqtMbYHYyDuaEBsqcpwf2c8.apk",
        },
      });
    }
  },

  async getBorrowHistory(req, res) {
    try {
      const userId = req.query.studentId || req.query.email || req.user?.sub;
      const history = await studentModel.getUserBorrowHistory(userId);

      return res.json({ history: Array.isArray(history) ? history : [] });
    } catch (err) {
      console.warn("[studentController.getBorrowHistory] Database query failed, preserving client cache:", err.message);
      return res.status(503).json({
        message: "Unable to sync borrow history right now. Preserving local Library Card records.",
      });
    }
  },

  async borrowBook(req, res) {
    try {
      const userId = req.user?.sub || null;
      const { bookId, studentName, studentId, department, isbn, resourceTitle, dueDate, studentIdImage } = req.body;

      if (!bookId && !isbn && !resourceTitle) {
        return res.status(400).json({ message: "Book details (bookId, isbn, or resourceTitle) are required." });
      }

      const transaction = await studentModel.borrowBook(userId, bookId || isbn, {
        studentName,
        studentId,
        department,
        isbn,
        resourceTitle,
        dueDate,
        studentIdImage,
      });

      // Broadcast real-time WebSocket event across all channels and Super Admin telemetry
      emitBorrowRequest(transaction);
      void adminModel.syncBookAvailability(transaction.isbn || transaction.resourceTitle);
      void eventDispatcher.dispatchBorrowRequest(transaction);
      invalidateDashboardCache();

      try {
        await adminModel.addActivityLog(
          `Borrow request submitted for '${transaction.resourceTitle}' by student ${transaction.studentName || transaction.studentId}`,
          "info",
          transaction.studentName || "Student"
        );
      } catch (logErr) {
        // ignore
      }

      return res.status(201).json({
        message: "Borrow request submitted.",
        transaction,
      });
    } catch (error) {
      if (error.code === "DUPLICATE_PENDING") {
        return res.status(200).json({
          message: error.message,
          transaction: error.transaction,
          isDuplicate: true,
        });
      }
      if (error.code === "NO_COPIES_AVAILABLE") {
        return res.status(400).json({
          message: error.message,
          code: error.code,
        });
      }
      if (error.code === "BORROW_LIMIT_REACHED" || error.code === "OVERDUE_RETURN_REQUIRED") {
        return res.status(400).json({
          message: error.message,
          code: error.code,
          limitReached: true,
        });
      }
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  },

  async reserveBook(req, res) {
    try {
      const userId = req.user?.sub || null;
      const { bookId, studentName, studentId, department, isbn, resourceTitle, dueDate, studentIdImage } = req.body;

      if (!bookId && !isbn && !resourceTitle) {
        return res.status(400).json({ message: "Book details (bookId, isbn, or resourceTitle) are required." });
      }

      const transaction = await studentModel.reserveBook(userId, bookId || isbn, {
        studentName,
        studentId,
        department,
        isbn,
        resourceTitle,
        dueDate,
        studentIdImage,
      });

      // Broadcast real-time WebSocket event across all channels and Super Admin telemetry
      emitReservationRequest(transaction);
      void adminModel.syncBookAvailability(transaction.isbn || transaction.resourceTitle);
      void eventDispatcher.dispatchBorrowRequest(transaction);
      invalidateDashboardCache();

      return res.status(201).json({
        message: "Reservation request submitted.",
        transaction,
        queuePosition: transaction?.queuePosition || 1,
      });
    } catch (error) {
      if (error.code === "DUPLICATE_PENDING") {
        return res.status(200).json({
          message: error.message,
          transaction: error.transaction,
          isDuplicate: true,
        });
      }
      if (error.code === "COPIES_AVAILABLE") {
        return res.status(400).json({
          message: error.message,
          code: error.code,
        });
      }
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  },




  async cancelReservation(req, res) {
    try {
      const reservationId = req.params.id || req.params.transactionId;
      const userId = req.user?.sub || null;

      if (!reservationId) {
        return res.status(400).json({ message: "Reservation ID is required." });
      }

      const result = await studentModel.cancelReservation(reservationId, userId);

      if (!result) {
        return res.status(404).json({ message: "Reservation not found." });
      }

      if (result.notPending) {
        return res.status(400).json({
          message: `Cannot cancel reservation with status '${result.currentStatus}'. Only pending or active unpicked-up reservations can be cancelled.`,
          currentStatus: result.currentStatus,
        });
      }

      // Emit real-time WebSocket event for Circulation Librarian & Super Admin
      emitReservationCancelled(result.transaction);
      void eventDispatcher.dispatchReservationCancelled(result.transaction);
      invalidateDashboardCache();

      // If a held copy or waitlist spot was cancelled, promote the next waitlisted reservation
      try {
        await reservationTimerService.promoteNextReservation(result.transaction.isbn, result.transaction.resourceTitle);
      } catch (promoteErr) {
        // non-fatal
      }

      return res.json({
        message: "Reservation cancelled successfully.",
        transaction: result.transaction,
      });
    } catch (error) {
      console.error("student:cancelReservation controller error:", error);
      return res.status(500).json({ message: error.message || "Failed to cancel reservation." });
    }
  },

  async returnBook(req, res) {
    const { transactionId } = req.params;
    
    let transaction = null;
    const actorId = req.user?.sub || req.user?.id;
    const isUuid = Boolean(actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(actorId)));
    const decidedBy = isUuid ? actorId : null;
    const actorLabel = req.user?.name ? `${req.user.role || 'Staff'}: ${req.user.name}` : "Librarian Scanner";

    try {
      transaction = await adminModel.decideTransaction({
        transactionId,
        status: "Returned",
        decidedBy,
        comment: `Returned via ${actorLabel}`,
      });
    } catch (e) {
      console.warn("adminModel.decideTransaction in studentController.returnBook fallback:", e.message);
    }

    if (!transaction || !transaction.resourceTitle) {
      try {
        const directResult = await studentModel.returnBook(transactionId);
        if (directResult) {
          transaction = { ...directResult, ...transaction };
        }
      } catch (directErr) {
        console.warn("studentModel.returnBook fallback:", directErr.message);
      }
    }
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // Ensure book availability is always synchronized when a return is recorded
    if (transaction.isbn || transaction.resourceTitle) {
      void adminModel.syncBookAvailability(transaction.isbn || transaction.resourceTitle);
    }

    // Synchronize to Web System (Librarian/Admin) via WebSockets and audit logs
    try {
      emitTransactionDecided(transaction);
      emitTransactionUpdated(transaction);
      emitBookReturned(transaction);
      void eventDispatcher.dispatchTransactionDecision(transaction);
      invalidateDashboardCache();

      const actorLabel = req.user?.role ? `${req.user.role} ${req.user.name || "Mobile User"}` : "Mobile Return";
      await adminModel.addHistoryLog({
        actor: actorLabel,
        action: `Returned transaction`,
        target: transaction.studentName || "Student",
        module: "Transactions",
        detail: `${transaction.resourceTitle || "Book"} is now marked Returned via mobile app.`,
      });
      await adminModel.addActivityLog(
        `Borrow returned for ${transaction.studentId || transaction.studentName || "Student"}`,
        "success",
        req.user?.name || "Librarian Scanner"
      );
    } catch (broadcastErr) {
      console.warn("Real-time sync / audit logging warning on mobile return:", broadcastErr.message);
    }

    // Automated Return-to-Reservation Notification & 24h Timer:
    // If a book is returned, promote the next waitlisted reservation and start their 24h timer
    let promotedTransaction = null;
    try {
      promotedTransaction = await reservationTimerService.promoteNextReservation(transaction.isbn, transaction.resourceTitle);
    } catch (notifyErr) {
      console.warn("Automated reservation timer activation error on student return:", notifyErr.message);
    }

    return res.json({
      message: "Book returned successfully.",
      transaction,
      promotedTransaction,
      ok: true,
    });
  },

  async pickupBook(req, res) {
    const { transactionId } = req.params;
    const { librarianName, librarianId, resourceTitle, isbn, studentId, studentName } = req.body || {};

    const actorId = req.user?.sub || req.user?.id || librarianId;
    const isUuid = Boolean(actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(actorId)));
    const decidedBy = isUuid ? actorId : null;
    const actorName = req.user?.name || librarianName || "Librarian";

    let transaction = null;
    try {
      transaction = await adminModel.markTransactionPickedUp({
        transactionId,
        librarianId: decidedBy,
        librarianName: actorName,
        resourceTitle,
        isbn,
        studentId,
        studentName,
      });
    } catch (e) {
      console.warn("adminModel.markTransactionPickedUp in studentController.pickupBook notice:", e.message);
    }

    if (!transaction) {
      transaction = {
        id: transactionId,
        status: "Approved",
        type: "Borrow",
        pickedUpAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        studentName: studentName || "Student",
        studentId: studentId || "",
        resourceTitle: resourceTitle || "Book",
        isbn: isbn || "",
        isPickedUp: true,
      };
    }

    try {
      emitTransactionPickedUp(transaction);
      emitTransactionUpdated(transaction);
      emitTransactionDecided(transaction);
      void eventDispatcher.dispatchTransactionDecision(transaction);
      invalidateDashboardCache();

      await adminModel.addHistoryLog({
        actor: `Librarian: ${actorName}`,
        action: "Picked Up book",
        target: transaction.studentName || "Student",
        module: "Transactions",
        detail: `Physical copy of "${transaction.resourceTitle || "Book"}" claimed by ${transaction.studentName || "Student"}.`,
      });
      await adminModel.addActivityLog(
        `Book picked up: "${transaction.resourceTitle || "Book"}" by ${transaction.studentName || transaction.studentId || "Student"}`,
        "success",
        actorName
      );
    } catch (broadcastErr) {
      console.warn("Real-time sync / audit logging warning on mobile pickup:", broadcastErr.message);
    }

    return res.json({
      success: true,
      message: "Book marked as picked up successfully.",
      transaction,
    });
  },

  async resolveReceiptQr(req, res) {
    const { qrData, receiptNumber, transactionId, studentId, isbn, title } = req.body || {};
    let parsed = null;

    if (qrData && typeof qrData === "string") {
      try {
        parsed = JSON.parse(qrData.trim());
      } catch {
        if (qrData.startsWith("RCP-")) {
          parsed = { receiptNumber: qrData };
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrData)) {
          parsed = { transactionId: qrData };
        } else {
          parsed = { payload: qrData };
        }
      }
    } else if (qrData && typeof qrData === "object") {
      parsed = qrData;
    } else {
      parsed = { receiptNumber, transactionId, studentId, isbn, title };
    }

    const targetTxId = parsed?.transactionId || transactionId || (parsed?.token?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]) || null;
    const targetReceiptNo = parsed?.receiptNumber || receiptNumber || null;
    const targetStudentId = parsed?.studentId || studentId || null;
    const targetIsbn = parsed?.isbn || isbn || null;
    const targetTitle = parsed?.bookTitle || parsed?.title || title || null;

    let transaction = null;

    if (targetTxId) {
      try {
        const { rows } = await pool.query(
          `SELECT t.*, 
                  u.name as "userName", u.department as "userDept", u.course as "userCourse", u.avatar as "userAvatar",
                  b.author as "bookAuthor", b.shelf_location as "bookShelf", b.department as "bookCategory"
           FROM transactions t
           LEFT JOIN users u ON t.user_id = u.id OR LOWER(t.student_id) = LOWER(u.id_number)
           LEFT JOIN books b ON (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn)
                             OR (LOWER(t.resource_title) = LOWER(b.title))
           WHERE t.id::text = $1::text
           LIMIT 1`,
          [targetTxId]
        );
        if (rows.length > 0) transaction = rows[0];
      } catch (err) {
        console.warn("DB lookup by targetTxId warning:", err.message);
      }
    }

    if (!transaction && (targetStudentId && (targetIsbn || targetTitle))) {
      try {
        const { rows } = await pool.query(
          `SELECT t.*, 
                  u.name as "userName", u.department as "userDept", u.course as "userCourse", u.avatar as "userAvatar",
                  b.author as "bookAuthor", b.shelf_location as "bookShelf", b.department as "bookCategory"
           FROM transactions t
           LEFT JOIN users u ON t.user_id = u.id OR LOWER(t.student_id) = LOWER(u.id_number)
           LEFT JOIN books b ON (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn)
                             OR (LOWER(t.resource_title) = LOWER(b.title))
           WHERE (LOWER(t.student_id) = LOWER($1) OR LOWER(t.student_name) = LOWER($1))
             AND (
               ($2::text != '' AND $2::text != 'N/A' AND t.isbn = $2::text)
               OR ($3::text != '' AND LOWER(t.resource_title) = LOWER($3::text))
             )
           ORDER BY t.requested_at DESC
           LIMIT 1`,
          [targetStudentId, targetIsbn || "", targetTitle || ""]
        );
        if (rows.length > 0) transaction = rows[0];
      } catch (err) {
        console.warn("DB lookup by studentId & book warning:", err.message);
      }
    }

    let catalogBook = null;
    if (targetIsbn || targetTitle) {
      try {
        const { rows } = await pool.query(
          `SELECT * FROM books 
           WHERE ($1::text != '' AND $1::text != 'N/A' AND isbn = $1)
              OR ($2::text != '' AND LOWER(title) = LOWER($2))
           LIMIT 1`,
          [targetIsbn || "", targetTitle || ""]
        );
        if (rows.length > 0) catalogBook = rows[0];
      } catch (err) {}
    }

    let isPickedUp = false;
    if (transaction) {
      isPickedUp = Boolean(
        transaction.picked_up_at ||
        String(transaction.status).toLowerCase() === "picked up"
      );
    } else {
      isPickedUp = Boolean(
        parsed?.isPickedUp === true ||
        (parsed?.status && String(parsed.status).toLowerCase() === "picked up") ||
        parsed?.picked_up_at ||
        parsed?.pickedUpAt
      );
    }

    const formattedBorrowDate = transaction?.requested_at
      ? new Date(transaction.requested_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : (parsed?.borrowDate || "2026-10-13 12:13 am");

    const formattedReturnDate = transaction?.due_date
      ? new Date(transaction.due_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : (parsed?.returnDate || "2026-10-20");

    const formattedPickupDate = transaction?.picked_up_at
      ? new Date(transaction.picked_up_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : (isPickedUp ? (parsed?.pickupDate || "Completed") : "Ready for Pickup");

    const resolved = {
      transactionId: transaction?.id || targetTxId || parsed?.transactionId || "b8816339-e413-4716-9013-e5140befd994",
      receiptNumber: targetReceiptNo || parsed?.receiptNumber || `RCP-PROVED-2130`,
      status: isPickedUp ? "Picked Up" : (transaction?.status || parsed?.status || "Approved"),
      isPickedUp,
      bookTitle: transaction?.resource_title || catalogBook?.title || parsed?.bookTitle || parsed?.title || "The Struggle",
      author: transaction?.bookAuthor || catalogBook?.author || parsed?.author || "Betty",
      isbn: transaction?.isbn || catalogBook?.isbn || parsed?.isbn || "222-1234-162",
      category: catalogBook?.category || catalogBook?.department || transaction?.bookCategory || transaction?.department || parsed?.category || parsed?.department || "Fiction",
      shelf: catalogBook?.shelf_location || catalogBook?.shelf || transaction?.bookShelf || transaction?.bookShelfAlt || parsed?.shelf || "CIR 101.4 .B40s 2026 v.1 c.1",
      studentName: transaction?.student_name || transaction?.userName || parsed?.studentName || "Hi",
      studentId: transaction?.student_id || parsed?.studentId || "23-1234-567",
      department: transaction?.userDept || transaction?.department || parsed?.department || "CHTM",
      course: transaction?.userCourse || parsed?.course || parsed?.department || "CHTM",
      borrowDate: formattedBorrowDate,
      pickupDate: formattedPickupDate,
      returnDate: formattedReturnDate,
      pickedUpAt: transaction?.picked_up_at || (isPickedUp ? new Date().toISOString() : null),
      verifiedBy: parsed?.verifiedBy || "BookHive Circulation Desk",
      token: parsed?.token || `BH-RCPT-${targetReceiptNo || Date.now()}`,
    };

    return res.json({
      success: true,
      receipt: resolved,
    });
  },

  async getAnnouncements(req, res) {
    try {
      const announcements = await studentModel.getAnnouncements().catch(() => []);
      return res.json({ announcements: announcements || [] });
    } catch (err) {
      console.warn("[studentController.getAnnouncements] Safe fallback:", err.message);
      return res.json({ announcements: [] });
    }
  },

  async getRecommendations(req, res) {
    try {
      const userId = req.user?.sub;
      const recommendations = await studentModel.getRecommendations(userId).catch(() => []);
      return res.json({ recommendations: recommendations || [] });
    } catch (error) {
      console.warn("[studentController.getRecommendations] Safe fallback:", error.message);
      return res.json({ recommendations: [] });
    }
  },

  async getStudentByQr(req, res) {
    try {
      const qrPayload = req.params.qrCode || req.params.qrPayload || req.query.qr;
      if (!qrPayload) {
        return res.status(400).json({ message: "QR payload or Student identifier is required." });
      }

      const result = await studentModel.getStudentCardAndViolations(qrPayload);
      if (!result) {
        return res.status(404).json({ message: "Student account not found for this QR code." });
      }

      return res.json(result);
    } catch (error) {
      console.error("getStudentByQr controller error:", error);
      return res.status(500).json({ message: "Failed to resolve student QR payload." });
    }
  },

  async renderStudentVerificationWebPage(req, res) {
    try {
      const qrPayload = req.params.qrCode || req.params.qrPayload || req.query.qr;
      if (!qrPayload) {
        return res.status(400).send("<h1>400 Bad Request: Missing student QR code or identifier.</h1>");
      }

      // If API client explicitly requests JSON, return JSON
      if (req.headers.accept && req.headers.accept.includes("application/json") && !req.headers.accept.includes("text/html")) {
        const result = await studentModel.getStudentCardAndViolations(qrPayload);
        if (!result) return res.status(404).json({ message: "Student not found." });
        return res.json(result);
      }

      const data = await studentModel.getStudentCardAndViolations(qrPayload);
      if (!data || !data.student) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Student Not Found | BookHive</title>
            <style>
              body { background-color: #080F1E; color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
              .card { background: #111A2E; border: 1px solid #24334C; border-radius: 18px; max-width: 420px; width: 100%; padding: 32px 24px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
              .icon { font-size: 48px; color: #EF4444; margin-bottom: 16px; }
              h1 { font-size: 20px; margin: 0 0 8px 0; color: #FFFFFF; }
              p { color: #94A3B8; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5; }
              .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); border: 1px solid #EF4444; color: #EF4444; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">⚠️</div>
              <h1>Student Record Not Found</h1>
              <p>The scanned QR code payload <code>${String(qrPayload).replace(/</g, "&lt;")}</code> does not match any registered student in BookHive.</p>
              <div class="badge">Unverified Pass</div>
            </div>
          </body>
          </html>
        `);
      }

      const { student, libraryCard, violations } = data;
      const studentName = student.fullName || student.name || "Student";
      const studentId = student.studentId || student.idNumber || "—";
      const course = student.course || "General Program";
      const dept = student.department || "WNU STI";
      const email = student.email || "—";
      const status = student.status || "Active";
      const hasViolations = violations && violations.length > 0;
      const totalFine = violations ? violations.reduce((acc, v) => acc + (Number(v.penaltyAmount) || 0), 0) : 0;

      const cardRowsHtml = (libraryCard && libraryCard.length > 0)
        ? libraryCard.map(item => {
            const hl = item.highlightType || 'none';
            const rowBg = hl === 'green'
              ? 'background: rgba(74, 222, 128, 0.08);'
              : hl === 'violet'
              ? 'background: rgba(168, 85, 247, 0.08);'
              : hl === 'red'
              ? 'background: rgba(239, 68, 68, 0.10);'
              : '';
            const dueCellStyle = hl === 'green'
              ? 'background: rgba(74, 222, 128, 0.22); color: #86EFAC; font-weight: 700;'
              : hl === 'violet'
              ? 'background: rgba(168, 85, 247, 0.28); color: #D8B4FE; font-weight: 700;'
              : hl === 'red'
              ? 'background: rgba(239, 68, 68, 0.28); color: #F87171; font-weight: 700;'
              : '';
            return `
            <tr style="${rowBg}">
              <td>${item.borrowDate || "—"}</td>
              <td style="${dueCellStyle}">${item.dueReturnDate || "—"}</td>
              <td class="bold-text">${item.bookTitle || "—"}</td>
              <td><span class="status-pill status-${(item.status || "active").toLowerCase().replace(/\s+/g, '-')}">${item.status || "Approved"}</span></td>
            </tr>
          `;
          }).join("")
        : `<tr><td colspan="4" style="text-align: center; color: #64748B; padding: 20px;">No borrow history recorded on this library pass.</td></tr>`;

      const violationsHtml = hasViolations
        ? violations.map(v => `
            <div class="violation-card">
              <div class="violation-top">
                <span class="violation-type">${v.violationType || "Policy Violation"}</span>
                <span class="penalty-tag">${v.penaltyAmount > 0 ? '₱' + Number(v.penaltyAmount).toFixed(2) + ' Fine' : v.status}</span>
              </div>
              ${v.bookTitle ? `<div class="violation-book">Book: ${v.bookTitle}</div>` : ''}
              <div class="violation-remarks">${v.remarks || 'Standard library penalty.'}</div>
              ${v.date ? `<div class="violation-date">Recorded: ${v.date}</div>` : ''}
            </div>
          `).join("")
        : `
          <div class="clear-card">
            <div class="clear-icon">✓</div>
            <div class="clear-title">No Active Violations</div>
            <div class="clear-desc">Student account is in good standing with zero overdue penalties or disciplinary records.</div>
          </div>
        `;

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${studentName} - BookHive Official Library Pass</title>
          <style>
            :root {
              --bg: #080F1E;
              --card: #111A2E;
              --card-inner: #162444;
              --border: #24334C;
              --gold: #FFD700;
              --text: #F8FAFC;
              --muted: #94A3B8;
              --green: #10B981;
              --red: #EF4444;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              background: var(--bg);
              color: var(--text);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 18px 12px 60px;
              display: flex;
              justify-content: center;
            }
            .container {
              width: 100%;
              max-width: 600px;
            }
            .header-banner {
              text-align: center;
              margin-bottom: 20px;
              padding: 16px;
              background: linear-gradient(180deg, #162444 0%, #111A2E 100%);
              border: 1px solid var(--border);
              border-radius: 20px;
              box-shadow: 0 4px 18px rgba(0,0,0,0.4);
            }
            .logo-title {
              font-size: 20px;
              font-weight: 900;
              color: var(--gold);
              letter-spacing: 1.5px;
            }
            .subtitle {
              font-size: 12px;
              color: var(--muted);
              margin-top: 4px;
            }
            .section {
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 18px;
              padding: 18px;
              margin-bottom: 18px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.3);
            }
            .section-title {
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 1px;
              color: var(--gold);
              margin-bottom: 14px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .profile-card {
              display: flex;
              align-items: center;
              gap: 16px;
              background: var(--card-inner);
              border: 1px solid var(--border);
              padding: 14px;
              border-radius: 14px;
              margin-bottom: 14px;
            }
            .avatar-circle {
              width: 58px;
              height: 58px;
              border-radius: 29px;
              background: #FFD700;
              color: #080F1E;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 22px;
              flex-shrink: 0;
            }
            .avatar-img {
              object-fit: cover;
              border: 2.5px solid #FFD700;
            }
            .profile-details {
              flex: 1;
              min-width: 0;
            }
            .student-name {
              font-size: 17px;
              font-weight: 800;
              color: #FFFFFF;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .id-badge {
              display: inline-block;
              background: rgba(255, 215, 0, 0.15);
              color: var(--gold);
              border: 1px solid rgba(255, 215, 0, 0.4);
              padding: 2px 10px;
              border-radius: 10px;
              font-size: 12px;
              font-weight: 800;
              margin: 4px 0;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            @media (max-width: 480px) {
              .info-grid { grid-template-columns: 1fr; }
            }
            .info-item {
              background: rgba(255,255,255,0.03);
              border: 1px solid rgba(255,255,255,0.06);
              padding: 8px 12px;
              border-radius: 10px;
            }
            .info-label {
              font-size: 11px;
              color: var(--muted);
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-val {
              font-size: 13px;
              font-weight: 700;
              color: #FFFFFF;
              margin-top: 2px;
              word-break: break-all;
            }
            /* Table */
            .table-wrap {
              overflow-x: auto;
              overflow-y: auto;
              max-height: 410px;
              border: 1px solid var(--border);
              border-radius: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              text-align: left;
            }
            thead th {
              position: sticky;
              top: 0;
              z-index: 2;
              background: #18253E;
              color: #CBD5E1;
              padding: 10px 8px;
              font-size: 11px;
              border-bottom: 2px solid var(--border);
            }
            td {
              padding: 9px 8px;
              border-bottom: 1px solid rgba(255,255,255,0.06);
              color: #E2E8F0;
            }
            .bold-text { font-weight: 700; color: #FFFFFF; }
            .status-pill {
              font-size: 10px;
              font-weight: 800;
              padding: 3px 8px;
              border-radius: 8px;
              text-transform: uppercase;
              background: rgba(16, 185, 129, 0.15);
              color: #10B981;
            }
            .status-returned {
              background: rgba(59, 130, 246, 0.15);
              color: #60A5FA;
            }
            .status-reservation {
              background: rgba(168, 85, 247, 0.2);
              color: #D8B4FE;
            }
            .status-overdue {
              background: rgba(239, 68, 68, 0.15);
              color: #EF4444;
            }
            .legend-box {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: center;
              gap: 12px;
              row-gap: 8px;
              margin-top: 12px;
              padding: 8px 10px;
              background: rgba(30, 41, 59, 0.45);
              border-radius: 10px;
              border: 1px solid #1E293B;
              font-size: 11px;
              color: #CBD5E1;
              font-weight: 600;
            }
            .legend-item {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .legend-dot {
              width: 9px;
              height: 9px;
              border-radius: 50%;
            }
            /* Violations */
            .clear-card {
              background: rgba(16, 185, 129, 0.08);
              border: 1px solid rgba(16, 185, 129, 0.3);
              border-radius: 14px;
              padding: 20px;
              text-align: center;
            }
            .clear-icon {
              font-size: 32px;
              color: var(--green);
              margin-bottom: 6px;
            }
            .clear-title {
              font-size: 15px;
              font-weight: 800;
              color: #FFFFFF;
            }
            .clear-desc {
              font-size: 12px;
              color: var(--muted);
              margin-top: 4px;
            }
            .violation-card {
              background: #1F1417;
              border: 1px solid #3F1B22;
              border-radius: 12px;
              padding: 12px;
              margin-bottom: 10px;
            }
            .violation-top {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
            }
            .violation-type {
              color: #EF4444;
              font-weight: 800;
              font-size: 13px;
            }
            .penalty-tag {
              background: #EF4444;
              color: #FFFFFF;
              font-weight: 800;
              font-size: 11px;
              padding: 2px 8px;
              border-radius: 6px;
            }
            .violation-book { font-size: 12px; font-weight: 600; color: #FFFFFF; margin-bottom: 3px; }
            .violation-remarks { font-size: 12px; color: #FCA5A5; }
            .violation-date { font-size: 11px; color: #94A3B8; margin-top: 4px; }
            .footer-tag {
              text-align: center;
              font-size: 11px;
              color: #64748B;
              letter-spacing: 0.8px;
              margin-top: 24px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header-banner">
              <div class="logo-title">BOOKHIVE LIBRARY PASS</div>
              <div class="subtitle">Official Verified Student Record & Credentials</div>
            </div>

            <!-- SECTION 1: STUDENT INFORMATION -->
            <div class="section">
              <div class="section-title" style="justify-content: space-between;">
                <span>👤 STUDENT INFORMATION</span>
                <button
                  id="toggleIdsBtn"
                  onclick="var el = document.getElementById('studentIdsGrid'); var btn = document.getElementById('toggleIdsBtn'); if (el.style.display === 'none') { el.style.display = 'grid'; btn.innerHTML = '🪪 Hide IDs ▲'; btn.style.borderColor = '#FFD700'; btn.style.color = '#FFD700'; } else { el.style.display = 'none'; btn.innerHTML = '🪪 Show IDs ▼'; btn.style.borderColor = 'rgba(255,255,255,0.18)'; btn.style.color = '#E2E8F0'; }"
                  style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); color: #E2E8F0; border-radius: 10px; padding: 5px 12px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px;"
                >🪪 Show IDs ▼</button>
              </div>
              <div class="profile-card">
                ${student.avatar && (student.avatar.startsWith('http') || student.avatar.startsWith('data:')) && !student.avatar.includes('placeholder.com') ? `
                  <img src="${student.avatar}" class="avatar-circle avatar-img" alt="${studentName}" />
                ` : `
                  <div class="avatar-circle">${studentName.charAt(0).toUpperCase()}</div>
                `}
                <div class="profile-details">
                  <div class="student-name">${studentName}</div>
                  <div class="id-badge">ID: ${studentId}</div>
                  <div style="font-size: 12px; color: var(--muted);">${course}</div>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Department</div>
                  <div class="info-val">${dept}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Institutional Email</div>
                  <div class="info-val">${email}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Academic Standing</div>
                  <div class="info-val" style="color: ${hasViolations ? '#EF4444' : '#10B981'};">
                    ● ${hasViolations ? 'Action Required (Fine Pending)' : 'Good Standing (Active)'}
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-label">Pass Verification</div>
                  <div class="info-val" style="color: var(--gold);">Verified Digital Card</div>
                </div>
              </div>

              <div id="studentIdsGrid" style="display: none; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);">
                ${[
                  { label: 'School ID (Front)', src: student.schoolIdFront },
                  { label: 'School ID (Back)', src: student.schoolIdBack },
                  { label: 'Library ID (Front)', src: student.libraryIdFront },
                  { label: 'Library ID (Back)', src: student.libraryIdBack },
                ].map(card => `
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px; text-align: center;">
                    <div style="font-size: 10px; font-weight: 800; color: var(--gold); margin-bottom: 6px; text-transform: uppercase;">${card.label}</div>
                    ${card.src ? `<img src="${card.src}" alt="${card.label}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 6px; cursor: pointer;" onclick="window.open(this.src, '_blank')" />` : `<div style="height: 110px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--muted); border: 1px dashed rgba(255,255,255,0.12); border-radius: 6px;">No ID Uploaded</div>`}
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- SECTION 2: STUDENT LIBRARY CARD -->
            <div class="section">
              <div class="section-title">📚 STUDENT LIBRARY CARD</div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Borrow Date</th>
                      <th>Due Return</th>
                      <th>Book Title</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${cardRowsHtml}
                  </tbody>
                </table>
              </div>
              <div class="legend-box">
                <div class="legend-item"><span class="legend-dot" style="background: #86EFAC;"></span>Green: Borrow (Active)</div>
                <div class="legend-item"><span class="legend-dot" style="background: #F87171;"></span>Red: Due to Return</div>
                <div class="legend-item"><span class="legend-dot" style="background: #C084FC;"></span>Violet: Reservation</div>
              </div>
            </div>

            <!-- SECTION 3: VIOLATION RECORD -->
            <div class="section">
              <div class="section-title" style="color: ${hasViolations ? '#EF4444' : '#10B981'};">
                🛡️ VIOLATION & PENALTY RECORD
              </div>
              ${violationsHtml}
              ${hasViolations && totalFine > 0 ? `
                <div style="margin-top: 12px; padding: 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid #EF4444; border-radius: 8px; text-align: right; font-weight: 800; color: #EF4444; font-size: 13px;">
                  Total Outstanding Fines: ₱${totalFine.toFixed(2)}
                </div>
              ` : ''}
            </div>

            <div class="footer-tag">
              OFFICIAL BOOKHIVE VERIFICATION PORTAL • REAL-TIME DATABASE SYNC
            </div>
          </div>
        </body>
        </html>
      `;

      return res.send(html);
    } catch (error) {
      console.error("renderStudentVerificationWebPage error:", error);
      return res.status(500).send("<h1>500 Internal Server Error</h1>");
    }
  },

  async verifyStudentIdOcr(req, res) {
    const {
      schoolIdFront,
      schoolIdBack,
      libraryIdFront,
      libraryIdBack,
      expectedName,
      expectedIdNumber,
    } = req.body;

    if (!schoolIdFront && !schoolIdBack && !libraryIdFront && !libraryIdBack) {
      return res.status(400).json({
        success: false,
        message: 'At least one ID image is required for verification.',
      });
    }

    try {
      const result = await verifyStudentIdCardsOcr({
        schoolIdFront,
        schoolIdBack,
        libraryIdFront,
        libraryIdBack,
        expectedName,
        expectedIdNumber,
      });

      return res.json(result);
    } catch (err) {
      console.error('[studentController.verifyStudentIdOcr] Error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify ID card via OCR service.',
      });
    }
  },

  async scanPaperOcr(req, res) {
    const { image, text, orientationHint } = req.body;
    if (!image && !text) {
      return res.status(400).json({ message: "Either image data or text query is required for paper scanning." });
    }
    const result = await processPaperScan(image, text, orientationHint);
    return res.json(result);
  },

  async aiSearch(req, res) {
    const { prompt, file, department, limit } = req.body;
    const result = await executeAiSearch({
      prompt: prompt || "",
      file: file || null,
      department: department || null,
      limit: limit ? Number(limit) : 40,
    });

    const actorId = req.user?.sub || req.user?.id || null;
    const actorName = req.user?.name || "Student";
    const userDept = req.user?.department || department || "General";
    const fileNames = file?.name ? [file.name] : [];
    const matchesCount = result?.total || result?.books?.length || 0;
    const searchPrompt = prompt || (file?.name ? `File: ${file.name}` : "AI Neural Search");

    try {
      const cleanPrompt = String(searchPrompt).trim();
      await pool.query(
        `DELETE FROM ai_search_logs 
         WHERE LOWER(TRIM(prompt)) = LOWER(TRIM($1))
           AND COALESCE(mode, 'ai') = 'ai'
           AND (actor_id = $2 OR actor_name = $3)`,
        [cleanPrompt, actorId, actorName]
      );
      await pool.query(
        "INSERT INTO ai_search_logs (actor_id, actor_name, prompt, department, mode, file_names, matches_found) VALUES ($1, $2, $3, $4, 'ai', $5, $6)",
        [actorId, actorName, cleanPrompt, userDept, fileNames, matchesCount]
      );
    } catch (logErr) {
      console.warn("[studentController.aiSearch] Telemetry insert warning:", logErr.message);
    }

    try {
      void eventDispatcher.dispatchSearchEvent({
        query: String(searchPrompt).trim(),
        mode: "ai",
        actor: actorName,
        department: userDept,
        matches: matchesCount,
      });
    } catch {}

    return res.json({
      success: true,
      books: result.books,
      total: result.total,
      aiAnalysis: result.aiAnalysis,
    });
  },
};


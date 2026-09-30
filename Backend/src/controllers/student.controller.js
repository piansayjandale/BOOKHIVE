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
} from "../socket.js";
import { eventDispatcher } from "../services/event-dispatcher.js";
import { pool } from "../db/pool.js";
import { reservationTimerService } from "../services/reservation-timer.service.js";
import { processPaperScan } from "../services/ocr.service.js";
import { executeAiSearch } from "../services/ai-search.service.js";



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
      const { name, email, idNumber, course, department, yearLevel, section, avatar } = req.body;
      
      const user = await studentModel.updateUserProfile(userId, { name, email, idNumber, course, department, yearLevel, section, avatar });
      
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
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    
    const result = await studentModel.getAvailableBooks(page, limit);
    
    return res.json({
      books: result.books,
      total: result.total,
      page,
      limit,
    });
  },

  async getBook(req, res) {
    const { id } = req.params;
    const title = req.query.title || req.query.resourceTitle;
    const isbn = req.query.isbn;
    const book = await studentModel.getBookById(id, { title, isbn });
    
    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    return res.json({ book });
  },

  async searchBooks(req, res) {
    const { q, mode } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: "Search query is required." });
    }

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
    const searchMode = String(mode || "prefix").toLowerCase();
    
    const result = await studentModel.searchBooks(q, page, limit, searchMode);
    
    // Broadcast real-time search telemetry event to Super Admin
    void eventDispatcher.dispatchSearchEvent({ query: q, mode: searchMode, actor: req.user?.name || "Student" });

    // Persist search query telemetry for Admin "Most Searched Books" analytics
    try {
      void pool.query(
        "INSERT INTO ai_search_logs (actor_name, prompt, department, matches_found) VALUES ($1, $2, $3, $4)",
        [req.user?.name || "Student", String(q).trim(), req.user?.department || "General", result.total || 0]
      );
    } catch {
      // Non-blocking search telemetry
    }

    return res.json({
      books: result.books,
      total: result.total,
      page,
      limit,
      query: q,
    });
  },

  async getBorrowHistory(req, res) {
    const userId = req.user.sub;
    const history = await studentModel.getUserBorrowHistory(userId);
    
    return res.json({ history });
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
      void eventDispatcher.dispatchBorrowRequest(transaction);

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
      throw error;
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
      void eventDispatcher.dispatchBorrowRequest(transaction);

      return res.status(201).json({
        message: "Reservation request submitted.",
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
      throw error;
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
          message: `Cannot cancel reservation with status '${result.currentStatus}'. Only pending reservations can be cancelled.`,
          currentStatus: result.currentStatus,
        });
      }

      // Emit real-time WebSocket event for Circulation Librarian & Super Admin
      emitReservationCancelled(result.transaction);
      void eventDispatcher.dispatchReservationCancelled(result.transaction);

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

    // Synchronize to Web System (Librarian/Admin) via WebSockets and audit logs
    try {
      emitTransactionDecided(transaction);
      emitTransactionUpdated(transaction);
      emitBookReturned(transaction);
      void eventDispatcher.dispatchTransactionDecision(transaction);

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
    try {
      await reservationTimerService.promoteNextReservation(transaction.isbn, transaction.resourceTitle);
    } catch (notifyErr) {
      console.warn("Automated reservation timer activation error on student return:", notifyErr.message);
    }

    return res.json({
      message: "Book returned successfully.",
      transaction,
    });
  },


  async getAnnouncements(req, res) {
    const announcements = await studentModel.getAnnouncements();
    return res.json({ announcements });
  },

  async getRecommendations(req, res) {
    try {
      const userId = req.user.sub;
      const recommendations = await studentModel.getRecommendations(userId);
      return res.json({ recommendations });
    } catch (error) {
      console.error("getRecommendations controller error:", error);
      return res.status(500).json({ message: "An error occurred while generating recommendations." });
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
        ? libraryCard.map(item => `
            <tr>
              <td>${item.borrowDate || "—"}</td>
              <td>${item.dueReturnDate || "—"}</td>
              <td class="bold-text">${item.bookTitle || "—"}</td>
              <td><span class="status-pill status-${(item.status || "active").toLowerCase()}">${item.status || "Approved"}</span></td>
            </tr>
          `).join("")
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
              --card-inner: #16233B;
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
              border: 1px solid var(--border);
              border-radius: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              text-align: left;
            }
            th {
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
            .status-overdue {
              background: rgba(239, 68, 68, 0.15);
              color: #EF4444;
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
              <div class="section-title">👤 STUDENT INFORMATION</div>
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

  async scanPaperOcr(req, res) {
    const { image, text } = req.body;
    if (!image && !text) {
      return res.status(400).json({ message: "Either image data or text query is required for paper scanning." });
    }
    const result = await processPaperScan(image, text);
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
    return res.json({
      success: true,
      books: result.books,
      total: result.total,
      aiAnalysis: result.aiAnalysis,
    });
  },
};


import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { studentModel } from "../models/student.model.js";
import { emitBorrowRequest, emitReservationRequest, emitReservationCancelled } from "../socket.js";
import { eventDispatcher } from "../services/event-dispatcher.js";



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

    if (!user) {
      // Check if it matches allowed school domains
      const isSchool = normalizedIdentifier.endsWith("@sti.edu.ph") || 
                       normalizedIdentifier.endsWith("@stiwnu.edu.ph") || 
                       normalizedIdentifier.endsWith("@wnu.sti.edu.ph");
      
      if (isSchool) {
        // Automatically register the student
        const emailLocalPart = normalizedIdentifier.split("@")[0];
        const parts = emailLocalPart.split(".");
        
        let parsedName = "STI Student";
        let parsedId = "STI-" + Date.now().toString().slice(-6);

        if (parts.length >= 2) {
          const idCandidate = parts[parts.length - 1];
          if (/^\d+$/.test(idCandidate)) {
            parsedId = idCandidate;
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
          idNumber: parsedId,
          department: "WNU STI",
          course: "General Program",
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
      const { name, email, idNumber, course, department, avatar } = req.body;
      
      const user = await studentModel.updateUserProfile(userId, { name, email, idNumber, course, department, avatar });
      
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
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    
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
    const book = await studentModel.getBookById(id);
    
    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    return res.json({ book });
  },

  async searchBooks(req, res) {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: "Search query is required." });
    }

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
    
    const result = await studentModel.searchBooks(q, page, limit);
    
    // Broadcast real-time search telemetry event to Super Admin
    void eventDispatcher.dispatchSearchEvent({ query: q, actor: req.user?.name || "Student" });

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
    
    const transaction = await studentModel.returnBook(transactionId);
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
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
};


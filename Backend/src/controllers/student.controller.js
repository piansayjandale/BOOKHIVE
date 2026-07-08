import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { studentModel } from "../models/student.model.js";

export const studentController = {
  async login(req, res) {
    const { email, password } = req.body;
    console.log("LOGIN REQUEST BODY:", req.body);
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await studentModel.findUserByEmail(normalizedEmail);

    if (!user) {
      // Check if it matches allowed school domains
      const isSchool = normalizedEmail.endsWith("@sti.edu.ph") || 
                       normalizedEmail.endsWith("@stiwnu.edu.ph") || 
                       normalizedEmail.endsWith("@wnu.sti.edu.ph");
      
      if (isSchool) {
        // Automatically register the student
        const emailLocalPart = normalizedEmail.split("@")[0];
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

        const passwordHash = await bcrypt.hash(password, 10);
        user = await studentModel.createUser({
          name: parsedName,
          email: normalizedEmail,
          idNumber: parsedId,
          department: "WNU STI",
          course: "General Program",
          passwordHash,
          role: "Student",
        });

        if (!user) {
          return res.status(500).json({ message: "Failed to create automatic user." });
        }
      } else {
        return res.status(401).json({ message: "Invalid credentials." });
      }
    } else {
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
      },
    });
  },

  async register(req, res) {
    const { email, password, name, idNumber, department, course } = req.body;

    if (!email || !password || !name || !idNumber) {
      return res.status(400).json({ message: "Email, password, name, and idNumber are required." });
    }

    const existing = await studentModel.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await studentModel.createUser({
      name,
      email,
      idNumber,
      department: department || "STI Student",
      course: course || "General Program",
      passwordHash,
      role: "Student",
    });

    if (!user) {
      return res.status(500).json({ message: "Failed to create user." });
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
    const userId = req.user.sub;
    const { bookId, studentName, studentId, department, isbn, resourceTitle, dueDate, studentIdImage } = req.body;

    if (!bookId) {
      return res.status(400).json({ message: "Book ID is required." });
    }

    const transaction = await studentModel.borrowBook(userId, bookId, {
      studentName,
      studentId,
      department,
      isbn,
      resourceTitle,
      dueDate,
      studentIdImage,
    });

    return res.status(201).json({
      message: "Borrow request submitted.",
      transaction,
    });
  },

  async reserveBook(req, res) {
    const userId = req.user.sub;
    const { bookId, studentName, studentId, department, isbn, resourceTitle, dueDate, studentIdImage } = req.body;

    if (!bookId) {
      return res.status(400).json({ message: "Book ID is required." });
    }

    const transaction = await studentModel.reserveBook(userId, bookId, {
      studentName,
      studentId,
      department,
      isbn,
      resourceTitle,
      dueDate,
      studentIdImage,
    });

    return res.status(201).json({
      message: "Reservation request submitted.",
      transaction,
    });
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
};


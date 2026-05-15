import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { studentModel } from "../models/student.model.js";

export const studentController = {
  async login(req, res) {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await studentModel.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials." });
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
      },
    });
  },

  async register(req, res) {
    const { email, password, name, idNumber, department, course } = req.body;

    if (!email || !password || !name || !idNumber || !department || !course) {
      return res.status(400).json({ message: "Email, password, name, idNumber, department, and course are required." });
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
      department,
      course,
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
    const userId = req.user.sub;
    const { name, email } = req.body;
    
    const user = await studentModel.updateUserProfile(userId, { name, email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user });
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
    const { bookId, studentName, studentId, department, isbn, resourceTitle, dueDate } = req.body;

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
    });

    return res.status(201).json({
      message: "Borrow request submitted.",
      transaction,
    });
  },

  async reserveBook(req, res) {
    const userId = req.user.sub;
    const { bookId, studentName, studentId, department, isbn, resourceTitle, dueDate } = req.body;

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
};

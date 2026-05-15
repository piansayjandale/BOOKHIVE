import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { adminModel } from "../models/admin.model.js";

const DEV_CREDENTIALS = {
  "yana.palmares@stiwnu.edu.ph": {
    id: "user-001",
    name: "Yana Palmares",
    email: "yana.palmares@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    idNumber: "ADM-2026-0001",
    department: "Library Administration",
    course: "Library Administration",
  },
  "joseph.tan@stiwnu.edu.ph": {
    id: "user-002",
    name: "Joseph Tan",
    email: "joseph.tan@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-002",
    department: "Library",
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
      console.warn("Backend login DB failed, checking fallback:", error.message);
    }

    // Fallback for development
    if (!user && process.env.NODE_ENV !== "production") {
      const devAccount = DEV_CREDENTIALS[identifier.toLowerCase()];
      if (devAccount && devAccount.password === password) {
        user = { ...devAccount, passwordHash: "HIDDEN" };
      }
    }

    if (!user || !["Admin", "Librarian"].includes(user.role)) {
      return res.status(401).json({ message: "Invalid credentials." });
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
      },
    });
  },

  async getDashboard(_req, res) {
    const [summary, monthlyBorrowTrends, departmentUsage, recentActivities, newUsers, latestTransactions] =
      await Promise.all([
        adminModel.getDashboardSummary(),
        adminModel.getMonthlyBorrowTrends(),
        adminModel.getDepartmentUsage(),
        adminModel.getRecentActivities(),
        adminModel.getRecentUsers(),
        adminModel.getLatestTransactions(),
      ]);

    return res.json({
      summary,
      monthlyBorrowTrends,
      departmentUsage,
      recentActivities,
      newUsers,
      latestTransactions,
    });
  },

  async listUsers(req, res) {
    const search = String(req.query.search ?? "");
    const role = String(req.query.role ?? "All");
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));
    const offset = (page - 1) * pageSize;
    const result = await adminModel.listUsers({ search, role, limit: pageSize, offset });

    return res.json({
      users: result.rows,
      total: result.total,
      page,
      pageSize,
    });
  },

  async createUser(req, res) {
    const passwordHash = await bcrypt.hash(req.body.idNumber, 10);
    const user = await adminModel.createUser({ ...req.body, passwordHash });
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

    return res.json({ user });
  },

  async deleteUser(req, res) {
    await adminModel.deleteUser(req.params.id);
    return res.json({ ok: true });
  },

  // --- Option A: Transaction approval workflow ---
  async listTransactions(req, res) {
    const status = String(req.query.status ?? 'Pending');
    const type = req.query.type ? String(req.query.type) : null;

    const { transactions } = await adminModel.listTransactions({ status, type });
    return res.json({ transactions });
  },

  async decideTransaction(req, res) {
    const { transactionId } = req.params;
    const { status } = req.body;

    if (!status || !['Approved', 'Declined', 'Returned'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const transaction = await adminModel.decideTransaction({
      transactionId,
      status,
      decidedBy: req.user.sub,
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    return res.json({ transaction });
  },
};


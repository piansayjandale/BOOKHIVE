import { Router } from "express";

import { adminController } from "../controllers/admin.controller.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminRouter = Router();

adminRouter.use(authenticateToken);

// --- Staff Routes (Accessible to Admins and Librarians) ---
adminRouter.get("/dashboard", asyncHandler(adminController.getDashboard));

// Transactions approval and desk creations
adminRouter.get("/transactions", asyncHandler(adminController.listTransactions));
adminRouter.post("/transactions", asyncHandler(adminController.createTransaction));
adminRouter.patch("/transactions/:transactionId", asyncHandler(adminController.decideTransaction));

// Catalog Management
adminRouter.get("/books", asyncHandler(adminController.listBooks));
adminRouter.post("/books", asyncHandler(adminController.addBook));
adminRouter.put("/books/:id", asyncHandler(adminController.updateBook));
adminRouter.delete("/books/:id", asyncHandler(adminController.deleteBook));
adminRouter.get("/records-catalog", asyncHandler(adminController.getRecordsCatalog));

// Announcements
adminRouter.get("/announcements", asyncHandler(adminController.listAnnouncements));
adminRouter.post("/announcements", requireAdmin, asyncHandler(adminController.addAnnouncement));
adminRouter.put("/announcements/:id", requireAdmin, asyncHandler(adminController.updateAnnouncement));
adminRouter.delete("/announcements/:id", requireAdmin, asyncHandler(adminController.deleteAnnouncement));

// Settings
adminRouter.get("/settings", asyncHandler(adminController.getSettings));
adminRouter.patch("/settings", asyncHandler(adminController.updateSettings));

// Reports
adminRouter.get("/reports", asyncHandler(adminController.getReports));

// Logs
adminRouter.get("/activity", asyncHandler(adminController.listActivityLogs));
adminRouter.get("/history", asyncHandler(adminController.listHistoryLogs));
adminRouter.get("/monitoring", asyncHandler(adminController.getMonitoring));

// AI Prompt Search
adminRouter.get("/prompt-search", asyncHandler(adminController.getPromptSearchLogs));
adminRouter.post("/prompt-search", asyncHandler(adminController.runPromptSearch));
adminRouter.delete("/prompt-search/:id", asyncHandler(adminController.deletePromptSearchLog));
adminRouter.delete("/prompt-search", asyncHandler(adminController.deletePromptSearchLog));

// Profile
adminRouter.get("/profile", asyncHandler(adminController.getProfile));
adminRouter.patch("/profile", asyncHandler(adminController.updateProfile));
adminRouter.post("/profile/password", asyncHandler(adminController.changePassword));

// --- Admin-Only Routes ---
adminRouter.use(requireAdmin);

adminRouter.get("/users", asyncHandler(adminController.listUsers));
adminRouter.post("/users", asyncHandler(adminController.createUser));
adminRouter.put("/users/:id", asyncHandler(adminController.updateUser));
adminRouter.patch("/users/:id", asyncHandler(adminController.updateUser));
adminRouter.delete("/users/:id", asyncHandler(adminController.deleteUser));


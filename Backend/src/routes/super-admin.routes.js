import { Router } from "express";

import { superAdminController } from "../controllers/super-admin.controller.js";
import { authenticateToken, requireSuperAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const superAdminRouter = Router();

// Strict RBAC: All Super Admin routes require JWT authentication and SUPER_ADMIN role
superAdminRouter.use(authenticateToken);
superAdminRouter.use(requireSuperAdmin);

// 1. Dashboard Vitals & Infrastructure Overview
superAdminRouter.get("/dashboard", asyncHandler(superAdminController.getDashboard));

// 2. User Account CRUD (All User Types)
superAdminRouter.get("/users", asyncHandler(superAdminController.listUsers));
superAdminRouter.post("/users", asyncHandler(superAdminController.createUser));
superAdminRouter.put("/users/:id", asyncHandler(superAdminController.updateUser));
superAdminRouter.patch("/users/:id", asyncHandler(superAdminController.updateUser));
superAdminRouter.delete("/users/:id", asyncHandler(superAdminController.deleteUser));

// 3. Permanent Data Pruning
superAdminRouter.post("/pruning/books", asyncHandler(superAdminController.purgeArchivedBooks));
superAdminRouter.post("/pruning/accounts", asyncHandler(superAdminController.purgeDeactivatedAccounts));

// 4. Infrastructure Health & Search Index Rebuild
superAdminRouter.get("/infrastructure", asyncHandler(superAdminController.getInfrastructure));
superAdminRouter.post("/infrastructure/rebuild-index", asyncHandler(superAdminController.rebuildIndex));

// 5. Audit & Security Logs
superAdminRouter.get("/audit-logs", asyncHandler(superAdminController.listAuditLogs));

// 6. Master Records (Tabbed: Accounts, Books, Transactions)
superAdminRouter.get("/records", asyncHandler(superAdminController.getRecords));

// 7. Global Settings & Institutional Sync
superAdminRouter.get("/settings", asyncHandler(superAdminController.getSettings));
superAdminRouter.patch("/settings", asyncHandler(superAdminController.updateSettings));
superAdminRouter.post("/settings/sync", asyncHandler(superAdminController.triggerInstitutionalSync));

// 8. Database Backups & Snapshots
superAdminRouter.get("/backups", asyncHandler(superAdminController.listBackups));
superAdminRouter.post("/backups", asyncHandler(superAdminController.triggerBackup));
superAdminRouter.post("/backups/restore", asyncHandler(superAdminController.restoreBackup));

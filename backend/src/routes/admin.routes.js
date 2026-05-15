import { Router } from "express";

import { adminController } from "../controllers/admin.controller.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminRouter = Router();

adminRouter.use(authenticateToken);

// Dashboard is accessible to all staff (Admins and Librarians)
adminRouter.get("/dashboard", asyncHandler(adminController.getDashboard));

// All other routes below are restricted to Admins only
adminRouter.use(requireAdmin);

adminRouter.get("/users", asyncHandler(adminController.listUsers));
adminRouter.post("/users", asyncHandler(adminController.createUser));
adminRouter.patch("/users/:id", asyncHandler(adminController.updateUser));
adminRouter.delete("/users/:id", asyncHandler(adminController.deleteUser));

// Transaction approval workflow (Option A)
adminRouter.get("/transactions", asyncHandler(adminController.listTransactions));
adminRouter.patch("/transactions/:transactionId", asyncHandler(adminController.decideTransaction));


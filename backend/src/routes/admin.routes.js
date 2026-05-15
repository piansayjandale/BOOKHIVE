import { Router } from "express";

import { adminController } from "../controllers/admin.controller.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminRouter = Router();

adminRouter.use(authenticateToken, requireAdmin);

adminRouter.get("/dashboard", asyncHandler(adminController.getDashboard));
adminRouter.get("/users", asyncHandler(adminController.listUsers));
adminRouter.post("/users", asyncHandler(adminController.createUser));
adminRouter.patch("/users/:id", asyncHandler(adminController.updateUser));
adminRouter.delete("/users/:id", asyncHandler(adminController.deleteUser));

// Transaction approval workflow (Option A)
adminRouter.get("/transactions", asyncHandler(adminController.listTransactions));
adminRouter.patch("/transactions/:transactionId", asyncHandler(adminController.decideTransaction));


import { Router } from "express";

import { asyncHandler } from "../utils/async-handler.js";
import { studentController } from "../controllers/student.controller.js";
import { authenticateToken } from "../middleware/auth.js";

export const studentRouter = Router();

// Public routes
studentRouter.post("/login", asyncHandler(studentController.login));

// Protected routes
studentRouter.use(authenticateToken);

studentRouter.get("/profile", asyncHandler(studentController.getProfile));
studentRouter.put("/profile", asyncHandler(studentController.updateProfile));

studentRouter.get("/books", asyncHandler(studentController.getBooks));
studentRouter.get("/books/search", asyncHandler(studentController.searchBooks));
studentRouter.get("/books/:id", asyncHandler(studentController.getBook));

studentRouter.get("/borrow-history", asyncHandler(studentController.getBorrowHistory));
studentRouter.post("/borrow", asyncHandler(studentController.borrowBook));
studentRouter.post("/reserve", asyncHandler(studentController.reserveBook));
studentRouter.post("/return/:transactionId", asyncHandler(studentController.returnBook));


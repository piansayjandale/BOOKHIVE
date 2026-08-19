import { Router } from "express";

import { asyncHandler } from "../utils/async-handler.js";
import { studentController } from "../controllers/student.controller.js";
import { authenticateToken } from "../middleware/auth.js";

export const studentRouter = Router();

// Public routes
studentRouter.post("/login", asyncHandler(studentController.login));
studentRouter.post("/register", asyncHandler(studentController.register));
studentRouter.post("/reset-password", asyncHandler(studentController.resetPassword));

// Protected routes
studentRouter.use(authenticateToken);

studentRouter.get("/profile", asyncHandler(studentController.getProfile));
studentRouter.put("/profile", asyncHandler(studentController.updateProfile));

studentRouter.get("/books", asyncHandler(studentController.getBooks));
studentRouter.get("/books/search", asyncHandler(studentController.searchBooks));
studentRouter.get("/books/:id", asyncHandler(studentController.getBook));

studentRouter.get("/announcements", asyncHandler(studentController.getAnnouncements));

studentRouter.get("/borrow-history", asyncHandler(studentController.getBorrowHistory));
studentRouter.get("/recommendations", asyncHandler(studentController.getRecommendations));

studentRouter.post("/borrow", asyncHandler(studentController.borrowBook));
studentRouter.post("/reserve", asyncHandler(studentController.reserveBook));
studentRouter.post("/reservations", asyncHandler(studentController.reserveBook));
studentRouter.post("/reservations/:id/cancel", asyncHandler(studentController.cancelReservation));
studentRouter.patch("/reservations/:id/cancel", asyncHandler(studentController.cancelReservation));
studentRouter.post("/cancel/:id", asyncHandler(studentController.cancelReservation));
studentRouter.patch("/cancel/:id", asyncHandler(studentController.cancelReservation));
studentRouter.post("/return/:transactionId", asyncHandler(studentController.returnBook));

// QR resolution & Library Card + Violations read-only views
studentRouter.get("/qr/:qrCode", asyncHandler(studentController.getStudentByQr));
studentRouter.get("/card-by-qr/:qrCode", asyncHandler(studentController.getStudentByQr));
studentRouter.get("/card-and-violations/:qrCode", asyncHandler(studentController.getStudentByQr));




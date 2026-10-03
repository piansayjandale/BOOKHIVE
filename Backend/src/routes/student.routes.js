import { Router } from "express";

import { asyncHandler } from "../utils/async-handler.js";
import { studentController } from "../controllers/student.controller.js";
import { authenticateToken, optionalAuthenticateToken } from "../middleware/auth.js";

export const studentRouter = Router();

// Public routes
studentRouter.post("/login", asyncHandler(studentController.login));
studentRouter.post("/register", asyncHandler(studentController.register));
studentRouter.post("/reset-password", asyncHandler(studentController.resetPassword));

// QR resolution & Library Card + Violations public verification views
studentRouter.get("/qr/:qrCode", asyncHandler(studentController.getStudentByQr));
studentRouter.get("/card-by-qr/:qrCode", asyncHandler(studentController.getStudentByQr));
studentRouter.get("/card-and-violations/:qrCode", asyncHandler(studentController.getStudentByQr));
studentRouter.get("/verify/:qrCode", asyncHandler(studentController.renderStudentVerificationWebPage));

// Return routes (accessible with optional token so circulation scanners never fail)
studentRouter.post("/return/:transactionId", optionalAuthenticateToken, asyncHandler(studentController.returnBook));
studentRouter.patch("/return/:transactionId", optionalAuthenticateToken, asyncHandler(studentController.returnBook));

// OCR Paper / Words Scanner Route (Primary for Librarian Catalog)
studentRouter.post("/ocr/scan-paper", optionalAuthenticateToken, asyncHandler(studentController.scanPaperOcr));

// AI Semantic Prompt & Document Search Route
studentRouter.post("/ai-search", optionalAuthenticateToken, asyncHandler(studentController.aiSearch));

// Book Catalog & Search (Public / Optional Auth for guest or student browsing)
studentRouter.get("/books", optionalAuthenticateToken, asyncHandler(studentController.getBooks));
studentRouter.get("/books/search", optionalAuthenticateToken, asyncHandler(studentController.searchBooks));
studentRouter.get("/books/:id", optionalAuthenticateToken, asyncHandler(studentController.getBook));

// Protected routes
studentRouter.use(authenticateToken);

studentRouter.get("/profile", asyncHandler(studentController.getProfile));
studentRouter.put("/profile", asyncHandler(studentController.updateProfile));

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




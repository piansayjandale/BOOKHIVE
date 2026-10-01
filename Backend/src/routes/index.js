import { Router } from "express";

import { adminRouter } from "./admin.routes.js";
import { authRouter } from "./auth.routes.js";
import { studentRouter } from "./student.routes.js";
import { superAdminRouter } from "./super-admin.routes.js";

import { adminModel } from "../models/admin.model.js";
import { adminController } from "../controllers/admin.controller.js";
import { studentController } from "../controllers/student.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/super-admin", superAdminRouter);
apiRouter.use("/student", studentRouter);

// Standardized direct endpoint aliases for Expo Mobile App & Web Dashboard integration
apiRouter.get("/dashboard", asyncHandler(adminController.getDashboard));
apiRouter.get("/trending-books", asyncHandler(async (_req, res) => {
  try {
    const topBooks = await adminModel.getTopBorrowedBooks(10).catch(() => []);
    return res.json({ books: topBooks || [], topBooks: topBooks || [] });
  } catch (err) {
    console.warn("[trending-books Fallback]:", err.message);
    return res.json({ books: [], topBooks: [] });
  }
}));
apiRouter.get("/transactions", asyncHandler(adminController.listTransactions));
apiRouter.patch("/transactions/:transactionId", asyncHandler(adminController.decideTransaction));
apiRouter.get("/books", asyncHandler(studentController.getBooks));
apiRouter.post("/books", asyncHandler(adminController.addBook));
apiRouter.post("/circulation/borrow", asyncHandler(studentController.borrowBook));
apiRouter.post("/borrow", asyncHandler(studentController.borrowBook));
apiRouter.post("/reservations", asyncHandler(studentController.reserveBook));
apiRouter.post("/reserve", asyncHandler(studentController.reserveBook));
apiRouter.post("/reservations/:id/cancel", asyncHandler(studentController.cancelReservation));
apiRouter.patch("/reservations/:id/cancel", asyncHandler(studentController.cancelReservation));
apiRouter.post("/reservations/cancel/:id", asyncHandler(studentController.cancelReservation));
apiRouter.patch("/reservations/cancel/:id", asyncHandler(studentController.cancelReservation));
apiRouter.post("/student/cancel/:id", asyncHandler(studentController.cancelReservation));
apiRouter.patch("/student/cancel/:id", asyncHandler(studentController.cancelReservation));
apiRouter.post("/transactions/:transactionId/return", asyncHandler(studentController.returnBook));
apiRouter.post("/return/:transactionId", asyncHandler(studentController.returnBook));
apiRouter.patch("/return/:transactionId", asyncHandler(studentController.returnBook));





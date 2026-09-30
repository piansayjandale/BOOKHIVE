import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { corsOptions } from "./config/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";
import { studentController } from "./controllers/student.controller.js";
import { asyncHandler } from "./utils/async-handler.js";

export function createApp() {
  const app = express();

  // CORS middleware supporting web frontends, localhost, mobile APKs, and hybrid schemes
  app.use(cors(corsOptions));

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Dedicated health-check endpoint for Render zero-downtime health probes and uptime monitoring
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      app: "BOOKHIVE",
      timestamp: new Date().toISOString(),
    });
  });

  // Alias health probe for client or proxy checks
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      app: "BOOKHIVE",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/verify/:qrCode", asyncHandler(studentController.renderStudentVerificationWebPage));
  app.get("/verify", asyncHandler(studentController.renderStudentVerificationWebPage));

  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
}

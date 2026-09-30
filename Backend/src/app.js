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

  // Root status endpoint for Vercel apex domain checks
  app.get("/", (_req, res) => {
    res.status(200).json({
      status: "ok",
      app: "BOOKHIVE",
      message: "BookHive Backend API Serverless Runtime Active",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/verify/:qrCode", asyncHandler(studentController.renderStudentVerificationWebPage));
  app.get("/verify", asyncHandler(studentController.renderStudentVerificationWebPage));

  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
}

// Instantiate singleton Express application instance for Vercel / serverless runtimes
const app = createApp();

// Prevent port conflicts in Vercel serverless environments:
// Only execute app.listen() when running directly as standalone script in local development.
// In Vercel and cloud platforms, the hosting environment manages the HTTP lifecycle automatically.
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const isDirectRun =
    process.argv[1] &&
    (process.argv[1].endsWith("app.js") || process.argv[1].endsWith("app"));

  if (isDirectRun) {
    const PORT = Number(process.env.PORT || 5000);
    const HOST = process.env.HOST || "0.0.0.0";
    app.listen(PORT, HOST, () => {
      console.log(
        `[BookHive API] Local standalone server listening on http://${HOST}:${PORT}`
      );
    });
  }
}

export default app;

import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { env } from "./config/env.js";
import { corsOptions } from "./config/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";
import { studentController } from "./controllers/student.controller.js";
import { asyncHandler } from "./utils/async-handler.js";
import { pool, isDatabaseConnected } from "./db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPublicDir = path.resolve(__dirname, "../../public");

export function createApp() {
  const app = express();

  // CORS middleware supporting web frontends, localhost, mobile APKs, and hybrid schemes
  app.use(cors(corsOptions));

  // 1. Static Files & Favicon Optimization:
  // Intercept /favicon.ico immediately before DB middleware or body parsers.
  // Returns 204 No Content if no file exists to avoid unnecessary DB queries or lambda invocation penalties.
  app.get("/favicon.ico", (_req, res) => {
    const faviconPath = path.join(rootPublicDir, "favicon.ico");
    if (fs.existsSync(faviconPath)) {
      return res.sendFile(faviconPath);
    }
    return res.status(204).end();
  });

  // Serve static assets and mobile APK direct download routes without executing DB middleware
  app.use("/downloads", express.static(path.join(rootPublicDir, "downloads"), { maxAge: "1d" }));
  app.use(express.static(rootPublicDir, { maxAge: "1d" }));

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Dedicated health-check endpoint for Render / Vercel uptime monitoring
  // Always returns 200 OK so health probes succeed even if DB is in fallback/offline mode
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      app: "BOOKHIVE",
      database: isDatabaseConnected() ? "connected" : "offline_fallback",
      timestamp: new Date().toISOString(),
    });
  });

  // Alias health probe for client or proxy checks
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      app: "BOOKHIVE",
      database: isDatabaseConnected() ? "connected" : "offline_fallback",
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Graceful Root Route (/) with Error-Resilient Fallback:
  // If the database is missing tables or unreachable, safely renders without throwing 500.
  app.get("/", async (req, res) => {
    let books = [];
    let dbStatus = "offline_fallback";

    try {
      if (isDatabaseConnected()) {
        const queryRes = await pool.query("SELECT * FROM books LIMIT 6").catch((err) => {
          console.warn("[Root Route DB Notice]:", err.message);
          return { rows: [] };
        });
        books = queryRes?.rows || [];
        dbStatus = "connected";
      }
    } catch (dbErr) {
      console.warn("[Root Route Fallback Activated]:", dbErr.message);
      books = [];
      dbStatus = "offline_fallback";
    }

    const acceptsHtml = req.accepts(["html", "json"]) === "html";
    if (acceptsHtml && !req.xhr && !req.headers["x-requested-with"]) {
      return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BookHive API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; }
    .card { max-width: 650px; margin: 2rem auto; background: #1e293b; border-radius: 12px; padding: 2rem; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    h1 { color: #38bdf8; margin-top: 0; font-size: 1.75rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; background: #0284c7; color: white; margin-bottom: 1rem; }
    .status { margin: 0.5rem 0; color: #94a3b8; font-size: 0.95rem; }
    .status strong { color: #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>BookHive API</h1>
    <span class="badge">Operational</span>
    <p class="status">Runtime: <strong>Vercel Serverless (Express)</strong></p>
    <p class="status">Database Status: <strong>${dbStatus}</strong></p>
    <p class="status">Books Discovered: <strong>${books.length}</strong></p>
  </div>
</body>
</html>
      `);
    }

    return res.status(200).json({
      status: "ok",
      app: "BOOKHIVE",
      database: dbStatus,
      message: "BookHive Backend API Serverless Runtime Active",
      books,
      totalBooks: books.length,
      timestamp: new Date().toISOString(),
    });
  });

  // Public student ID card verification routes
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

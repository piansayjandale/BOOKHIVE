if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {};
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}

if (typeof global !== 'undefined') {
  if (!global.DOMMatrix) global.DOMMatrix = globalThis.DOMMatrix;
  if (!global.ImageData) global.ImageData = globalThis.ImageData;
  if (!global.Path2D) global.Path2D = globalThis.Path2D;
}

import "./polyfills.js";
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

  // Mobile APK direct download route: serves HTML/views directly without waiting for blocking database calls
  app.get(["/download", "/mobile"], (req, res) => {
    const apkFileName = "bookhive-release.apk";
    const directApkUrl = "/downloads/" + apkFileName;

    // Check if client explicitly requests direct file download via query parameter
    if (req.query.direct === "true" || req.query.file === "true") {
      const localApkPath = path.join(rootPublicDir, "downloads", apkFileName);
      if (fs.existsSync(localApkPath)) {
        return res.download(localApkPath, apkFileName);
      }
      return res.redirect(directApkUrl);
    }

    // Return JSON if client requested json query
    if (req.query.json === "true" || (req.accepts(["html", "json"]) === "json" && !req.accepts("html"))) {
      return res.status(200).json({
        status: "ok",
        app: "BOOKHIVE",
        downloadUrl: directApkUrl,
        filename: apkFileName,
        platform: "Android",
        compatibility: "Android 8.0+",
      });
    }

    // Serve HTML download page directly without blocking database calls
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download BookHive for Android</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1825; color: #f1f5f9; padding: 2rem 1rem; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
    .container { max-width: 540px; width: 100%; background: #122130; border-radius: 16px; padding: 2.25rem 2rem; border: 1px solid #1e3a5f; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); margin-bottom: 1.25rem; }
    .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
    h1 { color: #ffffff; margin: 0 0 0.5rem 0; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; }
    p.subtitle { color: #94a3b8; font-size: 0.95rem; margin: 0 0 1.75rem 0; line-height: 1.5; }
    .btn-download { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 1rem 1.5rem; background: linear-gradient(135deg, #f59e0b, #d97706); color: #0b1825; font-size: 1.05rem; font-weight: 700; text-decoration: none; border-radius: 12px; transition: all 0.2s; box-shadow: 0 8px 20px rgba(245, 158, 11, 0.35); }
    .btn-download:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(245, 158, 11, 0.45); background: linear-gradient(135deg, #fbbf24, #f59e0b); }
    .file-meta { margin-top: 0.75rem; font-size: 0.8rem; color: #64748b; }
    .instructions { margin-top: 2rem; text-align: left; background: #0a1420; border-radius: 12px; padding: 1.25rem 1.5rem; border: 1px solid #1e293b; }
    .instructions h3 { margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.05em; }
    .instructions ol { margin: 0; padding-left: 1.25rem; color: #cbd5e1; font-size: 0.85rem; line-height: 1.6; }
    .instructions li { margin-bottom: 0.4rem; }
    .footer { margin-top: 1.5rem; font-size: 0.75rem; color: #475569; }
    .footer a { color: #38bdf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge"><span class="badge-dot"></span> Official Mobile Release &bull; Android</div>
    <h1>BookHive for Android</h1>
    <p class="subtitle">Access library catalogs, digital student ID barcodes, holds, and loan due countdowns on your mobile device.</p>
    <a href="${directApkUrl}" download="${apkFileName}" class="btn-download">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <span>Download BookHive APK</span>
    </a>
    <div class="file-meta">Package: ${apkFileName} &bull; Target: Android 8.0+ &bull; Free</div>
    <div class="instructions">
      <h3>Installation Guide</h3>
      <ol>
        <li>Download the APK file using the button above.</li>
        <li>Tap <strong>&ldquo;Download anyway&rdquo;</strong> if prompted by Android security.</li>
        <li>Open the downloaded file and allow <strong>&ldquo;Install unknown apps&rdquo;</strong> to complete installation.</li>
      </ol>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} BookHive Library Ecosystem. <a href="/">Return to API Overview</a></p>
    </div>
  </div>
</body>
</html>`);
  });

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
  // Serves HTML/views directly without waiting for blocking database calls.
  app.get("/", (req, res) => {
    const dbStatus = isDatabaseConnected() ? "connected" : "offline_fallback";
    const acceptsHtml = req.accepts(["html", "json"]) === "html";

    if (acceptsHtml && !req.xhr && !req.headers["x-requested-with"]) {
      return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BookHive API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { max-width: 600px; width: 100%; background: #1e293b; border-radius: 14px; padding: 2.25rem 2rem; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    h1 { color: #38bdf8; margin: 0 0 0.5rem 0; font-size: 1.85rem; font-weight: 700; }
    .subtitle { color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.3rem 0.8rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; background: #0284c7; color: white; margin-bottom: 1.25rem; }
    .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; }
    .status-group { background: #0f172a; border-radius: 10px; padding: 1rem 1.25rem; border: 1px solid #334155; margin-bottom: 1.5rem; }
    .status-row { display: flex; justify-content: space-between; padding: 0.35rem 0; color: #94a3b8; font-size: 0.9rem; }
    .status-row strong { color: #f1f5f9; }
    .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.7rem 1.25rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; text-decoration: none; transition: all 0.2s; }
    .btn-primary { background: #38bdf8; color: #0f172a; }
    .btn-primary:hover { background: #7dd3fc; }
    .btn-secondary { background: #334155; color: #f8fafc; border: 1px solid #475569; }
    .btn-secondary:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="badge-dot"></span> Operational</div>
    <h1>BookHive API</h1>
    <p class="subtitle">STI West Negros University Library Management System &bull; Serverless Runtime</p>
    <div class="status-group">
      <div class="status-row"><span>Runtime Environment</span><strong>Vercel Serverless (Express)</strong></div>
      <div class="status-row"><span>Database Dialect</span><strong>PostgreSQL / MySQL Adaptive</strong></div>
      <div class="status-row"><span>Database Connection</span><strong>${dbStatus}</strong></div>
      <div class="status-row"><span>System Health</span><strong>OK &bull; Non-blocking Root Resilient</strong></div>
    </div>
    <div class="actions">
      <a href="/download" class="btn btn-primary">Download Mobile App (APK)</a>
      <a href="/health" class="btn btn-secondary">API Health Probe</a>
    </div>
  </div>
</body>
</html>`);
    }

    return res.status(200).json({
      status: "ok",
      app: "BOOKHIVE",
      database: dbStatus,
      message: "BookHive Backend API Serverless Runtime Active",
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

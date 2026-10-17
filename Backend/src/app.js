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
const frontendPublicDir = path.resolve(__dirname, "../../Librarian Admin/Librarian and Admin/frontend/public");

export function createApp() {
  const app = express();

  // CORS middleware supporting web frontends, localhost, mobile APKs, and hybrid schemes
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));


  // 1. Static Files & Favicon Optimization:
  // Intercept /favicon.ico immediately before DB middleware or body parsers.
  // Returns 204 No Content if no file exists to avoid unnecessary DB queries or lambda invocation penalties.
  app.get("/favicon.ico", (_req, res) => {
    const faviconPath = path.join(rootPublicDir, "favicon.ico");
    if (fs.existsSync(faviconPath)) {
      return res.sendFile(faviconPath);
    }
    const altFaviconPath = path.join(frontendPublicDir, "favicon.ico");
    if (fs.existsSync(altFaviconPath)) {
      return res.sendFile(altFaviconPath);
    }
    return res.status(204).end();
  });

  // Serve static assets from frontend and root public directories
  if (fs.existsSync(frontendPublicDir)) {
    app.use(express.static(frontendPublicDir, { maxAge: "1d" }));
  }
  app.use("/downloads", express.static(path.join(rootPublicDir, "downloads"), { maxAge: "1d" }));
  app.use(express.static(rootPublicDir, { maxAge: "1d" }));

  // Apple Over-The-Air (OTA) wireless app installation manifest
  app.get("/downloads/manifest.plist", (req, res) => {
    const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "https";
    const host = req.get("host");
    const ipaUrl = `${protocol}://${host}/downloads/bookhive-release.ipa`;
    const iconUrl = `${protocol}://${host}/logo.png`;

    res.set("Content-Type", "application/x-plist");
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${ipaUrl}</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>display-image</string>
          <key>needs-shine</key>
          <false/>
          <key>url</key>
          <string>${iconUrl}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>ph.edu.stiwnu.bookhive</string>
        <key>bundle-version</key>
        <string>1.0.4</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>BookHive</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`);
  });

  // Mobile download route: serves cross-platform access for both Android and iOS
  app.get(["/download", "/mobile"], (req, res) => {
    const apkFileName = "bookhive-release.apk";
    const ipaFileName = "bookhive-release.ipa";
    const directApkUrl = "/downloads/" + apkFileName;
    const userAgent = req.get("user-agent") || "";
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const hasIpa = fs.existsSync(path.join(rootPublicDir, "downloads", ipaFileName));
    const host = req.get("host");
    const otaManifestUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(`https://${host}/downloads/manifest.plist`)}`;

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
        platforms: {
          android: {
            downloadUrl: directApkUrl,
            filename: apkFileName,
            format: "APK",
            compatibility: "Android 8.0+",
          },
          ios: {
            bundleIdentifier: "ph.edu.stiwnu.bookhive",
            hasDirectOta: hasIpa,
            directOtaUrl: hasIpa ? otaManifestUrl : null,
            expoGoAppStoreUrl: "https://apps.apple.com/app/expo-go/id982107779",
            webAppUrl: "/",
            instructions: "Use Safari 'Add to Home Screen', TestFlight, or OTA link",
          },
        },
      });
    }

    // Serve HTML download page supporting both Android and iOS
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Get BookHive Mobile for Android &amp; iOS | STI WNU</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem 1rem; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
    .container { max-width: 540px; width: 100%; background: #ffffff; border-radius: 24px; padding: 2.25rem 2rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06), 0 8px 10px -6px rgba(0,0,0,0.04); text-align: center; }
    .logo-container { width: 80px; height: 80px; margin: 0 auto 1.25rem; background: #fef9c3; border-radius: 20px; border: 1px solid #fde047; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; }
    .logo-container img { width: 100%; height: 100%; object-fit: contain; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; margin-bottom: 1rem; }
    .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
    h1 { color: #0f172a; margin: 0 0 0.5rem 0; font-size: 1.7rem; font-weight: 800; letter-spacing: -0.02em; }
    p.subtitle { color: #475569; font-size: 0.92rem; margin: 0 0 1.5rem 0; line-height: 1.5; font-weight: 400; }
    
    /* Segmented Tab Switcher */
    .tab-switcher { display: flex; background: #f1f5f9; border-radius: 14px; padding: 4px; margin-bottom: 1.5rem; gap: 4px; }
    .tab-btn { flex: 1; padding: 0.65rem 0.75rem; border: none; background: transparent; font-size: 0.88rem; font-weight: 700; color: #64748b; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .tab-btn.active { background: #ffffff; color: #0072ce; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
    
    .panel { display: none; text-align: left; animation: fadeIn 0.2s ease; }
    .panel.active { display: block; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

    .btn-download { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 0.95rem 1.25rem; background: linear-gradient(135deg, #0072ce, #005bb5); color: #ffffff; font-size: 1rem; font-weight: 700; text-decoration: none; border-radius: 14px; transition: all 0.2s; box-shadow: 0 6px 16px rgba(0, 114, 206, 0.25); border: none; cursor: pointer; }
    .btn-download:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(0, 114, 206, 0.35); color: #ffffff; }
    .btn-download.amber { background: linear-gradient(135deg, #f59e0b, #d97706); color: #0b1825; box-shadow: 0 6px 16px rgba(245, 158, 11, 0.3); }
    .btn-download.amber:hover { background: linear-gradient(135deg, #fbbf24, #f59e0b); }
    .btn-outline { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 0.75rem 1rem; background: #ffffff; color: #0072ce; font-size: 0.9rem; font-weight: 600; text-decoration: none; border-radius: 12px; border: 1.5px solid #0072ce; transition: all 0.2s; margin-top: 0.75rem; }
    .btn-outline:hover { background: #eff6ff; }

    .file-meta { margin: 0.85rem 0 1.25rem; font-size: 0.8rem; color: #64748b; display: flex; justify-content: center; gap: 8px; align-items: center; }
    .meta-tag { background: #f1f5f9; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-weight: 600; color: #334155; }
    
    .card-option { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.15rem; margin-bottom: 0.85rem; }
    .card-option-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .card-option-title { font-weight: 700; font-size: 0.95rem; color: #0f172a; display: flex; align-items: center; gap: 6px; }
    .card-pill { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; }
    .card-desc { font-size: 0.85rem; color: #475569; line-height: 1.5; margin: 0 0 0.75rem 0; }
    
    .instructions { background: #f8fafc; border-radius: 14px; padding: 1.15rem 1.35rem; border: 1px solid #e2e8f0; }
    .instructions h3 { margin: 0 0 0.5rem 0; font-size: 0.82rem; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
    .instructions ol { margin: 0; padding-left: 1.2rem; color: #334155; font-size: 0.83rem; line-height: 1.6; }
    .instructions li { margin-bottom: 0.35rem; }
    
    .footer { margin-top: 1.5rem; font-size: 0.75rem; color: #94a3b8; text-align: center; }
    .footer a { color: #0284c7; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <img src="/logo.png" alt="BookHive" />
    </div>
    <div class="badge"><span class="badge-dot"></span> STI WNU Library Ecosystem</div>
    <h1>BookHive Mobile</h1>
    <p class="subtitle">Access library catalogs, digital student ID barcodes, book holds, and due dates directly on your smartphone.</p>
    
    <div class="tab-switcher">
      <button type="button" id="tabAndroid" class="tab-btn ${!isIOS ? "active" : ""}" onclick="switchTab('android')">
        🤖 Android
      </button>
      <button type="button" id="tabIos" class="tab-btn ${isIOS ? "active" : ""}" onclick="switchTab('ios')">
        🍎 Apple iOS
      </button>
    </div>

    <div id="inAppBrowserAlert" style="display:none; background:#fef3c7; border:1px solid #f59e0b; border-radius:12px; padding:0.85rem; margin-bottom:1rem; text-align:left; font-size:0.82rem; color:#92400e;">
      <strong>⚠️ Viewing inside Messenger:</strong> In-app browsers block installing home-screen apps. For the best experience, tap the <strong>three dots (&bull;&bull;&bull;)</strong> in the top-right corner and select <strong>&ldquo;Open in Safari&rdquo;</strong>.
    </div>

    <!-- ANDROID PANEL -->
    <div id="panelAndroid" class="panel ${!isIOS ? "active" : ""}">
      <a href="${directApkUrl}" download="${apkFileName}" class="btn-download amber">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Download Android APK</span>
      </a>
      <div class="file-meta">
        <span class="meta-tag">APK Package</span>
        <span>&bull;</span>
        <span>${apkFileName}</span>
        <span>&bull;</span>
        <span class="meta-tag" style="background:#fef3c7; color:#92400e; border-color:#fde68a;">Free</span>
      </div>
      <div class="instructions">
        <h3>Android Installation Steps</h3>
        <ol>
          <li>Tap <strong>Download Android APK</strong> above.</li>
          <li>Tap <strong>&ldquo;Download anyway&rdquo;</strong> if prompted by Google Chrome.</li>
          <li>Open the downloaded APK and enable <strong>&ldquo;Install unknown apps&rdquo;</strong> to complete setup.</li>
        </ol>
      </div>
    </div>

    <!-- IOS PANEL -->
    <div id="panelIos" class="panel ${isIOS ? "active" : ""}">
      ${hasIpa ? `
      <div class="card-option" style="border-color: #0284c7; background: #f0f9ff;">
        <div class="card-option-header">
          <div class="card-option-title" style="color: #0369a1;">📲 Wireless Direct iOS Install</div>
          <span class="card-pill" style="background:#0284c7; color:#ffffff;">Direct OTA</span>
        </div>
        <p class="card-desc">An iOS application build is available! Tap the button below to install BookHive directly to your iPhone home screen:</p>
        <a href="${otaManifestUrl}" class="btn-download" style="background: linear-gradient(135deg, #0284c7, #0369a1);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Install BookHive on iPhone</span>
        </a>
      </div>
      ` : ''}
      <div class="card-option">
        <div class="card-option-header">
          <div class="card-option-title">📲 Option 1: Add to Home Screen (Safari)</div>
          <span class="card-pill">Instant &bull; No App Store</span>
        </div>
        <p class="card-desc">Run BookHive immediately in full-screen standalone mode with offline capabilities right from Safari:</p>
        <div class="instructions" style="background:#ffffff; margin-bottom: 0.75rem;">
          <ol>
            <li>Open the BookHive Student Portal in <strong>Safari</strong> on your iPhone or iPad.</li>
            <li>Tap the <strong>Share</strong> button (box with upward arrow <span style="font-size:1.1em;">&#x2934;</span>) at the bottom toolbar.</li>
            <li>Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.</li>
            <li>Tap <strong>Add</strong>. BookHive now launches like a native app from your home screen.</li>
          </ol>
        </div>
        <a href="/" class="btn-download">Launch Mobile Web App</a>
      </div>

      <div class="card-option">
        <div class="card-option-header">
          <div class="card-option-title">⚡ Option 2: Expo Go (Native Experience)</div>
          <span class="card-pill" style="background:#ecfdf5; color:#047857;">App Store</span>
        </div>
        <p class="card-desc">Since BookHive is built with Expo &amp; React Native, you can run the native app directly on iPhone via Expo Go:</p>
        <ol style="margin: 0 0 0.75rem 1.25rem; font-size: 0.82rem; color: #334155; line-height: 1.5;">
          <li>Install the free <strong>Expo Go</strong> app from the Apple App Store.</li>
          <li>Launch the development/preview link provided by your library IT or run <code style="background:#e2e8f0; padding:1px 4px; border-radius:4px;">npm run start:tunnel</code>.</li>
        </ol>
        <a href="https://apps.apple.com/app/expo-go/id982107779" target="_blank" rel="noopener noreferrer" class="btn-outline">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-.93.04-2.07.63-2.73 1.4-.58.67-1.09 1.76-.95 2.81 1.04.08 2.11-.53 2.74-1.28z"/></svg>
          <span>Get Expo Go on App Store</span>
        </a>
      </div>
    </div>

    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} BookHive Library Ecosystem. <a href="/">Return to Portal</a></p>
    </div>
  </div>

  <script>
    function switchTab(platform) {
      document.getElementById('tabAndroid').classList.toggle('active', platform === 'android');
      document.getElementById('tabIos').classList.toggle('active', platform === 'ios');
      document.getElementById('panelAndroid').classList.toggle('active', platform === 'android');
      document.getElementById('panelIos').classList.toggle('active', platform === 'ios');
    }
    // Auto-detect client on load if not already matched
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      switchTab('ios');
    }
    // Detect in-app social browsers (Messenger, Instagram, FB)
    if (/FBAN|FBAV|Messenger|Instagram|Line/i.test(navigator.userAgent)) {
      var alertBox = document.getElementById('inAppBrowserAlert');
      if (alertBox) alertBox.style.display = 'block';
    }
  </script>
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

  // 3. Root Route (GET /): Serves the real main BookHive application interface / login portal
  app.get("/", (req, res) => {
    // If client requested JSON explicitly via query or Accept header
    if (req.query.json === "true" || (req.accepts(["html", "json"]) === "json" && !req.accepts("html"))) {
      const dbStatus = isDatabaseConnected() ? "connected" : "offline_fallback";
      return res.status(200).json({
        status: "ok",
        app: "BOOKHIVE",
        database: dbStatus,
        message: "BookHive Backend API Serverless Runtime Active",
        timestamp: new Date().toISOString(),
      });
    }

    // Serve the real main BookHive application interface / login portal
    const indexPath = path.join(rootPublicDir, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    const altIndexPath = path.join(frontendPublicDir, "index.html");
    if (fs.existsSync(altIndexPath)) {
      return res.sendFile(altIndexPath);
    }

    return res.status(200).send("<h1>BookHive Portal Ready</h1>");
  });

  // Explicit /login route alias serving the real main BookHive application interface
  app.get("/login", (_req, res) => {
    const indexPath = path.join(rootPublicDir, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return res.redirect("/");
  });

  // Librarian Operations Dashboard Route Handlers (Express 5 compatible RegExp)
  app.get(/^\/librarian(\/.*)?$/, (_req, res) => {
    const librarianPath = path.join(rootPublicDir, "librarian.html");
    if (fs.existsSync(librarianPath)) {
      return res.sendFile(librarianPath);
    }
    const altIndexPath = path.join(rootPublicDir, "index.html");
    return res.sendFile(altIndexPath);
  });

  // Admin & Super Admin Dashboard Route Handlers (Express 5 compatible RegExp)
  app.get(
    /^\/(admin|super-admin|dashboard|circulation|technical)(\/.*)?$/,
    (_req, res) => {
      const adminPath = path.join(rootPublicDir, "admin.html");
      if (fs.existsSync(adminPath)) {
        return res.sendFile(adminPath);
      }
      const librarianPath = path.join(rootPublicDir, "librarian.html");
      if (fs.existsSync(librarianPath)) {
        return res.sendFile(librarianPath);
      }
      return res.sendFile(path.join(rootPublicDir, "index.html"));
    }
  );

  // Public student ID card verification routes
  app.get("/verify/:qrCode", asyncHandler(studentController.renderStudentVerificationWebPage));
  app.get("/verify", asyncHandler(studentController.renderStudentVerificationWebPage));

  app.use("/api", apiRouter);

  // SPA / Static Fallback Catch-All for non-API client routes (Express 5 compatible RegExp)
  app.get(/.*/, (req, res, next) => {
    // Pass through API requests, downloads, and favicon
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/downloads") ||
      req.path === "/favicon.ico"
    ) {
      return next();
    }

    // Role-specific client routing fallback
    if (req.path.startsWith("/librarian")) {
      const librarianPath = path.join(rootPublicDir, "librarian.html");
      if (fs.existsSync(librarianPath)) {
        return res.sendFile(librarianPath);
      }
    }

    if (
      req.path.startsWith("/admin") ||
      req.path.startsWith("/super-admin") ||
      req.path.startsWith("/dashboard")
    ) {
      const adminPath = path.join(rootPublicDir, "admin.html");
      if (fs.existsSync(adminPath)) {
        return res.sendFile(adminPath);
      }
      const librarianPath = path.join(rootPublicDir, "librarian.html");
      if (fs.existsSync(librarianPath)) {
        return res.sendFile(librarianPath);
      }
    }

    // Default SPA fallback: index.html
    const indexPath = path.join(rootPublicDir, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    const altIndexPath = path.join(frontendPublicDir, "index.html");
    if (fs.existsSync(altIndexPath)) {
      return res.sendFile(altIndexPath);
    }

    return next();
  });

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

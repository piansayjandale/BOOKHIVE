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
import http from "http";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initSocketServer } from "./socket.js";
import { reservationTimerService } from "./services/reservation-timer.service.js";
import { initOcrWorker } from "./services/ocr.service.js";

const app = createApp();
const server = http.createServer(app);

// In Vercel serverless functions, Vercel automatically manages the HTTP lifecycle.
// Server listening and persistent background timers only execute on long-running hosts (local dev, Render).
if (!process.env.VERCEL) {
  initSocketServer(server);

  // Start background reservation expiration monitor (checks for 1-day expired holds)
  reservationTimerService.startReservationTimerService(30000);

  const PORT = Number(process.env.PORT || 5000);
  const HOST = process.env.HOST || "0.0.0.0";

  server.listen(PORT, HOST, () => {
    console.log(`[BookHive API] Server listening on http://${HOST}:${PORT}`);
    initOcrWorker().catch((e) => console.warn("[OCR Warmup] Notice:", e.message));
  });
}

export default app;

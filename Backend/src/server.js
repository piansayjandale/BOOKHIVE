import http from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initSocketServer } from "./socket.js";
import { reservationTimerService } from "./services/reservation-timer.service.js";
import { initOcrWorker } from "./services/ocr.service.js";

const app = createApp();
const server = http.createServer(app);

initSocketServer(server);

// Start background reservation expiration monitor (checks for 1-day expired holds)
reservationTimerService.startReservationTimerService(30000);

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`[BookHive API] Server listening on http://${HOST}:${PORT}`);
  initOcrWorker().catch((e) => console.warn("[OCR Warmup] Notice:", e.message));
});

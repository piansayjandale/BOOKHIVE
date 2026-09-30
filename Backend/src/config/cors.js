import { env } from "./env.js";

/**
 * Validates request origin against allowed web and mobile patterns.
 * Supports:
 * - Native mobile applications (Android APK, iOS, Postman, curl) which send no Origin header
 * - Hybrid mobile frameworks (capacitor://, exp://, ionic://, null origin in sandboxed WebViews)
 * - Localhost development URLs (http://localhost:3000, http://localhost:5173, http://127.0.0.1:*, etc.)
 * - Local LAN network IPs (for mobile devices running Expo on the same Wi-Fi subnet)
 * - Production frontend URLs configured via FRONTEND_URL or CORS_ORIGIN
 *
 * @param {string | undefined} origin
 * @returns {boolean}
 */
export function isAllowedOrigin(origin) {
  // 1. Allow requests with NO origin header (Native mobile Android APKs, iOS, Postman, curl, server-to-server)
  if (!origin) {
    return true;
  }

  // 2. Allow hybrid mobile schemes and sandboxed WebViews (capacitor://, exp://, ionic://, file://)
  if (
    origin === "null" ||
    origin.startsWith("capacitor://") ||
    origin.startsWith("exp://") ||
    origin.startsWith("ionic://") ||
    origin.startsWith("file://")
  ) {
    return true;
  }

  // 3. Allow localhost / 127.0.0.1 on any port (e.g., 3000, 5173, 8081, 19006)
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  // 4. Allow local private LAN IPs (e.g., physical mobile devices testing via Expo / Wi-Fi)
  if (
    /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
      origin
    )
  ) {
    return true;
  }

  // 5. Allow production frontend origins from FRONTEND_URL or CORS_ORIGIN (supports comma-separated values)
  const configuredOrigins = [
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : []),
    env.frontendUrl,
    env.corsOrigin,
  ]
    .map((o) => (o ? o.trim() : ""))
    .filter(Boolean);

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  // 6. In non-production environments, allow any origin to ease local development
  if (env.nodeEnv !== "production") {
    return true;
  }

  return false;
}

export const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
};

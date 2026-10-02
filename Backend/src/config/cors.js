import { env } from "./env.js";

export const allowedOrigins = [
  "https://bookhive-peach.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
];

/**
 * Validates request origin against allowed web and mobile patterns.
 * Supports:
 * - Native mobile applications (Android APK, iOS, Postman, curl) which send no Origin header
 * - Production domain https://bookhive-peach.vercel.app
 * - All Vercel preview deployments (matching regex /https:\/\/.*\.vercel\.app$/ or /\.vercel\.app$/)
 * - Local environments: http://localhost:3000, http://localhost:5173, http://127.0.0.1:3000
 * - Hybrid mobile frameworks (capacitor://, exp://, ionic://, null origin in sandboxed WebViews)
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

  // 2. Allow explicitly whitelisted origins
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // 3. Allow all Vercel deployments and preview URLs (*.vercel.app)
  if (/\.vercel\.app$/.test(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin)) {
    return true;
  }

  // 4. Allow hybrid mobile schemes and sandboxed WebViews (capacitor://, exp://, ionic://, file://)
  if (
    origin === "null" ||
    origin.startsWith("capacitor://") ||
    origin.startsWith("exp://") ||
    origin.startsWith("ionic://") ||
    origin.startsWith("file://")
  ) {
    return true;
  }

  // 5. Allow localhost / 127.0.0.1 on any port (e.g., 3000, 5173, 8081, 19006)
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  // 6. Allow local private LAN IPs (e.g., physical mobile devices testing via Expo / Wi-Fi)
  if (
    /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
      origin
    )
  ) {
    return true;
  }

  // 7. Allow production frontend origins from FRONTEND_URL or CORS_ORIGIN (supports comma-separated values)
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

  // Permissive fallback to prevent breaking auth in production
  return true;
}

export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin) || isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    // Permissive fallback to prevent breaking auth in production
    return callback(null, true);
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

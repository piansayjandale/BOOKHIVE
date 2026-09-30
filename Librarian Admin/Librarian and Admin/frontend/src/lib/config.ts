/**
 * Centralized Application & API Configuration
 *
 * Single environment variable: NEXT_PUBLIC_API_URL
 * (Also supports VITE_API_URL, REACT_APP_API_URL, API_URL, or BACKEND_URL)
 *
 * Local Development Default: http://localhost:5000/api
 */

const defaultDevBackend =
  process.env.DEFAULT_API_URL ||
  (process.env.BACKEND_PORT
    ? `http://localhost:${process.env.BACKEND_PORT}/api`
    : "http://localhost:5000/api");

const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  process.env.API_URL ||
  process.env.BACKEND_URL ||
  defaultDevBackend;

function cleanUrl(url: string): string {
  return (url || "").trim().replace(/\/+$/, "");
}

/**
 * Full API Base URL (guaranteed to include /api)
 * Example: "http://localhost:5000/api" or "https://api.yourdomain.com/api"
 */
export const API_URL = cleanUrl(rawApiUrl).endsWith("/api")
  ? cleanUrl(rawApiUrl)
  : `${cleanUrl(rawApiUrl)}/api`;

/**
 * Root Backend Origin URL (without trailing /api, for Socket.IO, WebSocket, or proxies appending /api)
 * Example: "http://localhost:5000" or "https://api.yourdomain.com"
 */
export const BACKEND_URL = cleanUrl(API_URL.replace(/\/api$/, ""));

/**
 * Helper to check if the current configured API target is localhost or 127.0.0.1
 */
export const isLocalApi =
  BACKEND_URL.includes("localhost") ||
  BACKEND_URL.includes("127.0.0.1") ||
  BACKEND_URL.includes("::1");

/**
 * Helper to determine SSL configuration for direct PostgreSQL connections
 */
export function getDbSslConfig(url = process.env.DATABASE_URL) {
  if (process.env.DB_SSL === "false") return false;
  if (process.env.DB_SSL === "true") return { rejectUnauthorized: false };
  if (!url) return false;
  const isLocal =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("::1");
  return isLocal ? false : { rejectUnauthorized: false };
}

import pg from "pg";
import { env } from "../config/env.js";
import {
  getDatabaseConfig,
  maskDatabaseUrl,
  isLocalhost,
  getDbSslConfig,
} from "./connection-config.js";

const { Pool } = pg;

const dbConfig = getDatabaseConfig(env.databaseUrl);

console.log(
  `[Backend] Database Target: ${dbConfig.isLocal ? "Localhost" : "Cloud"} (${dbConfig.host}:${dbConfig.database}) | SSL: ${
    dbConfig.ssl ? "Enabled (rejectUnauthorized: false)" : "Disabled"
  }`
);

const rawPool = new Pool({
  connectionString: dbConfig.connectionString,
  ssl: dbConfig.ssl,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000), // 10s default to tolerate cloud cold-starts
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
  max: Number(process.env.DB_MAX_CONNECTIONS ?? 10), // Suitable for free tier database limits
});

// Guard against unexpected errors on idle pool clients (e.g. Render / Neon / Supabase TCP drops)
rawPool.on("error", (err) => {
  console.error("[Backend] Unexpected error on idle PostgreSQL client:", err.message);
});

let isOffline = false;
let lastCheckTime = 0;
const RETRY_COOLDOWN_MS = 3000; // Check DB every 3 seconds if offline

function isConnectionError(err) {
  if (!err) return false;
  const connCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "57P01",
    "57P02",
    "57P03",
    "28P01",
  ]);
  if (err.code && connCodes.has(err.code)) return true;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("connect econnrefused") ||
    msg.includes("connection terminated") ||
    msg.includes("connection timeout") ||
    msg.includes("timeout exceeded") ||
    msg.includes("client has encountered a connection error") ||
    msg.includes("password authentication failed")
  );
}

export const pool = {
  async query(text, params) {
    const now = Date.now();
    if (isOffline && (now - lastCheckTime < RETRY_COOLDOWN_MS)) {
      const err = new Error("Database offline");
      err.code = "DB_OFFLINE";
      throw err;
    }

    try {
      const res = await rawPool.query(text, params);
      if (isOffline) {
        console.log("[Backend] Database connection established.");
        isOffline = false;
      }
      return res;
    } catch (err) {
      if (isConnectionError(err)) {
        if (!isOffline) {
          console.log(`[Backend] Database connection lost (${err.message}). Using in-memory fallback.`);
        }
        isOffline = true;
        lastCheckTime = Date.now();
      } else {
        // A SQL or constraint error proves the database connection is alive
        if (isOffline) {
          isOffline = false;
        }
      }
      throw err;
    }
  },

  connect() {
    return rawPool.connect();
  },

  on(...args) {
    return rawPool.on(...args);
  },

  end() {
    return rawPool.end();
  },

  raw: rawPool,
  config: dbConfig,
};

export { getDatabaseConfig, isLocalhost, getDbSslConfig, maskDatabaseUrl };

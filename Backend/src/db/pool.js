import pg from "pg";
import { env } from "../config/env.js";
import {
  getDatabaseConfig,
  maskDatabaseUrl,
  isLocalhost,
  getDbSslConfig,
  resolveDatabaseUrl,
} from "./connection-config.js";

const { Pool } = pg;

const dbConfig = getDatabaseConfig(env.databaseUrl);

console.log(
  `[Backend DB] Target: ${dbConfig.isLocal ? "Localhost" : "Cloud"} (${dbConfig.host}:${dbConfig.port}/${dbConfig.database}) | ` +
  `SSL: ${dbConfig.ssl ? "Enabled" : "Disabled"} | Configured: ${dbConfig.hasExplicitConfig ? "Yes" : "Default Localhost"}`
);

if (!dbConfig.hasExplicitConfig && (process.env.NODE_ENV === "production" || process.env.VERCEL)) {
  console.warn(
    "[Backend DB] Warning: No cloud database credentials found in environment variables (DATABASE_URL, DB_HOST, DB_USER, etc.). " +
    "Defaulting to local Postgres fallback. If deployed on Vercel, set DATABASE_URL or DB_* variables in Vercel project settings."
  );
}

let isOffline = !dbConfig.hasExplicitConfig && Boolean(process.env.VERCEL);
let lastCheckTime = 0;
const RETRY_COOLDOWN_MS = 5000;

let rawPool = null;

try {
  rawPool = new Pool({
    connectionString: dbConfig.connectionString,
    ssl: dbConfig.ssl,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 4000), // 4s timeout to avoid lambda freezes
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    max: Number(process.env.DB_MAX_CONNECTIONS ?? 10),
  });

  // Guard against unhandled errors on idle pool clients
  rawPool.on("error", (err) => {
    console.warn("[Backend DB] Idle connection error:", err.message);
    isOffline = true;
  });
} catch (poolInitErr) {
  console.warn("[Backend DB] Failed to initialize Pool:", poolInitErr.message);
  isOffline = true;
}

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
    "3D000",
  ]);
  if (err.code && connCodes.has(err.code)) return true;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("connect econnrefused") ||
    msg.includes("connection terminated") ||
    msg.includes("connection timeout") ||
    msg.includes("timeout exceeded") ||
    msg.includes("client has encountered a connection error") ||
    msg.includes("password authentication failed") ||
    msg.includes("database offline")
  );
}

/**
 * Non-blocking connection test probe.
 * Returns true if database is reachable, false otherwise.
 * Never throws or crashes the serverless process.
 */
export async function testDatabaseConnection() {
  if (!rawPool) {
    isOffline = true;
    return false;
  }
  try {
    const client = await rawPool.connect();
    client.release();
    isOffline = false;
    console.log(`[Backend DB] Database connection verified successfully (${dbConfig.host}:${dbConfig.port}/${dbConfig.database}).`);
    return true;
  } catch (err) {
    isOffline = true;
    console.warn(
      `[Backend DB] Database connection notice: Could not connect to database at ${dbConfig.host}:${dbConfig.port} (${err.message}). ` +
      `Serverless process will continue serving public and health routes.`
    );
    return false;
  }
}

// Trigger initial connection test asynchronously without blocking module execution
testDatabaseConnection().catch((err) => {
  console.warn("[Backend DB] Initial connection check notice:", err.message);
});

export function isDatabaseConnected() {
  return !isOffline && rawPool !== null;
}

export const pool = {
  async query(text, params) {
    const now = Date.now();
    if (isOffline && (now - lastCheckTime < RETRY_COOLDOWN_MS)) {
      const err = new Error("Database offline: service is currently running in fallback mode.");
      err.code = "DB_OFFLINE";
      throw err;
    }

    if (!rawPool) {
      const err = new Error("Database pool not available.");
      err.code = "DB_OFFLINE";
      throw err;
    }

    try {
      const res = await rawPool.query(text, params);
      if (isOffline) {
        console.log("[Backend DB] Database connection restored.");
        isOffline = false;
      }
      return res;
    } catch (err) {
      if (isConnectionError(err)) {
        if (!isOffline) {
          console.warn(`[Backend DB] Database connection lost (${err.message}). Switching to fallback mode.`);
        }
        isOffline = true;
        lastCheckTime = Date.now();
        err.code = "DB_OFFLINE";
      } else {
        if (isOffline) {
          isOffline = false;
        }
      }
      throw err;
    }
  },

  async connect() {
    if (!rawPool) {
      const err = new Error("Database pool not available.");
      err.code = "DB_OFFLINE";
      throw err;
    }
    try {
      const client = await rawPool.connect();
      isOffline = false;
      return client;
    } catch (err) {
      isOffline = true;
      console.warn(`[Backend DB] Client checkout error: ${err.message}`);
      throw err;
    }
  },

  on(...args) {
    if (rawPool) return rawPool.on(...args);
    return null;
  },

  end() {
    if (rawPool) return rawPool.end();
    return Promise.resolve();
  },

  raw: rawPool,
  config: dbConfig,
};

export { getDatabaseConfig, isLocalhost, getDbSslConfig, maskDatabaseUrl, resolveDatabaseUrl };

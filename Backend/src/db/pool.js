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

// If running in Vercel serverless and NO explicit database is configured, immediately stay in fallback mode.
// Never attempt to contact 127.0.0.1 in a serverless container.
const isVercelServerless = Boolean(process.env.VERCEL);
let isOffline = isVercelServerless && !dbConfig.hasExplicitConfig;
let lastCheckTime = 0;
const RETRY_COOLDOWN_MS = 5000;

if (isOffline) {
  console.warn(
    "[Backend DB] Notice: Running in Vercel serverless mode without DATABASE_URL / DB_HOST configured. " +
    "Database operations will safely use in-memory fallback. Public routes and health checks will respond with 200 OK."
  );
}

// Lazy Pool: Do not create rawPool until first query, and allow idle exit so lambda functions never hang!
let rawPool = null;

function getOrCreatePool() {
  if (rawPool) return rawPool;

  // On Vercel without credentials, do not attempt to create pool
  if (isVercelServerless && !dbConfig.hasExplicitConfig) {
    return null;
  }

  try {
    rawPool = new Pool({
      connectionString: dbConfig.connectionString,
      ssl: dbConfig.ssl,
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 3000), // 3s max timeout to protect serverless
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 1500), // close idle connections quickly
      max: Number(process.env.DB_MAX_CONNECTIONS ?? 2), // small pool size for lambdas
      allowExitOnIdle: true, // CRITICAL: allows Node.js event loop to exit when idle, preventing FUNCTION_INVOCATION_FAILED!
    });

    rawPool.on("error", (err) => {
      console.warn("[Backend DB] Database client notice:", err.message);
      isOffline = true;
    });

    return rawPool;
  } catch (err) {
    console.warn("[Backend DB] Failed to instantiate pool:", err.message);
    isOffline = true;
    return null;
  }
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

    const p = getOrCreatePool();
    if (!p) {
      const err = new Error("Database pool unavailable: running in offline fallback mode.");
      err.code = "DB_OFFLINE";
      throw err;
    }

    try {
      const res = await p.query(text, params);
      if (isOffline) {
        console.log("[Backend DB] Database connection established.");
        isOffline = false;
      }
      return res;
    } catch (err) {
      if (isConnectionError(err)) {
        if (!isOffline) {
          console.warn(`[Backend DB] Database connection error (${err.message}). Switching to fallback mode.`);
        }
        isOffline = true;
        lastCheckTime = Date.now();
        err.code = "DB_OFFLINE";
      }
      throw err;
    }
  },

  async connect() {
    const p = getOrCreatePool();
    if (!p) {
      const err = new Error("Database pool unavailable: running in offline fallback mode.");
      err.code = "DB_OFFLINE";
      throw err;
    }
    try {
      const client = await p.connect();
      isOffline = false;
      return client;
    } catch (err) {
      isOffline = true;
      console.warn(`[Backend DB] Client checkout error: ${err.message}`);
      throw err;
    }
  },

  on(...args) {
    const p = getOrCreatePool();
    if (p) return p.on(...args);
    return null;
  },

  end() {
    if (rawPool) {
      const p = rawPool;
      rawPool = null;
      return p.end();
    }
    return Promise.resolve();
  },

  get raw() {
    return getOrCreatePool();
  },
  config: dbConfig,
};

export { getDatabaseConfig, isLocalhost, getDbSslConfig, maskDatabaseUrl, resolveDatabaseUrl };

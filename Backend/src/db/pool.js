import pg from "pg";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import {
  getDatabaseConfig,
  maskDatabaseUrl,
  isLocalhost,
  getDbSslConfig,
  resolveDatabaseUrl,
  resolveDatabaseType,
} from "./connection-config.js";

const { Pool: PgPool } = pg;

const dbConfig = getDatabaseConfig(process.env.DATABASE_URL || env.databaseUrl);

console.log(
  `[Backend DB] Dialect: ${dbConfig.clientType.toUpperCase()} | Target: ${dbConfig.isLocal ? "Localhost" : "Cloud"} ` +
  `(${dbConfig.host}:${dbConfig.port}/${dbConfig.database}) | ` +
  `SSL: ${dbConfig.ssl ? "Enabled (rejectUnauthorized: false)" : "Disabled"} | ` +
  `Configured: ${dbConfig.hasExplicitConfig ? "Yes" : "Default Localhost"}`
);

// Actively connect to DATABASE_URL when provided; only use offline fallback if no credentials on Vercel
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

// Database pool instance
let rawPool = null;

function getOrCreatePool() {
  if (rawPool) return rawPool;

  // On Vercel without credentials, do not attempt to contact localhost
  if (isVercelServerless && !dbConfig.hasExplicitConfig && !process.env.DATABASE_URL) {
    return null;
  }

  try {
    if (dbConfig.clientType === "mysql") {
      // Actively configure Aiven MySQL instance with SSL rejectUnauthorized: false
      const mysqlOptions = {
        host: dbConfig.host,
        port: dbConfig.port || 3306,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_MAX_CONNECTIONS ?? 5),
        connectTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        ssl: {
          rejectUnauthorized: false,
        },
      };

      rawPool = mysql.createPool(mysqlOptions);
      isOffline = false;
      return rawPool;
    }

    // Default PostgreSQL Pool
    const pgSsl = (dbConfig.ssl || !dbConfig.isLocal || process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false;
    rawPool = new PgPool({
      connectionString: dbConfig.connectionString,
      ssl: pgSsl,
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 1500),
      max: Number(process.env.DB_MAX_CONNECTIONS ?? 5),
      allowExitOnIdle: true, // Prevents FUNCTION_INVOCATION_FAILED by allowing Node event loop to exit
    });

    rawPool.on("error", (err) => {
      console.warn("[Backend DB] Database client notice:", err.message);
      isOffline = true;
    });

    isOffline = false;
    return rawPool;
  } catch (err) {
    console.warn("[Backend DB] Failed to instantiate pool (non-fatal):", err.message);
    isOffline = true;
    return null;
  }
}

// Actively initialize pool on startup when DATABASE_URL or database credentials are provided
if (dbConfig.hasExplicitConfig || process.env.DATABASE_URL) {
  try {
    getOrCreatePool();
  } catch (initErr) {
    console.warn("[Backend DB] Initial connection notice:", initErr.message);
  }
}


/**
 * Clean and adapt SQL queries for MySQL compatibility when executing Postgres-style queries.
 */
function cleanSqlForMysql(sql) {
  return sql
    .replace(/::[a-zA-Z_]+/g, "") // strip Postgres casts (e.g. ::text, ::int, ::date)
    .replace(/\bILIKE\b/gi, "LIKE")
    .replace(/gen_random_uuid\(\)/gi, "UUID()")
    .replace(/NOW\(\)::date/gi, "CURDATE()")
    .replace(/date_trunc\('month',\s*([^)]+)\)/gi, "DATE_FORMAT($1, '%Y-%m-01')")
    .replace(/\bRETURNING\b[\s\S]*$/i, "");
}

/**
 * Converts $1, $2 Postgres placeholders to ? parameters for MySQL.
 */
function adaptQueryForMysql(sql, params = []) {
  if (!sql) return { sql: "", params: [] };

  const matches = [...sql.matchAll(/\$(\d+)/g)];
  if (matches.length > 0) {
    const newParams = [];
    const newSql = sql.replace(/\$(\d+)/g, (_, num) => {
      const idx = parseInt(num, 10) - 1;
      newParams.push(params[idx]);
      return "?";
    });
    return {
      sql: cleanSqlForMysql(newSql),
      params: newParams,
    };
  }

  return {
    sql: cleanSqlForMysql(sql),
    params,
  };
}

function isConnectionError(err) {
  if (!err) return false;
  const connCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "PROTOCOL_CONNECTION_LOST",
    "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
    "ER_ACCESS_DENIED_ERROR",
    "HANDSHAKE_ERROR",
    "ER_BAD_DB_ERROR",
    "ER_DBACCESS_DENIED_ERROR",
    "ER_CON_COUNT_ERROR",
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
    msg.includes("access denied for user") ||
    msg.includes("password authentication failed") ||
    msg.includes("handshake") ||
    msg.includes("self signed certificate") ||
    msg.includes("certificate") ||
    msg.includes("database offline")
  );
}

function isMissingTableError(err) {
  if (!err) return false;
  if (err.code === "ER_NO_SUCH_TABLE" || err.code === 1146 || err.code === "42P01") {
    return true;
  }
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("doesn't exist") ||
    msg.includes("does not exist") ||
    msg.includes("no such table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

export function isDatabaseConnected() {
  if (rawPool === null && (Boolean(process.env.DATABASE_URL) || dbConfig.hasExplicitConfig)) {
    getOrCreatePool();
  }
  return !isOffline && rawPool !== null;
}

export const pool = {
  async query(text, params) {
    const now = Date.now();
    if (isOffline && now - lastCheckTime < RETRY_COOLDOWN_MS) {
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
      let res;
      if (dbConfig.clientType === "mysql") {
        const adapted = adaptQueryForMysql(text, params);
        const [rows, fields] = await p.query(adapted.sql, adapted.params);
        res = {
          rows: Array.isArray(rows) ? rows : [rows],
          rowCount: Array.isArray(rows) ? rows.length : (rows?.affectedRows || 0),
          fields,
        };
      } else {
        res = await p.query(text, params);
      }

      if (isOffline) {
        console.log("[Backend DB] Database connection established.");
        isOffline = false;
      }
      return res;
    } catch (err) {
      if (isMissingTableError(err)) {
        console.warn(`[Backend DB] Table missing or not yet migrated: ${err.message}. Returning empty rows fallback.`);
        return { rows: [], rowCount: 0 };
      }

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
      if (dbConfig.clientType === "mysql") {
        const connection = await p.getConnection();
        isOffline = false;
        return connection;
      }
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
    if (p && typeof p.on === "function") return p.on(...args);
    return null;
  },

  async end() {
    if (rawPool) {
      const p = rawPool;
      rawPool = null;
      try {
        await p.end();
      } catch {}
    }
    return Promise.resolve();
  },

  get raw() {
    return getOrCreatePool();
  },
  config: dbConfig,
};

export {
  getDatabaseConfig,
  isLocalhost,
  getDbSslConfig,
  maskDatabaseUrl,
  resolveDatabaseUrl,
  resolveDatabaseType,
};

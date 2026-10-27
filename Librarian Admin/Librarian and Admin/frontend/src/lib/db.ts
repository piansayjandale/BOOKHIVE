import pg from "pg";
import { getDbSslConfig } from "./config";
import { executeLocalSqlFallback } from "./data/local-db";

const { Pool } = pg;

export const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.DEFAULT_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd";
export const hasExplicitDatabaseUrl = Boolean(process.env.DATABASE_URL);

const rawPool = new Pool({
  connectionString: databaseUrl,
  ssl: getDbSslConfig(databaseUrl),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5000),
  idleTimeoutMillis: 30000,
  max: Number(process.env.DB_MAX_CONNECTIONS ?? 10),
});

rawPool.on("error", (err) => {
  console.warn("[Next.js DB Pool] Idle client notice:", err.message);
});

let remoteOfflineUntil = 0;

function isQuotaOrConnError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("exceeded the quota") ||
    msg.includes("quota") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound") ||
    msg.includes("connection terminated") ||
    msg.includes("timeout") ||
    err.code === "ECONNREFUSED" ||
    err.code === "ETIMEDOUT" ||
    err.code === "ENOTFOUND"
  );
}

export const pool: pg.Pool = {
  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const now = Date.now();
    if (now < remoteOfflineUntil) {
      return executeLocalSqlFallback(text, params) as Promise<{ rows: T[]; rowCount: number }>;
    }

    try {
      const res = await rawPool.query(text, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    } catch (err: any) {
      if (isQuotaOrConnError(err)) {
        remoteOfflineUntil = Date.now() + 120_000;
        return executeLocalSqlFallback(text, params) as Promise<{ rows: T[]; rowCount: number }>;
      }
      throw err;
    }
  },
  on: rawPool.on.bind(rawPool),
  connect: rawPool.connect.bind(rawPool),
  end: rawPool.end.bind(rawPool),
} as unknown as pg.Pool;

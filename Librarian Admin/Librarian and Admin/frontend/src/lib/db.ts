import pg from "pg";
import { getDbSslConfig } from "./config";

const { Pool } = pg;

export const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.DEFAULT_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd";
export const hasExplicitDatabaseUrl = Boolean(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: getDbSslConfig(databaseUrl),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
  idleTimeoutMillis: 30000,
  max: Number(process.env.DB_MAX_CONNECTIONS ?? 10),
});

pool.on("error", (err) => {
  console.error("[Next.js DB Pool] Unexpected error on idle client:", err.message);
});

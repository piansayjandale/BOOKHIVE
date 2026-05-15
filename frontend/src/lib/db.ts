import pg from "pg";

const { Pool } = pg;

export const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/bookhive";
export const hasExplicitDatabaseUrl = Boolean(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 1500,
});

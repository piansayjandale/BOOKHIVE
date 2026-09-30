import dotenv from "dotenv";

dotenv.config();

export const DEFAULT_LOCAL_DATABASE_URL =
  process.env.DEFAULT_DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd";

/**
 * Checks whether a given PostgreSQL connection string or hostname targets localhost / loopback.
 * @param {string} [urlStr]
 * @returns {boolean}
 */
export function isLocalhost(urlStr) {
  if (!urlStr) return true;
  try {
    const parsed = new URL(urlStr);
    const host = (parsed.hostname || "").toLowerCase();
    return (
      !host ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".localhost")
    );
  } catch {
    return /@(localhost|127\.0\.0\.1|::1)(:\d+)?\//i.test(urlStr);
  }
}

/**
 * Determines SSL configuration dynamically:
 * - Disabled on localhost or 127.0.0.1 (unless overridden)
 * - Enabled with { rejectUnauthorized: false } for production or any remote/cloud host
 *   (e.g., Render, Neon, Supabase, AWS RDS)
 * - Respects explicit DB_SSL or DATABASE_SSL override ('true' | 'false')
 *
 * @param {string} [urlStr]
 * @returns {false | { rejectUnauthorized: boolean }}
 */
export function getDbSslConfig(urlStr) {
  const forceSsl = process.env.DB_SSL ?? process.env.DATABASE_SSL;
  if (forceSsl === "false" || forceSsl === "0") {
    return false;
  }
  if (forceSsl === "true" || forceSsl === "1") {
    return { rejectUnauthorized: false };
  }

  const isLocal = isLocalhost(urlStr);

  // If pointing to localhost/127.0.0.1, disable SSL for 100% localhost parity
  if (isLocal && process.env.NODE_ENV !== "production") {
    return false;
  }

  // If host is remote (or production mode on non-localhost), enable SSL dynamically
  return isLocal ? false : { rejectUnauthorized: false };
}

/**
 * Returns a sanitized configuration object for pg.Pool or pg.Client.
 * Strips 'sslmode' query parameter from the connection string to prevent pg-connection-string
 * from overriding rejectUnauthorized: false with an empty object {}.
 *
 * @param {string} [rawUrl] - Optional connection string override (e.g. from CLI flag)
 * @returns {{
 *   connectionString: string,
 *   ssl: false | { rejectUnauthorized: boolean },
 *   isLocal: boolean,
 *   host: string,
 *   database: string
 * }}
 */
export function getDatabaseConfig(rawUrl) {
  const connStr =
    rawUrl || process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;

  let connectionString = connStr;
  let host = "127.0.0.1";
  let database = "bookhive_2nd";
  let isLocal = true;

  try {
    const parsed = new URL(connStr);
    host = parsed.hostname || "127.0.0.1";
    database = (parsed.pathname || "").replace(/^\//, "") || "bookhive_2nd";
    isLocal = isLocalhost(connStr);

    // Remove sslmode query param so it does not conflict with our explicit ssl config
    if (parsed.searchParams.has("sslmode")) {
      parsed.searchParams.delete("sslmode");
    }
    connectionString = parsed.toString();
  } catch {
    isLocal = isLocalhost(connStr);
  }

  const ssl = getDbSslConfig(connStr);

  return {
    connectionString,
    ssl,
    isLocal,
    host,
    database,
  };
}

/**
 * Masks a database connection URL so it can be logged safely without exposing passwords.
 * @param {string} urlStr
 * @returns {string}
 */
export function maskDatabaseUrl(urlStr) {
  if (!urlStr) return "N/A";
  try {
    const parsed = new URL(urlStr);
    if (parsed.password) {
      parsed.password = "******";
    }
    return parsed.toString();
  } catch {
    return urlStr.replace(/:([^:@]+)@/, ":******@");
  }
}

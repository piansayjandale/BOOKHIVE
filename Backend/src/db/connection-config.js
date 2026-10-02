import dotenv from "dotenv";

dotenv.config();

export const DEFAULT_LOCAL_DATABASE_URL =
  process.env.DEFAULT_DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd";

/**
 * Determines whether the database target is MySQL or PostgreSQL.
 * Supports explicit environment flags (DB_CLIENT, DB_TYPE),
 * protocol prefixes in URLs (mysql://, postgresql://), or discrete config.
 *
 * @param {string} [rawUrl]
 * @returns {"mysql" | "postgres"}
 */
export function resolveDatabaseType(rawUrl) {
  const explicitClient = (
    process.env.DB_CLIENT ||
    process.env.DB_TYPE ||
    process.env.DB_DIALECT ||
    ""
  ).toLowerCase();

  if (explicitClient.includes("mysql") || explicitClient.includes("mariadb")) {
    return "mysql";
  }
  if (explicitClient.includes("pg") || explicitClient.includes("postgres")) {
    return "postgres";
  }

  const candidateUrl = (
    rawUrl ||
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL ||
    ""
  ).trim().toLowerCase();

  if (
    candidateUrl.startsWith("mysql:") ||
    candidateUrl.startsWith("mysql2:") ||
    candidateUrl.includes("mysql") ||
    candidateUrl.includes("aivencloud")
  ) {
    return "mysql";
  }
  if (candidateUrl.startsWith("postgres:") || candidateUrl.startsWith("postgresql:")) {
    return "postgres";
  }

  // If MySQL discrete variables are present without Postgres variables
  if (process.env.MYSQL_HOST && !process.env.POSTGRES_HOST && !process.env.PGHOST) {
    return "mysql";
  }

  return "postgres";
}

/**
 * Dynamically resolves the database connection string from environment variables:
 * 1. process.env.DATABASE_URL
 * 2. process.env.MYSQL_URL / POSTGRES_URL / POSTGRES_PRISMA_URL
 * 3. Individual variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT (or MYSQL/PG equivalents)
 * 4. Fallback to DEFAULT_LOCAL_DATABASE_URL
 *
 * @param {string} [rawUrl]
 * @returns {string}
 */
export function resolveDatabaseUrl(rawUrl) {
  if (rawUrl && typeof rawUrl === "string" && rawUrl.trim()) {
    return rawUrl.trim();
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.trim();
  }

  const clientType = resolveDatabaseType(rawUrl);

  if (clientType === "mysql" && process.env.MYSQL_URL) {
    return process.env.MYSQL_URL.trim();
  }

  if (clientType === "postgres") {
    if (process.env.POSTGRES_URL) {
      return process.env.POSTGRES_URL.trim();
    }
    if (process.env.POSTGRES_PRISMA_URL) {
      return process.env.POSTGRES_PRISMA_URL.trim();
    }
  }

  // Check individual environment variables (DB_*, MYSQL_*, and PG_* conventions)
  const host =
    process.env.MYSQL_HOST ||
    process.env.DB_HOST ||
    process.env.POSTGRES_HOST ||
    process.env.PGHOST;

  if (host) {
    const isMysql = clientType === "mysql" || Boolean(process.env.MYSQL_HOST);

    const user =
      process.env.MYSQL_USER ||
      process.env.DB_USER ||
      process.env.DB_USERNAME ||
      process.env.POSTGRES_USER ||
      process.env.PGUSER ||
      (isMysql ? "avnadmin" : "postgres");

    const password =
      process.env.MYSQL_PASSWORD ||
      process.env.DB_PASSWORD ||
      process.env.DB_PASS ||
      process.env.POSTGRES_PASSWORD ||
      process.env.PGPASSWORD ||
      "";

    const database =
      process.env.MYSQL_DATABASE ||
      process.env.DB_NAME ||
      process.env.DB_DATABASE ||
      process.env.POSTGRES_DATABASE ||
      process.env.PGDATABASE ||
      (isMysql ? "defaultdb" : "bookhive_2nd");

    const defaultPort = isMysql ? "3306" : "5432";
    const port =
      process.env.MYSQL_PORT ||
      process.env.DB_PORT ||
      process.env.POSTGRES_PORT ||
      process.env.PGPORT ||
      defaultPort;

    const protocol = isMysql ? "mysql" : "postgresql";

    const auth = password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
      : user
      ? `${encodeURIComponent(user)}@`
      : "";

    return `${protocol}://${auth}${host}:${port}/${database}`;
  }

  return DEFAULT_LOCAL_DATABASE_URL;
}

/**
 * Checks whether a given database connection string or hostname targets localhost / loopback.
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
 *   (e.g., Aiven MySQL, Render, Neon, Supabase, AWS RDS, Vercel)
 * - Respects explicit DB_SSL, DATABASE_SSL, or MYSQL_SSL override ('true' | 'false')
 *
 * @param {string} [urlStr]
 * @returns {false | { rejectUnauthorized: boolean }}
 */
export function getDbSslConfig(urlStr) {
  const forceSsl =
    process.env.DB_SSL ??
    process.env.DATABASE_SSL ??
    process.env.MYSQL_SSL;

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

  // If host is remote (or production mode on non-localhost), explicitly enable SSL
  // with rejectUnauthorized: false for Aiven and cloud provider certificate compatibility
  return isLocal ? false : { rejectUnauthorized: false };
}

/**
 * Returns a sanitized configuration object for MySQL or PostgreSQL pool/client.
 * Strips 'sslmode' and 'ssl-mode' query parameters from the connection string to prevent
 * drivers from overriding our explicit rejectUnauthorized: false configuration.
 *
 * @param {string} [rawUrl] - Optional connection string override
 * @returns {{
 *   clientType: "mysql" | "postgres",
 *   connectionString: string,
 *   ssl: false | { rejectUnauthorized: boolean },
 *   isLocal: boolean,
 *   host: string,
 *   port: number,
 *   database: string,
 *   user: string,
 *   password: string,
 *   hasExplicitConfig: boolean
 * }}
 */
export function getDatabaseConfig(rawUrl) {
  const clientType = resolveDatabaseType(rawUrl);

  const hasExplicitConfig = Boolean(
    rawUrl ||
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DB_HOST ||
    process.env.PGHOST ||
    process.env.MYSQL_HOST
  );

  const connStr = resolveDatabaseUrl(rawUrl);

  let connectionString = connStr;
  let host = "127.0.0.1";
  let port = clientType === "mysql" ? 3306 : 5432;
  let database = clientType === "mysql" ? "defaultdb" : "bookhive_2nd";
  let user = clientType === "mysql" ? "avnadmin" : "postgres";
  let password = "";
  let isLocal = true;

  try {
    const parsed = new URL(connStr);
    host = parsed.hostname || "127.0.0.1";
    port = parsed.port ? Number(parsed.port) : (clientType === "mysql" ? 3306 : 5432);
    database = (parsed.pathname || "").replace(/^\//, "") || (clientType === "mysql" ? "defaultdb" : "bookhive_2nd");
    user = parsed.username ? decodeURIComponent(parsed.username) : (clientType === "mysql" ? "avnadmin" : "postgres");
    password = parsed.password ? decodeURIComponent(parsed.password) : "";
    isLocal = isLocalhost(connStr);

    // Remove sslmode and ssl-mode query params so they do not conflict with our explicit ssl config
    if (parsed.searchParams.has("sslmode")) {
      parsed.searchParams.delete("sslmode");
    }
    if (parsed.searchParams.has("ssl-mode")) {
      parsed.searchParams.delete("ssl-mode");
    }
    connectionString = parsed.toString();
  } catch {
    isLocal = isLocalhost(connStr);
  }

  const ssl = getDbSslConfig(connStr);

  return {
    clientType,
    connectionString,
    ssl,
    isLocal,
    host,
    port,
    database,
    user,
    password,
    hasExplicitConfig,
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

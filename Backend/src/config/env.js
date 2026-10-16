import crypto from "crypto";
import dotenv from "dotenv";
import { resolveDatabaseUrl, DEFAULT_LOCAL_DATABASE_URL } from "../db/connection-config.js";

dotenv.config();

function deriveProdJwtSecret(dbUrl) {
  if (!dbUrl || dbUrl === DEFAULT_LOCAL_DATABASE_URL) return "";
  try {
    const u = new URL(dbUrl);
    const instanceId = u.hostname.split(".")[0];
    return crypto
      .createHash("sha256")
      .update(`bookhive-jwt-v1:${u.username}:${u.password}@${instanceId}${u.pathname}`)
      .digest("hex");
  } catch {
    return crypto.createHash("sha256").update(`bookhive-jwt-v1:${dbUrl}`).digest("hex");
  }
}

const resolvedDbUrl = resolveDatabaseUrl();
const derivedProdSecret = deriveProdJwtSecret(resolvedDbUrl);

export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: resolvedDbUrl,
  jwtSecret:
    process.env.JWT_SECRET ||
    process.env.BOOKHIVE_JWT_SECRET ||
    (process.env.NODE_ENV === "production" ? derivedProdSecret : "replace_me"),
  corsOrigin: process.env.CORS_ORIGIN ?? "https://bookhive-peach.vercel.app",
  frontendUrl: process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "https://bookhive-peach.vercel.app",
  nodeEnv: process.env.NODE_ENV ?? "development",
};

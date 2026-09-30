import dotenv from "dotenv";
import { resolveDatabaseUrl, DEFAULT_LOCAL_DATABASE_URL } from "../db/connection-config.js";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: resolveDatabaseUrl(),
  jwtSecret: process.env.JWT_SECRET ?? process.env.BOOKHIVE_JWT_SECRET ?? "replace_me",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
};

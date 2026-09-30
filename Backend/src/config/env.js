import dotenv from "dotenv";
import { DEFAULT_LOCAL_DATABASE_URL } from "../db/connection-config.js";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? process.env.BOOKHIVE_JWT_SECRET ?? "replace_me",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
};

import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/bookhive",
  jwtSecret: process.env.JWT_SECRET ?? process.env.BOOKHIVE_JWT_SECRET ?? "replace_me",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};

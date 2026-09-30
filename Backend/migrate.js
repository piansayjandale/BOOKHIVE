import pg from "pg";
import dotenv from "dotenv";
import { getDatabaseConfig, maskDatabaseUrl } from "./src/db/connection-config.js";

dotenv.config();

const { Client } = pg;

// Parse CLI flags (e.g. node migrate.js --url="postgresql://...")
const args = process.argv.slice(2);
let cliUrl = null;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--url=")) {
    cliUrl = arg.slice(6);
  } else if ((arg === "--url" || arg === "-u") && args[i + 1]) {
    cliUrl = args[i + 1];
    i++;
  }
}

const dbConfig = getDatabaseConfig(cliUrl);

async function migrate() {
  console.log("==================================================");
  console.log(" BookHive Database Migration Runner");
  console.log("==================================================");
  console.log(` Target Host : ${dbConfig.host}`);
  console.log(` Database    : ${dbConfig.database}`);
  console.log(` Environment : ${dbConfig.isLocal ? "Localhost" : "Remote Cloud"}`);
  console.log(` SSL Status  : ${dbConfig.ssl ? "Enabled (rejectUnauthorized: false)" : "Disabled"}`);
  console.log(` Connection  : ${maskDatabaseUrl(dbConfig.connectionString)}`);
  console.log("==================================================");

  const client = new Client({
    connectionString: dbConfig.connectionString,
    ssl: dbConfig.ssl,
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("✓ Connected to database. Running incremental migrations...\n");

    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    console.log("✓ Verified extension: pgcrypto");

    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS student_id_image TEXT");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS comment TEXT");
    console.log("✓ Verified columns: transactions (student_id_image, comment)");

    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_code UUID UNIQUE DEFAULT gen_random_uuid()");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS year_level TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS section TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{\"home\":true,\"records\":true,\"transactions\":true,\"reminders\":true,\"reports\":true,\"history\":true,\"settings\":true}'::jsonb");
    await client.query("UPDATE users SET qr_code = gen_random_uuid() WHERE qr_code IS NULL");
    console.log("✓ Verified columns: users (avatar, qr_code, year_level, section, permissions)");

    await client.query(`
      CREATE TABLE IF NOT EXISTS violations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL,
        student_name TEXT,
        book_title TEXT NOT NULL,
        isbn TEXT,
        violation_type TEXT NOT NULL DEFAULT 'Overdue Book Return',
        penalty_amount NUMERIC NOT NULL DEFAULT 0.00,
        status TEXT NOT NULL DEFAULT 'Active',
        remarks TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS idx_violations_student_id ON violations(student_id)");
    console.log("✓ Verified table: violations");

    console.log("\n==================================================");
    console.log(" All migrations completed successfully!");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();

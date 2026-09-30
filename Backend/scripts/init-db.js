import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { getDatabaseConfig, maskDatabaseUrl } from "../src/db/connection-config.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

// Parse CLI flags (e.g. node init-db.js --url="postgresql://..." or --seed-only or --schema-only)
const args = process.argv.slice(2);
let cliUrl = null;
let schemaOnly = false;
let seedOnly = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--url=")) {
    cliUrl = arg.slice(6);
  } else if ((arg === "--url" || arg === "-u") && args[i + 1]) {
    cliUrl = args[i + 1];
    i++;
  } else if (arg === "--schema-only") {
    schemaOnly = true;
  } else if (arg === "--seed-only") {
    seedOnly = true;
  }
}

const dbConfig = getDatabaseConfig(cliUrl);

const DEV_CREDENTIALS = [
  {
    name: "Yana Palmares",
    email: "admin@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    idNumber: "ADM-2026-0001",
    department: "Library Administration",
    course: "Library Administration",
  },
  {
    name: "Joseph Tan",
    email: "joseph.tan@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-002",
    department: "Library",
    course: "Library Services",
  },
];

async function run() {
  console.log("==================================================");
  console.log(" BookHive Database Initialization & Migration Tool");
  console.log("==================================================");
  console.log(` Target Host : ${dbConfig.host}`);
  console.log(` Database    : ${dbConfig.database}`);
  console.log(` Environment : ${dbConfig.isLocal ? "Localhost (Development)" : "Remote Cloud (Production/Staging)"}`);
  console.log(` SSL Status  : ${dbConfig.ssl ? "Enabled (rejectUnauthorized: false)" : "Disabled"}`);
  console.log(` Connection  : ${maskDatabaseUrl(dbConfig.connectionString)}`);
  console.log("==================================================");

  const client = new Client({
    connectionString: dbConfig.connectionString,
    ssl: dbConfig.ssl,
    connectionTimeoutMillis: 15000,
  });

  try {
    console.log("Connecting to PostgreSQL...");
    await client.connect();
    console.log("✓ Connection established successfully.\n");

    // 1. Run schema.sql (unless --seed-only is specified)
    if (!seedOnly) {
      const sqlPath = path.join(__dirname, "../db/schema.sql");
      console.log(`[Step 1/2] Reading schema from: ${sqlPath}`);
      if (!fs.existsSync(sqlPath)) {
        throw new Error(`Schema file not found at ${sqlPath}`);
      }
      const sql = fs.readFileSync(sqlPath, "utf8");

      console.log("[Step 1/2] Applying schema to database...");
      await client.query(sql);
      console.log("✓ Schema applied successfully (extensions, types, tables, and triggers created).\n");
    } else {
      console.log("[Step 1/2] Skipping schema execution (--seed-only flag passed).\n");
    }

    // 2. Seed initial admin and librarian users (unless --schema-only is specified)
    if (!schemaOnly) {
      console.log("[Step 2/2] Seeding initial administrative accounts...");
      for (const cred of DEV_CREDENTIALS) {
        // Check by both email and id_number to respect unique constraints
        const checkRes = await client.query(
          "SELECT id, email, id_number, role FROM users WHERE email = $1 OR id_number = $2",
          [cred.email, cred.idNumber]
        );

        if (checkRes.rows.length === 0) {
          const passwordHash = await bcrypt.hash(cred.password, 10);
          const query = `
            INSERT INTO users (name, id_number, email, password_hash, role, department, course, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
            RETURNING id
          `;
          const insertRes = await client.query(query, [
            cred.name,
            cred.idNumber,
            cred.email,
            passwordHash,
            cred.role,
            cred.department,
            cred.course,
          ]);
          console.log(`  ✓ Created ${cred.role}: ${cred.name} (${cred.email}) [ID: ${insertRes.rows[0].id}]`);
        } else {
          const existing = checkRes.rows[0];
          console.log(`  - Account already exists: ${existing.email} (ID Number: ${existing.id_number}, Role: ${existing.role}). Skipping.`);
        }
      }
      console.log("✓ Seeding verification completed successfully.\n");
    } else {
      console.log("[Step 2/2] Skipping seeding (--schema-only flag passed).\n");
    }

    console.log("==================================================");
    console.log(" Database initialization finished successfully!");
    console.log("==================================================");
  } catch (err) {
    console.error("\n❌ Database initialization error:", err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

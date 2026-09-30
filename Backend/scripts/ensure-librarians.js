import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
import { getDatabaseConfig, maskDatabaseUrl } from "../src/db/connection-config.js";

const dbConfig = getDatabaseConfig();
const pool = new Pool({
  connectionString: dbConfig.connectionString,
  ssl: dbConfig.ssl,
});

const LIBRARIANS = [
  {
    name: "Yana Brich R. Palmares",
    idNumber: "LIB-2026-0001",
    email: "librarian@stiwnu.edu.ph",
    department: "Library Services",
    course: "Library Services",
  },
  {
    name: "Joseph Tan",
    idNumber: "LIB-2026-0002",
    email: "joseph.tan@stiwnu.edu.ph",
    department: "Library Services",
    course: "Library Services",
  },
  {
    name: "Maria Santos",
    idNumber: "LIB-2026-0003",
    email: "maria.santos@stiwnu.edu.ph",
    department: "Library Services",
    course: "Library Services",
  },
];

async function run() {
  try {
    console.log("Connecting to:", maskDatabaseUrl(dbConfig.connectionString));
    // Ensure permissions column exists
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"home":true,"records":true,"transactions":true,"reminders":true,"reports":true,"history":true,"settings":true}'::jsonb;
    `);

    for (const lib of LIBRARIANS) {
      const existing = await pool.query("SELECT id, permissions FROM users WHERE email = $1", [lib.email]);
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (name, id_number, email, password_hash, role, department, course, status, permissions)
           VALUES ($1, $2, $3, 'dummy', 'Librarian', $4, $5, 'Active', '{"home":true,"records":true,"transactions":true,"reminders":true,"reports":true,"history":true,"settings":true}'::jsonb)`,
          [lib.name, lib.idNumber, lib.email, lib.department, lib.course]
        );
        console.log("Created librarian:", lib.name);
      } else {
        if (!existing.rows[0].permissions) {
          await pool.query(
            `UPDATE users SET permissions = '{"home":true,"records":true,"transactions":true,"reminders":true,"reports":true,"history":true,"settings":true}'::jsonb WHERE id = $1`,
            [existing.rows[0].id]
          );
          console.log("Updated default permissions for:", lib.name);
        } else {
          console.log("Librarian already exists with permissions:", lib.name);
        }
      }
    }

    const res = await pool.query("SELECT id, name, email, role, permissions FROM users WHERE role::text ILIKE '%librarian%'");
    console.log("Total librarians in DB:", res.rows.length);
    console.table(res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

run();

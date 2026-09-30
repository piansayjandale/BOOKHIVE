import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/bookhive",
});

async function migrate() {
  try {
    console.log("Adding permissions column to users table if not exists...");
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"home":true,"records":true,"transactions":true,"reminders":true,"reports":true,"history":true,"settings":true}'::jsonb;
    `);

    console.log("Setting default permissions for existing users who have null permissions...");
    await pool.query(`
      UPDATE users
      SET permissions = '{"home":true,"records":true,"transactions":true,"reminders":true,"reports":true,"history":true,"settings":true}'::jsonb
      WHERE permissions IS NULL;
    `);

    const check = await pool.query("SELECT id, name, role, permissions FROM users WHERE role::text ILIKE '%librarian%'");
    console.log("Librarians with permissions:", JSON.stringify(check.rows, null, 2));

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

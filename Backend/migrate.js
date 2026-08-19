import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5432/bookhive" });

async function migrate() {
  try {
    await client.connect();
    console.log("Connected to database. Running migration...");
    await client.query("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\"");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS student_id_image TEXT");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS comment TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_code UUID UNIQUE DEFAULT gen_random_uuid()");
    await client.query("UPDATE users SET qr_code = gen_random_uuid() WHERE qr_code IS NULL");
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
    console.log("Migration successful! Column additions and violations table completed.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

migrate();

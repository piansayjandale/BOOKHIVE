import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5432/bookhive" });

async function migrate() {
  try {
    await client.connect();
    console.log("Connected to database. Running migration...");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS student_id_image TEXT");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS comment TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");
    console.log("Migration successful! Column additions completed.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

migrate();

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd",
});

async function run() {
  const { rows } = await pool.query(
    "SELECT id, name, email, role, permissions FROM users WHERE email = 'librarian@stiwnu.edu.ph'"
  );
  console.log("Current Yana in DB:", JSON.stringify(rows, null, 2));
  await pool.end();
}

run();

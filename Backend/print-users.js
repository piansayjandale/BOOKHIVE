import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/bookhive_2nd";
const client = new Client({ connectionString });

async function test() {
  try {
    await client.connect();
    const res = await client.query("SELECT id, name, email, role, id_number, avatar FROM users");
    console.log("USERS:");
    console.log(res.rows);
  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
  }
}

test();
